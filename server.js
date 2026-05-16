const crypto = require("crypto");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
let Pool = null;
try {
  ({ Pool } = require("pg"));
} catch (_error) {
  Pool = null;
}

const { CARD_DEFINITIONS, PILE_DEFINITIONS, CARD_POOL } = require("./cards");
const createGameEngine = require("./gameEngine");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true },
  transports: ["websocket", "polling"],
});

const engine = createGameEngine(CARD_DEFINITIONS, PILE_DEFINITIONS, CARD_POOL);
const rooms = new Map();
let randomWaitingSocketId = null;
const db = createDbPool();

const reconnectMs = 60_000;
const turnLimitMs = 90_000;
const pendingLimitMs = 30_000;
const cleanupMs = 6 * 60 * 60 * 1000;

function roomAudit(room, event, detail = {}) {
  const payload = {
    roomId: room?.id || "unknown",
    status: room?.gameStatus || "unknown",
    gameStarted: Boolean(room?.gameStarted),
    ...detail,
  };
  const line = `[room:${payload.roomId}] ${event}`;
  if (event.includes("blocked") || event.includes("delete") || event.includes("disconnect")) {
    console.warn(line, payload);
  } else {
    console.log(line, payload);
  }
}

function touchRoom(room, reason = "updated") {
  const now = Date.now();
  room.updatedAt = now;
  room.lastUpdatedAt = now;
  room.lastUpdateReason = reason;
}

function createDbPool() {
  if (!process.env.DATABASE_URL || !Pool) {
    if (process.env.DATABASE_URL && !Pool) console.warn("DATABASE_URL is set, but pg is not installed.");
    return null;
  }
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
  });
}

let leaderboardReady = false;
async function ensureLeaderboardTable() {
  if (!db || leaderboardReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id SERIAL PRIMARY KEY,
      player_name VARCHAR(16) NOT NULL,
      avatar_id TEXT NOT NULL,
      mode VARCHAR(32) NOT NULL,
      difficulty VARCHAR(16) NOT NULL,
      win_streak INTEGER NOT NULL CHECK (win_streak >= 1),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  leaderboardReady = true;
}

function sanitizeLeaderboardEntry(body) {
  const playerName = sanitizeText(body.player_name || body.playerName || "").slice(0, 16);
  const avatarId = sanitizeText(body.avatar_id || body.avatarId || "").slice(0, 3000);
  const mode = sanitizeText(body.mode || "");
  const difficulty = sanitizeText(body.difficulty || "");
  const winStreak = Number(body.win_streak ?? body.winStreak);
  if (!playerName) return { ok: false, message: "プレイヤー名が不正です。" };
  if (!avatarId) return { ok: false, message: "アイコンが不正です。" };
  if (mode !== "cpu") return { ok: false, message: "モードが不正です。" };
  if (!["normal", "hard"].includes(difficulty)) return { ok: false, message: "難易度が不正です。" };
  if (!Number.isInteger(winStreak) || winStreak < 1 || winStreak > 9999) return { ok: false, message: "連勝数が不正です。" };
  return {
    ok: true,
    entry: {
      player_name: playerName,
      avatar_id: avatarId,
      mode,
      difficulty,
      win_streak: winStreak,
    },
  };
}

function sanitizeText(value) {
  return String(value || "")
    .replace(/[<>\r\n\t]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

app.use(express.json({ limit: "16kb" }));
app.use(express.static(__dirname));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

app.get("/api/leaderboard", async (_req, res) => {
  if (!db) return res.json({ entries: [] });
  try {
    await ensureLeaderboardTable();
    const result = await db.query(`
      SELECT id, player_name, avatar_id, mode, difficulty, win_streak, created_at
      FROM leaderboard
      ORDER BY win_streak DESC, created_at ASC
      LIMIT 50
    `);
    res.json({ entries: result.rows });
  } catch (error) {
    console.error("leaderboard get failed", error);
    res.status(500).json({ message: "ランキングを取得できません。" });
  }
});

app.post("/api/leaderboard", async (req, res) => {
  if (!db) return res.status(503).json({ message: "ランキングDBが設定されていません。" });
  const parsed = sanitizeLeaderboardEntry(req.body || {});
  if (!parsed.ok) return res.status(400).json({ message: parsed.message });
  try {
    await ensureLeaderboardTable();
    const result = await db.query(
      `INSERT INTO leaderboard (player_name, avatar_id, mode, difficulty, win_streak)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, player_name, avatar_id, mode, difficulty, win_streak, created_at`,
      [parsed.entry.player_name, parsed.entry.avatar_id, parsed.entry.mode, parsed.entry.difficulty, parsed.entry.win_streak],
    );
    res.status(201).json({ entry: result.rows[0] });
  } catch (error) {
    console.error("leaderboard post failed", error);
    res.status(500).json({ message: "ランキングを保存できません。" });
  }
});

io.on("connection", (socket) => {
  socket.data.roomId = null;
  socket.data.playerId = null;
  socket.data.playerMeta = null;

  socket.on("room:create", (payload = {}, reply) => {
    const room = createRoom();
    const token = createPlayerToken();
    joinRoom(socket, room, 0, token);
    setPlayerMeta(room, 0, payload.player || {});
    reply?.({ ok: true, roomId: room.id, password: room.id, playerId: 0, playerToken: token });
    broadcastRoom(room);
  });

  socket.on("room:random", (payload = {}, reply) => {
    const waitingSocket = randomWaitingSocketId ? io.sockets.sockets.get(randomWaitingSocketId) : null;
    if (waitingSocket && waitingSocket.id !== socket.id && !waitingSocket.data.roomId) {
      randomWaitingSocketId = null;
      const room = createRoom();
      const token0 = createPlayerToken();
      const token1 = createPlayerToken();
      joinRoom(waitingSocket, room, 0, token0);
      joinRoom(socket, room, 1, token1);
      setPlayerMeta(room, 0, waitingSocket.data.playerMeta || {});
      setPlayerMeta(room, 1, payload.player || {});
      const started = startRoomGame(room, { caller: "room:random", reason: "initial-random-match" });
      if (!started.ok) return reply?.({ ok: false, message: started.message });
      io.to(waitingSocket.id).emit("room:matched", { ok: true, roomId: room.id, playerId: 0, playerToken: token0, random: true });
      reply?.({ ok: true, roomId: room.id, playerId: 1, playerToken: token1, random: true });
      broadcastRoom(room);
      return;
    }
    randomWaitingSocketId = socket.id;
    socket.data.playerMeta = sanitizePlayerMeta(payload.player || {});
    reply?.({ ok: true, waiting: true });
  });

  socket.on("room:join", (payload = {}, reply) => {
    const key = String(payload.password || payload.roomId || "").trim().toUpperCase();
    const room = rooms.get(key);
    if (!room) return reply?.({ ok: false, message: "部屋が見つかりません。" });
    const seat = nextOpenSeat(room);
    if (seat === null) return reply?.({ ok: false, message: "この部屋は満員です。" });
    const token = createPlayerToken();
    joinRoom(socket, room, seat, token);
    setPlayerMeta(room, seat, payload.player || {});
    if (room.players[0].token && room.players[1].token && room.gameStatus === "waiting") {
      const started = startRoomGame(room, { caller: "room:join", reason: "initial-two-players-ready" });
      if (!started.ok) return reply?.({ ok: false, message: started.message });
    }
    reply?.({ ok: true, roomId: room.id, password: room.id, playerId: seat, playerToken: token });
    broadcastRoom(room);
  });

  socket.on("room:reconnect", (payload = {}, reply) => {
    const room = rooms.get(String(payload.roomId || "").trim().toUpperCase());
    const token = String(payload.playerToken || "");
    if (!room || !token) return reply?.({ ok: false, message: "復帰できる部屋がありません。" });
    const playerId = room.players.findIndex((player) => player.token === token);
    if (playerId === -1) return reply?.({ ok: false, message: "復帰情報が一致しません。" });
    const player = room.players[playerId];
    if (player.reconnectDeadline && Date.now() > player.reconnectDeadline) {
      return reply?.({ ok: false, message: "復帰期限を過ぎています。" });
    }
    attachSocketToPlayer(socket, room, playerId);
    player.connected = true;
    player.disconnectedAt = null;
    player.reconnectDeadline = null;
    room.gameStatus = room.game?.winner === null ? "playing" : room.gameStatus;
    roomAudit(room, "reconnect", { playerId, socketId: socket.id });
    addRoomLog(room, `${room.playerMeta[playerId].name}が復帰しました。`);
    touchRoom(room, "reconnect");
    reply?.({ ok: true, roomId: room.id, playerId, playerToken: token });
    broadcastRoom(room);
  });

  socket.on("room:rematch", (_payload, reply) => {
    const room = getSocketRoom(socket);
    if (!room || !room.players[0].token || !room.players[1].token) return reply?.({ ok: false, message: "連戦できる相手がいません。" });
    const started = startRoomGame(room, { caller: "room:rematch", reason: "rematch" });
    if (!started.ok) return reply?.({ ok: false, message: started.message });
    reply?.({ ok: true, roomId: room.id, playerToken: room.players[socket.data.playerId].token });
    broadcastRoom(room);
  });

  socket.on("game:action", (payload = {}, reply) => {
    const room = getSocketRoom(socket);
    const playerId = socket.data.playerId;
    if (!room || playerId === null || playerId === undefined) return reply?.({ ok: false, message: "部屋に参加していません。" });
    if (room.gameStatus !== "playing" || !room.game || room.game.winner !== null) return reply?.({ ok: false, message: "対戦中ではありません。" });
    if (!room.players[playerId].connected) return reply?.({ ok: false, message: "接続状態を確認しています。" });
    if (hasDisconnectedOpponent(room, playerId)) return reply?.({ ok: false, message: "相手の再接続待ちです。" });
    if (!isAllowedDuringPending(room.game, playerId, payload.type)) return reply?.({ ok: false, message: "効果処理中です。必要な選択を先に完了してください。" });

    const activeBefore = room.game.activePlayer;
    const result = applyAction(room.game, playerId, payload);
    if (result.ok) {
      room.lastActionAt = Date.now();
      room.players[playerId].timeoutCount = 0;
      if (room.game.activePlayer !== activeBefore) room.turnStartedAt = Date.now();
      refreshRoomTimers(room);
      touchRoom(room, `action:${payload.type || "unknown"}`);
    }
    reply?.({
      ok: result.ok,
      message: result.message || room.game.lastMessage,
      drawnCards: filterDrawnCards(result.drawnCards, playerId),
      discardedDrawCards: filterDrawnCards(result.discardedDrawCards, playerId),
    });
    broadcastRoom(room);
  });

  socket.on("room:leave", () => leaveSocketRoom(socket, { intentional: true }));
  socket.on("disconnect", () => leaveSocketRoom(socket, { intentional: false }));
});

function createRoom() {
  let id = "";
  do {
    id = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (rooms.has(id));
  const now = Date.now();
  const room = {
    id,
    roomId: id,
    players: [createEmptySeat(0), createEmptySeat(1)],
    playerMeta: [defaultPlayerMeta(0), defaultPlayerMeta(1)],
    game: null,
    gameState: null,
    gameLog: [],
    gameStatus: "waiting",
    started: false,
    gameStarted: false,
    createdAt: now,
    lastUpdatedAt: now,
    resetReason: "not-started",
    lastStartCaller: null,
    lastInitializeCaller: null,
    lastUpdateReason: "created",
    lastActionAt: now,
    turnStartedAt: null,
    pendingStartedAt: null,
    updatedAt: now,
  };
  rooms.set(id, room);
  roomAudit(room, "room created", { createdAt: room.createdAt });
  return room;
}

function createEmptySeat(playerId) {
  return {
    playerId,
    socketId: null,
    token: null,
    connected: false,
    disconnectedAt: null,
    reconnectDeadline: null,
    timeoutCount: 0,
  };
}

function createPlayerToken() {
  return crypto.randomBytes(24).toString("hex");
}

function startRoomGame(room, options = {}) {
  const caller = options.caller || "unknown";
  const reason = options.reason || "initial";
  room.lastStartCaller = caller;
  roomAudit(room, "startGame requested", { caller, reason, winner: room.game?.winner ?? null });

  const isRematch = reason === "rematch";
  const playingOrReconnecting = room.gameStatus === "playing" || room.gameStatus === "reconnecting";
  if (playingOrReconnecting) {
    const message = "進行中の部屋ではゲームを初期化できません。";
    room.resetReason = `blocked:${reason}`;
    roomAudit(room, "initializeGame blocked: gameStatus is active", { caller, reason });
    return { ok: false, message };
  }
  if (room.gameStarted && room.game && room.game.winner === null) {
    const message = "進行中の部屋ではゲームを初期化できません。";
    room.resetReason = `blocked:${reason}`;
    roomAudit(room, "initializeGame blocked: game already started", { caller, reason });
    return { ok: false, message };
  }
  if (isRematch && room.gameStatus !== "finished" && room.game?.winner === null) {
    const message = "決着前に連戦開始はできません。";
    room.resetReason = `blocked:${reason}`;
    roomAudit(room, "initializeGame blocked: rematch before finish", { caller, reason });
    return { ok: false, message };
  }
  if (!isRematch && room.gameStarted) {
    const message = "この部屋はすでに開始済みです。復帰してください。";
    room.resetReason = `blocked:${reason}`;
    roomAudit(room, "initializeGame blocked: unexpected second start", { caller, reason });
    return { ok: false, message };
  }

  room.lastInitializeCaller = caller;
  room.resetReason = reason;
  roomAudit(room, "initializeGame executed", { caller, reason });
  room.started = true;
  room.gameStarted = true;
  room.gameStatus = "playing";
  room.game = engine.createGame();
  room.game.players[0].name = room.playerMeta[0].name;
  room.game.players[0].avatar = room.playerMeta[0].avatar;
  room.game.players[1].name = room.playerMeta[1].name;
  room.game.players[1].avatar = room.playerMeta[1].avatar;
  room.game.lastMessage = "2人そろいました。山札を選んでドローしてください。";
  room.game.log.unshift("オンライン対戦を開始しました。");
  room.game.log.unshift(`初期化理由: ${reason} / 呼び出し元: ${caller}`);
  room.players.forEach((player) => {
    player.timeoutCount = 0;
    player.disconnectedAt = null;
    player.reconnectDeadline = null;
  });
  room.lastActionAt = Date.now();
  room.turnStartedAt = Date.now();
  room.pendingStartedAt = null;
  touchRoom(room, `initialize:${reason}`);
  return { ok: true };
}

function joinRoom(socket, room, playerId, token) {
  leaveSocketRoom(socket, { intentional: true, silent: true });
  room.players[playerId] = {
    ...room.players[playerId],
    playerId,
    socketId: socket.id,
    token,
    connected: true,
    disconnectedAt: null,
    reconnectDeadline: null,
  };
  attachSocketToPlayer(socket, room, playerId);
  roomAudit(room, "player joined", { playerId, socketId: socket.id, hasToken: Boolean(token) });
  touchRoom(room, `join:${playerId}`);
}

function attachSocketToPlayer(socket, room, playerId) {
  const previousSocketId = room.players[playerId].socketId;
  if (previousSocketId && previousSocketId !== socket.id) {
    const previousSocket = io.sockets.sockets.get(previousSocketId);
    previousSocket?.leave(room.id);
    if (previousSocket) {
      previousSocket.data.roomId = null;
      previousSocket.data.playerId = null;
    }
  }
  room.players[playerId].socketId = socket.id;
  socket.data.roomId = room.id;
  socket.data.playerId = playerId;
  socket.join(room.id);
}

function defaultPlayerMeta(playerId) {
  return { name: `プレイヤー${playerId + 1}`, avatar: playerId === 0 ? "assets/player.png" : "assets/enemy.png" };
}

function sanitizePlayerMeta(meta = {}, playerId = 0) {
  const fallback = defaultPlayerMeta(playerId);
  const name = String(meta.name || "").trim().slice(0, 16) || fallback.name;
  const avatar = String(meta.avatar || "").trim().slice(0, 3000) || fallback.avatar;
  return { name, avatar };
}

function setPlayerMeta(room, playerId, meta = {}) {
  room.playerMeta[playerId] = sanitizePlayerMeta(meta, playerId);
}

function leaveSocketRoom(socket, options = {}) {
  if (randomWaitingSocketId === socket.id) randomWaitingSocketId = null;
  const room = getSocketRoom(socket);
  if (!room) return;
  const playerId = socket.data.playerId;
  const seat = playerId === 0 || playerId === 1 ? room.players[playerId] : null;
  socket.leave(room.id);
  socket.data.roomId = null;
  socket.data.playerId = null;
  if (!seat || seat.socketId !== socket.id) return;

  roomAudit(room, options.intentional ? "player leave" : "player disconnect", {
    playerId,
    socketId: socket.id,
    intentional: Boolean(options.intentional),
    silent: Boolean(options.silent),
  });

  if (options.intentional && room.gameStatus === "playing" && room.game?.winner === null) {
    engine.surrender(room.game, playerId);
    room.gameStatus = "finished";
    addRoomLog(room, `${room.playerMeta[playerId].name}が退出しました。`);
  }

  if (options.intentional || room.gameStatus === "waiting" || room.gameStatus === "finished") {
    room.players[playerId] = createEmptySeat(playerId);
  } else {
    seat.connected = false;
    seat.socketId = null;
    seat.disconnectedAt = Date.now();
    seat.reconnectDeadline = Date.now() + reconnectMs;
    room.gameStatus = "reconnecting";
    addRoomLog(room, `${room.playerMeta[playerId].name}が切断しました。60秒待機中です。`);
  }

  touchRoom(room, options.intentional ? "leave" : "disconnect");
  if (!room.players[0].token && !room.players[1].token) deleteRoom(room, "no players remaining");
  else if (!options.silent) broadcastRoom(room);
}

function deleteRoom(room, reason) {
  room.resetReason = `room-delete:${reason}`;
  roomAudit(room, "room delete", { reason, lastUpdatedAt: room.lastUpdatedAt, createdAt: room.createdAt });
  rooms.delete(room.id);
}

function getSocketRoom(socket) {
  return socket.data.roomId ? rooms.get(socket.data.roomId) : null;
}

function nextOpenSeat(room) {
  if (!room.players[0].token) return 0;
  if (!room.players[1].token) return 1;
  return null;
}

function hasDisconnectedOpponent(room, playerId) {
  const opponent = room.players[playerId === 0 ? 1 : 0];
  return Boolean(opponent.token && !opponent.connected && opponent.reconnectDeadline);
}

function addRoomLog(room, message) {
  if (!message || !room.game) return;
  room.game.lastMessage = message;
  room.game.log.unshift(message);
  room.game.log = room.game.log.slice(0, 32);
}

function applyAction(game, playerId, payload) {
  switch (payload.type) {
    case "draw":
      return engine.drawFromPile(game, playerId, payload.pileId);
    case "summon":
      return engine.summonFromHand(game, playerId, payload.handIndex, payload.payload || {});
    case "equip":
      return engine.equipItemFromHand(game, playerId, payload.handIndex, payload.unitId);
    case "playAction":
      return engine.playAction(game, playerId, payload.handIndex, payload.payload || {});
    case "quickReplay":
      return engine.resolvePendingQuickReplay(game, playerId, payload.payload || {});
    case "doubleCheck":
      return engine.resolvePendingOpponentHandCheck(game, playerId, payload.opponentHandIndex);
    case "discardSelection":
      return engine.resolvePendingDiscardSelection(game, playerId, payload.handIndexes);
    case "discardTake":
      return engine.resolvePendingDiscardTake(game, playerId, payload.discardIndex);
    case "pileDrawSelection":
      return engine.resolvePendingPileDrawSelection(game, playerId, payload.pileIds);
    case "pileSearch":
      return engine.resolvePendingPileSearch(game, playerId, payload.pileIndexes);
    case "attackLife":
      return engine.attackLife(game, playerId, payload.attackerId);
    case "attackLifeAll":
      return engine.attackLifeWithAll(game, playerId);
    case "attackMonster":
      return engine.attackMonster(game, playerId, payload.attackerId, payload.defenderId);
    case "unitAbility":
      return engine.useUnitAbility(game, playerId, payload);
    case "gainLife":
      return engine.gainLifeWithUnit(game, playerId, payload.unitId);
    case "endTurn":
      return engine.endTurn(game, playerId);
    case "surrender":
      return engine.surrender(game, playerId);
    default:
      return { ok: false, message: "不明な操作です。" };
  }
}

function pendingInfo(game) {
  const entries = [
    ["quickReplay", game.pendingQuickReplay, "quickReplay"],
    ["doubleCheck", game.pendingOpponentHandCheck, "doubleCheck"],
    ["discardSelection", game.pendingDiscardSelection, "discardSelection"],
    ["discardTake", game.pendingDiscardTake, "discardTake"],
    ["pileDrawSelection", game.pendingPileDrawSelection, "pileDrawSelection"],
    ["pileSearch", game.pendingPileSearch, "pileSearch"],
  ];
  const found = entries.find(([, value]) => Boolean(value));
  if (!found) return null;
  return { kind: found[0], data: found[1], actionType: found[2], playerId: found[1].playerId };
}

function isAllowedDuringPending(game, playerId, actionType) {
  const pending = pendingInfo(game);
  if (!pending) return true;
  if (["surrender", "endTurn"].includes(actionType)) return true;
  return pending.playerId === playerId && pending.actionType === actionType;
}

function refreshRoomTimers(room) {
  if (!room.game) return;
  room.gameState = room.game;
  room.gameLog = [...room.game.log];
  if (room.game.winner !== null) {
    room.gameStatus = "finished";
    room.pendingStartedAt = null;
    return;
  }
  const pending = pendingInfo(room.game);
  if (pending) {
    if (!room.pendingStartedAt) room.pendingStartedAt = Date.now();
  } else {
    room.pendingStartedAt = null;
  }
  if (room.gameStatus !== "reconnecting") room.gameStatus = "playing";
}

function processRoomTimers(room) {
  if (!room.game || room.game.winner !== null) {
    refreshRoomTimers(room);
    return;
  }
  const now = Date.now();
  let changed = false;

  room.players.forEach((player, playerId) => {
    if (player.token && !player.connected && player.reconnectDeadline && now > player.reconnectDeadline && room.game.winner === null) {
      engine.surrender(room.game, playerId);
      room.gameStatus = "finished";
      addRoomLog(room, `${room.playerMeta[playerId].name}が60秒以内に戻らなかったため、切断負けになりました。`);
      changed = true;
    }
  });

  if (room.game.winner === null && room.pendingStartedAt && now - room.pendingStartedAt > pendingLimitMs) {
    const pending = pendingInfo(room.game);
    const playerId = pending?.playerId ?? room.game.activePlayer;
    const result = engine.endTurn(room.game, playerId);
    if (result.ok) {
      addRoomLog(room, "効果処理が30秒以上続いたため、安全のためターンを終了しました。");
      room.lastActionAt = now;
      room.turnStartedAt = now;
      changed = true;
    }
  }

  if (room.game.winner === null && room.gameStatus === "playing" && room.turnStartedAt && now - room.turnStartedAt > turnLimitMs) {
    const playerId = room.game.activePlayer;
    room.players[playerId].timeoutCount += 1;
    if (room.players[playerId].timeoutCount >= 3) {
      engine.surrender(room.game, playerId);
      addRoomLog(room, `${room.playerMeta[playerId].name}は3回連続で時間切れになったため敗北しました。`);
      room.gameStatus = "finished";
    } else {
      engine.endTurn(room.game, playerId);
      addRoomLog(room, `${room.playerMeta[playerId].name}は90秒操作がなかったため自動でターン終了しました。`);
      room.turnStartedAt = now;
      room.lastActionAt = now;
    }
    changed = true;
  }

  refreshRoomTimers(room);
  if (changed) touchRoom(room, "timer");
  if (changed || room.players.some((player) => player.connected)) broadcastRoom(room);
}

function filterDrawnCards(drawnCards, playerId) {
  return playerId === undefined || playerId === null ? [] : (drawnCards || []);
}

function broadcastRoom(room) {
  refreshRoomTimers(room);
  touchRoom(room, "broadcast");
  [0, 1].forEach((playerId) => {
    const player = room.players[playerId];
    if (!player.socketId || !player.connected) return;
    io.to(player.socketId).emit("room:state", buildRoomState(room, playerId));
  });
}

function buildRoomState(room, playerId) {
  const opponentId = playerId === 0 ? 1 : 0;
  const now = Date.now();
  const reconnectRemainingMs = room.players[opponentId].reconnectDeadline
    ? Math.max(0, room.players[opponentId].reconnectDeadline - now)
    : 0;
  const turnRemainingMs = room.turnStartedAt && room.gameStatus === "playing" && room.game?.winner === null
    ? Math.max(0, turnLimitMs - (now - room.turnStartedAt))
    : 0;
  const view = room.started ? engine.getPublicState(room.game, playerId) : createWaitingView(room, playerId);
  view.players.forEach((player, index) => {
    player.name = room.playerMeta[index]?.name || player.name;
    player.avatar = room.playerMeta[index]?.avatar || player.avatar || defaultPlayerMeta(index).avatar;
  });
  return {
    roomId: room.id,
    playerId,
    playerToken: room.players[playerId].token,
    started: room.started,
    gameStarted: room.gameStarted,
    gameStatus: room.gameStatus,
    createdAt: room.createdAt,
    lastUpdatedAt: room.lastUpdatedAt,
    resetReason: room.resetReason,
    lastStartCaller: room.lastStartCaller,
    lastInitializeCaller: room.lastInitializeCaller,
    opponentConnected: Boolean(room.players[opponentId].connected),
    reconnectRemainingMs,
    turnRemainingMs,
    turnLimitMs,
    timeoutCounts: room.players.map((player) => player.timeoutCount),
    connected: room.players.map((player) => player.connected),
    pending: pendingInfo(room.game || {})?.kind || null,
    lastActionAt: room.lastActionAt,
    turnStartedAt: room.turnStartedAt,
    playerMeta: room.playerMeta,
    view,
  };
}

function createWaitingView(room, viewerId) {
  return {
    activePlayer: 0,
    firstPlayer: 0,
    turn: 0,
    winner: null,
    doubleNextAction: null,
    pendingQuickReplay: null,
    pendingOpponentHandCheck: null,
    pendingDiscardSelection: null,
    pendingDiscardTake: null,
    pendingPileDrawSelection: null,
    pendingPileSearch: null,
    lastPlayedAction: null,
    maxFieldSize: 3,
    maxHandSize: 10,
    lastMessage: "相手の参加待ちです。2人そろうとバトルスタートして初期手札を配ります。",
    log: [`部屋ID: ${room.id}`],
    discard: [],
    piles: PILE_DEFINITIONS.map((pile) => ({ id: pile.id, name: pile.name, count: 0, topCardId: null })),
    players: [0, 1].map((playerId) => ({
      name: room.playerMeta[playerId]?.name || (playerId === viewerId ? `あなた プレイヤー${playerId + 1}` : `相手 プレイヤー${playerId + 1}`),
      avatar: room.playerMeta[playerId]?.avatar || "",
      life: 12,
      actions: 0,
      hasDrawnThisTurn: false,
      handCount: 0,
      hand: [],
      field: [],
    })),
  };
}

setInterval(() => {
  for (const room of rooms.values()) processRoomTimers(room);
}, 1000).unref();

setInterval(() => {
  const deadline = Date.now() - cleanupMs;
  for (const [id, room] of rooms) {
    if (room.updatedAt < deadline) deleteRoom(room, "cleanup timeout");
  }
}, 1000 * 60 * 30).unref();

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  console.log(`Card duel server listening on ${port}`);
});

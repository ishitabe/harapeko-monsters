const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

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

app.use(express.static(__dirname));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

io.on("connection", (socket) => {
  socket.data.roomId = null;
  socket.data.playerId = null;

  socket.on("room:create", (payload = {}, reply) => {
    const room = createRoom();
    joinRoom(socket, room, 0);
    setPlayerMeta(room, 0, payload.player || {});
    reply?.({ ok: true, roomId: room.id, password: room.id, playerId: 0 });
    broadcastRoom(room);
  });

  socket.on("room:random", (payload = {}, reply) => {
    const waitingSocket = randomWaitingSocketId ? io.sockets.sockets.get(randomWaitingSocketId) : null;
    if (waitingSocket && waitingSocket.id !== socket.id && !waitingSocket.data.roomId) {
      randomWaitingSocketId = null;
      const room = createRoom();
      joinRoom(waitingSocket, room, 0);
      joinRoom(socket, room, 1);
      setPlayerMeta(room, 0, waitingSocket.data.playerMeta || {});
      setPlayerMeta(room, 1, payload.player || {});
      startRoomGame(room);
      reply?.({ ok: true, roomId: room.id, playerId: 1, random: true });
      broadcastRoom(room);
      return;
    }
    randomWaitingSocketId = socket.id;
    socket.data.playerMeta = sanitizePlayerMeta(payload.player || {});
    reply?.({ ok: true, waiting: true });
  });

  socket.on("room:join", (payload = {}, reply) => {
    const { roomId, password } = payload;
    const key = String(password || roomId || "").trim().toUpperCase();
    const room = rooms.get(key);
    if (!room) return reply?.({ ok: false, message: "部屋が見つかりません。" });
    const seat = nextOpenSeat(room);
    if (seat === null) return reply?.({ ok: false, message: "この部屋は満員です。" });
    joinRoom(socket, room, seat);
    setPlayerMeta(room, seat, payload.player || {});
    if (room.players[0] && room.players[1] && !room.started) {
      startRoomGame(room);
    }
    reply?.({ ok: true, roomId: room.id, password: room.id, playerId: seat });
    broadcastRoom(room);
  });

  socket.on("room:rematch", (_payload, reply) => {
    const room = getSocketRoom(socket);
    if (!room || !room.players[0] || !room.players[1]) return reply?.({ ok: false, message: "連戦できる相手がいません。" });
    startRoomGame(room);
    reply?.({ ok: true, roomId: room.id });
    broadcastRoom(room);
  });

  socket.on("game:action", (payload = {}, reply) => {
    const room = getSocketRoom(socket);
    const playerId = socket.data.playerId;
    if (!room || playerId === null || playerId === undefined) return reply?.({ ok: false, message: "部屋に参加していません。" });
    if (!room.started) return reply?.({ ok: false, message: "相手の参加待ちです。" });
    const result = applyAction(room.game, playerId, payload);
    reply?.({
      ok: result.ok,
      message: result.message || room.game.lastMessage,
      drawnCards: filterDrawnCards(result.drawnCards, playerId),
      discardedDrawCards: filterDrawnCards(result.discardedDrawCards, playerId),
    });
    broadcastRoom(room);
  });

  socket.on("room:leave", () => leaveSocketRoom(socket));
  socket.on("disconnect", () => leaveSocketRoom(socket));
});

function createRoom() {
  let id = "";
  do {
    id = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (rooms.has(id));
  const room = {
    id,
    game: null,
    players: [null, null],
    playerMeta: [defaultPlayerMeta(0), defaultPlayerMeta(1)],
    started: false,
    updatedAt: Date.now(),
  };
  rooms.set(id, room);
  return room;
}

function startRoomGame(room) {
  room.started = true;
  room.game = engine.createGame();
  room.game.players[0].name = room.playerMeta[0].name;
  room.game.players[0].avatar = room.playerMeta[0].avatar;
  room.game.players[1].name = room.playerMeta[1].name;
  room.game.players[1].avatar = room.playerMeta[1].avatar;
  room.game.lastMessage = "2人そろいました。山札を選んでドローしてください。";
  room.game.log.unshift("オンライン対戦を開始しました。");
  room.updatedAt = Date.now();
}

function filterDrawnCards(drawnCards, playerId) {
  return playerId === undefined || playerId === null ? [] : (drawnCards || []);
}

function joinRoom(socket, room, playerId) {
  leaveSocketRoom(socket);
  room.players[playerId] = socket.id;
  socket.data.roomId = room.id;
  socket.data.playerId = playerId;
  socket.join(room.id);
  room.updatedAt = Date.now();
}

function defaultPlayerMeta(playerId) {
  return { name: `プレイヤー${playerId + 1}`, avatar: playerId === 0 ? "assets/player.png" : "assets/enemy.png" };
}

function sanitizePlayerMeta(meta = {}, playerId = 0) {
  const fallback = defaultPlayerMeta(playerId);
  const name = String(meta.name || "").trim().slice(0, 16) || fallback.name;
  const avatar = String(meta.avatar || "").trim().slice(0, 120) || fallback.avatar;
  return { name, avatar };
}

function setPlayerMeta(room, playerId, meta = {}) {
  room.playerMeta[playerId] = sanitizePlayerMeta(meta, playerId);
}

function leaveSocketRoom(socket) {
  if (randomWaitingSocketId === socket.id) randomWaitingSocketId = null;
  const room = getSocketRoom(socket);
  if (!room) return;
  const playerId = socket.data.playerId;
  if (playerId === 0 || playerId === 1) room.players[playerId] = null;
  socket.leave(room.id);
  socket.data.roomId = null;
  socket.data.playerId = null;
  room.updatedAt = Date.now();
  if (!room.players[0] && !room.players[1]) rooms.delete(room.id);
  else broadcastRoom(room);
}

function getSocketRoom(socket) {
  return socket.data.roomId ? rooms.get(socket.data.roomId) : null;
}

function nextOpenSeat(room) {
  if (!room.players[0]) return 0;
  if (!room.players[1]) return 1;
  return null;
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

function broadcastRoom(room) {
  room.updatedAt = Date.now();
  [0, 1].forEach((playerId) => {
    const socketId = room.players[playerId];
    if (!socketId) return;
    io.to(socketId).emit("room:state", {
      roomId: room.id,
      playerId,
      started: room.started,
      opponentConnected: Boolean(room.players[playerId === 0 ? 1 : 0]),
      view: room.started ? engine.getPublicState(room.game, playerId) : createWaitingView(room, playerId),
    });
  });
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
  const deadline = Date.now() - 1000 * 60 * 60 * 6;
  for (const [id, room] of rooms) {
    if (room.updatedAt < deadline) rooms.delete(id);
  }
}, 1000 * 60 * 30).unref();

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  console.log(`Card duel server listening on ${port}`);
});

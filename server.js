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

app.use(express.static(__dirname));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

io.on("connection", (socket) => {
  socket.data.roomId = null;
  socket.data.playerId = null;

  socket.on("room:create", (_payload, reply) => {
    const room = createRoom();
    joinRoom(socket, room, 0);
    reply?.({ ok: true, roomId: room.id, playerId: 0 });
    broadcastRoom(room);
  });

  socket.on("room:join", ({ roomId } = {}, reply) => {
    const room = rooms.get(String(roomId || "").trim().toUpperCase());
    if (!room) return reply?.({ ok: false, message: "部屋が見つかりません。" });
    const seat = nextOpenSeat(room);
    if (seat === null) return reply?.({ ok: false, message: "この部屋は満員です。" });
    joinRoom(socket, room, seat);
    if (room.players[0] && room.players[1] && !room.started) {
      room.started = true;
      room.game = engine.createGame();
      room.game.players[0].name = "プレイヤー1";
      room.game.players[1].name = "プレイヤー2";
      room.game.lastMessage = "2人そろいました。プレイヤー1から開始です。山札を選んでドローしてください。";
      room.game.log.unshift("オンライン対戦を開始しました。");
    }
    reply?.({ ok: true, roomId: room.id, playerId: seat });
    broadcastRoom(room);
  });

  socket.on("game:action", (payload = {}, reply) => {
    const room = getSocketRoom(socket);
    const playerId = socket.data.playerId;
    if (!room || playerId === null || playerId === undefined) return reply?.({ ok: false, message: "部屋に参加していません。" });
    if (!room.started) return reply?.({ ok: false, message: "相手の参加待ちです。" });
    const result = applyAction(room.game, playerId, payload);
    reply?.({ ok: result.ok, message: result.message || room.game.lastMessage });
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
    started: false,
    updatedAt: Date.now(),
  };
  rooms.set(id, room);
  return room;
}

function joinRoom(socket, room, playerId) {
  leaveSocketRoom(socket);
  room.players[playerId] = socket.id;
  socket.data.roomId = room.id;
  socket.data.playerId = playerId;
  socket.join(room.id);
  room.updatedAt = Date.now();
}

function leaveSocketRoom(socket) {
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
      return engine.summonFromHand(game, playerId, payload.handIndex);
    case "equip":
      return engine.equipItemFromHand(game, playerId, payload.handIndex, payload.unitId);
    case "playAction":
      return engine.playAction(game, playerId, payload.handIndex, payload.payload || {});
    case "quickReplay":
      return engine.resolvePendingQuickReplay(game, playerId, payload.payload || {});
    case "doubleCheck":
      return engine.resolvePendingOpponentHandCheck(game, playerId, payload.opponentHandIndex);
    case "attackLife":
      return engine.attackLife(game, playerId, payload.attackerId);
    case "attackMonster":
      return engine.attackMonster(game, playerId, payload.attackerId, payload.defenderId);
    case "gainLife":
      return engine.gainLifeWithUnit(game, playerId, payload.unitId);
    case "endTurn":
      return engine.endTurn(game, playerId);
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
    maxFieldSize: 2,
    lastMessage: "相手の参加待ちです。2人そろうとバトルスタートして初期手札を配ります。",
    log: [`部屋ID: ${room.id}`],
    discard: [],
    piles: PILE_DEFINITIONS.map((pile) => ({ id: pile.id, name: pile.name, count: 0, topCardId: null })),
    players: [0, 1].map((playerId) => ({
      name: playerId === viewerId ? `あなた プレイヤー${playerId + 1}` : `相手 プレイヤー${playerId + 1}`,
      life: 7,
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

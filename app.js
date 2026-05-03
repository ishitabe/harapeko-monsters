(() => {
if (window.__CARD_APP_INITIALIZED) {
  window.__CARD_APP_RENDERED = true;
  return;
}
window.__CARD_APP_INITIALIZED = true;

const { CARD_DEFINITIONS, PILE_DEFINITIONS, CARD_POOL } = window.CardGameCards;
const engine = window.CardGameEngine(CARD_DEFINITIONS, PILE_DEFINITIONS, CARD_POOL);

let game = engine.createGame();
let cpuEnabled = true;
let cpuThinking = false;
let socket = null;
let onlineMode = false;
let onlineState = null;
let onlinePlayerId = 0;
let lastOnlineStarted = false;
let titleActive = true;
let optionsOpen = false;
let titleLobbyOpen = false;
let selectedKey = null;
let detailKey = null;
let detailData = null;
let previousView = null;
const pendingFx = new Map();

const elements = {
  turnLabel: document.querySelector("#turnLabel"),
  actionLabel: document.querySelector("#actionLabel"),
  activeHandLabel: document.querySelector("#activeHandLabel"),
  deckGrid: document.querySelector("#deckGrid"),
  discardPileButton: document.querySelector("#discardPileButton"),
  discardCount: document.querySelector("#discardCount"),
  discardList: document.querySelector("#discardList"),
  handGrid: document.querySelector("#handGrid"),
  opponentHand: document.querySelector("#opponentHand"),
  messageText: document.querySelector("#messageText"),
  logList: document.querySelector("#logList"),
  endTurnButton: document.querySelector("#endTurnButton"),
  resetButton: document.querySelector("#resetButton"),
  optionsButton: document.querySelector("#optionsButton"),
  optionsPanel: document.querySelector("#optionsPanel"),
  closeOptionsButton: document.querySelector("#closeOptionsButton"),
  backTitleButton: document.querySelector("#backTitleButton"),
  titleScreen: document.querySelector("#titleScreen"),
  startCpuButton: document.querySelector("#startCpuButton"),
  startMultiButton: document.querySelector("#startMultiButton"),
  titleLobby: document.querySelector("#titleLobby"),
  titleLobbyStatus: document.querySelector("#titleLobbyStatus"),
  titleLobbyNote: document.querySelector("#titleLobbyNote"),
  titleShareLink: document.querySelector("#titleShareLink"),
  titleCreateRoomButton: document.querySelector("#titleCreateRoomButton"),
  titleJoinRoomButton: document.querySelector("#titleJoinRoomButton"),
  titleRoomIdInput: document.querySelector("#titleRoomIdInput"),
  titleBackButton: document.querySelector("#titleBackButton"),
  onlineStatus: document.querySelector("#onlineStatus"),
  onlineRoomLabel: document.querySelector("#onlineRoomLabel"),
  createRoomButton: document.querySelector("#createRoomButton"),
  joinRoomButton: document.querySelector("#joinRoomButton"),
  leaveRoomButton: document.querySelector("#leaveRoomButton"),
  roomIdInput: document.querySelector("#roomIdInput"),
  detailPanel: document.querySelector("#detailPanel"),
  detailContent: document.querySelector("#detailContent"),
  closeDetailButton: document.querySelector("#closeDetailButton"),
  life: [document.querySelector("#p0Life"), document.querySelector("#p1Life")],
  handCount: [document.querySelector("#p0HandCount"), document.querySelector("#p1HandCount")],
  actions: [document.querySelector("#p0Actions"), document.querySelector("#p1Actions")],
  fields: [document.querySelector("#p0Field"), document.querySelector("#p1Field")],
};

function render() {
  window.__CARD_APP_RENDERED = true;
  const view = getView();
  const selfId = getSelfId();
  const opponentId = selfId === 0 ? 1 : 0;
  const activePlayer = view.players[view.activePlayer];
  const lockedForCpu = !onlineMode && isCpuTurn(view);
  const lockedForOnline = onlineMode && (!onlineState?.started || view.activePlayer !== selfId);
  const locked = lockedForCpu || lockedForOnline;

  elements.turnLabel.textContent = view.winner === null
    ? `${activePlayer.name}のターン ${view.turn}`
    : `決着: ${view.players[view.winner].name}の勝ち`;
  elements.actionLabel.textContent = activePlayer.hasDrawnThisTurn
    ? `アクション ${activePlayer.actions}/2`
    : "山札を選んでドロー";
  elements.activeHandLabel.textContent = "自分の手札";
  elements.messageText.textContent = view.lastMessage;
  elements.endTurnButton.disabled = view.winner !== null || locked;
  document.body.classList.toggle("title-active", titleActive);
  document.body.classList.toggle("title-lobby-active", titleLobbyOpen);
  elements.titleLobby?.classList.toggle("hidden", !titleLobbyOpen);
  elements.optionsPanel?.classList.toggle("hidden", !optionsOpen);
  updateOptionsVisibility();

  renderOnlineStatus();
  renderTitleLobby();
  renderPlayerInfo(view);
  renderOpponentHand(view.players[opponentId].handCount);
  renderDecks(view.piles, activePlayer, view.winner, locked);
  renderDiscard(view.discard);
  renderField(elements.fields[1], view.players[opponentId].field, view.maxFieldSize, view, opponentId);
  renderField(elements.fields[0], view.players[selfId].field, view.maxFieldSize, view, selfId);
  renderHand(view.players[selfId].hand, view, locked);
  renderLog(view.log);
  renderDetail();
  renderPendingDoubleCheck();
  renderPendingQuickReplay();
  flushFx();
  previousView = view;
  if (!onlineMode) scheduleCpuTurn();
}

function getView() {
  return onlineMode && onlineState?.view ? onlineState.view : engine.getPublicState(game, getSelfId());
}

function getSelfId() {
  return onlineMode ? onlinePlayerId : 0;
}

function getOpponentId() {
  return getSelfId() === 0 ? 1 : 0;
}

function isMyTurn(view = getView()) {
  return view.activePlayer === getSelfId();
}

function renderPlayerInfo(view) {
  const slots = [getSelfId(), getOpponentId()];
  slots.forEach((playerId, slotId) => {
    const player = view.players[playerId];
    elements.life[slotId].textContent = `HP ${player.life}`;
    const previousLife = previousView?.players[playerId]?.life;
    elements.life[slotId].classList.remove("life-damage", "life-heal");
    if (previousLife !== undefined && previousLife !== player.life) {
      const className = player.life < previousLife ? "life-damage" : "life-heal";
      elements.life[slotId].classList.add(className);
      showFloat(`${player.life > previousLife ? "+" : ""}${player.life - previousLife}`, player.life < previousLife ? "damage" : "heal");
      setTimeout(() => elements.life[slotId].classList.remove(className), 820);
      playSound(player.life < previousLife ? "damage" : "heal");
    }
    elements.handCount[slotId].textContent = `手札 ${player.handCount}`;
    renderActionLamps(elements.actions[slotId], player.actions, previousView?.players[playerId]?.actions);
  });
}

function renderOnlineStatus() {
  if (!elements.onlineStatus) return;
  if (!onlineMode) {
    elements.onlineStatus.textContent = cpuEnabled ? "CPU対戦" : "マルチ対戦準備";
    elements.onlineRoomLabel.textContent = window.io ? "部屋作成または参加ができます" : "オンラインは npm start で開いた時だけ使えます";
    elements.leaveRoomButton.disabled = true;
    return;
  }
  elements.onlineStatus.textContent = onlineState?.started ? "オンライン対戦中" : "相手待ち";
  elements.onlineRoomLabel.textContent = `部屋 ${onlineState?.roomId || "-"} / あなたはプレイヤー${onlinePlayerId + 1}`;
  elements.leaveRoomButton.disabled = false;
}

function updateOptionsVisibility() {
  const roomControls = [
    elements.createRoomButton,
    elements.roomIdInput,
    elements.joinRoomButton,
  ];
  const showRoomControls = !cpuEnabled && (!onlineMode || !onlineState?.started);
  roomControls.forEach((node) => {
    if (node) node.classList.toggle("hidden", !showRoomControls);
  });
  if (elements.leaveRoomButton) elements.leaveRoomButton.classList.toggle("hidden", !onlineMode);
  if (elements.resetButton) elements.resetButton.classList.toggle("hidden", onlineMode || !cpuEnabled);
}

function renderTitleLobby() {
  if (!elements.titleLobby) return;
  if (!titleLobbyOpen) return;
  if (!onlineMode) {
    elements.titleLobbyStatus.textContent = "マルチ対戦";
    elements.titleLobbyNote.textContent = window.location.protocol === "file:"
      ? "オンライン対戦は npm start で起動したURLから使えます。"
      : "部屋を作るか、共有された部屋IDで参加してください。";
    elements.titleShareLink.textContent = "";
    return;
  }
  if (!onlineState?.started) {
    const link = makeRoomUrl(onlineState?.roomId || elements.titleRoomIdInput.value);
    elements.titleLobbyStatus.textContent = "相手待ち";
    elements.titleLobbyNote.textContent = "このURLを2人目に送ると、開いた時点で部屋IDが入力されます。";
    elements.titleShareLink.textContent = link;
    return;
  }
  elements.titleLobbyStatus.textContent = "バトルスタート";
  elements.titleLobbyNote.textContent = "2人そろいました。初期手札を配って対戦を開始します。";
  elements.titleShareLink.textContent = "";
}

function makeRoomUrl(roomId) {
  if (!roomId) return "";
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomId);
  return url.toString();
}

function renderActionLamps(container, actions, previousActions) {
  container.replaceChildren();
  const label = document.createElement("span");
  label.className = "action-label";
  label.textContent = "アクション権";
  container.append(label);
  for (let index = 0; index < 2; index += 1) {
    const lamp = document.createElement("span");
    const changedOn = previousActions !== undefined && index < actions && index >= previousActions;
    const changedOff = previousActions !== undefined && index >= actions && index < previousActions;
    lamp.className = `lamp ${index < actions ? "on" : ""} ${changedOn ? "lamp-pop" : ""} ${changedOff ? "lamp-fade" : ""}`;
    container.append(lamp);
  }
}

function renderOpponentHand(count) {
  elements.opponentHand.replaceChildren();
  for (let index = 0; index < count; index += 1) {
    const back = document.createElement("div");
    back.className = "card-back";
    back.title = `相手手札 ${index + 1}`;
    elements.opponentHand.append(back);
  }
}

function renderDecks(piles, activePlayer, winner, lockedForCpu) {
  elements.deckGrid.replaceChildren();
  piles.forEach((pile) => {
    const topCard = CARD_DEFINITIONS[pile.topCardId];
    const key = `deck:${pile.id}`;
    const button = document.createElement("button");
    button.dataset.key = key;
    button.className = `deck-card ${topCard ? topCard.type : ""} ${selectedKey === key ? "selected" : ""} ${fxClassFor(key)}`;
    button.type = "button";
    button.disabled = !pile.topCardId;
    button.innerHTML = `
      <div class="deck-thumb">${topCard ? compactCardMarkup(topCard) : ""}</div>
      <div>
        <div class="deck-name">${pile.name}</div>
        ${topCard ? `<div class="card-name">${topCard.name}</div><p class="card-text">${topCard.text}</p>` : "<p class=\"empty-note\">空</p>"}
        <small>残り ${pile.count} 枚</small>
      </div>
    `;
    button.addEventListener("click", () => {
      playSound("select");
      selectDetail(key, topCard, `${pile.name} トップ`, null, { source: "deck" });
      if (winner === null && !lockedForCpu && !activePlayer.hasDrawnThisTurn) {
        addFx(key, "fx-draw");
        playSound("draw");
        runGameAction("draw", { pileId: pile.id }, () => engine.drawFromPile(game, game.activePlayer, pile.id));
        showFloat("DRAW", "draw");
      }
      if (!onlineMode) render();
    });
    elements.deckGrid.append(button);
  });
}

function renderDiscard(discard) {
  elements.discardCount.textContent = `${discard.length}枚`;
  elements.discardList.replaceChildren();

  elements.discardPileButton.onclick = () => {
    if (selectedKey === "discard:pile") clearSelection();
    else {
      selectedKey = "discard:pile";
      detailKey = "discard:pile";
      detailData = { list: discard };
    }
    render();
  };

  if (discard.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = "捨札はまだありません。";
    elements.discardList.append(empty);
    return;
  }

  discard.forEach((cardId, index) => {
    const card = CARD_DEFINITIONS[cardId];
    const key = `discard:${index}`;
    const item = document.createElement("button");
    item.dataset.key = key;
    item.className = `mini-card ${card.type} ${selectedKey === key ? "selected" : ""} ${index === 0 ? "fx-discard-pop" : ""}`;
    item.type = "button";
    item.innerHTML = compactCardMarkup(card);
    item.addEventListener("click", () => {
      playSound("select");
      selectDetail(key, card, "捨札", null, { source: "discard" });
      render();
    });
    elements.discardList.append(item);
  });
}

function renderField(container, field, maxFieldSize, view, playerId) {
  container.replaceChildren();
  container.classList.toggle("wall-active", field.length >= maxFieldSize);
  for (let index = 0; index < maxFieldSize; index += 1) {
    const unit = field[index];
    const slot = document.createElement("article");
    const key = unit ? `field:${playerId}:${unit.id}` : `field-empty:${playerId}:${index}`;
    slot.dataset.key = key;
    const showExhausted = playerId === view.activePlayer && unit && !unit.canAct;
    slot.className = `field-slot ${unit ? `filled ${CARD_DEFINITIONS[unit.cardId].type}` : "empty"} ${showExhausted ? "exhausted" : ""} ${unit && unit.summonedTurn === view.turn ? "fresh" : ""} ${selectedKey === key ? "selected" : ""} ${fxClassFor(key)}`;

    if (!unit) {
      slot.innerHTML = `<span>${playerId === getSelfId() ? "自分" : "相手"} 空き枠 ${index + 1}</span>`;
      container.append(slot);
      continue;
    }

    const card = CARD_DEFINITIONS[unit.cardId];
    slot.innerHTML = `
      ${typeBadge(card.type)}
      <div class="card-name">${card.name}</div>
      <div class="unit-stats">
        <span class="stat-pill hp">HP ${unit.hp}/${unit.maxHp}</span>
        <span class="stat-pill pow">PW ${unit.power}</span>
      </div>
      ${unit.item && unit.item.hasItem ? `<span class="item-badge">${unit.item.visibleCardId ? CARD_DEFINITIONS[unit.item.visibleCardId].name : "持ち物あり"}</span>` : ""}
      <span class="state-badge ${unit.canAct ? "" : "exhausted"}">${unit.canAct ? "行動可" : unit.summonedTurn === view.turn ? "召喚酔い" : "行動済み"}</span>
      <p class="card-text">${card.text}</p>
    `;
    slot.addEventListener("click", () => {
      playSound("select");
      selectDetail(key, card, playerId === getSelfId() ? "自分の場" : "相手の場", unit, { source: "field", ownerId: playerId, unitId: unit.id });
      render();
    });
    container.append(slot);
  }
}

function renderHand(hand, view, lockedForCpu) {
  elements.handGrid.replaceChildren();
  const activePlayer = view.players[view.activePlayer];
  const handOwner = view.players[getSelfId()];

  if (lockedForCpu) {
    const note = document.createElement("p");
    note.className = "empty-note";
    note.textContent = "相手ターン中です。自分の手札は確認できます。";
    elements.handGrid.append(note);
  }

  if (!lockedForCpu && !activePlayer.hasDrawnThisTurn) {
    const note = document.createElement("p");
    note.className = "empty-note";
    note.textContent = "まず左の山札を1つ選んでドローします。";
    elements.handGrid.append(note);
  }

  hand.forEach((cardId, handIndex) => {
    const card = CARD_DEFINITIONS[cardId];
    const key = `hand:${handIndex}`;
    const article = document.createElement("article");
    article.dataset.key = key;
    article.className = `card-shell ${card.type} ${selectedKey === key ? "selected" : ""} ${fxClassFor(key)} ${lockedForCpu || isHandCardDisabled(card, handOwner, view) ? "disabled-card" : ""}`;
    article.innerHTML = cardMarkup(card);
    article.addEventListener("click", () => {
      playSound("select");
      selectDetail(key, card, "自分の手札", null, { source: "hand", handIndex, cardId, locked: lockedForCpu });
      render();
    });
    elements.handGrid.append(article);
  });
}

function renderLog(log) {
  elements.logList.replaceChildren();
  if (log.length === 0) {
    const item = document.createElement("li");
    item.textContent = "ログはまだありません。";
    elements.logList.append(item);
    return;
  }
  log.forEach((entry) => {
    const item = document.createElement("li");
    item.textContent = entry;
    elements.logList.append(item);
  });
}

function renderDetail() {
  if (!detailKey || !detailData) {
    elements.detailPanel.classList.add("hidden");
    elements.detailContent.replaceChildren();
    return;
  }
  elements.detailPanel.classList.remove("hidden");

  if (detailData.list) {
    elements.detailContent.innerHTML = `
      <div class="detail-card">
        <p class="eyebrow">捨札一覧</p>
        <h2>捨札 ${detailData.list.length}枚</h2>
        <div class="discard-list"></div>
      </div>
    `;
    const list = elements.detailContent.querySelector(".discard-list");
    detailData.list.forEach((cardId, index) => {
      const card = CARD_DEFINITIONS[cardId];
      const item = document.createElement("button");
      item.className = `mini-card ${card.type}`;
      item.type = "button";
      item.innerHTML = compactCardMarkup(card);
      item.addEventListener("click", () => {
        selectDetail(`discard-detail:${index}`, card, "捨札", null, { source: "discard" });
        render();
      });
      list.append(item);
    });
    return;
  }

  const { card, zone, unit } = detailData;
  elements.detailContent.innerHTML = `
    <div class="detail-card ${card.type}">
      <p class="eyebrow">${zone}</p>
      ${typeBadge(card.type)}
      <h2>${card.name}</h2>
      ${card.type === "unit" ? `
        <div class="detail-stats">
          <span class="stat-pill hp">HP ${unit ? `${unit.hp}/${unit.maxHp}` : card.hp}</span>
          <span class="stat-pill pow">パワー ${unit ? unit.power : card.power}</span>
        </div>
      ` : ""}
      ${unit && unit.item && unit.item.hasItem ? `<span class="item-badge">${unit.item.visibleCardId ? CARD_DEFINITIONS[unit.item.visibleCardId].name : "持ち物あり"}</span>` : ""}
      <p class="card-text">${card.text}</p>
      <div class="detail-actions" id="detailActions"></div>
    </div>
  `;
  renderDetailActions(elements.detailContent.querySelector("#detailActions"), detailData);
}

function renderPendingDoubleCheck() {
  const view = getView();
  if (!view.pendingOpponentHandCheck || view.pendingOpponentHandCheck.playerId !== getSelfId() || isCpuTurn()) return;
  selectedKey = "pending:doubleCheck";
  detailKey = "pending:doubleCheck";
  detailData = { source: "pendingDoubleCheck", zone: "二重チェック", card: CARD_DEFINITIONS.doubleCheck };
  renderDetail();
}

function renderPendingQuickReplay() {
  const view = getView();
  if (view.pendingOpponentHandCheck) return;
  if (!view.pendingQuickReplay || view.pendingQuickReplay.playerId !== getSelfId() || isCpuTurn()) return;
  const card = CARD_DEFINITIONS[view.pendingQuickReplay.cardId];
  if (!card) return;
  selectedKey = "pending:quickReplay";
  detailKey = "pending:quickReplay";
  detailData = { source: "pendingQuickReplay", zone: "早業 2回目", card };
  renderDetail();
}

function renderDetailActions(container, data) {
  if (!container) return;
  const view = getView();
  const activePlayer = view.players[view.activePlayer];
  const lockedForTurn = !isMyTurn(view) || isCpuTurn(view);
  const disabled = view.winner !== null || lockedForTurn || !activePlayer.hasDrawnThisTurn;
  if (data.locked) {
    const note = document.createElement("p");
    note.className = "empty-note";
    note.textContent = "相手ターン中は操作できません。";
    container.append(note);
    return;
  }

  if (data.source === "pendingDoubleCheck") {
    const opponent = view.players[view.activePlayer === 0 ? 1 : 0];
    opponent.hand.forEach((cardId, index) => {
      container.append(createSmallButton(`${CARD_DEFINITIONS[cardId].name}を捨てる`, false, () => {
        runGameAction("doubleCheck", { opponentHandIndex: index }, () => engine.resolvePendingOpponentHandCheck(game, game.activePlayer, index));
        clearSelection();
        if (!onlineMode) render();
      }));
    });
    return;
  }

  if (data.source === "pendingQuickReplay") {
    renderQuickReplayControls(container, data.card, view);
    return;
  }

  if (data.source === "hand") {
    if (data.card.type === "unit") {
      container.append(createSmallButton("このモンスターを召喚", disabled || activePlayer.actions <= 0 || activePlayer.field.length >= view.maxFieldSize, () => {
        addFx(`hand:${data.handIndex}`, "fx-summon");
        playSound("summon");
        runGameAction("summon", { handIndex: data.handIndex }, () => engine.summonFromHand(game, game.activePlayer, data.handIndex));
        showFloat("SUMMON", "summon");
        clearSelection();
        if (!onlineMode) render();
      }));
    }
    if (data.card.type === "item") {
      if (activePlayer.field.length === 0) {
        const note = document.createElement("p");
        note.className = "empty-note";
        note.textContent = "装備先のモンスターが場にいません。";
        container.append(note);
      }
      activePlayer.field.forEach((unit) => {
        container.append(createSmallButton(`${CARD_DEFINITIONS[unit.cardId].name}に装備`, disabled || Boolean(unit.item?.hasItem), () => {
          addFx(`field:${view.activePlayer}:${unit.id}`, "fx-item");
          playSound("select");
          runGameAction("equip", { handIndex: data.handIndex, unitId: unit.id }, () => engine.equipItemFromHand(game, game.activePlayer, data.handIndex, unit.id));
          showFloat("ITEM", "item");
          clearSelection();
          if (!onlineMode) render();
        }));
      });
    }
    if (data.card.type === "action") {
      renderActionControls(container, data.card, data.handIndex, view);
    }
  }

  if (data.source === "field") {
    if (data.ownerId === view.activePlayer) {
      const unit = activePlayer.field.find((candidate) => candidate.id === data.unitId);
      if (!unit) return;
      const opponentHasWall = view.players[view.activePlayer === 0 ? 1 : 0].field.length >= view.maxFieldSize;
      container.append(createSmallButton(opponentHasWall ? "壁でライフ攻撃不可" : "ライフを攻撃", disabled || !unit.canAct || opponentHasWall, () => {
        addFx(`field:${data.ownerId}:${unit.id}`, "fx-attack");
        playSound("attack");
        runGameAction("attackLife", { attackerId: unit.id }, () => engine.attackLife(game, game.activePlayer, unit.id));
        showFloat("ATTACK", "damage");
        clearSelection();
        if (!onlineMode) render();
      }));
      if (CARD_DEFINITIONS[unit.cardId].effectKey === "attackOrGainLife") {
        container.append(createSmallButton("ライフ+2を選ぶ", disabled || !unit.canAct, () => {
          playSound("heal");
          runGameAction("gainLife", { unitId: unit.id }, () => engine.gainLifeWithUnit(game, game.activePlayer, unit.id));
          showFloat("+2", "heal");
          clearSelection();
          if (!onlineMode) render();
        }));
      }
    } else {
      activePlayer.field.forEach((attacker) => {
        container.append(createSmallButton(`${CARD_DEFINITIONS[attacker.cardId].name}で攻撃`, disabled || !attacker.canAct, () => {
          addFx(`field:${view.activePlayer}:${attacker.id}`, "fx-attack");
          addFx(`field:${data.ownerId}:${data.unitId}`, "fx-hit");
          playSound("attack");
          runGameAction("attackMonster", { attackerId: attacker.id, defenderId: data.unitId }, () => engine.attackMonster(game, game.activePlayer, attacker.id, data.unitId));
          showFloat("HIT", "damage");
          clearSelection();
          if (!onlineMode) render();
        }));
      });
    }
  }
}

function renderActionControls(container, card, handIndex, view) {
  const form = document.createElement("div");
  form.className = "action-form";
  const controls = card.effectKey === "discardOpponentHand" ? {} : createActionInputs(form, card, view, handIndex);

  form.append(createSmallButton("使用する", isActionUseDisabled(card, view), async () => {
    const payload = readActionPayload(controls);
    addFx(`hand:${handIndex}`, "fx-discard");
    playSound("select");
    await animateActionPreview(card);
    runGameAction("playAction", { handIndex, payload }, () => engine.playAction(game, game.activePlayer, handIndex, payload));
    showFloat(card.name, "action");
    clearSelection();
    if (!onlineMode && card.effectKey === "discardOpponentHand" && game.pendingOpponentHandCheck) {
      selectedKey = "pending:doubleCheck";
      detailKey = "pending:doubleCheck";
      detailData = { source: "pendingDoubleCheck", zone: "二重チェック", card };
    }
    if (!onlineMode) render();
  }));
  container.append(form);
}

function renderQuickReplayControls(container, card, view) {
  const form = document.createElement("div");
  form.className = "action-form";
  const controls = card.effectKey === "discardOpponentHand" ? {} : createActionInputs(form, card, view, null);
  const activePlayer = view.players[view.activePlayer];
  const disabled = view.winner !== null || isCpuTurn(view) || !activePlayer.hasDrawnThisTurn;
  const note = document.createElement("p");
  note.className = "empty-note";
  note.textContent = "早業の効果で、このカードをもう一度処理します。カードとアクション権は追加で消費しません。";
  form.prepend(note);
  form.append(createSmallButton("もう一度使う", disabled, async () => {
    const payload = readActionPayload(controls);
    playSound("select");
    await animateActionPreview(card);
    runGameAction("quickReplay", { payload }, () => engine.resolvePendingQuickReplay(game, game.activePlayer, payload));
    showFloat(`早業: ${card.name}`, "action");
    clearSelection();
    if (!onlineMode && card.effectKey === "discardOpponentHand" && game.pendingOpponentHandCheck) {
      selectedKey = "pending:doubleCheck";
      detailKey = "pending:doubleCheck";
      detailData = { source: "pendingDoubleCheck", zone: "二重チェック", card };
    }
    if (!onlineMode) render();
  }));
  container.append(form);
}

function isActionUseDisabled(card, view) {
  const activePlayer = view.players[view.activePlayer];
  if (view.winner !== null || isCpuTurn(view) || !isMyTurn(view) || !activePlayer.hasDrawnThisTurn || activePlayer.actions <= 0) return true;
  if (card.effectKey === "reviveUnit" && activePlayer.field.length >= view.maxFieldSize) return true;
  return false;
}

async function animateActionPreview(card) {
  const drawCounts = {
    drawThreeDiscardTwo: 3,
    drawTwoGainAction: 2,
    drawOneEachDiscardOne: 3,
  };
  const count = drawCounts[card.effectKey] || 0;
  for (let index = 0; index < count; index += 1) {
    showFloat(`DRAW ${index + 1}`, "draw");
    playSound("draw");
    await delay(720);
  }
}

function createActionInputGroup(form, card, view, label, handIndex) {
  const title = document.createElement("div");
  title.className = "repeat-label";
  title.textContent = label;
  form.append(title);
  return createActionInputs(form, card, view, handIndex);
}

function createActionInputs(form, card, view, actionHandIndex = null) {
  const controls = {};
  const units = getAllUnits(view);
  const active = view.players[view.activePlayer];
  const opponent = view.players[view.activePlayer === 0 ? 1 : 0];

  if (["drawThreeDiscardTwo", "drawTwoGainAction"].includes(card.effectKey)) {
    controls.pile = appendSelect(form, "山札", view.piles.map((pile) => [pile.id, `${pile.name} (${pile.count})`]));
  }
  if (card.effectKey === "discardUnit") {
    controls.target = appendSelect(form, "対象", units.map((entry) => [entry.unit.id, `${entry.ownerName}: ${CARD_DEFINITIONS[entry.unit.cardId].name}`]));
  }
  if (card.effectKey === "dealTwoToUnitOrLife") {
    controls.target = appendSelect(form, "対象", [
      ["life", "相手ライフ"],
      ...units.map((entry) => [entry.unit.id, `${entry.ownerName}: ${CARD_DEFINITIONS[entry.unit.cardId].name}`]),
    ]);
  }
  if (card.effectKey === "swapUnits") {
    controls.ownUnit = appendSelect(form, "自分", active.field.map((unit) => [unit.id, CARD_DEFINITIONS[unit.cardId].name]));
    controls.opponentUnit = appendSelect(form, "相手", opponent.field.map((unit) => [unit.id, CARD_DEFINITIONS[unit.cardId].name]));
  }
  if (card.effectKey === "reviveUnit") {
    controls.discard = appendSelect(form, "捨札", view.discard
      .map((cardId, index) => [String(index), CARD_DEFINITIONS[cardId].name, CARD_DEFINITIONS[cardId].type])
      .filter((entry) => entry[2] === "unit")
      .map(([value, label]) => [value, label]));
  }
  if (card.effectKey === "takeDiscardToHand") {
    controls.discard = appendSelect(form, "捨札", view.discard.map((cardId, index) => [String(index), CARD_DEFINITIONS[cardId].name]));
  }
  if (["drawThreeDiscardTwo", "drawOneEachDiscardOne"].includes(card.effectKey)) {
    const count = card.effectKey === "drawThreeDiscardTwo" ? 2 : 1;
    const choices = active.hand
      .map((cardId, index) => [String(index), CARD_DEFINITIONS[cardId].name])
      .filter(([value]) => Number(value) !== actionHandIndex);
    controls.discards = appendMultiSelect(form, "捨てる手札", choices, count);
  }
  return controls;
}

function readActionPayload(controls) {
  const payload = {};
  if (controls.pile) payload.pileId = controls.pile.value;
  if (controls.target && controls.target.value === "life") payload.targetType = "life";
  else if (controls.target) payload.unitId = controls.target.value;
  if (controls.ownUnit) payload.ownUnitId = controls.ownUnit.value;
  if (controls.opponentUnit) payload.opponentUnitId = controls.opponentUnit.value;
  if (controls.discard) payload.discardIndex = controls.discard.value;
  if (controls.opponentHand) payload.opponentHandIndex = controls.opponentHand.value;
  if (controls.discards) payload.discardHandIndexes = Array.from(controls.discards.selectedOptions).map((option) => option.value);
  return payload;
}

function selectDetail(key, card, zone, unit = null, extra = {}) {
  if (selectedKey === key && detailKey === key) {
    clearSelection();
    return;
  }
  selectedKey = key;
  detailKey = key;
  detailData = { card, zone, unit, ...extra };
}

function clearSelection() {
  selectedKey = null;
  detailKey = null;
  detailData = null;
}

function cardMarkup(card) {
  return `
    ${typeBadge(card.type)}
    <div class="card-name">${card.name}</div>
    ${card.type === "unit" ? `
      <div class="unit-stats">
        <span class="stat-pill hp">HP ${card.hp}</span>
        <span class="stat-pill pow">PW ${card.power}</span>
      </div>
    ` : ""}
    <p class="card-text">${card.text}</p>
  `;
}

function compactCardMarkup(card) {
  return `
    ${typeBadge(card.type)}
    <div class="card-name">${card.name}</div>
    ${card.type === "unit" ? `<div class="unit-stats"><span class="stat-pill hp">HP ${card.hp}</span><span class="stat-pill pow">PW ${card.power}</span></div>` : ""}
    <small>${card.text}</small>
  `;
}

function typeBadge(type) {
  return `<span class="card-type ${type}">${typeLabel(type)}</span>`;
}

function typeLabel(type) {
  if (type === "unit") return "モンスター";
  if (type === "item") return "持ち物";
  if (type === "action") return "アクション";
  return type;
}

function appendSelect(form, label, options) {
  const wrapper = document.createElement("label");
  wrapper.textContent = label;
  const select = document.createElement("select");
  replaceOptions(select, options);
  wrapper.append(select);
  form.append(wrapper);
  return select;
}

function appendMultiSelect(form, label, options, size) {
  const select = appendSelect(form, label, options);
  select.multiple = true;
  select.size = Math.max(size, Math.min(4, options.length || size));
  return select;
}

function replaceOptions(select, options) {
  select.replaceChildren();
  options.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  });
}

function getAllUnits(view) {
  return view.players.flatMap((player, ownerId) => player.field.map((unit) => ({ unit, ownerId, ownerName: player.name })));
}

function createSmallButton(label, disabled, onClick) {
  const button = document.createElement("button");
  button.className = "small-button";
  button.type = "button";
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

function runGameAction(type, payload, localAction) {
  if (!onlineMode) {
    const result = localAction();
    if (result && result.ok === false) showFloat(result.message || "操作できません", "damage");
    return;
  }
  if (!socket || !socket.connected) {
    showFloat("サーバー未接続", "damage");
    return;
  }
  socket.emit("game:action", { type, ...payload }, (result) => {
    if (result && result.ok === false) showFloat(result.message || "操作できません", "damage");
  });
}

function startCpuGame() {
  if (socket) socket.emit("room:leave");
  onlineMode = false;
  onlineState = null;
  onlinePlayerId = 0;
  lastOnlineStarted = false;
  cpuEnabled = true;
  cpuThinking = false;
  game = engine.createGame();
  titleActive = false;
  titleLobbyOpen = false;
  optionsOpen = false;
  clearSelection();
  previousView = null;
  showTurnBanner("CPU対戦");
  render();
}

function startMultiSetup() {
  if (socket) socket.emit("room:leave");
  onlineMode = false;
  onlineState = null;
  onlinePlayerId = 0;
  lastOnlineStarted = false;
  cpuEnabled = false;
  cpuThinking = false;
  titleActive = true;
  titleLobbyOpen = true;
  optionsOpen = false;
  clearSelection();
  previousView = null;
  render();
}

function backToTitle() {
  if (socket) socket.emit("room:leave");
  onlineMode = false;
  onlineState = null;
  onlinePlayerId = 0;
  lastOnlineStarted = false;
  cpuThinking = false;
  optionsOpen = false;
  titleActive = true;
  titleLobbyOpen = false;
  clearSelection();
  render();
}

elements.endTurnButton.addEventListener("click", () => {
  runGameAction("endTurn", {}, () => engine.endTurn(game, game.activePlayer));
  clearSelection();
  if (!onlineMode) render();
});

elements.startCpuButton?.addEventListener("click", startCpuGame);
elements.startMultiButton?.addEventListener("click", startMultiSetup);
elements.titleBackButton?.addEventListener("click", () => {
  titleLobbyOpen = false;
  onlineMode = false;
  onlineState = null;
  render();
});
elements.titleCreateRoomButton?.addEventListener("click", async () => {
  await createOnlineRoom({ fromTitle: true });
});
elements.titleJoinRoomButton?.addEventListener("click", async () => {
  const roomId = elements.titleRoomIdInput.value.trim().toUpperCase();
  await joinOnlineRoom(roomId, { fromTitle: true });
});
elements.optionsButton?.addEventListener("click", () => {
  optionsOpen = !optionsOpen;
  render();
});
elements.closeOptionsButton?.addEventListener("click", () => {
  optionsOpen = false;
  render();
});
elements.backTitleButton?.addEventListener("click", backToTitle);

elements.resetButton.addEventListener("click", () => {
  if (onlineMode) {
    showFloat("オンライン中はリセット不可", "damage");
    return;
  }
  game = engine.createGame();
  cpuThinking = false;
  clearSelection();
  render();
});

elements.closeDetailButton.addEventListener("click", () => {
  clearSelection();
  render();
});

elements.createRoomButton?.addEventListener("click", async () => {
  await createOnlineRoom({ fromTitle: false });
});

elements.joinRoomButton?.addEventListener("click", async () => {
  const roomId = elements.roomIdInput.value.trim().toUpperCase();
  await joinOnlineRoom(roomId, { fromTitle: false });
});

async function createOnlineRoom({ fromTitle }) {
  if (!await ensureSocket()) return;
  socket.emit("room:create", {}, (result) => {
    if (!result?.ok) {
      showFloat(result?.message || "部屋作成に失敗", "damage");
      return;
    }
    onlineMode = true;
    onlinePlayerId = result.playerId;
    titleActive = fromTitle;
    titleLobbyOpen = fromTitle;
    optionsOpen = false;
    elements.roomIdInput.value = result.roomId;
    if (elements.titleRoomIdInput) elements.titleRoomIdInput.value = result.roomId;
    history.replaceState(null, "", makeRoomUrl(result.roomId));
    showFloat(`部屋 ${result.roomId}`, "draw");
  });
}

async function joinOnlineRoom(roomId, { fromTitle }) {
  if (!await ensureSocket()) return;
  if (!roomId) {
    showFloat("部屋IDを入力", "damage");
    return;
  }
  socket.emit("room:join", { roomId }, (result) => {
    if (!result?.ok) {
      showFloat(result?.message || "参加に失敗", "damage");
      return;
    }
    onlineMode = true;
    onlinePlayerId = result.playerId;
    titleActive = fromTitle;
    titleLobbyOpen = fromTitle;
    optionsOpen = false;
    elements.roomIdInput.value = result.roomId;
    if (elements.titleRoomIdInput) elements.titleRoomIdInput.value = result.roomId;
    history.replaceState(null, "", makeRoomUrl(result.roomId));
    showFloat(`部屋 ${result.roomId} 参加`, "draw");
  });
}

elements.leaveRoomButton?.addEventListener("click", () => {
  if (socket) socket.emit("room:leave");
  onlineMode = false;
  onlineState = null;
  onlinePlayerId = 0;
  lastOnlineStarted = false;
  optionsOpen = true;
  clearSelection();
  render();
});

async function ensureSocket() {
  if (socket) return true;
  if (!window.io) {
    if (window.location.protocol === "file:") {
      showFloat("npm start で開くとオンライン可", "damage");
      return false;
    }
    try {
      await loadScript("/socket.io/socket.io.js");
    } catch {
      showFloat("Socket.IOを読み込めません", "damage");
      return false;
    }
  }
  socket = window.io({ transports: ["websocket", "polling"] });
  socket.on("connect", () => {
    renderOnlineStatus();
  });
  socket.on("disconnect", () => {
    onlineMode = false;
    onlineState = null;
    render();
  });
  socket.on("room:state", (state) => {
    onlineMode = true;
    onlineState = state;
    onlinePlayerId = state.playerId;
    titleActive = !state.started && titleLobbyOpen;
    if (state.started && !lastOnlineStarted) {
      titleActive = false;
      titleLobbyOpen = false;
      showTurnBanner("BATTLE START");
    }
    lastOnlineStarted = Boolean(state.started);
    if (elements.roomIdInput && state.roomId) elements.roomIdInput.value = state.roomId;
    if (elements.titleRoomIdInput && state.roomId) elements.titleRoomIdInput.value = state.roomId;
    render();
  });
  return true;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
}

function isCpuTurn(view = engine.getPublicState(game, 0)) {
  return !onlineMode && cpuEnabled && view.winner === null && view.activePlayer === 1;
}

function isHandCardDisabled(card, activePlayer, view) {
  if (!activePlayer.hasDrawnThisTurn) return true;
  if (card.type === "unit") return activePlayer.actions <= 0 || activePlayer.field.length >= view.maxFieldSize;
  if (card.type === "action") return activePlayer.actions <= 0;
  if (card.type === "item") return activePlayer.field.length === 0 || activePlayer.field.every((unit) => unit.item?.hasItem);
  return false;
}

function addFx(key, className, duration = 920) {
  pendingFx.set(key, className);
  setTimeout(() => {
    if (pendingFx.get(key) === className) pendingFx.delete(key);
  }, duration);
}

function fxClassFor(key) {
  return pendingFx.get(key) || "";
}

function flushFx() {
  if (pendingFx.size === 0) return;
  const schedule = window.requestAnimationFrame || ((callback) => setTimeout(callback, 16));
  schedule(() => {
    document.querySelectorAll(".fx-draw, .fx-summon, .fx-discard, .fx-attack, .fx-hit, .fx-item").forEach((node) => {
      node.addEventListener("animationend", () => {
        node.classList.remove("fx-draw", "fx-summon", "fx-discard", "fx-attack", "fx-hit", "fx-item");
      }, { once: true });
    });
  });
}

function showFloat(text, type = "") {
  const node = document.createElement("div");
  node.className = `fx-float ${type}`;
  node.textContent = text;
  document.body.append(node);
  node.addEventListener("animationend", () => node.remove(), { once: true });
}

function showTurnBanner(text) {
  const node = document.createElement("div");
  node.className = "turn-banner";
  node.textContent = text;
  document.body.append(node);
  node.addEventListener("animationend", () => node.remove(), { once: true });
}

let audioContext = null;
function playSound(kind) {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    const table = {
      select: [620, 0.035, 0.025],
      draw: [420, 0.05, 0.03],
      summon: [520, 0.07, 0.035],
      attack: [150, 0.06, 0.04],
      damage: [110, 0.06, 0.04],
      heal: [760, 0.06, 0.03],
      turn: [330, 0.08, 0.025],
    };
    const [frequency, duration, volume] = table[kind] || table.select;
    osc.frequency.setValueAtTime(frequency, now);
    osc.type = kind === "damage" || kind === "attack" ? "sawtooth" : "sine";
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + duration + 0.015);
  } catch {
    // Audio is optional.
  }
}

function scheduleCpuTurn() {
  const view = engine.getPublicState(game, 0);
  if (!isCpuTurn(view) || cpuThinking) return;
  cpuThinking = true;
  showTurnBanner("ENEMY TURN");
  playSound("turn");
  window.setTimeout(async () => {
    try {
      await runCpuTurn();
    } finally {
      cpuThinking = false;
      render();
    }
  }, 900);
}

async function runCpuTurn() {
  if (game.winner !== null || game.activePlayer !== 1) return;
  await runCpuOpeningDraw();
  await runCpuSummon();
  await runCpuAttacks();
  if (game.winner === null && game.activePlayer === 1) {
    await cpuStep("ターン終了", () => engine.endTurn(game, 1), "turn");
    showTurnBanner("YOUR TURN");
  }
}

async function runCpuOpeningDraw() {
  const view = engine.getPublicState(game, 0);
  if (view.players[1].hasDrawnThisTurn) return;
  const pile = [...game.piles].filter((candidate) => candidate.deck.length > 0).sort((a, b) => b.deck.length - a.deck.length)[0];
  if (pile) {
    await cpuStep("CPU ドロー", () => {
      addFx(`deck:${pile.id}`, "fx-draw");
      return engine.drawFromPile(game, 1, pile.id);
    }, "draw");
  }
}

async function runCpuSummon() {
  const player = game.players[1];
  while (game.winner === null && player.actions > 0 && player.field.length < 2) {
    const unitIndex = player.hand.findIndex((cardId) => CARD_DEFINITIONS[cardId].type === "unit");
    if (unitIndex === -1) break;
    const result = await cpuStep("CPU 召喚", () => engine.summonFromHand(game, 1, unitIndex), "summon");
    if (!result.ok) break;
  }
  await runCpuEquipItems();
}

async function runCpuEquipItems() {
  const player = game.players[1];
  let equipped = true;
  while (equipped) {
    equipped = false;
    const itemIndex = player.hand.findIndex((cardId) => CARD_DEFINITIONS[cardId].type === "item");
    const target = player.field.find((unit) => !unit.item);
    if (itemIndex === -1 || !target) return;
    const result = await cpuStep("CPU 装備", () => {
      addFx(`field:1:${target.id}`, "fx-item");
      return engine.equipItemFromHand(game, 1, itemIndex, target.id);
    }, "select");
    equipped = result.ok;
  }
}

async function runCpuAttacks() {
  let acted = true;
  while (game.winner === null && acted) {
    acted = false;
    const attacker = game.players[1].field.find((unit) => unit.canAct);
    if (!attacker) return;
    const lifeResult = await cpuStep("CPU 攻撃", () => {
      addFx(`field:1:${attacker.id}`, "fx-attack");
      return engine.attackLife(game, 1, attacker.id);
    }, "attack");
    if (lifeResult.ok) {
      acted = true;
      continue;
    }
    const defender = game.players[0].field[0];
    if (!defender) return;
    const monsterResult = await cpuStep("CPU 戦闘", () => {
      addFx(`field:1:${attacker.id}`, "fx-attack");
      addFx(`field:0:${defender.id}`, "fx-hit");
      return engine.attackMonster(game, 1, attacker.id, defender.id);
    }, "attack");
    acted = monsterResult.ok;
  }
}

async function cpuStep(label, action, sound) {
  showFloat(label, "cpu");
  playSound(sound);
  const result = action();
  render();
  await delay(1450);
  return result;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function initializeFromUrl() {
  const roomId = new URLSearchParams(window.location.search).get("room");
  if (!roomId) return;
  titleActive = true;
  titleLobbyOpen = true;
  cpuEnabled = false;
  if (elements.roomIdInput) elements.roomIdInput.value = roomId.toUpperCase();
  if (elements.titleRoomIdInput) elements.titleRoomIdInput.value = roomId.toUpperCase();
  if (window.location.protocol !== "file:") {
    setTimeout(() => joinOnlineRoom(roomId.toUpperCase(), { fromTitle: true }), 250);
  }
}

initializeFromUrl();
render();
})();

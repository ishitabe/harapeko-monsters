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
let titleRulesOpen = false;
let titleCardsOpen = false;
let rulesPageIndex = 0;
let selectedKey = null;
let detailKey = null;
let detailData = null;
let previousView = null;
let animationLock = false;
const pendingFx = new Map();
const RULE_PAGES = [
  {
    title: "まずは勝ち方",
    lead: "相手のライフを0にしたプレイヤーの勝ちです。",
    items: [
      "モンスターを場に出して、相手モンスターや相手ライフを攻撃します。",
      "持ち物でモンスターを強化し、アクションカードで盤面を動かします。"
    ]
  },
  {
    title: "ターンの流れ",
    lead: "ターン開始時は、中央に表示される案内どおり山札を1つ選んで1枚ドローします。",
    items: [
      "ドローはアクション権を消費しません。",
      "1ターンのアクション権は基本2つです。",
      "召喚とアクションカード使用にはアクション権を1つ使います。",
      "攻撃はアクション権を消費せず、行動可能なモンスターごとに1回できます。",
      "ターン終了時、自分の場のモンスターは全回復します。"
    ]
  },
  {
    title: "山札と手札",
    lead: "山札は共通3山で、各山の一番上のカードは常に公開されています。",
    items: [
      "カードは3山にランダムに分配されます。",
      "捨札は共通で全公開です。クリックすると一覧を確認できます。",
      "2つの山札が空になったら、山札と捨札をすべてシャッフルして3山に配り直します。",
      "手札上限は10枚です。10枚を超えるドローは失敗し、そのカードは捨札へ行きます。"
    ]
  },
  {
    title: "場と戦闘",
    lead: "場にはモンスターを最大3体まで出せます。",
    items: [
      "攻撃すると、自分のパワーの値だけ相手にダメージを与えます。",
      "モンスター同士の戦闘では必ず反撃が発生し、お互いのパワー分のダメージを同時に受けます。",
      "HPが0になったモンスターは捨札へ送られます。",
      "モンスターが3体いるとウォールが発生し、モンスターの攻撃ではライフを攻撃できません。"
    ]
  },
  {
    title: "カードの種類",
    lead: "カードはモンスター、持ち物、アクションの3種類です。",
    items: [
      "モンスター: 召喚にアクション権を1消費します。召喚したターンは基本的に行動できません。",
      "持ち物: 召喚済みの自分のモンスターに装備します。アクション権は消費しません。",
      "持ち物は裏向きで装備され、発動タイミングで公開されます。相手にはカード右上のアイコンだけ見えます。",
      "アクション: 手札から使用し、アクション権を1消費します。使用後は捨札へ行きます。"
    ]
  },
  {
    title: "詳しい仕様",
    lead: "現在の基本仕様です。カード効果の細部はカード本文が優先です。",
    items: [
      "初期ライフは12です。",
      "先攻・後攻はCPU対戦、マルチ対戦ともランダムです。",
      "初期手札は先攻5枚、後攻6枚です。",
      "先攻1ターン目のアクション権は1、それ以外は基本2です。",
      "オンライン対戦では、手札、山札順、裏向き持ち物は相手に見えません。"
    ]
  }
];

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
  showRulesButton: document.querySelector("#showRulesButton"),
  showCardsButton: document.querySelector("#showCardsButton"),
  titleRules: document.querySelector("#titleRules"),
  rulesPageLabel: document.querySelector("#rulesPageLabel"),
  rulesTitle: document.querySelector("#rulesTitle"),
  rulesBody: document.querySelector("#rulesBody"),
  rulesPrevButton: document.querySelector("#rulesPrevButton"),
  rulesNextButton: document.querySelector("#rulesNextButton"),
  rulesCloseButton: document.querySelector("#rulesCloseButton"),
  titleCards: document.querySelector("#titleCards"),
  cardListSummary: document.querySelector("#cardListSummary"),
  cardListBody: document.querySelector("#cardListBody"),
  cardsCloseButton: document.querySelector("#cardsCloseButton"),
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
  playerName: [document.querySelector("#p0Name"), document.querySelector("#p1Name")],
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
  const locked = lockedForCpu || lockedForOnline || animationLock;
  renderBattleEvents(view);

  elements.turnLabel.textContent = view.winner === null
    ? `${activePlayer.name}のターン ${view.turn}`
    : `決着: ${view.players[view.winner].name}の勝ち`;
  elements.actionLabel.textContent = activePlayer.hasDrawnThisTurn
    ? `アクション ${activePlayer.actions}/2`
    : "山札を選んでドロー";
  elements.activeHandLabel.textContent = "手札";
  elements.messageText.textContent = view.lastMessage;
  const canEndTurn = view.winner === null && !titleActive && !animationLock && (onlineMode
    ? Boolean(onlineState?.started) && view.activePlayer === selfId
    : !isCpuTurn(view));
  elements.endTurnButton.disabled = !canEndTurn;
  document.body.classList.toggle("title-active", titleActive);
  document.body.classList.toggle("title-lobby-active", titleLobbyOpen);
  document.body.classList.toggle("title-rules-active", titleRulesOpen);
  document.body.classList.toggle("title-cards-active", titleCardsOpen);
  elements.titleLobby?.classList.toggle("hidden", !titleLobbyOpen);
  elements.titleRules?.classList.toggle("hidden", !titleRulesOpen);
  elements.titleCards?.classList.toggle("hidden", !titleCardsOpen);
  elements.optionsPanel?.classList.toggle("hidden", !optionsOpen);
  updateOptionsVisibility();

  renderOnlineStatus();
  renderTitleLobby();
  renderRules();
  renderCardList();
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
  renderPendingDiscardSelection();
  renderPendingPileSearch();
  updateDrawPrompt(view, locked);
  renderWinnerOverlay(view);
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
    elements.playerName[slotId].textContent = player.name;
    elements.life[slotId].textContent = `HP ${player.life}`;
    const previousLife = previousView?.players[playerId]?.life;
    elements.life[slotId].classList.remove("life-damage", "life-heal");
    if (previousLife !== undefined && previousLife !== player.life) {
      const className = player.life < previousLife ? "life-damage" : "life-heal";
      elements.life[slotId].classList.add(className);
      const amount = Math.abs(player.life - previousLife);
      showFloat(player.life < previousLife ? `${player.name}に${amount}ダメージ！` : `${player.name}が${amount}回復！`, player.life < previousLife ? "damage" : "heal");
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

function renderRules() {
  if (!elements.titleRules || !titleRulesOpen) return;
  const page = RULE_PAGES[rulesPageIndex] || RULE_PAGES[0];
  elements.rulesPageLabel.textContent = `RULE ${rulesPageIndex + 1} / ${RULE_PAGES.length}`;
  elements.rulesTitle.textContent = page.title;
  elements.rulesBody.replaceChildren();

  const lead = document.createElement("p");
  lead.className = "rules-lead";
  lead.textContent = page.lead;
  elements.rulesBody.append(lead);

  const list = document.createElement("ul");
  list.className = "rules-list";
  page.items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    list.append(li);
  });
  elements.rulesBody.append(list);

  elements.rulesPrevButton.disabled = rulesPageIndex === 0;
  elements.rulesNextButton.textContent = rulesPageIndex === RULE_PAGES.length - 1 ? "最初へ" : "次へ";
}

function renderCardList() {
  if (!elements.titleCards || !titleCardsOpen) return;
  const typeLabels = { unit: "モンスター", item: "持ち物", action: "アクション" };
  const cardsByType = { unit: [], item: [], action: [] };
  CARD_POOL.forEach((cardId) => {
    const card = CARD_DEFINITIONS[cardId];
    if (card && cardsByType[card.type]) cardsByType[card.type].push(card);
  });
  const total = Object.values(cardsByType).reduce((sum, cards) => sum + cards.length, 0);
  elements.cardListSummary.textContent = `全${total}枚 / モンスター${cardsByType.unit.length}枚 / 持ち物${cardsByType.item.length}枚 / アクション${cardsByType.action.length}枚`;
  elements.cardListBody.replaceChildren();

  ["unit", "item", "action"].forEach((type) => {
    const section = document.createElement("section");
    section.className = `card-list-section ${type}`;

    const heading = document.createElement("h3");
    heading.textContent = `${typeLabels[type]} ${cardsByType[type].length}枚`;
    section.append(heading);

    const grid = document.createElement("div");
    grid.className = "card-list-grid";
    cardsByType[type].forEach((card) => {
      const article = document.createElement("article");
      article.className = `card-list-entry ${card.type}`;
      const stats = card.type === "unit" ? `<div class="card-list-stats"><span>HP ${card.hp}</span><span>PW ${card.power}</span></div>` : "";
      article.innerHTML = `
        <div class="card-list-entry-head">
          <span class="card-type ${card.type}">${typeLabels[card.type]}</span>
          <strong>${card.name}</strong>
        </div>
        ${stats}
        <p>${card.text}</p>
      `;
      grid.append(article);
    });
    section.append(grid);
    elements.cardListBody.append(section);
  });
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
  label.textContent = `アクション権 ${actions}`;
  container.append(label);
  const lampCount = Math.max(2, Math.min(5, actions));
  for (let index = 0; index < lampCount; index += 1) {
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
      <div class="deck-thumb ${topCard ? topCard.type : ""}">${topCard ? typeBadge(topCard.type) : ""}</div>
      <div>
        <div class="deck-meta"><span class="deck-name">${pile.name}</span><small>残り ${pile.count} 枚</small></div>
        ${topCard ? `<div class="card-name">${topCard.name}</div><p class="card-text">${topCard.text}</p>` : "<p class=\"empty-note\">空</p>"}
      </div>
    `;
    button.addEventListener("click", () => {
      playSound("select");
      selectDetail(key, topCard, `${pile.name} トップ`, null, { source: "deck" });
      if (winner === null && !lockedForCpu && !activePlayer.hasDrawnThisTurn) {
        addFx(key, "fx-draw");
        playSound("draw");
        runGameAction("draw", { pileId: pile.id }, () => engine.drawFromPile(game, game.activePlayer, pile.id), showDrawnCards);
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
    const isNewUnit = Boolean(unit && previousView && !previousView.players[playerId]?.field.some((oldUnit) => oldUnit.id === unit.id));
    slot.className = `field-slot ${unit ? `filled ${CARD_DEFINITIONS[unit.cardId].type}` : "empty"} ${showExhausted ? "exhausted" : ""} ${unit && unit.summonedTurn === view.turn ? "fresh" : ""} ${isNewUnit ? "fx-summon" : ""} ${selectedKey === key ? "selected" : ""} ${fxClassFor(key)}`;

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
      ${unit.item && unit.item.hasItem ? itemBadgeMarkup(unit.item) : ""}
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
      ${unit && unit.item && unit.item.hasItem ? itemBadgeMarkup(unit.item) : ""}
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

function renderPendingDiscardSelection() {
  const view = getView();
  const pending = view.pendingDiscardSelection;
  if (!pending || pending.playerId !== getSelfId() || isCpuTurn()) return;
  selectedKey = "pending:discardSelection";
  detailKey = "pending:discardSelection";
  detailData = { source: "pendingDiscardSelection", zone: "アクロバット", count: pending.count, card: CARD_DEFINITIONS.acrobat };
  renderDetail();
}

function renderPendingPileSearch() {
  const view = getView();
  const pending = view.pendingPileSearch;
  if (!pending || pending.playerId !== getSelfId() || isCpuTurn()) return;
  selectedKey = "pending:pileSearch";
  detailKey = "pending:pileSearch";
  detailData = { source: "pendingPileSearch", zone: "下準備", count: pending.count, cards: pending.cards, card: CARD_DEFINITIONS.preparation };
  renderDetail();
}

function renderDetailActions(container, data) {
  if (!container) return;
  const view = getView();
  const activePlayer = view.players[view.activePlayer];
  const lockedForTurn = !isMyTurn(view) || isCpuTurn(view);
  const disabled = view.winner !== null || lockedForTurn || animationLock || !activePlayer.hasDrawnThisTurn;
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
      container.append(createSmallButton(`${CARD_DEFINITIONS[cardId].name}を加える`, false, () => {
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

  if (data.source === "pendingDiscardSelection") {
    renderDiscardSelectionControls(container, data.count, view);
    return;
  }

  if (data.source === "pendingPileSearch") {
    renderPileSearchControls(container, data);
    return;
  }

  if (data.source === "hand") {
    if (data.card.type === "unit") {
      container.append(createSmallButton("このモンスターを召喚", disabled || activePlayer.actions <= 0 || activePlayer.field.length >= view.maxFieldSize, () => {
        playSound("summon");
        runGameAction("summon", { handIndex: data.handIndex }, () => engine.summonFromHand(game, game.activePlayer, data.handIndex));
    showFloat(`${data.card.name}を召喚！`, "summon");
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
          showFloat(`${CARD_DEFINITIONS[unit.cardId].name}に装備！`, "item");
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
      const opponentHasSnorlax = view.players[view.activePlayer === 0 ? 1 : 0].field.some((target) => CARD_DEFINITIONS[target.cardId].effectKey === "mustBeAttacked");
      container.append(createSmallButton(opponentHasSnorlax ? "カビゴンでライフ攻撃不可" : opponentHasWall ? "壁でライフ攻撃不可" : "ライフを攻撃", disabled || !unit.canAct || opponentHasWall || opponentHasSnorlax, async () => {
        await playAttackSequence(`field:${data.ownerId}:${unit.id}`, null, getOpponentId());
        playSound("attack");
        runGameAction("attackLife", { attackerId: unit.id }, () => engine.attackLife(game, game.activePlayer, unit.id));
        showFloat(`${activePlayer.name}がライフ攻撃！`, "damage");
        clearSelection();
        if (!onlineMode) render();
      }));
      if (CARD_DEFINITIONS[unit.cardId].effectKey === "attackOrGainLife") {
        container.append(createSmallButton("ライフ+3を選ぶ", disabled || !unit.canAct, () => {
          playSound("heal");
          runGameAction("gainLife", { unitId: unit.id }, () => engine.gainLifeWithUnit(game, game.activePlayer, unit.id));
          showFloat(`${CARD_DEFINITIONS[unit.cardId].name}: ライフ+3！`, "heal");
          clearSelection();
          if (!onlineMode) render();
        }));
      }
      if (CARD_DEFINITIONS[unit.cardId].effectKey === "zeroPowerAndReturn") {
        const opponentId = view.activePlayer === 0 ? 1 : 0;
        view.players[opponentId].field.forEach((target) => {
          container.append(createSmallButton(`${CARD_DEFINITIONS[target.cardId].name}を威嚇して戻る`, disabled || !unit.canAct, () => {
            runGameAction("unitAbility", { ability: "zeroPowerAndReturn", unitId: unit.id, targetUnitId: target.id }, () => engine.useUnitAbility(game, game.activePlayer, { ability: "zeroPowerAndReturn", unitId: unit.id, targetUnitId: target.id }));
            addFx(`field:${opponentId}:${target.id}`, "fx-stat-down");
            clearSelection();
            if (!onlineMode) render();
          }));
        });
      }
      if (CARD_DEFINITIONS[unit.cardId].effectKey === "doubleOwnPower") {
        container.append(createSmallButton("自分のパワーを2倍", disabled || !unit.canAct, () => {
          runGameAction("unitAbility", { ability: "doubleOwnPower", unitId: unit.id }, () => engine.useUnitAbility(game, game.activePlayer, { ability: "doubleOwnPower", unitId: unit.id }));
          addFx(`field:${view.activePlayer}:${unit.id}`, "fx-stat-up");
          clearSelection();
          if (!onlineMode) render();
        }));
      }
      const opponentId = view.activePlayer === 0 ? 1 : 0;
      const defenders = filterAttackTargets(view.players[opponentId].field);
      defenders.forEach((defender) => {
        container.append(createSmallButton(`${CARD_DEFINITIONS[defender.cardId].name}を攻撃`, disabled || !unit.canAct, async () => {
          await playAttackSequence(`field:${view.activePlayer}:${unit.id}`, `field:${opponentId}:${defender.id}`);
          playSound("attack");
          runGameAction("attackMonster", { attackerId: unit.id, defenderId: defender.id }, () => engine.attackMonster(game, game.activePlayer, unit.id, defender.id), showDrawnCards);
          showFloat(`${CARD_DEFINITIONS[defender.cardId].name}に攻撃！`, "damage");
          clearSelection();
          if (!onlineMode) render();
        }));
      });
    } else {
      const attackers = filterAttackTargets(activePlayer.field);
      attackers.forEach((attacker) => {
        container.append(createSmallButton(`${CARD_DEFINITIONS[attacker.cardId].name}で攻撃`, disabled || !attacker.canAct, async () => {
          await playAttackSequence(`field:${view.activePlayer}:${attacker.id}`, `field:${data.ownerId}:${data.unitId}`);
          playSound("attack");
          runGameAction("attackMonster", { attackerId: attacker.id, defenderId: data.unitId }, () => engine.attackMonster(game, game.activePlayer, attacker.id, data.unitId), showDrawnCards);
          showFloat(`${data.card.name}に攻撃！`, "damage");
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
    playSound("select");
    await showCardCast(card);
    runGameAction("playAction", { handIndex, payload }, () => engine.playAction(game, game.activePlayer, handIndex, payload), showDrawnCards);
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
    await showCardCast(card);
    runGameAction("quickReplay", { payload }, () => engine.resolvePendingQuickReplay(game, game.activePlayer, payload), showDrawnCards);
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
  if (view.winner !== null || animationLock || isCpuTurn(view) || !isMyTurn(view) || !activePlayer.hasDrawnThisTurn || activePlayer.actions <= 0) return true;
  if (card.effectKey === "reviveUnit" && activePlayer.field.length >= view.maxFieldSize) return true;
  return false;
}

function filterAttackTargets(field) {
  const snorlax = field.filter((unit) => CARD_DEFINITIONS[unit.cardId].effectKey === "mustBeAttacked");
  return snorlax.length > 0 ? snorlax : field;
}

async function showDrawnCards(result) {
  const drawnCards = result?.drawnCards || [];
  const discardedDrawCards = result?.discardedDrawCards || [];
  if (drawnCards.length === 0) {
    if (discardedDrawCards.length > 0) {
      for (const cardId of discardedDrawCards) {
        const card = CARD_DEFINITIONS[cardId];
        showFloat(`手札上限: ${card ? card.name : cardId}は捨札へ`, "damage");
        await delay(720);
      }
      return;
    }
    showFloat("ドローなし", "draw");
    return;
  }
  for (let index = 0; index < drawnCards.length; index += 1) {
    const card = CARD_DEFINITIONS[drawnCards[index]];
    showFloat(`ドロー${index + 1}: ${card ? card.name : drawnCards[index]}`, "draw");
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

  if (["drawTwoGainAction", "drawPileDiscardTwo", "searchTwoFromPile", "drawOneBuffOwnField"].includes(card.effectKey)) {
    controls.pile = appendSelect(form, "山札", view.piles.map((pile) => [pile.id, `${pile.name} (${pile.count})`]));
  }
  if (["discardUnit"].includes(card.effectKey)) {
    controls.target = appendSelect(form, "対象", orderedUnitOptions(view));
  }
  if (card.effectKey === "sacrifice") {
    controls.target = appendSelect(form, "対象", ownUnitOptions(view));
  }
  if (card.effectKey === "dealTwoToUnitOrLife") {
    controls.target = appendSelect(form, "対象", [
      ["life", "相手ライフ"],
      ...orderedUnitOptions(view),
    ]);
  }
  if (card.effectKey === "swapUnits") {
    const note = document.createElement("p");
    note.className = "empty-note";
    note.textContent = "自分と相手の場のモンスターを、持ち物ごとすべて入れ替えます。";
    form.append(note);
  }
  if (card.effectKey === "reviveUnit") {
    controls.discard = appendSelect(form, "捨札", view.discard
      .map((cardId, index) => [String(index), CARD_DEFINITIONS[cardId].name, CARD_DEFINITIONS[cardId].type])
      .filter((entry) => entry[2] === "unit")
      .map(([value, label]) => [value, label]));
  }
  if (card.effectKey === "takeDiscardToHandGainAction") {
    controls.discard = appendSelect(form, "捨札", view.discard.map((cardId, index) => [String(index), CARD_DEFINITIONS[cardId].name]));
  }
  return controls;
}

function renderDiscardSelectionControls(container, count, view) {
  const form = document.createElement("div");
  form.className = "action-form";
  const note = document.createElement("p");
  note.className = "empty-note";
  note.textContent = `アクロバットでドローしました。捨てる手札を${count}枚選んでください。`;
  form.append(note);
  const hand = view.players[getSelfId()].hand;
  if (hand.length <= count) {
    form.append(createSmallButton(`手札をすべて捨てる`, false, () => {
      const handIndexes = hand.map((_, index) => String(index));
      runGameAction("discardSelection", { handIndexes }, () => engine.resolvePendingDiscardSelection(game, game.activePlayer, handIndexes));
      clearSelection();
      if (!onlineMode) render();
    }));
    container.append(form);
    return;
  }
  const choices = hand.map((cardId, index) => [String(index), CARD_DEFINITIONS[cardId].name]);
  const picker = appendClickMultiPicker(form, "捨てる手札", choices, count);
  form.append(createSmallButton(`${count}枚捨てる`, hand.length < count, () => {
    const handIndexes = picker.getSelectedValues();
    runGameAction("discardSelection", { handIndexes }, () => engine.resolvePendingDiscardSelection(game, game.activePlayer, handIndexes));
    clearSelection();
    if (!onlineMode) render();
  }));
  container.append(form);
}

function renderPileSearchControls(container, data) {
  const form = document.createElement("div");
  form.className = "action-form";
  const note = document.createElement("p");
  note.className = "empty-note";
  note.textContent = `山札から手札に加えるカードを${data.count}枚まで選んでください。`;
  form.append(note);
  const choices = (data.cards || []).map((cardId, index) => [String(index), CARD_DEFINITIONS[cardId].name]);
  const picker = appendClickMultiPicker(form, "山札の中身", choices, data.count);
  form.append(createSmallButton("手札に加える", choices.length === 0, () => {
    const pileIndexes = picker.getSelectedValues();
    runGameAction("pileSearch", { pileIndexes }, () => engine.resolvePendingPileSearch(game, game.activePlayer, pileIndexes), showDrawnCards);
    clearSelection();
    if (!onlineMode) render();
  }));
  container.append(form);
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
  if (controls.discards) payload.discardHandIndexes = controls.discards.getSelectedValues
    ? controls.discards.getSelectedValues()
    : Array.from(controls.discards.selectedOptions).map((option) => option.value);
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

function updateDrawPrompt(view, locked) {
  let node = document.querySelector("#drawPrompt");
  const shouldShow = !titleActive
    && view.winner === null
    && !locked
    && isMyTurn(view)
    && !view.players[view.activePlayer].hasDrawnThisTurn;
  if (!shouldShow) {
    node?.remove();
    return;
  }
  if (!node) {
    node = document.createElement("div");
    node.id = "drawPrompt";
    node.className = "draw-prompt";
    node.textContent = "山を選んで1枚ドロー";
    document.body.append(node);
  }
}

function renderWinnerOverlay(view) {
  let node = document.querySelector("#winnerOverlay");
  if (view.winner === null) {
    node?.remove();
    return;
  }
  if (node) return;
  const winner = view.players[view.winner];
  node = document.createElement("div");
  node.id = "winnerOverlay";
  node.className = "winner-overlay";
  node.innerHTML = `
    <div class="winner-card">
      <p>決着</p>
      <h2>${winner.name}の勝ち！</h2>
      <div class="winner-actions">
        <button type="button" id="winnerRematch">もう一度戦う</button>
        <button type="button" id="winnerTitle">タイトルへ</button>
      </div>
    </div>
  `;
  document.body.append(node);
  playSound("turn");
  setAnimationLock(900);
  node.querySelector("#winnerRematch").addEventListener("click", () => {
    node.remove();
    if (onlineMode) {
      showFloat("オンラインはタイトルから再作成してください", "cpu");
      backToTitle();
      return;
    }
    startCpuGame();
  });
  node.querySelector("#winnerTitle").addEventListener("click", () => {
    node.remove();
    backToTitle();
  });
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

function itemBadgeMarkup(item) {
  if (!item.visibleCardId) return `<span class="item-badge item-icon" title="持ち物あり">◆</span>`;
  const card = CARD_DEFINITIONS[item.visibleCardId];
  return `
    <span class="item-badge item-icon" title="${card.name}">
      ◆
      <span class="item-preview ${card.type}">${cardMarkup(card)}</span>
    </span>
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

function appendClickMultiPicker(form, label, options, maxCount) {
  const wrapper = document.createElement("div");
  wrapper.className = "click-picker-wrap";
  const title = document.createElement("span");
  title.textContent = label;
  const grid = document.createElement("div");
  grid.className = "click-picker";
  const selected = new Set();
  const getSelectedValues = () => Array.from(selected);
  const update = () => {
    grid.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("selected", selected.has(button.value));
    });
  };
  options.forEach(([value, text]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.value = value;
    button.textContent = text;
    button.addEventListener("click", () => {
      if (selected.has(value)) selected.delete(value);
      else if (selected.size < maxCount) selected.add(value);
      playSound("select");
      update();
    });
    grid.append(button);
  });
  wrapper.append(title, grid);
  form.append(wrapper);
  return { getSelectedValues };
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

function orderedUnitOptions(view) {
  const opponentId = view.activePlayer === 0 ? 1 : 0;
  return [opponentId, view.activePlayer].flatMap((ownerId) => view.players[ownerId].field
    .map((unit) => [unit.id, `${ownerId === opponentId ? "相手" : "自分"}: ${CARD_DEFINITIONS[unit.cardId].name}`]));
}

function ownUnitOptions(view) {
  return view.players[view.activePlayer].field
    .map((unit) => [unit.id, `自分: ${CARD_DEFINITIONS[unit.cardId].name}`]);
}

function renderBattleEvents(view) {
  if (!previousView) return;
  if (onlineMode && view.lastPlayedAction && view.lastPlayedAction.playerId !== getSelfId()
    && view.lastPlayedAction.serial !== previousView.lastPlayedAction?.serial) {
    const card = CARD_DEFINITIONS[view.lastPlayedAction.cardId];
    if (card) showCardCast(card);
  }
  const removedNames = [];
  view.players.forEach((player, playerId) => {
    const oldField = previousView.players[playerId]?.field || [];
    oldField.forEach((oldUnit) => {
      const stillInPlay = view.players.some((candidate) => candidate.field.some((unit) => unit.id === oldUnit.id));
      if (!stillInPlay) removedNames.push(CARD_DEFINITIONS[oldUnit.cardId]?.name || "モンスター");
    });
  });
  if (removedNames.length > 0) {
    showFloat(`${removedNames.join("、")}は倒れた！`, "damage");
    playSound("damage");
    document.body.classList.add("screen-shake");
    setTimeout(() => document.body.classList.remove("screen-shake"), 760);
  }
  showStatChangeEvents(view);
}

function showStatChangeEvents(view) {
  view.players.forEach((player, playerId) => {
    const oldField = previousView.players[playerId]?.field || [];
    player.field.forEach((unit) => {
      const oldUnit = oldField.find((candidate) => candidate.id === unit.id);
      if (!oldUnit) return;
      const name = CARD_DEFINITIONS[unit.cardId]?.name || "モンスター";
      const key = `field:${playerId}:${unit.id}`;
      if (unit.power > oldUnit.power) {
        addFx(key, "fx-stat-up");
      } else if (unit.power < oldUnit.power) {
        addFx(key, "fx-stat-down");
      }
      if (unit.maxHp > oldUnit.maxHp) addFx(key, "fx-stat-up");
      else if (unit.maxHp < oldUnit.maxHp) addFx(key, "fx-stat-down");
    });
  });
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

function runGameAction(type, payload, localAction, afterResult = null) {
  if (animationLock) {
    showFloat("演出中です", "cpu");
    return null;
  }
  if (!onlineMode) {
    const result = localAction();
    if (result && result.ok === false) showFloat(result.message || "操作できません", "damage");
    else if (afterResult) afterResult(result);
    return result;
  }
  if (!socket || !socket.connected) {
    showFloat("サーバー未接続", "damage");
    return null;
  }
  socket.emit("game:action", { type, ...payload }, (result) => {
    if (result && result.ok === false) showFloat(result.message || "操作できません", "damage");
    else if (afterResult) afterResult(result);
  });
  return null;
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
  game.players[1].name = "CPU";
  titleActive = false;
  titleLobbyOpen = false;
  titleRulesOpen = false;
  titleCardsOpen = false;
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
  titleRulesOpen = false;
  titleCardsOpen = false;
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
  titleRulesOpen = false;
  titleCardsOpen = false;
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
elements.showRulesButton?.addEventListener("click", () => {
  titleRulesOpen = true;
  titleCardsOpen = false;
  titleLobbyOpen = false;
  rulesPageIndex = 0;
  render();
});
elements.showCardsButton?.addEventListener("click", () => {
  titleCardsOpen = true;
  titleRulesOpen = false;
  titleLobbyOpen = false;
  render();
});
elements.cardsCloseButton?.addEventListener("click", () => {
  titleCardsOpen = false;
  render();
});
elements.rulesCloseButton?.addEventListener("click", () => {
  titleRulesOpen = false;
  render();
});
elements.rulesPrevButton?.addEventListener("click", () => {
  rulesPageIndex = Math.max(0, rulesPageIndex - 1);
  render();
});
elements.rulesNextButton?.addEventListener("click", () => {
  rulesPageIndex = rulesPageIndex === RULE_PAGES.length - 1 ? 0 : rulesPageIndex + 1;
  render();
});
elements.titleBackButton?.addEventListener("click", () => {
  titleLobbyOpen = false;
  titleRulesOpen = false;
  titleCardsOpen = false;
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
  game.players[1].name = "CPU";
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
    titleRulesOpen = false;
    titleCardsOpen = false;
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
    titleRulesOpen = false;
    titleCardsOpen = false;
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
      titleRulesOpen = false;
      titleCardsOpen = false;
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
    document.querySelectorAll(".fx-draw, .fx-summon, .fx-discard, .fx-attack, .fx-attack-charge, .fx-hit, .fx-item, .fx-stat-up, .fx-stat-down").forEach((node) => {
      node.addEventListener("animationend", () => {
        node.classList.remove("fx-draw", "fx-summon", "fx-discard", "fx-attack", "fx-attack-charge", "fx-hit", "fx-item", "fx-stat-up", "fx-stat-down");
      }, { once: true });
    });
  });
}

async function playAttackSequence(attackerKey, targetKey = null, targetLifePlayerId = null) {
  setAnimationLock(1700);
  addFx(attackerKey, "fx-attack-charge", 1300);
  render();
  await delay(620);
  addFx(attackerKey, "fx-attack");
  if (targetKey) addFx(targetKey, "fx-hit");
  if (targetLifePlayerId !== null) {
    const slot = targetLifePlayerId === getSelfId() ? 0 : 1;
    elements.life[slot].classList.add("life-damage");
    setTimeout(() => elements.life[slot].classList.remove("life-damage"), 900);
  }
  render();
  await delay(520);
  animationLock = false;
  document.body.classList.remove("animation-lock");
}

function showCardCast(card) {
  return new Promise((resolve) => {
    const node = document.createElement("div");
    node.className = `card-cast ${card.type}`;
    node.innerHTML = cardMarkup(card);
    document.body.append(node);
    playSound("select");
    setTimeout(() => {
      node.classList.add("leaving");
      setTimeout(() => {
        node.remove();
        resolve();
      }, 260);
    }, 980);
  });
}

function showFloat(text, type = "") {
  const node = document.createElement("div");
  node.className = `fx-float ${type}`;
  node.textContent = text;
  document.body.append(node);
  if (type !== "cpu") setAnimationLock(700);
  node.addEventListener("animationend", () => node.remove(), { once: true });
}

function showTurnBanner(text) {
  const node = document.createElement("div");
  node.className = "turn-banner";
  node.textContent = text;
  document.body.append(node);
  setAnimationLock(900);
  node.addEventListener("animationend", () => node.remove(), { once: true });
}

function setAnimationLock(ms) {
  animationLock = true;
  document.body.classList.add("animation-lock");
  clearTimeout(setAnimationLock.timer);
  setAnimationLock.timer = setTimeout(() => {
    animationLock = false;
    document.body.classList.remove("animation-lock");
    render();
  }, ms);
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
  await runCpuActions();
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
  while (game.winner === null && player.actions > 0 && player.field.length < engine.getPublicState(game, 0).maxFieldSize) {
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
    const choice = chooseCpuItemEquip();
    if (!choice) return;
    const result = await cpuStep("CPU 装備", () => {
      addFx(`field:1:${choice.unit.id}`, "fx-item");
      return engine.equipItemFromHand(game, 1, choice.handIndex, choice.unit.id);
    }, "select");
    equipped = result.ok;
  }
}

function chooseCpuItemEquip() {
  const player = game.players[1];
  const items = player.hand
    .map((cardId, handIndex) => ({ cardId, handIndex, card: CARD_DEFINITIONS[cardId] }))
    .filter((entry) => entry.card.type === "item");
  for (const entry of items) {
    const candidates = player.field.filter((unit) => !unit.item);
    if (candidates.length === 0) return null;
    if (entry.cardId === "lightBall") {
      const pikachu = candidates.find((unit) => unit.cardId === "pikachu");
      if (pikachu) return { handIndex: entry.handIndex, unit: pikachu };
      continue;
    }
    if (entry.cardId === "choiceScarf") {
      const fresh = candidates.find((unit) => !unit.canAct);
      if (fresh) return { handIndex: entry.handIndex, unit: fresh };
    }
    const best = [...candidates].sort((a, b) => (b.power + b.hp) - (a.power + a.hp))[0];
    return { handIndex: entry.handIndex, unit: best };
  }
  return null;
}

async function runCpuActions() {
  let used = true;
  while (game.winner === null && used && game.players[1].actions > 0) {
    used = false;
    const choice = chooseCpuAction();
    if (!choice) return;
    const card = CARD_DEFINITIONS[game.players[1].hand[choice.handIndex]];
    await showCardCast(card);
    const result = await cpuStep(`CPU ${card.name}`, () => engine.playAction(game, 1, choice.handIndex, choice.payload), "select");
    used = result.ok;
    if (game.pendingDiscardSelection?.playerId === 1) {
      const indexes = game.players[1].hand.map((_, index) => index).slice(0, game.pendingDiscardSelection.count);
      await cpuStep("CPU 捨てる", () => engine.resolvePendingDiscardSelection(game, 1, indexes), "select");
    }
    if (game.pendingPileSearch?.playerId === 1) {
      const indexes = game.piles.find((pile) => pile.id === game.pendingPileSearch.pileId)?.deck
        .map((cardId, index) => ({ cardId, index, card: CARD_DEFINITIONS[cardId] }))
        .sort((a, b) => cardScore(b.card) - cardScore(a.card))
        .slice(0, game.pendingPileSearch.count)
        .map((entry) => entry.index) || [];
      await cpuStep("CPU 下準備", () => engine.resolvePendingPileSearch(game, 1, indexes), "draw");
    }
  }
}

function chooseCpuAction() {
  const player = game.players[1];
  const opponent = game.players[0];
  const findAction = (effectKey) => player.hand.findIndex((cardId) => CARD_DEFINITIONS[cardId].effectKey === effectKey);
  const strength = (unit) => unit.power + unit.hp;
  const strongestEnemy = [...opponent.field].sort((a, b) => strength(b) - strength(a))[0];

  let index = findAction("healLifeThree");
  if (index !== -1 && player.life <= 7) return { handIndex: index, payload: {} };

  index = findAction("dealTwoToUnitOrLife");
  if (index !== -1) {
    if (opponent.life <= 3) return { handIndex: index, payload: { targetType: "life" } };
    const target = opponent.field.find((unit) => unit.hp <= 3) || strongestEnemy;
    if (target) return { handIndex: index, payload: { unitId: target.id } };
  }

  index = findAction("discardUnit");
  if (index !== -1 && strongestEnemy && strength(strongestEnemy) >= 5) return { handIndex: index, payload: { unitId: strongestEnemy.id } };

  index = findAction("shockWave");
  if (index !== -1 && opponent.field.length >= 2) return { handIndex: index, payload: {} };

  index = findAction("reviveUnit");
  if (index !== -1 && player.field.length < engine.getPublicState(game, 0).maxFieldSize) {
    const discardIndex = game.discard.findIndex((cardId) => CARD_DEFINITIONS[cardId]?.type === "unit");
    if (discardIndex !== -1) return { handIndex: index, payload: { discardIndex } };
  }

  index = findAction("drawTwoGainAction");
  if (index !== -1 && player.hand.length <= 8) {
    const pile = [...game.piles].filter((candidate) => candidate.deck.length > 0).sort((a, b) => b.deck.length - a.deck.length)[0];
    if (pile) return { handIndex: index, payload: { pileId: pile.id } };
  }

  index = findAction("searchTwoFromPile");
  if (index !== -1 && player.hand.length <= 8) {
    const pile = [...game.piles].filter((candidate) => candidate.deck.length > 0).sort((a, b) => b.deck.length - a.deck.length)[0];
    if (pile) return { handIndex: index, payload: { pileId: pile.id } };
  }

  index = findAction("drawOneBuffOwnField");
  if (index !== -1 && player.field.length > 0) {
    const pile = [...game.piles].find((candidate) => candidate.deck.length > 0);
    if (pile) return { handIndex: index, payload: { pileId: pile.id } };
  }

  index = findAction("discardOpponentHand");
  if (index !== -1 && opponent.hand.length >= 4) return { handIndex: index, payload: { opponentHandIndex: Math.floor(Math.random() * opponent.hand.length) } };

  index = findAction("redCard");
  if (index !== -1 && opponent.hand.length >= 5) return { handIndex: index, payload: {} };

  return null;
}

function cardScore(card) {
  if (!card) return 0;
  if (card.type === "unit") return 30 + card.hp + card.power * 2;
  if (card.type === "action") return 22;
  if (card.type === "item") return 18;
  return 0;
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
    const defender = chooseCpuAttackTarget(attacker);
    if (!defender) return;
    const monsterResult = await cpuStep("CPU 戦闘", () => {
      addFx(`field:1:${attacker.id}`, "fx-attack");
      addFx(`field:0:${defender.id}`, "fx-hit");
      return engine.attackMonster(game, 1, attacker.id, defender.id);
    }, "attack");
    acted = monsterResult.ok;
  }
}

function chooseCpuAttackTarget(attacker) {
  const targets = filterAttackTargets(game.players[0].field);
  if (targets.length === 0) return null;
  return [...targets].sort((a, b) => {
    const damage = engine.getEffectivePower(game, attacker, a, "attack");
    const aKill = a.hp <= damage ? 1 : 0;
    const bKill = b.hp <= damage ? 1 : 0;
    if (aKill !== bKill) return bKill - aKill;
    return (a.hp + a.power) - (b.hp + b.power);
  })[0];
}

async function cpuStep(label, action, sound) {
  showFloat(label, "cpu");
  playSound(sound);
  const result = await action();
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
  titleRulesOpen = false;
  titleCardsOpen = false;
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

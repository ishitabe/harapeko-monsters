function createGameEngine(cards, pileDefinitions, cardPool = Object.keys(cards)) {
  const startingLife = 7;
  const startingActions = 2;
  const maxFieldSize = 2;
  let nextUnitId = 1;

  function createGame() {
    const game = {
      firstPlayer: 0,
      activePlayer: 0,
      turn: 1,
      winner: null,
      players: [createPlayer("プレイヤー1"), createPlayer("プレイヤー2")],
      doubleNextAction: null,
      pendingQuickReplay: null,
      pendingOpponentHandCheck: null,
      piles: pileDefinitions.map((pile) => ({ id: pile.id, name: pile.name, deck: [] })),
      discard: [],
      log: [],
      lastMessage: "山札を1つ選んでドローしてください。",
    };

    distributeCardsAcrossDecks(game, shuffle([...cardPool]));
    dealOpeningHands(game);
    game.players[0].actions = 1;
    return game;
  }

  function createPlayer(name) {
    return {
      name,
      life: startingLife,
      hand: [],
      field: [],
      actions: startingActions,
      hasDrawnThisTurn: false,
    };
  }

  function dealOpeningHands(game) {
    const order = [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
    order.forEach((playerId, index) => drawCard(game, playerId, game.piles[index % 3].id, { silent: true, skipRebalance: true }));
    addLog(game, "初期手札を配りました。先攻5枚、後攻6枚です。");
  }

  function getPublicState(game, viewerId = game.activePlayer) {
    return {
      activePlayer: game.activePlayer,
      firstPlayer: game.firstPlayer,
      turn: game.turn,
      winner: game.winner,
      doubleNextAction: game.doubleNextAction,
      pendingQuickReplay: game.pendingQuickReplay,
      pendingOpponentHandCheck: game.pendingOpponentHandCheck,
      maxFieldSize,
      lastMessage: game.lastMessage,
      log: [...game.log],
      discard: [...game.discard],
      piles: game.piles.map((pile) => ({
        id: pile.id,
        name: pile.name,
        count: pile.deck.length,
        topCardId: pile.deck[0] || null,
      })),
      players: game.players.map((player, ownerId) => ({
        name: player.name,
        life: player.life,
        actions: player.actions,
        hasDrawnThisTurn: player.hasDrawnThisTurn,
        handCount: player.hand.length,
        hand: canViewHand(game, viewerId, ownerId) ? [...player.hand] : [],
        field: player.field.map((unit) => publicUnit(unit, ownerId, viewerId)),
      })),
    };
  }

  function drawFromPile(game, playerId, pileId) {
    if (!canAct(game, playerId)) return fail(game, "今はそのプレイヤーのターンではありません。");
    const player = game.players[playerId];
    if (player.hasDrawnThisTurn) return fail(game, "このターンはすでにドローしています。");

    ensureDecksHaveCards(game);
    const drawn = drawCard(game, playerId, pileId, { silent: true });
    if (!drawn) return fail(game, "その山札は空です。");

    player.hasDrawnThisTurn = true;
    game.lastMessage = `${player.name}が${cards[drawn].name}をドローしました。`;
    addLog(game, `${player.name}が${getPile(game, pileId).name}から${cards[drawn].name}をドロー。`);
    return ok(game);
  }

  function summonFromHand(game, playerId, handIndex) {
    if (!canAct(game, playerId)) return fail(game, "今はそのプレイヤーのターンではありません。");
    const player = game.players[playerId];
    if (!player.hasDrawnThisTurn) return fail(game, "先にターン開始ドローをしてください。");
    if (player.actions <= 0) return fail(game, "アクション権がありません。");
    if (player.field.length >= maxFieldSize) return fail(game, "場が埋まっています。");

    const cardId = player.hand[Number(handIndex)];
    const card = cards[cardId];
    if (!card || card.type !== "unit") return fail(game, "召喚できるモンスターを選んでください。");

    player.hand.splice(Number(handIndex), 1);

    player.actions -= 1;
    player.field.push(createUnit(cardId, game.turn));
    game.lastMessage = `${player.name}が${card.name}を召喚しました。召喚ターンは行動できません。`;
    addLog(game, game.lastMessage);
    return ok(game);
  }

  function equipItemFromHand(game, playerId, handIndex, unitId) {
    if (!canAct(game, playerId)) return fail(game, "今はそのプレイヤーのターンではありません。");
    const player = game.players[playerId];
    if (!player.hasDrawnThisTurn) return fail(game, "先にターン開始ドローをしてください。");
    const cardId = player.hand[Number(handIndex)];
    const card = cards[cardId];
    if (!card || card.type !== "item") return fail(game, "装備する持ち物カードを選んでください。");
    const unit = findUnit(player, unitId);
    if (!unit) return fail(game, "自分の場のモンスターを選んでください。");
    if (unit.item) return fail(game, "そのモンスターにはすでに持ち物があります。");

    player.hand.splice(Number(handIndex), 1);
    unit.item = { cardId, revealed: false };
    if (card.effectKey === "maxHpPlusTwo") {
      unit.maxHp += 2;
      unit.hp += 2;
    }
    game.lastMessage = `${cards[unit.cardId].name}に持ち物を裏向きで装備しました。`;
    addLog(game, game.lastMessage);
    return ok(game);
  }

  function playAction(game, playerId, handIndex, payload = {}) {
    if (!canAct(game, playerId)) return fail(game, "今はそのプレイヤーのターンではありません。");
    const player = game.players[playerId];
    if (!player.hasDrawnThisTurn) return fail(game, "先にターン開始ドローをしてください。");
    if (player.actions <= 0) return fail(game, "アクション権がありません。");

    const cardId = player.hand[Number(handIndex)];
    const card = cards[cardId];
    if (!card || card.type !== "action") return fail(game, "手札のアクションカードを選んでください。");

    player.hand.splice(Number(handIndex), 1);
    adjustPayloadAfterActionRemoval(payload, Number(handIndex));
    player.actions -= 1;
    game.discard.push(cardId);

    const shouldReplay = game.doubleNextAction === playerId && card.effectKey !== "doubleNextAction";
    if (shouldReplay) {
      game.doubleNextAction = null;
      game.pendingQuickReplay = { playerId, cardId };
    }

    const result = resolveActionCard(game, playerId, card, payload);
    if (!result.ok) return result;

    game.lastMessage = shouldReplay
      ? `${player.name}が${card.name}を使用しました。早業でもう一度使えます。`
      : `${player.name}が${card.name}を使用しました。`;
    addLog(game, game.lastMessage);
    checkWinner(game);
    rebalanceDecksIfNeeded(game);
    return ok(game);
  }

  function resolveActionCard(game, playerId, card, payload) {
    const player = game.players[playerId];
    const opponentId = opponentOf(playerId);
    const opponent = game.players[opponentId];

    if (card.effectKey === "stealOpponentItems") {
      let count = 0;
      opponent.field.forEach((unit) => {
        if (!unit.item) return;
        player.hand.push(unit.item.cardId);
        unit.item = null;
        count += 1;
      });
      addLog(game, `${card.name}: 持ち物を${count}枚奪いました。`);
      return ok(game);
    }

    if (card.effectKey === "setAllCurrentHpToOne") {
      game.players.forEach((candidate) => candidate.field.forEach((unit) => { unit.hp = Math.min(unit.hp, 1); }));
      return ok(game);
    }

    if (card.effectKey === "discardUnit") {
      const located = findUnitById(game, payload.unitId);
      if (!located) return fail(game, "捨札に送るモンスターを選んでください。");
      moveUnitToDiscard(game, located.ownerId, located.unit);
      return ok(game);
    }

    if (card.effectKey === "drawThreeDiscardTwo") {
      if (!payload.pileId) return fail(game, "山札を選んでください。");
      drawMultiple(game, playerId, payload.pileId, 3);
      return discardHandCards(game, playerId, payload.discardHandIndexes, 2);
    }

    if (card.effectKey === "swapUnits") {
      const own = findUnit(player, payload.ownUnitId);
      const enemy = findUnit(opponent, payload.opponentUnitId);
      if (!own || !enemy) return fail(game, "自分と相手のモンスターを1体ずつ選んでください。");
      swapUnits(game, playerId, payload.ownUnitId, opponentId, payload.opponentUnitId);
      return ok(game);
    }

    if (card.effectKey === "drawOneEachDiscardOne") {
      game.piles.forEach((pile) => drawCard(game, playerId, pile.id, { silent: true }));
      return discardHandCards(game, playerId, payload.discardHandIndexes, 1);
    }

    if (card.effectKey === "reviveUnit") {
      if (player.field.length >= maxFieldSize) return fail(game, "自分の場が埋まっています。");
      const discardIndex = Number(payload.discardIndex);
      const reviveCardId = game.discard[discardIndex];
      if (!cards[reviveCardId] || cards[reviveCardId].type !== "unit") return fail(game, "捨札のモンスターを選んでください。");
      game.discard.splice(discardIndex, 1);
      player.field.push(createUnit(reviveCardId, game.turn));
      return ok(game);
    }

    if (card.effectKey === "drawTwoGainAction") {
      if (!payload.pileId) return fail(game, "山札を選んでください。");
      drawMultiple(game, playerId, payload.pileId, 2);
      return ok(game);
    }

    if (card.effectKey === "doubleNextAction") {
      game.doubleNextAction = playerId;
      return ok(game);
    }

    if (card.effectKey === "takeDiscardToHand") {
      const discardIndex = Number(payload.discardIndex);
      const targetCardId = game.discard[discardIndex];
      if (!targetCardId) return fail(game, "捨札からカードを選んでください。");
      game.discard.splice(discardIndex, 1);
      player.hand.push(targetCardId);
      return ok(game);
    }

    if (card.effectKey === "discardOpponentHand") {
      if (payload.opponentHandIndex === undefined || payload.opponentHandIndex === null || payload.opponentHandIndex === "") {
        game.pendingOpponentHandCheck = { playerId, opponentId };
        return ok(game);
      }
      const opponentHandIndex = Number(payload.opponentHandIndex);
      const targetCardId = opponent.hand[opponentHandIndex];
      if (!targetCardId) return fail(game, "相手の手札からカードを選んでください。");
      opponent.hand.splice(opponentHandIndex, 1);
      game.discard.push(targetCardId);
      return ok(game);
    }

    if (card.effectKey === "dealTwoToUnitOrLife") {
      if (payload.targetType === "life") {
        opponent.life = Math.max(0, opponent.life - 2);
        checkWinner(game);
        return ok(game);
      }
      const located = findUnitById(game, payload.unitId);
      if (!located) return fail(game, "ダメージ対象を選んでください。");
      applyDamage(game, located.ownerId, located.unit, 2);
      discardDeadUnits(game);
      return ok(game);
    }

    return fail(game, "このアクションは未実装です。");
  }

  function gainLifeWithUnit(game, playerId, unitId) {
    if (!canAct(game, playerId)) return fail(game, "今はそのプレイヤーのターンではありません。");
    const player = game.players[playerId];
    if (!player.hasDrawnThisTurn) return fail(game, "先にターン開始ドローをしてください。");
    const unit = findUnit(player, unitId);
    if (!unit || !unit.canAct) return fail(game, "そのモンスターは行動できません。");
    if (cards[unit.cardId].effectKey !== "attackOrGainLife") return fail(game, "このモンスターはライフ+2を選べません。");

    unit.canAct = false;
    player.life += 2;
    game.lastMessage = `${cards[unit.cardId].name}がライフ+2を選びました。`;
    addLog(game, game.lastMessage);
    resolveAfterAction(game, playerId, unit.id);
    return ok(game);
  }

  function attackLife(game, playerId, attackerId) {
    if (!canAct(game, playerId)) return fail(game, "今はそのプレイヤーのターンではありません。");
    const player = game.players[playerId];
    if (!player.hasDrawnThisTurn) return fail(game, "先にターン開始ドローをしてください。");
    const attacker = findUnit(player, attackerId);
    if (!attacker || !attacker.canAct) return fail(game, "そのモンスターは行動できません。");
    const opponentId = opponentOf(playerId);
    if (hasEffect(game.players[opponentId], "blockLifeAttacks")) return fail(game, "カビゴンがいるためライフ攻撃できません。");
    if (game.players[opponentId].field.length >= maxFieldSize) return fail(game, "相手の場にモンスターが2体いるため、壁でライフ攻撃できません。");

    const damage = getEffectivePower(game, attacker, null, "lifeAttack");
    attacker.canAct = false;
    game.players[opponentId].life = Math.max(0, game.players[opponentId].life - damage);
    game.lastMessage = `${cards[attacker.cardId].name}がライフに${damage}ダメージ。`;
    addLog(game, game.lastMessage);
    checkWinner(game);
    resolveAfterAction(game, playerId, attacker.id);
    return ok(game);
  }

  function attackMonster(game, playerId, attackerId, defenderId) {
    if (!canAct(game, playerId)) return fail(game, "今はそのプレイヤーのターンではありません。");
    const player = game.players[playerId];
    if (!player.hasDrawnThisTurn) return fail(game, "先にターン開始ドローをしてください。");
    const attacker = findUnit(player, attackerId);
    const defenderOwnerId = opponentOf(playerId);
    const defender = findUnit(game.players[defenderOwnerId], defenderId);
    if (!attacker || !attacker.canAct) return fail(game, "そのモンスターは行動できません。");
    if (!defender) return fail(game, "相手のモンスターを選んでください。");

    attacker.canAct = false;
    const result = resolveCombat(game, playerId, attacker, defenderOwnerId, defender);
    game.lastMessage = `${cards[attacker.cardId].name}が${cards[defender.cardId].name}を攻撃しました。`;
    addLog(game, `同時処理: 相手に${result.defenderDamage}、反撃で${result.attackerDamage}ダメージ。`);
    discardDeadUnits(game);
    resolveAfterAction(game, playerId, attacker.id);
    return ok(game);
  }

  function endTurn(game, playerId) {
    if (!canAct(game, playerId)) return fail(game, "今はそのプレイヤーのターンではありません。");
    if (game.winner !== null) return ok(game);

    if (game.doubleNextAction === playerId) game.doubleNextAction = null;
    if (game.pendingQuickReplay?.playerId === playerId) game.pendingQuickReplay = null;
    if (game.pendingOpponentHandCheck?.playerId === playerId) game.pendingOpponentHandCheck = null;

    healAllUnits(game);
    const nextPlayerId = opponentOf(playerId);
    game.activePlayer = nextPlayerId;
    game.turn += 1;
    startTurn(game, nextPlayerId);
    game.lastMessage = `${game.players[nextPlayerId].name}のターンです。山札を1つ選んでドローしてください。`;
    addLog(game, `${game.players[playerId].name}がターン終了。`);
    return ok(game);
  }

  function startTurn(game, playerId) {
    const player = game.players[playerId];
    player.actions = startingActions;
    player.hasDrawnThisTurn = false;
    player.field.forEach((unit) => {
      unit.canAct = unit.summonedTurn < game.turn;
      unit.power = cards[unit.cardId].power;
    });
  }

  function drawCard(game, playerId, pileId, options = {}) {
    ensureDecksHaveCards(game);
    const pile = getPile(game, pileId);
    if (!pile || pile.deck.length === 0) return null;
    const cardId = pile.deck.shift();
    game.players[playerId].hand.push(cardId);
    if (!options.silent) addLog(game, `${game.players[playerId].name}が${cards[cardId].name}をドロー。`);
    if (!options.skipRebalance) rebalanceDecksIfNeeded(game);
    return cardId;
  }

  function drawMultiple(game, playerId, pileId, amount) {
    for (let index = 0; index < amount; index += 1) drawCard(game, playerId, pileId, { silent: true });
  }

  function getEffectivePower(game, unit, targetUnit, reason) {
    let power = unit.power;
    const card = cards[unit.cardId];
    const unitOwnerId = ownerOfUnit(game, unit.id);
    const targetOwnerId = targetUnit ? ownerOfUnit(game, targetUnit.id) : opponentOf(unitOwnerId);
    const powerIncreaseBlocked = targetOwnerId !== null && hasEffect(game.players[targetOwnerId], "ignorePowerIncreases");

    if ((reason === "attack" || reason === "lifeAttack") && !powerIncreaseBlocked) {
      if (card.effectKey === "attackPowerPlusFive") power += 5;
      if (unit.item && cards[unit.item.cardId].effectKey === "attackPowerPlusTwo") {
        revealItem(game, unit, "拘り鉢巻でパワー+2。");
        power += 2;
      }
      if (unit.cardId === "pikachu" && unit.item && cards[unit.item.cardId].effectKey === "pikachuPowerPlusFive") {
        revealItem(game, unit, "でんきだまでパワー+5。");
        power += 5;
      }
    }

    if (card.effectKey === "useTargetPowerAsDamage" && targetUnit && reason === "attack") {
      power = targetUnit.hp;
    }

    return power;
  }

  function applyDamage(game, ownerId, unit, amount) {
    if (amount <= 0) return false;
    if (unit.item && cards[unit.item.cardId].effectKey === "maxHpPlusTwo") revealItem(game, unit, "突撃チョッキのHP+2が影響しました。");
    if (unit.hp - amount <= 0 && unit.item && cards[unit.item.cardId].effectKey === "surviveLethalAtOne") {
      revealItem(game, unit, "気合いのタスキでHP1で耐えました。");
      discardItem(game, unit);
      unit.hp = 1;
      return false;
    }
    unit.hp = Math.max(0, unit.hp - amount);
    return unit.hp <= 0;
  }

  function resolveCombat(game, attackerOwnerId, attacker, defenderOwnerId, defender) {
    const defenderDamage = getEffectivePower(game, attacker, defender, "attack");
    const attackerDamage = getEffectivePower(game, defender, attacker, "counter");
    applyDamage(game, defenderOwnerId, defender, defenderDamage);
    applyDamage(game, attackerOwnerId, attacker, attackerDamage);
    resolveDestinyCloak(game, attacker, defender);
    resolveDestinyCloak(game, defender, attacker);
    return { attackerDamage, defenderDamage };
  }

  function onDeath(game, ownerId, unit) {
    const card = cards[unit.cardId];
    if (unit.item) discardItem(game, unit);
    game.discard.push(unit.cardId);
    addLog(game, `${card.name}を捨札へ送りました。`);
    if (card.effectKey === "drawTwoOnDeath") {
      drawAnyAvailableCard(game, ownerId);
      drawAnyAvailableCard(game, ownerId);
      addLog(game, `${card.name}の死亡時効果で2ドロー。`);
    }
  }

  function resolveAfterAction(game, actorId, actedUnitId) {
    const unit = findUnit(game.players[actorId], actedUnitId);
    if (!unit || cards[unit.cardId].effectKey !== "damageAllOthersAfterAct") return;
    game.players.forEach((player, ownerId) => {
      player.field.forEach((target) => {
        if (target.id !== unit.id) applyDamage(game, ownerId, target, 1);
      });
    });
    addLog(game, `${cards[unit.cardId].name}が自分以外の全モンスターに1ダメージ。`);
    discardDeadUnits(game);
  }

  function createUnit(cardId, summonedTurn, itemCardId = null) {
    const card = cards[cardId];
    const itemCard = itemCardId ? cards[itemCardId] : null;
    const hpBonus = itemCard && itemCard.effectKey === "maxHpPlusTwo" ? 2 : 0;
    return {
      id: `u${nextUnitId++}`,
      cardId,
      hp: card.hp + hpBonus,
      maxHp: card.hp + hpBonus,
      baseHp: card.hp,
      power: card.power,
      canAct: false,
      summonedTurn,
      item: itemCardId ? { cardId: itemCardId, revealed: false } : null,
    };
  }

  function publicUnit(unit, ownerId, viewerId) {
    const hiddenVest = ownerId !== viewerId && unit.item && !unit.item.revealed && cards[unit.item.cardId].effectKey === "maxHpPlusTwo";
    return {
      ...unit,
      hp: hiddenVest ? Math.min(unit.hp, unit.baseHp) : unit.hp,
      maxHp: hiddenVest ? unit.baseHp : unit.maxHp,
      item: unit.item ? {
        hasItem: true,
        revealed: unit.item.revealed,
        visibleCardId: ownerId === viewerId || unit.item.revealed ? unit.item.cardId : null,
      } : { hasItem: false, revealed: false, visibleCardId: null },
    };
  }

  function canViewHand(game, viewerId, ownerId) {
    if (ownerId === viewerId) return true;
    const pending = game.pendingOpponentHandCheck;
    return Boolean(pending && pending.playerId === viewerId && pending.opponentId === ownerId);
  }

  function discardDeadUnits(game) {
    game.players.forEach((player, ownerId) => {
      const survivors = [];
      player.field.forEach((unit) => {
        if (unit.hp <= 0) onDeath(game, ownerId, unit);
        else survivors.push(unit);
      });
      player.field = survivors;
    });
  }

  function moveUnitToDiscard(game, ownerId, unit) {
    const player = game.players[ownerId];
    const index = player.field.findIndex((candidate) => candidate.id === unit.id);
    if (index === -1) return;
    if (unit.item) discardItem(game, unit);
    game.discard.push(unit.cardId);
    player.field.splice(index, 1);
    addLog(game, `${cards[unit.cardId].name}を捨札へ送りました。`);
  }

  function discardHandCards(game, playerId, indexes, requiredCount) {
    const player = game.players[playerId];
    let chosen = normalizeIndexes(indexes);
    if (chosen.length < requiredCount) {
      chosen = player.hand.map((_, index) => index).slice(0, requiredCount);
    }
    if (chosen.length < requiredCount) return fail(game, `捨てるカードを${requiredCount}枚選んでください。`);
    chosen.sort((a, b) => b - a).forEach((index) => {
      const cardId = player.hand[index];
      if (!cardId) return;
      player.hand.splice(index, 1);
      game.discard.push(cardId);
    });
    return ok(game);
  }

  function healAllUnits(game) {
    game.players.forEach((player) => player.field.forEach((unit) => { unit.hp = unit.maxHp; }));
  }

  function ensureDecksHaveCards(game) {
    const totalDeckCards = game.piles.reduce((total, pile) => total + pile.deck.length, 0);
    if (totalDeckCards > 0) return;
    const pool = game.discard.splice(0);
    distributeCardsAcrossDecks(game, shuffle(pool.length > 0 ? pool : [...cardPool]));
    addLog(game, "山札を再構築しました。");
  }

  function rebalanceDecksIfNeeded(game) {
    const emptyCount = game.piles.filter((pile) => pile.deck.length === 0).length;
    if (emptyCount < 2) return;
    const pool = shuffle([...game.piles.flatMap((pile) => pile.deck), ...game.discard]);
    if (pool.length === 0) return;
    distributeCardsAcrossDecks(game, pool);
    addLog(game, "2つの山札が空になったため、山札と捨札をすべてシャッフルして3山に均等分配しました。");
  }

  function distributeCardsAcrossDecks(game, pool) {
    game.piles.forEach((pile) => { pile.deck = []; });
    game.discard = [];
    pool.forEach((cardId, index) => {
      game.piles[index % game.piles.length].deck.push(cardId);
    });
  }

  function resolveDestinyCloak(game, deadCandidate, opposingUnit) {
    if (deadCandidate.hp > 0 || !deadCandidate.item) return;
    if (cards[deadCandidate.item.cardId].effectKey !== "destroyOpponentOnDeath") return;
    revealItem(game, deadCandidate, "道連れマントで相手も破壊します。");
    opposingUnit.hp = 0;
  }

  function revealItem(game, unit, message) {
    if (!unit.item || unit.item.revealed) return;
    unit.item.revealed = true;
    addLog(game, `${cards[unit.item.cardId].name}を公開。${message}`);
  }

  function discardItem(game, unit) {
    if (!unit.item) return;
    game.discard.push(unit.item.cardId);
    addLog(game, `${cards[unit.item.cardId].name}を捨札へ送りました。`);
    unit.item = null;
  }

  function findUnit(player, unitId) {
    return player.field.find((unit) => unit.id === unitId);
  }

  function findUnitById(game, unitId) {
    for (let ownerId = 0; ownerId < game.players.length; ownerId += 1) {
      const unit = findUnit(game.players[ownerId], unitId);
      if (unit) return { ownerId, unit };
    }
    return null;
  }

  function swapUnits(game, ownerA, unitAId, ownerB, unitBId) {
    const fieldA = game.players[ownerA].field;
    const fieldB = game.players[ownerB].field;
    const indexA = fieldA.findIndex((unit) => unit.id === unitAId);
    const indexB = fieldB.findIndex((unit) => unit.id === unitBId);
    if (indexA === -1 || indexB === -1) return;
    [fieldA[indexA], fieldB[indexB]] = [fieldB[indexB], fieldA[indexA]];
  }

  function getPile(game, pileId) {
    return game.piles.find((pile) => pile.id === pileId);
  }

  function addToDiscard(game, cardId) {
    game.discard.push(cardId);
    rebalanceDecksIfNeeded(game);
  }

  function resolvePendingOpponentHandCheck(game, playerId, opponentHandIndex) {
    const pending = game.pendingOpponentHandCheck;
    if (!pending || pending.playerId !== playerId) return fail(game, "二重チェックの処理待ちではありません。");
    const opponent = game.players[pending.opponentId];
    const targetCardId = opponent.hand[Number(opponentHandIndex)];
    if (!targetCardId) return fail(game, "相手の手札からカードを選んでください。");
    opponent.hand.splice(Number(opponentHandIndex), 1);
    game.discard.push(targetCardId);
    game.pendingOpponentHandCheck = null;
    game.lastMessage = `${cards[targetCardId].name}を二重チェックで捨札へ送りました。`;
    addLog(game, game.lastMessage);
    return ok(game);
  }

  function resolvePendingQuickReplay(game, playerId, payload = {}) {
    const pending = game.pendingQuickReplay;
    if (!pending || pending.playerId !== playerId) return fail(game, "早業の2回目処理待ちではありません。");
    if (!canAct(game, playerId)) return fail(game, "今はそのプレイヤーのターンではありません。");
    const card = cards[pending.cardId];
    if (!card || card.type !== "action") return fail(game, "早業で使うカードが見つかりません。");

    const result = resolveActionCard(game, playerId, card, payload);
    if (!result.ok) return result;

    game.pendingQuickReplay = null;
    game.lastMessage = `${game.players[playerId].name}が早業で${card.name}をもう一度使用しました。`;
    addLog(game, game.lastMessage);
    checkWinner(game);
    rebalanceDecksIfNeeded(game);
    return ok(game);
  }

  function drawAnyAvailableCard(game, playerId) {
    const pile = game.piles.find((candidate) => candidate.deck.length > 0);
    return pile ? drawCard(game, playerId, pile.id, { silent: true }) : null;
  }

  function adjustPayloadAfterActionRemoval(payload, removedIndex) {
    if (!payload) return;
    if (Array.isArray(payload.repeats)) payload.repeats.forEach((repeat) => adjustPayloadAfterActionRemoval(repeat, removedIndex));
    if (payload.discardHandIndexes) {
      payload.discardHandIndexes = normalizeIndexes(payload.discardHandIndexes)
        .filter((index) => index !== removedIndex)
        .map((index) => (index > removedIndex ? index - 1 : index));
    }
  }

  function normalizeIndexes(indexes) {
    if (Array.isArray(indexes)) return indexes.map(Number).filter((index) => Number.isInteger(index));
    if (indexes === undefined || indexes === null || indexes === "") return [];
    return [Number(indexes)].filter((index) => Number.isInteger(index));
  }

  function checkWinner(game) {
    const defeated = game.players.findIndex((player) => player.life <= 0);
    if (defeated === -1) return;
    game.players.forEach((player) => {
      player.life = Math.max(0, player.life);
    });
    game.winner = opponentOf(defeated);
    game.doubleNextAction = null;
    game.pendingQuickReplay = null;
    game.pendingOpponentHandCheck = null;
    game.lastMessage = `決着！${game.players[game.winner].name}の勝ちです。`;
    addLog(game, game.lastMessage);
  }

  function canAct(game, playerId) {
    return game.winner === null && game.activePlayer === playerId;
  }

  function opponentOf(playerId) {
    return playerId === 0 ? 1 : 0;
  }

  function ownerOfUnit(game, unitId) {
    const index = game.players.findIndex((player) => player.field.some((unit) => unit.id === unitId));
    return index === -1 ? null : index;
  }

  function hasEffect(player, effectKey) {
    return player.field.some((unit) => cards[unit.cardId].effectKey === effectKey);
  }

  function shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[target]] = [copy[target], copy[index]];
    }
    return copy;
  }

  function addLog(game, message) {
    game.log.unshift(message);
    game.log = game.log.slice(0, 16);
  }

  function ok(game) {
    return { ok: true, state: game };
  }

  function fail(game, message) {
    game.lastMessage = message;
    return { ok: false, state: game, message };
  }

  return {
    createGame,
    getPublicState,
    drawFromPile,
    summonFromHand,
    equipItemFromHand,
    playAction,
    gainLifeWithUnit,
    attackLife,
    attackMonster,
    endTurn,
    addToDiscard,
    resolvePendingOpponentHandCheck,
    resolvePendingQuickReplay,
    getEffectivePower,
    applyDamage,
    resolveCombat,
    onDeath,
  };
}

if (typeof window !== "undefined") window.CardGameEngine = createGameEngine;
if (typeof module !== "undefined") module.exports = createGameEngine;

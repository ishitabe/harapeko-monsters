function createGameEngine(cards, pileDefinitions, cardPool = Object.keys(cards)) {
  const startingLife = 12;
  const startingActions = 2;
  const maxFieldSize = 3;
  const maxHandSize = 10;
  let nextUnitId = 1;

  function createGame() {
    const firstPlayer = Math.random() < 0.5 ? 0 : 1;
    const game = {
      firstPlayer,
      activePlayer: firstPlayer,
      turn: 1,
      winner: null,
      players: [createPlayer("プレイヤー1"), createPlayer("プレイヤー2")],
      doubleNextAction: null,
      pendingQuickReplay: null,
      pendingOpponentHandCheck: null,
      pendingDiscardSelection: null,
      pendingPileSearch: null,
      lastPlayedAction: null,
      piles: pileDefinitions.map((pile) => ({ id: pile.id, name: pile.name, deck: [] })),
      discard: [],
      log: [],
      lastMessage: "山札を1つ選んでドローしてください。",
    };

    distributeCardsAcrossDecks(game, shuffle([...cardPool]));
    dealOpeningHands(game);
    game.players[firstPlayer].actions = 1;
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
      mysticGuardUntilTurn: 0,
      noCounterThisTurn: false,
      actionPenaltyNextTurn: 0,
      damageReductionUntilTurn: 0,
    };
  }

  function dealOpeningHands(game) {
    const secondPlayer = opponentOf(game.firstPlayer);
    const order = [secondPlayer, game.firstPlayer, secondPlayer, game.firstPlayer, secondPlayer, game.firstPlayer, secondPlayer, game.firstPlayer, secondPlayer, game.firstPlayer, secondPlayer];
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
      pendingDiscardSelection: game.pendingDiscardSelection,
      pendingPileSearch: game.pendingPileSearch && game.pendingPileSearch.playerId === viewerId
        ? publicPendingPileSearch(game)
        : null,
      maxFieldSize,
      maxHandSize,
      lastMessage: game.lastMessage,
      lastPlayedAction: game.lastPlayedAction,
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

  function publicPendingPileSearch(game) {
    const pending = game.pendingPileSearch;
    if (pending.allPiles) {
      return {
        playerId: pending.playerId,
        allPiles: true,
        count: pending.count,
        entries: game.piles.flatMap((pile) => pile.deck.map((cardId, index) => ({
          value: `${pile.id}:${index}`,
          cardId,
          label: `${pile.name}: ${cards[cardId].name}`,
        }))),
      };
    }
    const pile = getPile(game, pending.pileId);
    return {
      playerId: pending.playerId,
      pileId: pending.pileId,
      count: pending.count,
      cards: [...pile.deck],
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
    if (!drawn.added) {
      game.lastMessage = `手札上限です。${cards[drawn.cardId].name}は捨札へ送られました。`;
      addLog(game, game.lastMessage);
      return ok(game, { drawnCards: [], discardedDrawCards: [drawn.cardId] });
    }
    game.lastMessage = `${player.name}が${cards[drawn.cardId].name}をドローしました。`;
    addLog(game, `${player.name}が${getPile(game, pileId).name}から${cards[drawn.cardId].name}をドロー。`);
    return ok(game, { drawnCards: [drawn.cardId] });
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
    const unit = createUnit(cardId, game.turn);
    if (card.effectKey === "mustBeAttacked") unit.power += game.players[opponentOf(playerId)].field.length;
    if (hasItemEffect(unit, "canActOnSummon")) unit.canAct = true;
    player.field.push(unit);
    if (card.effectKey === "enemyPowerMinusOneOnSummon") {
      game.players[opponentOf(playerId)].field.forEach((target) => lowerPower(game, opponentOf(playerId), target, 1, playerId));
    }
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
    if (card.effectKey === "pikachuPowerPlusSix" && unit.cardId === "pikachu") {
      unit.maxHp += 6;
      unit.hp += 6;
      unit.power += 6;
    }
    if (card.effectKey === "attackPowerPlusTwo") {
      unit.power += 2;
    }
    if (card.effectKey === "canActOnSummon") {
      unit.canAct = true;
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
    game.lastPlayedAction = { playerId, cardId, serial: `${game.turn}:${game.log.length}:${cardId}` };

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
    return ok(game, { drawnCards: result.drawnCards || [], discardedDrawCards: result.discardedDrawCards || [] });
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
        removeItemStats(unit);
        unit.item = null;
        count += 1;
      });
      addLog(game, `${card.name}: 持ち物を${count}枚奪いました。`);
      return ok(game);
    }

    if (card.effectKey === "setAllMaxHpToOne") {
      opponent.field.forEach((unit) => {
        if (isProtectedFromOpponentEffects(game, opponentId, playerId)) return;
        unit.maxHp = 1;
        unit.hp = Math.min(unit.hp, 1);
      });
      return ok(game);
    }

    if (card.effectKey === "discardUnit") {
      const located = findUnitById(game, payload.unitId);
      if (!located) return fail(game, "捨札に送るモンスターを選んでください。");
      if (isProtectedFromOpponentEffects(game, located.ownerId, playerId)) return fail(game, "神秘の守りで効果を受けません。");
      moveUnitToDiscard(game, located.ownerId, located.unit);
      return ok(game);
    }

    if (card.effectKey === "swapUnits") {
      swapAllUnits(game, playerId, opponentId);
      return ok(game);
    }

    if (card.effectKey === "drawOneEachDiscardOne") {
      const drawResults = game.piles.map((pile) => drawCard(game, playerId, pile.id, { silent: true })).filter(Boolean);
      const drawnCards = drawResults.filter((drawn) => drawn.added).map((drawn) => drawn.cardId);
      const discardedDrawCards = drawResults.filter((drawn) => !drawn.added).map((drawn) => drawn.cardId);
      return ok(game, { drawnCards, discardedDrawCards });
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
      const { drawnCards, discardedDrawCards } = drawMultipleDetailed(game, playerId, payload.pileId, 2);
      player.actions += 1;
      return ok(game, { drawnCards, discardedDrawCards });
    }

    if (card.effectKey === "takeDiscardToHandGainAction") {
      const discardIndex = Number(payload.discardIndex);
      const targetCardId = game.discard[discardIndex];
      if (!targetCardId) return fail(game, "捨札からカードを選んでください。");
      game.discard.splice(discardIndex, 1);
      player.hand.push(targetCardId);
      player.actions += 1;
      return ok(game);
    }

    if (card.effectKey === "discardOpponentHand") {
      if (payload.opponentHandIndex === undefined || payload.opponentHandIndex === null || payload.opponentHandIndex === "") {
        game.pendingOpponentHandCheck = { playerId, opponentId, count: 2 };
        return ok(game);
      }
      const opponentHandIndex = Number(payload.opponentHandIndex);
      const targetCardId = opponent.hand[opponentHandIndex];
      if (!targetCardId) return fail(game, "相手の手札からカードを選んでください。");
      opponent.hand.splice(opponentHandIndex, 1);
      if (player.hand.length >= maxHandSize) game.discard.push(targetCardId);
      else player.hand.push(targetCardId);
      return ok(game);
    }

    if (card.effectKey === "dealTwoToUnitOrLife") {
      if (payload.targetType === "life") {
        dealLifeDamage(game, opponentId, 3);
        checkWinner(game);
        return ok(game);
      }
      const located = findUnitById(game, payload.unitId);
      if (!located) return fail(game, "ダメージ対象を選んでください。");
      if (isProtectedFromOpponentEffects(game, located.ownerId, playerId)) return fail(game, "神秘の守りで効果を受けません。");
      applyDamage(game, located.ownerId, located.unit, 3);
      discardDeadUnits(game);
      return ok(game);
    }

    if (card.effectKey === "mysticGuard") {
      player.mysticGuardUntilTurn = game.turn + 2;
      return ok(game);
    }

    if (card.effectKey === "redCard") {
      game.discard.push(...opponent.hand);
      opponent.hand = [];
      game.piles.forEach((pile) => drawCard(game, opponentId, pile.id, { silent: true }));
      return ok(game);
    }

    if (card.effectKey === "sacrifice") {
      const located = findUnitById(game, payload.unitId);
      if (!located) return fail(game, "パワーを上げるモンスターを選んでください。");
      if (located.ownerId !== playerId) return fail(game, "自分の場のモンスターを選んでください。");
      player.hand = player.hand.filter((cardId) => {
        if (cards[cardId]?.type !== "action") return true;
        game.discard.push(cardId);
        return false;
      });
      located.unit.power += 3;
      return ok(game);
    }

    if (card.effectKey === "shockWave") {
      opponent.field.forEach((unit) => {
        if (isProtectedFromOpponentEffects(game, opponentId, playerId)) return;
        unit.hp = Math.max(0, unit.hp - 1);
        lowerPower(game, opponentId, unit, 1, playerId);
      });
      discardDeadUnits(game);
      return ok(game);
    }

    if (card.effectKey === "drawPileDiscardTwo") {
      if (!payload.pileId) return fail(game, "山札を選んでください。");
      const pile = getPile(game, payload.pileId);
      const { drawnCards, discardedDrawCards } = drawMultipleDetailed(game, playerId, pile.id, 6);
      const discardCount = Math.min(3, player.hand.length);
      if (discardCount > 0) game.pendingDiscardSelection = { playerId, count: discardCount };
      return ok(game, { drawnCards, discardedDrawCards });
    }

    if (card.effectKey === "noCounterThisTurn") {
      player.noCounterThisTurn = true;
      return ok(game);
    }

    if (card.effectKey === "healLifeThree") {
      player.life += 4;
      return ok(game);
    }

    if (card.effectKey === "searchTwoFromPile") {
      if (!payload.pileId) return fail(game, "山札を選んでください。");
      game.pendingPileSearch = { playerId, pileId: payload.pileId, count: 3 };
      return ok(game);
    }

    if (card.effectKey === "drawOneBuffOwnField") {
      const pile = payload.pileId ? getPile(game, payload.pileId) : game.piles.find((candidate) => candidate.deck.length > 0);
      const drawn = pile ? drawCard(game, playerId, pile.id, { silent: true }) : null;
      player.field.forEach((unit) => { unit.power += 2; });
      return ok(game, {
        drawnCards: drawn && drawn.added ? [drawn.cardId] : [],
        discardedDrawCards: drawn && !drawn.added ? [drawn.cardId] : [],
      });
    }

    if (card.effectKey === "buffHpByEnemyCount") {
      const amount = opponent.field.length;
      player.field.forEach((unit) => {
        unit.maxHp += amount;
        unit.hp += amount;
      });
      return ok(game);
    }

    if (card.effectKey === "damageMinusOneUntilNextTurn") {
      player.damageReductionUntilTurn = game.turn + 2;
      return ok(game);
    }

    if (card.effectKey === "searchOneFromEachPile") {
      game.pendingPileSearch = { playerId, allPiles: true, count: game.piles.filter((pile) => pile.deck.length > 0).length };
      return ok(game);
    }

    if (card.effectKey === "discardAnyGainActions") {
      const indexes = normalizeIndexes(payload.discardHandIndexes).sort((a, b) => b - a);
      let count = 0;
      indexes.forEach((index) => {
        const cardId = player.hand[index];
        if (!cardId) return;
        player.hand.splice(index, 1);
        game.discard.push(cardId);
        count += 1;
      });
      player.actions += count;
      return ok(game);
    }

    return fail(game, "このアクションは未実装です。");
  }

  function resolvePendingPileSearch(game, playerId, pileIndexes) {
    const pending = game.pendingPileSearch;
    if (!pending || pending.playerId !== playerId) return fail(game, "山札を見る効果の処理待ちではありません。");
    const player = game.players[playerId];
    if (pending.allPiles) {
      const selected = Array.isArray(pileIndexes) ? pileIndexes : normalizeIndexes(pileIndexes);
      if (selected.length === 0) return fail(game, "加えるカードを選んでください。");
      const drawnCards = [];
      const discardedDrawCards = [];
      const byPile = new Map();
      selected.forEach((value) => {
        const [pileId, rawIndex] = String(value).split(":");
        if (!byPile.has(pileId)) byPile.set(pileId, Number(rawIndex));
      });
      [...byPile.entries()].slice(0, pending.count).sort(([pileA, indexA], [pileB, indexB]) => pileA === pileB ? indexB - indexA : pileB.localeCompare(pileA)).forEach(([pileId, index]) => {
        const pile = getPile(game, pileId);
        const cardId = pile?.deck[index];
        if (!cardId) return;
        pile.deck.splice(index, 1);
        if (player.hand.length >= maxHandSize) {
          game.discard.push(cardId);
          discardedDrawCards.push(cardId);
        } else {
          player.hand.push(cardId);
          drawnCards.push(cardId);
        }
      });
      game.pendingPileSearch = null;
      reshuffleDecks(game);
      rebalanceDecksIfNeeded(game);
      return ok(game, { drawnCards, discardedDrawCards });
    }
    const pile = getPile(game, pending.pileId);
    const indexes = normalizeIndexes(pileIndexes).slice(0, pending.count).sort((a, b) => b - a);
    if (indexes.length === 0) return fail(game, "加えるカードを選んでください。");
    const drawnCards = [];
    const discardedDrawCards = [];
    indexes.forEach((index) => {
      const cardId = pile.deck[index];
      if (!cardId) return;
      pile.deck.splice(index, 1);
      if (player.hand.length >= maxHandSize) {
        game.discard.push(cardId);
        discardedDrawCards.push(cardId);
      } else {
        player.hand.push(cardId);
        drawnCards.push(cardId);
      }
    });
    game.pendingPileSearch = null;
    rebalanceDecksIfNeeded(game);
    return ok(game, { drawnCards, discardedDrawCards });
  }

  function gainLifeWithUnit(game, playerId, unitId) {
    if (!canAct(game, playerId)) return fail(game, "今はそのプレイヤーのターンではありません。");
    const player = game.players[playerId];
    if (!player.hasDrawnThisTurn) return fail(game, "先にターン開始ドローをしてください。");
    const unit = findUnit(player, unitId);
    if (!unit || !unit.canAct) return fail(game, "そのモンスターは行動できません。");
    if (cards[unit.cardId].effectKey !== "attackOrGainLife") return fail(game, "このモンスターはライフ+3を選べません。");

    unit.canAct = false;
    player.life += 3;
    game.lastMessage = `${cards[unit.cardId].name}がライフ+3を選びました。`;
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
    if (hasEffect(game.players[opponentId], "mustBeAttacked")) return fail(game, "カビゴンがいるため、ライフは攻撃できません。");
    if (game.players[opponentId].field.length >= maxFieldSize && cards[attacker.cardId].effectKey !== "ignoreWallLifeAttack") return fail(game, "相手の場にモンスターが3体いるため、壁でライフ攻撃できません。");

    const damage = getEffectivePower(game, attacker, null, "lifeAttack");
    attacker.canAct = false;
    const actualDamage = dealLifeDamage(game, opponentId, damage);
    game.lastMessage = `${cards[attacker.cardId].name}がライフに${actualDamage}ダメージ。`;
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
    if (!canTargetDefender(game.players[defenderOwnerId], defender)) return fail(game, "カビゴンがいるため、そのモンスターは攻撃できません。");

    attacker.canAct = false;
    const result = resolveAttack(game, playerId, attacker, defenderOwnerId, defender);
    const drawnCards = [];
    if (cards[attacker.cardId].effectKey === "drawFromPileOnKill" && defender.hp <= 0) {
      const drawn = drawAnyAvailableCard(game, playerId);
      if (drawn) {
        drawnCards.push(drawn);
        addLog(game, `${cards[attacker.cardId].name}の撃破時効果で1ドロー。`);
      }
    }
    game.lastMessage = `${cards[attacker.cardId].name}が${cards[defender.cardId].name}を攻撃しました。`;
    addLog(game, `同時処理: 相手に${result.defenderDamage}、反撃で${result.attackerDamage}ダメージ。`);
    discardDeadUnits(game);
    resolveAfterAction(game, playerId, attacker.id);
    return ok(game, { drawnCards });
  }

  function useUnitAbility(game, playerId, payload = {}) {
    if (!canAct(game, playerId)) return fail(game, "今はそのプレイヤーのターンではありません。");
    const player = game.players[playerId];
    if (!player.hasDrawnThisTurn) return fail(game, "先にターン開始ドローをしてください。");
    const unit = findUnit(player, payload.unitId);
    if (!unit || !unit.canAct) return fail(game, "そのモンスターは行動できません。");
    const card = cards[unit.cardId];
    const opponentId = opponentOf(playerId);
    if (payload.ability === "zeroPowerAndReturn" && card.effectKey === "zeroPowerAndReturn") {
      const target = findUnit(game.players[opponentId], payload.targetUnitId);
      if (!target) return fail(game, "相手モンスターを選んでください。");
      lowerPower(game, opponentId, target, target.power, playerId);
      moveUnitToHand(game, playerId, unit);
      return ok(game);
    }
    if (payload.ability === "doubleOwnPower" && card.effectKey === "doubleOwnPower") {
      unit.power *= 2;
      unit.canAct = false;
      return ok(game);
    }
    if (payload.ability === "reduceNextOpponentAction" && card.effectKey === "reduceNextOpponentAction") {
      game.players[opponentId].actionPenaltyNextTurn += 1;
      unit.canAct = false;
      return ok(game);
    }
    return fail(game, "使える能力がありません。");
  }

  function endTurn(game, playerId) {
    if (!canAct(game, playerId)) return fail(game, "今はそのプレイヤーのターンではありません。");
    if (game.winner !== null) return ok(game);

    if (game.doubleNextAction === playerId) game.doubleNextAction = null;
    if (game.pendingQuickReplay?.playerId === playerId) game.pendingQuickReplay = null;
    if (game.pendingOpponentHandCheck?.playerId === playerId) game.pendingOpponentHandCheck = null;
    if (game.pendingDiscardSelection?.playerId === playerId) game.pendingDiscardSelection = null;
    if (game.pendingPileSearch?.playerId === playerId) game.pendingPileSearch = null;

    applyTurnEndEffects(game, playerId);
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
    player.actions = Math.max(0, startingActions - (player.actionPenaltyNextTurn || 0));
    player.actionPenaltyNextTurn = 0;
    player.noCounterThisTurn = false;
    player.hasDrawnThisTurn = false;
    player.field.forEach((unit) => {
      unit.canAct = unit.summonedTurn < game.turn;
    });
    applyTurnStartEffects(game, playerId);
  }

  function drawCard(game, playerId, pileId, options = {}) {
    ensureDecksHaveCards(game);
    const pile = getPile(game, pileId);
    if (!pile || pile.deck.length === 0) return null;
    const cardId = pile.deck.shift();
    const player = game.players[playerId];
    if (player.hand.length >= maxHandSize) {
      game.discard.push(cardId);
      if (!options.silent) addLog(game, `${game.players[playerId].name}の手札が10枚のため、${cards[cardId].name}を捨札へ送りました。`);
      if (!options.skipRebalance) rebalanceDecksIfNeeded(game);
      return { cardId, added: false };
    }
    player.hand.push(cardId);
    if (!options.silent) addLog(game, `${game.players[playerId].name}が${cards[cardId].name}をドロー。`);
    if (!options.skipRebalance) rebalanceDecksIfNeeded(game);
    return { cardId, added: true };
  }

  function drawMultiple(game, playerId, pileId, amount) {
    return drawMultipleDetailed(game, playerId, pileId, amount).drawnCards;
  }

  function drawMultipleDetailed(game, playerId, pileId, amount) {
    const drawnCards = [];
    const discardedDrawCards = [];
    for (let index = 0; index < amount; index += 1) {
      const drawn = drawCard(game, playerId, pileId, { silent: true });
      if (drawn?.added) drawnCards.push(drawn.cardId);
      else if (drawn) discardedDrawCards.push(drawn.cardId);
    }
    return { drawnCards, discardedDrawCards };
  }

  function drawAllFromPile(game, playerId, pile) {
    const drawnCards = [];
    const discardedDrawCards = [];
    if (!pile) return { drawnCards, discardedDrawCards };
    while (pile.deck.length > 0) {
      const cardId = pile.deck.shift();
      const player = game.players[playerId];
      if (player.hand.length >= maxHandSize) {
        game.discard.push(cardId);
        discardedDrawCards.push(cardId);
        addLog(game, `${player.name}の手札が10枚のため、${cards[cardId].name}を捨札へ送りました。`);
      } else {
        player.hand.push(cardId);
        drawnCards.push(cardId);
      }
    }
    rebalanceDecksIfNeeded(game);
    return { drawnCards, discardedDrawCards };
  }

  function getEffectivePower(game, unit, targetUnit, reason) {
    let power = unit.power;
    const card = cards[unit.cardId];
    const unitOwnerId = ownerOfUnit(game, unit.id);
    const targetOwnerId = targetUnit ? ownerOfUnit(game, targetUnit.id) : opponentOf(unitOwnerId);
    const powerIncreaseBlocked = targetOwnerId !== null && hasEffect(game.players[targetOwnerId], "ignorePowerIncreases");
    if ((reason === "attack" || reason === "lifeAttack" || reason === "counter") && unit.item && cards[unit.item.cardId].effectKey === "powerEqualsHp") {
      revealItem(game, unit, "ライフパワーでパワーがHPと同じ値になります。");
      power = unit.hp;
    }
    if ((reason === "attack" || reason === "lifeAttack" || reason === "counter") && powerIncreaseBlocked) {
      power = Math.min(power, unit.basePower ?? cards[unit.cardId].power);
    }

    if ((reason === "attack" || reason === "lifeAttack") && !powerIncreaseBlocked) {
      if (card.effectKey === "attackPowerPlusFive") power += 5;
      if (reason === "attack" && targetUnit && hasEffect(game.players[unitOwnerId], "allyMonsterAttackPowerPlusTwo")) power += 2;
      if (card.effectKey === "powerPlusIfLifeTen" && game.players[unitOwnerId].life >= 10) power += 4;
      if (unit.item && cards[unit.item.cardId].effectKey === "attackPowerPlusTwo") {
        revealItem(game, unit, "拘り鉢巻でパワー+2。");
      }
      if (unit.cardId === "pikachu" && unit.item && cards[unit.item.cardId].effectKey === "pikachuPowerPlusSix") {
        revealItem(game, unit, "でんきだまでHP+6、パワー+6。");
      }
    }

    return power;
  }

  function applyDamage(game, ownerId, unit, amount) {
    amount = reduceDamageForPlayer(game, ownerId, amount);
    if (amount <= 0) return false;
    if (unit.item && cards[unit.item.cardId].effectKey === "maxHpPlusTwo") revealItem(game, unit, "突撃チョッキのHP+2が影響しました。");
    if (unit.item && cards[unit.item.cardId].effectKey === "pikachuPowerPlusSix" && unit.cardId === "pikachu") revealItem(game, unit, "でんきだまのHP+6が影響しました。");
    if (unit.hp === unit.maxHp && unit.hp - amount <= 0 && unit.item && cards[unit.item.cardId].effectKey === "surviveLethalAtOne") {
      revealItem(game, unit, "気合いのタスキでHP1で耐えました。");
      discardItem(game, unit);
      unit.hp = 1;
      return false;
    }
    unit.hp = Math.max(0, unit.hp - amount);
    return unit.hp <= 0;
  }

  function dealLifeDamage(game, playerId, amount) {
    const damage = reduceDamageForPlayer(game, playerId, amount);
    game.players[playerId].life = Math.max(0, game.players[playerId].life - damage);
    return damage;
  }

  function reduceDamageForPlayer(game, playerId, amount) {
    if (amount <= 0) return 0;
    return game.players[playerId].damageReductionUntilTurn > game.turn ? Math.max(0, amount - 1) : amount;
  }

  function resolveAttack(game, attackerOwnerId, attacker, defenderOwnerId, defender) {
    const attackerCard = cards[attacker.cardId];
    const itemCard = attacker.item ? cards[attacker.item.cardId] : null;
    const hitsAll = attackerCard.effectKey === "attackAllEnemies" || itemCard?.effectKey === "powerMinusOneAttackAll";
    if (!hitsAll) return resolveCombat(game, attackerOwnerId, attacker, defenderOwnerId, defender);

    let totalDefenderDamage = 0;
    let attackerDamage = 0;
    [...game.players[defenderOwnerId].field].forEach((target) => {
      if (!canTargetDefender(game.players[defenderOwnerId], target)) return;
      const result = resolveCombat(game, attackerOwnerId, attacker, defenderOwnerId, target);
      totalDefenderDamage += result.defenderDamage;
      attackerDamage += result.attackerDamage;
    });
    return { defenderDamage: totalDefenderDamage, attackerDamage };
  }

  function resolveCombat(game, attackerOwnerId, attacker, defenderOwnerId, defender) {
    if (cards[attacker.cardId].effectKey === "useTargetPowerAsHp") {
      defender.hp = Math.min(defender.hp, Math.max(0, defender.power));
    }
    const defenderDamage = getEffectivePower(game, attacker, defender, "attack");
    const attackerDamage = game.players[attackerOwnerId].noCounterThisTurn ? 0 : getEffectivePower(game, defender, attacker, "counter");
    applyDamage(game, defenderOwnerId, defender, defenderDamage);
    applyDamage(game, attackerOwnerId, attacker, attackerDamage);
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
    return;
  }

  function createUnit(cardId, summonedTurn, itemCardId = null) {
    const card = cards[cardId];
    const itemCard = itemCardId ? cards[itemCardId] : null;
    const hpBonus = itemCard && itemCard.effectKey === "maxHpPlusTwo" ? 2
      : itemCard && itemCard.effectKey === "pikachuPowerPlusSix" && cardId === "pikachu" ? 6
        : 0;
    const powerBonus = itemCard && itemCard.effectKey === "pikachuPowerPlusSix" && cardId === "pikachu" ? 6
      : itemCard && itemCard.effectKey === "attackPowerPlusTwo" ? 2
        : 0;
    return {
      id: `u${nextUnitId++}`,
      cardId,
      hp: card.hp + hpBonus,
      maxHp: card.hp + hpBonus,
      baseHp: card.hp,
      basePower: card.power,
      power: card.power + powerBonus,
      canAct: false,
      summonedTurn,
      item: itemCardId ? { cardId: itemCardId, revealed: false } : null,
    };
  }

  function publicUnit(unit, ownerId, viewerId) {
    const hiddenHpItem = ownerId !== viewerId && unit.item && !unit.item.revealed
      && ["maxHpPlusTwo", "pikachuPowerPlusSix"].includes(cards[unit.item.cardId].effectKey);
    const hiddenPowerItem = ownerId !== viewerId && unit.item && !unit.item.revealed
      && ["pikachuPowerPlusSix", "powerEqualsHp", "attackPowerPlusTwo"].includes(cards[unit.item.cardId].effectKey);
    const visiblePower = unit.item && cards[unit.item.cardId].effectKey === "powerEqualsHp" && (ownerId === viewerId || unit.item.revealed)
      ? unit.hp
      : unit.power;
    return {
      ...unit,
      hp: hiddenHpItem ? Math.min(unit.hp, unit.baseHp) : unit.hp,
      maxHp: hiddenHpItem ? unit.baseHp : unit.maxHp,
      power: hiddenPowerItem ? cards[unit.cardId].power : visiblePower,
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

  function moveUnitToHand(game, ownerId, unit) {
    const player = game.players[ownerId];
    const index = player.field.findIndex((candidate) => candidate.id === unit.id);
    if (index === -1) return;
    if (unit.item) discardItem(game, unit);
    player.field.splice(index, 1);
    player.hand.push(unit.cardId);
    addLog(game, `${cards[unit.cardId].name}を手札に戻しました。`);
  }

  function discardHandCards(game, playerId, indexes, requiredCount) {
    const player = game.players[playerId];
    let chosen = normalizeIndexes(indexes);
    if (chosen.length < requiredCount) {
      return fail(game, `捨てるカードを${requiredCount}枚選んでください。`);
    }
    if (chosen.length < requiredCount) return fail(game, `捨てるカードを${requiredCount}枚選んでください。`);
    chosen.sort((a, b) => b - a).forEach((index) => {
      const cardId = player.hand[index];
      if (!cardId) return;
      player.hand.splice(index, 1);
      game.discard.push(cardId);
      if (cards[cardId]?.effectKey === "gainActionWhenDiscarded") player.actions += 1;
    });
    return ok(game);
  }

  function healAllUnits(game) {
    game.players.forEach((player) => player.field.forEach((unit) => { unit.hp = unit.maxHp; }));
  }

  function applyTurnStartEffects(game, playerId) {
    const player = game.players[playerId];
    player.field.forEach((unit) => {
      if (cards[unit.cardId].effectKey !== "damageAllOthersTurnStart") return;
      game.players.forEach((candidate, ownerId) => candidate.field.forEach((target) => {
        if (target.id === unit.id) return;
        applyDamage(game, ownerId, target, 1);
      }));
      addLog(game, `${cards[unit.cardId].name}が自分以外の全モンスターに1ダメージ。`);
    });
    discardDeadUnits(game);
  }

  function applyTurnEndEffects(game, playerId) {
    const player = game.players[playerId];
    player.field.forEach((unit) => {
      if (cards[unit.cardId].effectKey === "healLifeOnTurnEnd") player.life += 1;
      if (cards[unit.cardId].effectKey === "maxHpPlusOneOnTurnEnd") {
        unit.maxHp += 1;
        unit.hp += 1;
      }
    });
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

  function reshuffleDecks(game) {
    const pool = shuffle(game.piles.flatMap((pile) => pile.deck));
    if (pool.length === 0) return;
    game.piles.forEach((pile) => { pile.deck = []; });
    pool.forEach((cardId, index) => {
      game.piles[index % game.piles.length].deck.push(cardId);
    });
    addLog(game, "ザ・サーチの効果で山札をシャッフルして3山に再分配しました。");
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
    removeItemStats(unit);
    unit.item = null;
  }

  function removeItemStats(unit) {
    if (!unit.item) return;
    const itemCard = cards[unit.item.cardId];
    if (itemCard.effectKey === "maxHpPlusTwo") {
      unit.maxHp = Math.max(unit.baseHp, unit.maxHp - 2);
      unit.hp = Math.min(unit.hp, unit.maxHp);
    }
    if (itemCard.effectKey === "pikachuPowerPlusSix" && unit.cardId === "pikachu") {
      unit.maxHp = Math.max(unit.baseHp, unit.maxHp - 6);
      unit.hp = Math.min(unit.hp, unit.maxHp);
      unit.power = Math.max(cards[unit.cardId].power, unit.power - 6);
    }
    if (itemCard.effectKey === "attackPowerPlusTwo") {
      unit.power = Math.max(cards[unit.cardId].power, unit.power - 2);
    }
  }

  function getItemPowerBonus(unit) {
    if (!unit.item) return 0;
    const itemCard = cards[unit.item.cardId];
    if (itemCard.effectKey === "pikachuPowerPlusSix" && unit.cardId === "pikachu") return 6;
    if (itemCard.effectKey === "attackPowerPlusTwo") return 2;
    return 0;
  }

  function findUnit(player, unitId) {
    return player.field.find((unit) => unit.id === unitId);
  }

  function canTargetDefender(defenderPlayer, defender) {
    const blockers = defenderPlayer.field.filter((unit) => cards[unit.cardId].effectKey === "mustBeAttacked");
    return blockers.length === 0 || blockers.some((unit) => unit.id === defender.id);
  }

  function isProtectedFromOpponentEffects(game, ownerId, sourcePlayerId) {
    return ownerId !== sourcePlayerId && game.players[ownerId].mysticGuardUntilTurn > game.turn;
  }

  function lowerPower(game, ownerId, unit, amount, sourcePlayerId) {
    if (amount <= 0) return;
    if (isProtectedFromOpponentEffects(game, ownerId, sourcePlayerId)) return;
    if (ownerId !== sourcePlayerId && hasItemEffect(unit, "powerDropTurnsToPlusFour")) {
      revealItem(game, unit, "天邪鬼マスクでパワー+4。");
      unit.power += 4;
      return;
    }
    unit.power = Math.max(0, unit.power - amount);
  }

  function hasItemEffect(unit, effectKey) {
    return Boolean(unit.item && cards[unit.item.cardId]?.effectKey === effectKey);
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

  function swapAllUnits(game, ownerA, ownerB) {
    const fieldA = game.players[ownerA].field;
    const fieldB = game.players[ownerB].field;
    game.players[ownerA].field = fieldB;
    game.players[ownerB].field = fieldA;
    [...game.players[ownerA].field, ...game.players[ownerB].field].forEach((unit) => {
      if (unit.item) unit.item.revealed = true;
    });
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
    const indexes = normalizeIndexes(opponentHandIndex).slice(0, pending.count || 1).sort((a, b) => b - a);
    if (indexes.length === 0) return fail(game, "相手の手札からカードを選んでください。");
    const gained = [];
    indexes.forEach((index) => {
      const targetCardId = opponent.hand[index];
      if (!targetCardId) return;
      opponent.hand.splice(index, 1);
      gained.push(targetCardId);
      if (game.players[playerId].hand.length >= maxHandSize) game.discard.push(targetCardId);
      else game.players[playerId].hand.push(targetCardId);
    });
    game.pendingOpponentHandCheck = null;
    game.lastMessage = `${gained.map((cardId) => cards[cardId].name).join("、")}を二重チェックで手札に加えました。`;
    addLog(game, game.lastMessage);
    return ok(game);
  }

  function resolvePendingDiscardSelection(game, playerId, handIndexes) {
    const pending = game.pendingDiscardSelection;
    if (!pending || pending.playerId !== playerId) return fail(game, "捨てるカードの選択待ちではありません。");
    const player = game.players[playerId];
    const indexes = player.hand.length <= pending.count ? player.hand.map((_, index) => index) : handIndexes;
    const result = discardHandCards(game, playerId, indexes, Math.min(pending.count, player.hand.length));
    if (!result.ok) return result;
    game.pendingDiscardSelection = null;
    game.lastMessage = `${game.players[playerId].name}が手札を${pending.count}枚捨てました。`;
    addLog(game, game.lastMessage);
    rebalanceDecksIfNeeded(game);
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
    return ok(game, { drawnCards: result.drawnCards || [], discardedDrawCards: result.discardedDrawCards || [] });
  }

  function drawAnyAvailableCard(game, playerId) {
    const pile = game.piles.find((candidate) => candidate.deck.length > 0);
    const drawn = pile ? drawCard(game, playerId, pile.id, { silent: true }) : null;
    return drawn?.added ? drawn.cardId : null;
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
    game.pendingDiscardSelection = null;
    game.pendingPileSearch = null;
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

  function ok(game, extra = {}) {
    return { ok: true, state: game, ...extra };
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
    useUnitAbility,
    endTurn,
    addToDiscard,
    resolvePendingOpponentHandCheck,
    resolvePendingDiscardSelection,
    resolvePendingPileSearch,
    resolvePendingQuickReplay,
    getEffectivePower,
    applyDamage,
    resolveCombat,
    onDeath,
  };
}

if (typeof window !== "undefined") window.CardGameEngine = createGameEngine;
if (typeof module !== "undefined") module.exports = createGameEngine;

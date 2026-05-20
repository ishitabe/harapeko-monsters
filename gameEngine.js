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
      players: [createPlayer("繝励Ξ繧､繝､繝ｼ1"), createPlayer("繝励Ξ繧､繝､繝ｼ2")],
      doubleNextAction: null,
      pendingQuickReplay: null,
      pendingOpponentHandCheck: null,
      pendingDiscardSelection: null,
      pendingDiscardTake: null,
      pendingPileDrawSelection: null,
      pendingPileSearch: null,
      lastPlayedAction: null,
      lastRevealedItem: null,
      piles: pileDefinitions.map((pile) => ({ id: pile.id, name: pile.name, deck: [] })),
      discard: [],
      log: [],
      lastMessage: "螻ｱ譛ｭ繧・縺､驕ｸ繧薙〒繝峨Ο繝ｼ縺励※縺上□縺輔＞縲・",
    };

    distributeCardsAcrossDecks(game, shuffle([...cardPool]));
    dealOpeningHands(game);
    game.players[firstPlayer].actions = 1;
    addTurnSeparator(game, firstPlayer);
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
      lifeDamageReductionUntilTurn: 0,
      avatar: "",
    };
  }

  function dealOpeningHands(game) {
    const secondPlayer = opponentOf(game.firstPlayer);
    const order = [secondPlayer, game.firstPlayer, secondPlayer, game.firstPlayer, secondPlayer, game.firstPlayer, secondPlayer, game.firstPlayer, secondPlayer, game.firstPlayer, secondPlayer];
    order.forEach((playerId, index) => drawCard(game, playerId, game.piles[index % 3].id, { silent: true, skipRebalance: true }));
    addLog(game, "蛻晄悄謇区惆繧帝・繧翫∪縺励◆縲ょ・謾ｻ5譫壹∝ｾ梧判6譫壹〒縺吶・");
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
      pendingDiscardTake: game.pendingDiscardTake,
      pendingPileDrawSelection: game.pendingPileDrawSelection,
      pendingPileSearch: game.pendingPileSearch && game.pendingPileSearch.playerId === viewerId
        ? publicPendingPileSearch(game)
        : null,
      maxFieldSize,
      maxHandSize,
      lastMessage: game.lastMessage,
      lastPlayedAction: game.lastPlayedAction,
      lastRevealedItem: game.lastRevealedItem,
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
        avatar: player.avatar || "",
        life: player.life,
        actions: player.actions,
        hasDrawnThisTurn: player.hasDrawnThisTurn,
        handCount: player.hand.length,
        hand: canViewHand(game, viewerId, ownerId) ? [...player.hand] : [],
        field: player.field.map((unit) => publicUnit(game, unit, ownerId, viewerId)),
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
    if (!canAct(game, playerId)) return fail(game, "莉翫・縺昴・繝励Ξ繧､繝､繝ｼ縺ｮ繧ｿ繝ｼ繝ｳ縺ｧ縺ｯ縺ゅｊ縺ｾ縺帙ｓ縲・");
    const player = game.players[playerId];
    if (player.hasDrawnThisTurn) return fail(game, "縺薙・繧ｿ繝ｼ繝ｳ縺ｯ縺吶〒縺ｫ繝峨Ο繝ｼ縺励※縺・∪縺吶・");

    ensureDecksHaveCards(game);
    const drawn = drawCard(game, playerId, pileId, { silent: true });
    if (!drawn) return fail(game, "縺昴・螻ｱ譛ｭ縺ｯ遨ｺ縺ｧ縺吶・");

    player.hasDrawnThisTurn = true;
    if (!drawn.added) {
      game.lastMessage = `謇区惆荳企剞縺ｧ縺吶・{cards[drawn.cardId].name}縺ｯ謐ｨ譛ｭ縺ｸ騾√ｉ繧後∪縺励◆縲Ａ`;
      addLog(game, game.lastMessage);
      return ok(game, { drawnCards: [], discardedDrawCards: [drawn.cardId] });
    }
    game.lastMessage = `${player.name}縺・{cards[drawn.cardId].name}繧偵ラ繝ｭ繝ｼ縺励∪縺励◆縲Ａ`;
    addLog(game, `${getPile(game, pileId).name}縺九ｉ縲・{cards[drawn.cardId].name}縲阪ｒ繝峨Ο繝ｼ`);
    return ok(game, { drawnCards: [drawn.cardId] });
  }

  function summonFromHand(game, playerId, handIndex, payload = {}) {
    if (!canAct(game, playerId)) return fail(game, "莉翫・縺昴・繝励Ξ繧､繝､繝ｼ縺ｮ繧ｿ繝ｼ繝ｳ縺ｧ縺ｯ縺ゅｊ縺ｾ縺帙ｓ縲・");
    const player = game.players[playerId];
    if (!player.hasDrawnThisTurn) return fail(game, "蜈医↓繧ｿ繝ｼ繝ｳ髢句ｧ九ラ繝ｭ繝ｼ繧偵＠縺ｦ縺上□縺輔＞縲・");
    if (player.actions <= 0) return fail(game, "繧｢繧ｯ繧ｷ繝ｧ繝ｳ讓ｩ縺後≠繧翫∪縺帙ｓ縲・");
    if (player.field.length >= maxFieldSize) return fail(game, "蝣ｴ縺悟沂縺ｾ縺｣縺ｦ縺・∪縺吶・");

    const cardId = player.hand[Number(handIndex)];
    const card = cards[cardId];
    if (!card || card.type !== "unit") return fail(game, "蜿ｬ蝟壹〒縺阪ｋ繝｢繝ｳ繧ｹ繧ｿ繝ｼ繧帝∈繧薙〒縺上□縺輔＞縲・");

    player.hand.splice(Number(handIndex), 1);

    player.actions -= 1;
    enterField(game, playerId, cardId, "summon", payload);
    game.lastMessage = `${player.name}縺・{card.name}繧貞小蝟壹＠縺ｾ縺励◆縲Ａ`;
    addLog(game, game.lastMessage);
    return ok(game);
  }

  function equipItemFromHand(game, playerId, handIndex, unitId) {
    if (!canAct(game, playerId)) return fail(game, "莉翫・縺昴・繝励Ξ繧､繝､繝ｼ縺ｮ繧ｿ繝ｼ繝ｳ縺ｧ縺ｯ縺ゅｊ縺ｾ縺帙ｓ縲・");
    const player = game.players[playerId];
    if (!player.hasDrawnThisTurn) return fail(game, "蜈医↓繧ｿ繝ｼ繝ｳ髢句ｧ九ラ繝ｭ繝ｼ繧偵＠縺ｦ縺上□縺輔＞縲・");
    const cardId = player.hand[Number(handIndex)];
    const card = cards[cardId];
    if (!card || card.type !== "item") return fail(game, "陬・ｙ縺吶ｋ謖√■迚ｩ繧ｫ繝ｼ繝峨ｒ驕ｸ繧薙〒縺上□縺輔＞縲・");
    const unit = findUnit(player, unitId);
    if (!unit) return fail(game, "閾ｪ蛻・・蝣ｴ縺ｮ繝｢繝ｳ繧ｹ繧ｿ繝ｼ繧帝∈繧薙〒縺上□縺輔＞縲・");
    if (unit.item) return fail(game, "縺昴・繝｢繝ｳ繧ｹ繧ｿ繝ｼ縺ｫ縺ｯ縺吶〒縺ｫ謖√■迚ｩ縺後≠繧翫∪縺吶・");

    player.hand.splice(Number(handIndex), 1);
    unit.item = { cardId, revealed: false, powerApplied: false };
    if (card.effectKey === "maxHpPlusTwo") {
      unit.maxHp += 2;
      unit.hp += 2;
    }
    if (card.effectKey === "pikachuPowerPlusSix" && unit.cardId === "pikachu") {
      unit.maxHp += 6;
      unit.hp += 6;
      unit.item.powerApplied = increasePower(game, unit, 6);
    }
    if (card.effectKey === "attackPowerPlusTwo") {
      unit.item.powerApplied = increasePower(game, unit, 2);
    }
    if (card.effectKey === "canActOnSummon") {
      unit.canAct = true;
    }
    game.lastMessage = `${cards[unit.cardId].name}縺ｫ謖√■迚ｩ繧定｣丞髄縺阪〒陬・ｙ縺励∪縺励◆縲Ａ`;
    addLog(game, game.lastMessage);
    return ok(game);
  }

  function playAction(game, playerId, handIndex, payload = {}) {
    if (!canAct(game, playerId)) return fail(game, "莉翫・縺昴・繝励Ξ繧､繝､繝ｼ縺ｮ繧ｿ繝ｼ繝ｳ縺ｧ縺ｯ縺ゅｊ縺ｾ縺帙ｓ縲・");
    const player = game.players[playerId];
    if (!player.hasDrawnThisTurn) return fail(game, "蜈医↓繧ｿ繝ｼ繝ｳ髢句ｧ九ラ繝ｭ繝ｼ繧偵＠縺ｦ縺上□縺輔＞縲・");
    if (player.actions <= 0) return fail(game, "繧｢繧ｯ繧ｷ繝ｧ繝ｳ讓ｩ縺後≠繧翫∪縺帙ｓ縲・");

    const cardId = player.hand[Number(handIndex)];
    const card = cards[cardId];
    if (!card || card.type !== "action") return fail(game, "謇区惆縺ｮ繧｢繧ｯ繧ｷ繝ｧ繝ｳ繧ｫ繝ｼ繝峨ｒ驕ｸ繧薙〒縺上□縺輔＞縲・");
    if (card.effectKey === "discardOpponentHand" && game.players[opponentOf(playerId)].hand.length === 0) {
      return fail(game, "逶ｸ謇九・謇区惆縺・譫壹↑縺ｮ縺ｧ莠碁㍾繝√ぉ繝・け縺ｯ菴ｿ縺医∪縺帙ｓ縲・");
    }

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
      ? `${player.name}縺・{card.name}繧剃ｽｿ逕ｨ縺励∪縺励◆縲よ掠讌ｭ縺ｧ繧ゅ≧荳蠎ｦ菴ｿ縺医∪縺吶Ａ`
      : `${player.name}縺・{card.name}繧剃ｽｿ逕ｨ縺励∪縺励◆縲Ａ`;
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
      const gainedCards = [];
      opponent.field.forEach((unit) => {
        if (!unit.item) return;
        player.hand.push(unit.item.cardId);
        gainedCards.push(unit.item.cardId);
        removeItemStats(unit);
        unit.item = null;
        count += 1;
      });
      addLog(game, `${card.name}: 謖√■迚ｩ繧・{count}譫壼･ｪ縺・∪縺励◆縲Ａ`);
      return ok(game, { gainedCards });
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
      if (!located) return fail(game, "謐ｨ譛ｭ縺ｫ騾√ｋ繝｢繝ｳ繧ｹ繧ｿ繝ｼ繧帝∈繧薙〒縺上□縺輔＞縲・");
      if (isProtectedFromOpponentEffects(game, located.ownerId, playerId)) return fail(game, "逾樒ｧ倥・螳医ｊ縺ｧ蜉ｹ譫懊ｒ蜿励￠縺ｾ縺帙ｓ縲・");
      moveUnitToDiscard(game, located.ownerId, located.unit);
      return ok(game);
    }

    if (card.effectKey === "swapUnits") {
      swapAllUnits(game, playerId, opponentId);
      return ok(game);
    }

    if (card.effectKey === "drawOneEachDiscardOne") {
      const drawResults = game.piles.map((pile) => drawCard(game, playerId, pile.id, { silent: true })).filter(Boolean);
      logTopDrawResults(game, card.name, drawResults);
      const drawnCards = drawResults.filter((drawn) => drawn.added).map((drawn) => drawn.cardId);
      const discardedDrawCards = drawResults.filter((drawn) => !drawn.added).map((drawn) => drawn.cardId);
      return ok(game, { drawnCards, discardedDrawCards });
    }

    if (card.effectKey === "reviveUnit") {
      if (player.field.length >= maxFieldSize) return fail(game, "閾ｪ蛻・・蝣ｴ縺悟沂縺ｾ縺｣縺ｦ縺・∪縺吶・");
      const discardIndex = Number(payload.discardIndex);
      const reviveCardId = game.discard[discardIndex];
      if (!cards[reviveCardId] || cards[reviveCardId].type !== "unit") return fail(game, "謐ｨ譛ｭ縺ｮ繝｢繝ｳ繧ｹ繧ｿ繝ｼ繧帝∈繧薙〒縺上□縺輔＞縲・");
      game.discard.splice(discardIndex, 1);
      enterField(game, playerId, reviveCardId, "revive", payload);
      return ok(game);
    }

    if (card.effectKey === "drawTwoGainAction") {
      if (!payload.pileId) return fail(game, "螻ｱ譛ｭ繧帝∈繧薙〒縺上□縺輔＞縲・");
      const ownDraw = drawMultipleDetailed(game, playerId, payload.pileId, 2);
      const opponentDraw = drawMultipleDetailed(game, opponentId, payload.pileId, 2);
      logTopDrawResults(game, card.name, [...ownDraw.drawResults, ...opponentDraw.drawResults]);
      player.actions += 1;
      return ok(game, {
        drawnCards: ownDraw.drawnCards,
        discardedDrawCards: [...ownDraw.discardedDrawCards, ...opponentDraw.discardedDrawCards],
      });
    }

    if (card.effectKey === "takeDiscardToHandGainAction") {
      const discardIndex = Number(payload.discardIndex);
      const targetCardId = game.discard[discardIndex];
      if (!targetCardId) return fail(game, "謐ｨ譛ｭ縺九ｉ繧ｫ繝ｼ繝峨ｒ驕ｸ繧薙〒縺上□縺輔＞縲・");
      game.discard.splice(discardIndex, 1);
      player.hand.push(targetCardId);
      player.actions += 1;
      return ok(game, { gainedCards: [targetCardId] });
    }

    if (card.effectKey === "discardOpponentHand") {
      if (payload.opponentHandIndex === undefined || payload.opponentHandIndex === null || payload.opponentHandIndex === "") {
        game.pendingOpponentHandCheck = { playerId, opponentId, count: 1 };
        return ok(game);
      }
      const opponentHandIndex = Number(payload.opponentHandIndex);
      const targetCardId = opponent.hand[opponentHandIndex];
      if (!targetCardId) return fail(game, "逶ｸ謇九・謇区惆縺九ｉ繧ｫ繝ｼ繝峨ｒ驕ｸ繧薙〒縺上□縺輔＞縲・");
      opponent.hand.splice(opponentHandIndex, 1);
      if (player.hand.length >= maxHandSize) game.discard.push(targetCardId);
      else player.hand.push(targetCardId);
      return ok(game, { gainedCards: [targetCardId] });
    }

    if (card.effectKey === "dealTwoToUnitOrLife") {
      if (payload.targetType === "life") {
        dealLifeDamage(game, opponentId, 3, playerId, "action");
        checkWinner(game);
        return ok(game);
      }
      const located = findUnitById(game, payload.unitId);
      if (!located) return fail(game, "繝繝｡繝ｼ繧ｸ蟇ｾ雎｡繧帝∈繧薙〒縺上□縺輔＞縲・");
      if (isProtectedFromOpponentEffects(game, located.ownerId, playerId)) return fail(game, "逾樒ｧ倥・螳医ｊ縺ｧ蜉ｹ譫懊ｒ蜿励￠縺ｾ縺帙ｓ縲・");
      applyDamage(game, located.ownerId, located.unit, 3);
      discardDeadUnits(game);
      return ok(game);
    }

    if (card.effectKey === "mysticGuard") {
      player.mysticGuardUntilTurn = game.turn + 2;
      player.lifeDamageReductionUntilTurn = game.turn + 2;
      return ok(game);
    }

    if (card.effectKey === "redCard") {
      game.discard.push(...opponent.hand);
      opponent.hand = [];
      const drawResults = game.piles.map((pile) => drawCard(game, opponentId, pile.id, { silent: true })).filter(Boolean);
      logTopDrawResults(game, card.name, drawResults);
      return ok(game);
    }

    if (card.effectKey === "sacrifice") {
      const located = findUnitById(game, payload.unitId);
      if (!located) return fail(game, "繝代Ρ繝ｼ繧剃ｸ翫￡繧九Δ繝ｳ繧ｹ繧ｿ繝ｼ繧帝∈繧薙〒縺上□縺輔＞縲・");
      if (located.ownerId !== playerId) return fail(game, "閾ｪ蛻・・蝣ｴ縺ｮ繝｢繝ｳ繧ｹ繧ｿ繝ｼ繧帝∈繧薙〒縺上□縺輔＞縲・");
      player.hand = player.hand.filter((cardId) => {
        if (cards[cardId]?.type !== "action") return true;
        game.discard.push(cardId);
        return false;
      });
      increasePower(game, located.unit, 3);
      return ok(game);
    }

    if (card.effectKey === "shockWave") {
      opponent.field.forEach((unit) => {
        if (isProtectedFromOpponentEffects(game, opponentId, playerId)) return;
        unit.maxHp = Math.max(0, unit.maxHp - 1);
        unit.hp = Math.min(unit.hp, unit.maxHp);
        lowerPower(game, opponentId, unit, 1, playerId);
      });
      discardDeadUnits(game);
      return ok(game);
    }

    if (card.effectKey === "drawPileDiscardTwo") {
      if (!payload.pileId) return fail(game, "螻ｱ譛ｭ繧帝∈繧薙〒縺上□縺輔＞縲・");
      const pile = getPile(game, payload.pileId);
      const { drawnCards, discardedDrawCards, drawResults } = drawMultipleDetailed(game, playerId, pile.id, 6);
      logTopDrawResults(game, card.name, drawResults);
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
      const pile = payload.pileId ? getPile(game, payload.pileId) : game.piles.find((candidate) => candidate.deck.length > 0);
      const drawn = pile ? drawCard(game, playerId, pile.id, { silent: true }) : null;
      logTopDrawResults(game, card.name, [drawn]);
      return ok(game, {
        drawnCards: drawn && drawn.added ? [drawn.cardId] : [],
        discardedDrawCards: drawn && !drawn.added ? [drawn.cardId] : [],
      });
    }

    if (card.effectKey === "searchTwoFromPile") {
      if (!payload.pileId) return fail(game, "螻ｱ譛ｭ繧帝∈繧薙〒縺上□縺輔＞縲・");
      game.pendingPileSearch = { playerId, pileId: payload.pileId, count: 2, discardAfter: 1 };
      return ok(game);
    }

    if (card.effectKey === "drawOneBuffOwnField") {
      const pile = payload.pileId ? getPile(game, payload.pileId) : game.piles.find((candidate) => candidate.deck.length > 0);
      const drawn = pile ? drawCard(game, playerId, pile.id, { silent: true }) : null;
      logTopDrawResults(game, card.name, [drawn]);
      player.field.forEach((unit) => increasePower(game, unit, 2));
      return ok(game, {
        drawnCards: drawn && drawn.added ? [drawn.cardId] : [],
        discardedDrawCards: drawn && !drawn.added ? [drawn.cardId] : [],
      });
    }

    if (card.effectKey === "buffHpByEnemyCount") {
      const amount = opponent.field.length;
      if (amount > 0) game.pendingPileDrawSelection = { playerId, count: amount, source: card.id };
      player.field.forEach((unit) => {
        unit.maxHp += 1;
        unit.hp += 1;
      });
      return ok(game);
    }

    if (card.effectKey === "damageMinusOneUntilNextTurn") {
      player.damageReductionUntilTurn = game.turn + 2;
      const pile = payload.pileId ? getPile(game, payload.pileId) : game.piles.find((candidate) => candidate.deck.length > 0);
      const drawn = pile ? drawCard(game, playerId, pile.id, { silent: true }) : null;
      logTopDrawResults(game, card.name, [drawn]);
      return ok(game, {
        drawnCards: drawn && drawn.added ? [drawn.cardId] : [],
        discardedDrawCards: drawn && !drawn.added ? [drawn.cardId] : [],
      });
    }

    if (card.effectKey === "searchOneFromEachPile") {
      game.pendingPileSearch = { playerId, allPiles: true, count: 1 };
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
      player.actions += count + 1;
      return ok(game);
    }

    return fail(game, "縺薙・繧｢繧ｯ繧ｷ繝ｧ繝ｳ縺ｯ譛ｪ螳溯｣・〒縺吶・");
  }

  function resolvePendingPileSearch(game, playerId, pileIndexes) {
    const pending = game.pendingPileSearch;
    if (!pending || pending.playerId !== playerId) return fail(game, "螻ｱ譛ｭ繧定ｦ九ｋ蜉ｹ譫懊・蜃ｦ逅・ｾ・■縺ｧ縺ｯ縺ゅｊ縺ｾ縺帙ｓ縲・");
    const player = game.players[playerId];
    if (pending.allPiles) {
      const selected = Array.isArray(pileIndexes) ? pileIndexes : normalizeIndexes(pileIndexes);
      if (selected.length === 0) return fail(game, "蜉縺医ｋ繧ｫ繝ｼ繝峨ｒ驕ｸ繧薙〒縺上□縺輔＞縲・");
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
      addLog(game, `繧ｶ繝ｻ繧ｵ繝ｼ繝√〒繧ｫ繝ｼ繝峨ｒ${drawnCards.length}譫壽焔譛ｭ縺ｫ蜉縺医◆縲Ａ`);
      return ok(game, { drawnCards, discardedDrawCards });
    }
    const pile = getPile(game, pending.pileId);
    const indexes = normalizeIndexes(pileIndexes).slice(0, pending.count).sort((a, b) => b - a);
    if (indexes.length === 0) return fail(game, "蜉縺医ｋ繧ｫ繝ｼ繝峨ｒ驕ｸ繧薙〒縺上□縺輔＞縲・");
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
    if (pending.discardAfter) game.pendingDiscardSelection = { playerId, count: pending.discardAfter, source: "preparation" };
    rebalanceDecksIfNeeded(game);
    addLog(game, `荳区ｺ門ｙ縺ｧ繧ｫ繝ｼ繝峨ｒ${drawnCards.length}譫壽焔譛ｭ縺ｫ蜉縺医◆縲Ａ`);
    return ok(game, { drawnCards, discardedDrawCards });
  }

  function resolvePendingPileDrawSelection(game, playerId, pileIds) {
    const pending = game.pendingPileDrawSelection;
    if (!pending || pending.playerId !== playerId) return fail(game, "山札ドローの選択待ちではありません。");
    const selectedPileIds = Array.isArray(pileIds) ? pileIds : [pileIds].filter(Boolean);
    if (selectedPileIds.length < 1) return fail(game, "山札を1つ選んでください。");
    const drawnCards = [];
    const discardedDrawCards = [];
    const drawResults = [];
    const remaining = pending.remaining ?? pending.count;
    const drawCount = Math.min(selectedPileIds.length, remaining);
    selectedPileIds.slice(0, drawCount).forEach((pileId) => {
      const drawn = drawCard(game, playerId, pileId, { silent: true });
      if (drawn) drawResults.push(drawn);
      if (drawn?.added) drawnCards.push(drawn.cardId);
      else if (drawn) discardedDrawCards.push(drawn.cardId);
    });
    const nextRemaining = remaining - drawCount;
    game.pendingPileDrawSelection = nextRemaining > 0 ? { ...pending, remaining: nextRemaining } : null;
    game.lastMessage = `${game.players[playerId].name}が構えて${drawnCards.length}枚ドローしました。`;
    addLog(game, game.lastMessage);
    logTopDrawResults(game, "構える", drawResults);
    return ok(game, { drawnCards, discardedDrawCards });
  }
  function gainLifeWithUnit(game, playerId, unitId) {
    if (!canAct(game, playerId)) return fail(game, "莉翫・縺昴・繝励Ξ繧､繝､繝ｼ縺ｮ繧ｿ繝ｼ繝ｳ縺ｧ縺ｯ縺ゅｊ縺ｾ縺帙ｓ縲・");
    const player = game.players[playerId];
    if (!player.hasDrawnThisTurn) return fail(game, "蜈医↓繧ｿ繝ｼ繝ｳ髢句ｧ九ラ繝ｭ繝ｼ繧偵＠縺ｦ縺上□縺輔＞縲・");
    const unit = findUnit(player, unitId);
    if (!unit || !unit.canAct) return fail(game, "縺昴・繝｢繝ｳ繧ｹ繧ｿ繝ｼ縺ｯ陦悟虚縺ｧ縺阪∪縺帙ｓ縲・");
    if (cards[unit.cardId].effectKey !== "attackOrGainLife") return fail(game, "縺薙・繝｢繝ｳ繧ｹ繧ｿ繝ｼ縺ｯ繝ｩ繧､繝・3繧帝∈縺ｹ縺ｾ縺帙ｓ縲・");

    unit.canAct = false;
    player.life += 3;
    game.lastMessage = `${cards[unit.cardId].name}縺後Λ繧､繝・3繧帝∈縺ｳ縺ｾ縺励◆縲Ａ`;
    addLog(game, game.lastMessage);
    resolveAfterAction(game, playerId, unit.id);
    return ok(game);
  }

  function attackLife(game, playerId, attackerId) {
    if (!canAct(game, playerId)) return fail(game, "莉翫・縺昴・繝励Ξ繧､繝､繝ｼ縺ｮ繧ｿ繝ｼ繝ｳ縺ｧ縺ｯ縺ゅｊ縺ｾ縺帙ｓ縲・");
    const player = game.players[playerId];
    if (!player.hasDrawnThisTurn) return fail(game, "蜈医↓繧ｿ繝ｼ繝ｳ髢句ｧ九ラ繝ｭ繝ｼ繧偵＠縺ｦ縺上□縺輔＞縲・");
    const attacker = findUnit(player, attackerId);
    if (!attacker || !attacker.canAct) return fail(game, "縺昴・繝｢繝ｳ繧ｹ繧ｿ繝ｼ縺ｯ陦悟虚縺ｧ縺阪∪縺帙ｓ縲・");
    const opponentId = opponentOf(playerId);
    if (!canAttackLifeTarget(game, opponentId, attacker)) return fail(game, "繧ｫ繝薙ざ繝ｳ縺ｾ縺溘・繧ｦ繧ｩ繝ｼ繝ｫ縺ｫ繧医ｊ縲√Λ繧､繝輔・謾ｻ謦・〒縺阪∪縺帙ｓ縲・");

    const damage = getEffectivePower(game, attacker, null, "lifeAttack");
    attacker.canAct = false;
    const actualDamage = dealLifeDamage(game, opponentId, damage);
    if (cards[attacker.cardId].effectKey === "takeDiscardOnLifeAttack" && game.discard.length > 0) {
      game.pendingDiscardTake = { playerId, count: 1, source: attacker.cardId };
    }
    game.lastMessage = `${cards[attacker.cardId].name}縺・{game.players[opponentId].name}縺ｮ繝ｩ繧､繝輔↓謾ｻ謦・${actualDamage}繝繝｡繝ｼ繧ｸ・～`;
    addLog(game, game.lastMessage);
    checkWinner(game);
    resolveAfterAction(game, playerId, attacker.id);
    return ok(game);
  }

  function attackLifeWithAll(game, playerId) {
    if (!canAct(game, playerId)) return fail(game, "莉翫・縺昴・繝励Ξ繧､繝､繝ｼ縺ｮ繧ｿ繝ｼ繝ｳ縺ｧ縺ｯ縺ゅｊ縺ｾ縺帙ｓ縲・");
    const player = game.players[playerId];
    if (!player.hasDrawnThisTurn) return fail(game, "蜈医↓繧ｿ繝ｼ繝ｳ髢句ｧ九ラ繝ｭ繝ｼ繧偵＠縺ｦ縺上□縺輔＞縲・");
    const opponentId = opponentOf(playerId);
    const attackers = player.field.filter((unit) => unit.canAct && canAttackLifeTarget(game, opponentId, unit));
    if (attackers.length === 0) return fail(game, "繝ｩ繧､繝墓判謦・〒縺阪ｋ繝｢繝ｳ繧ｹ繧ｿ繝ｼ縺後＞縺ｾ縺帙ｓ縲・");
    let totalDamage = 0;
    attackers.forEach((attacker) => {
      const damage = getEffectivePower(game, attacker, null, "lifeAttack");
      attacker.canAct = false;
      totalDamage += dealLifeDamage(game, opponentId, damage);
      if (cards[attacker.cardId].effectKey === "takeDiscardOnLifeAttack" && game.discard.length > 0) {
        game.pendingDiscardTake = { playerId, count: 1, source: attacker.cardId };
      }
    });
    game.lastMessage = `${player.name}縺悟・蜩｡縺ｧ${game.players[opponentId].name}縺ｮ繝ｩ繧､繝輔↓謾ｻ謦・蜷郁ｨ・{totalDamage}繝繝｡繝ｼ繧ｸ・～`;
    addLog(game, game.lastMessage);
    checkWinner(game);
    return ok(game);
  }

  function attackMonster(game, playerId, attackerId, defenderId) {
    if (!canAct(game, playerId)) return fail(game, "莉翫・縺昴・繝励Ξ繧､繝､繝ｼ縺ｮ繧ｿ繝ｼ繝ｳ縺ｧ縺ｯ縺ゅｊ縺ｾ縺帙ｓ縲・");
    const player = game.players[playerId];
    if (!player.hasDrawnThisTurn) return fail(game, "蜈医↓繧ｿ繝ｼ繝ｳ髢句ｧ九ラ繝ｭ繝ｼ繧偵＠縺ｦ縺上□縺輔＞縲・");
    const attacker = findUnit(player, attackerId);
    const defenderOwnerId = opponentOf(playerId);
    const defender = findUnit(game.players[defenderOwnerId], defenderId);
    if (!attacker || !attacker.canAct) return fail(game, "縺昴・繝｢繝ｳ繧ｹ繧ｿ繝ｼ縺ｯ陦悟虚縺ｧ縺阪∪縺帙ｓ縲・");
    if (!defender) return fail(game, "逶ｸ謇九・繝｢繝ｳ繧ｹ繧ｿ繝ｼ繧帝∈繧薙〒縺上□縺輔＞縲・");
    if (!canTargetDefender(game.players[defenderOwnerId], defender, attacker)) return fail(game, "繧ｫ繝薙ざ繝ｳ縺後＞繧九◆繧√√◎縺ｮ繝｢繝ｳ繧ｹ繧ｿ繝ｼ縺ｯ謾ｻ謦・〒縺阪∪縺帙ｓ縲・");

    attacker.canAct = false;
    const result = resolveAttack(game, playerId, attacker, defenderOwnerId, defender);
    const drawnCards = [];
    if (cards[attacker.cardId].effectKey === "drawFromPileOnKill" && defender.hp <= 0) {
      const drawn = drawAnyAvailableCard(game, playerId);
      if (drawn) {
        drawnCards.push(drawn);
        addLog(game, `${cards[attacker.cardId].name}縺ｮ謦・ｴ譎ょ柑譫懊〒1繝峨Ο繝ｼ縲Ａ`);
      }
    }
    const specialMessage = /豌怜粋縺・・繧ｿ繧ｹ繧ｭ|驕馴｣繧後・繝ｳ繝/.test(game.lastMessage) ? game.lastMessage : "";
    game.lastMessage = specialMessage || `${cards[attacker.cardId].name}縺・{cards[defender.cardId].name}繧呈判謦・＠縺ｾ縺励◆縲Ａ`;
    addLog(game, `${cards[attacker.cardId].name}縺・{cards[defender.cardId].name}縺ｫ謾ｻ謦・${result.defenderDamage}繝繝｡繝ｼ繧ｸ・～`);
    if (result.attackerDamage > 0) addLog(game, `${cards[defender.cardId].name}縺・{cards[attacker.cardId].name}縺ｫ蜿肴茶縲${result.attackerDamage}繝繝｡繝ｼ繧ｸ・～`);
    discardDeadUnits(game);
    resolveAfterAction(game, playerId, attacker.id);
    return ok(game, { drawnCards });
  }

  function useUnitAbility(game, playerId, payload = {}) {
    if (!canAct(game, playerId)) return fail(game, "莉翫・縺昴・繝励Ξ繧､繝､繝ｼ縺ｮ繧ｿ繝ｼ繝ｳ縺ｧ縺ｯ縺ゅｊ縺ｾ縺帙ｓ縲・");
    const player = game.players[playerId];
    if (!player.hasDrawnThisTurn) return fail(game, "蜈医↓繧ｿ繝ｼ繝ｳ髢句ｧ九ラ繝ｭ繝ｼ繧偵＠縺ｦ縺上□縺輔＞縲・");
    const unit = findUnit(player, payload.unitId);
    if (!unit || !unit.canAct) return fail(game, "縺昴・繝｢繝ｳ繧ｹ繧ｿ繝ｼ縺ｯ陦悟虚縺ｧ縺阪∪縺帙ｓ縲・");
    const card = cards[unit.cardId];
    const opponentId = opponentOf(playerId);
    if (payload.ability === "zeroPowerAndReturn" && card.effectKey === "damageOnSummonZeroPowerAndReturn") {
      const target = findUnit(game.players[opponentId], payload.targetUnitId);
      if (!target) return fail(game, "逶ｸ謇九Δ繝ｳ繧ｹ繧ｿ繝ｼ繧帝∈繧薙〒縺上□縺輔＞縲・");
      lowerPower(game, opponentId, target, target.power, playerId);
      moveUnitToHand(game, playerId, unit);
      return ok(game);
    }
    if (payload.ability === "doubleOwnPower" && card.effectKey === "doubleOwnPower") {
      if (hasAnyEffect(game, "ignorePowerIncreases")) {
        unit.canAct = false;
        game.lastMessage = `${cards[unit.cardId].name}縺ｮ繝代Ρ繝ｼ蛟榊喧縺ｯ繝後が繝ｼ縺ｫ辟｡蜉ｹ蛹悶＆繧後∪縺励◆縲Ａ`;
        addLog(game, game.lastMessage);
        return ok(game);
      }
      increasePower(game, unit, unit.power);
      unit.canAct = false;
      return ok(game);
    }
    if (payload.ability === "sleepTargetNextTurn" && card.effectKey === "sleepTargetNextTurn") {
      const target = findUnit(game.players[opponentId], payload.targetUnitId);
      if (!target) return fail(game, "逶ｸ謇九Δ繝ｳ繧ｹ繧ｿ繝ｼ繧帝∈繧薙〒縺上□縺輔＞縲・");
      target.sleepUntilTurn = game.turn + 2;
      unit.canAct = false;
      return ok(game);
    }
    if (payload.ability === "swapAllHpPower" && unit.cardId === "farigiraf") {
      const changes = [];
      game.players.forEach((targetPlayer) => targetPlayer.field.forEach((target) => {
        const oldHp = target.hp;
        const oldMaxHp = target.maxHp;
        const oldPower = getEffectivePower(game, target, null, "status");
        target.maxHp = Math.max(0, oldPower);
        target.hp = Math.max(0, oldPower);
        target.power = oldMaxHp;
        changes.push(`${cards[target.cardId].name}: HP${target.hp}/${target.maxHp} 繝代Ρ繝ｼ${target.power}`);
      }));
      unit.canAct = false;
      game.lastMessage = "繝ｪ繧ｭ繧ｭ繝ｪ繝ｳ縺悟ｴ蜈ｨ菴薙・HP縺ｨ繝代Ρ繝ｼ繧貞・繧梧崛縺医◆縲・";
      addLog(game, game.lastMessage);
      changes.forEach((line) => addLog(game, line));
      discardDeadUnits(game);
      return ok(game);
    }
    return fail(game, "菴ｿ縺医ｋ閭ｽ蜉帙′縺ゅｊ縺ｾ縺帙ｓ縲・");
  }

  function endTurn(game, playerId) {
    if (!canAct(game, playerId)) return fail(game, "莉翫・縺昴・繝励Ξ繧､繝､繝ｼ縺ｮ繧ｿ繝ｼ繝ｳ縺ｧ縺ｯ縺ゅｊ縺ｾ縺帙ｓ縲・");
    if (game.winner !== null) return ok(game);

    if (game.doubleNextAction === playerId) game.doubleNextAction = null;
    if (game.pendingQuickReplay?.playerId === playerId) game.pendingQuickReplay = null;
    if (game.pendingOpponentHandCheck?.playerId === playerId) game.pendingOpponentHandCheck = null;
    if (game.pendingDiscardSelection?.playerId === playerId) game.pendingDiscardSelection = null;
    if (game.pendingDiscardTake?.playerId === playerId) game.pendingDiscardTake = null;
    if (game.pendingPileDrawSelection?.playerId === playerId) game.pendingPileDrawSelection = null;
    if (game.pendingPileSearch?.playerId === playerId) game.pendingPileSearch = null;

    applyTurnEndEffects(game, playerId);
    if (game.winner !== null) return ok(game);
    healAllUnits(game);
    const nextPlayerId = opponentOf(playerId);
    game.activePlayer = nextPlayerId;
    game.turn += 1;
    startTurn(game, nextPlayerId);
    game.lastMessage = `${game.players[nextPlayerId].name}縺ｮ繧ｿ繝ｼ繝ｳ縺ｧ縺吶ょｱｱ譛ｭ繧・縺､驕ｸ繧薙〒繝峨Ο繝ｼ縺励※縺上□縺輔＞縲Ａ`;
    addLog(game, `${game.players[playerId].name}縺後ち繝ｼ繝ｳ邨ゆｺ・Ａ`);
    addTurnSeparator(game, nextPlayerId);
    return ok(game);
  }

  function surrender(game, playerId) {
    if (game.winner !== null) return ok(game);
    const winnerId = opponentOf(playerId);
    game.players.forEach((player) => {
      player.life = Math.max(0, player.life);
    });
    game.winner = winnerId;
    game.doubleNextAction = null;
    game.pendingQuickReplay = null;
    game.pendingOpponentHandCheck = null;
    game.pendingDiscardSelection = null;
    game.pendingDiscardTake = null;
    game.pendingPileDrawSelection = null;
    game.pendingPileSearch = null;
    game.lastMessage = `${game.players[playerId].name}縺碁剄蜿ゅ＠縺ｾ縺励◆縲・{game.players[winnerId].name}縺ｮ蜍昴■縺ｧ縺吶Ａ`;
    addLog(game, game.lastMessage);
    return ok(game);
  }

  function startTurn(game, playerId) {
    const player = game.players[playerId];
    player.actions = Math.max(0, startingActions - (player.actionPenaltyNextTurn || 0));
    player.actionPenaltyNextTurn = 0;
    player.noCounterThisTurn = false;
    player.hasDrawnThisTurn = false;
    player.field.forEach((unit) => {
      unit.canAct = unit.summonedTurn < game.turn && !(unit.sleepUntilTurn > game.turn);
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
      if (!options.silent) addLog(game, `${game.players[playerId].name}縺ｮ謇区惆縺・0譫壹・縺溘ａ縲・{cards[cardId].name}繧呈昏譛ｭ縺ｸ騾√ｊ縺ｾ縺励◆縲Ａ`);
      if (!options.skipRebalance) rebalanceDecksIfNeeded(game);
      return { cardId, added: false, pileId: pile.id, pileName: pile.name };
    }
    player.hand.push(cardId);
    if (!options.silent) addLog(game, `${game.players[playerId].name}縺・{cards[cardId].name}繧偵ラ繝ｭ繝ｼ縲Ａ`);
    if (!options.skipRebalance) rebalanceDecksIfNeeded(game);
    return { cardId, added: true, pileId: pile.id, pileName: pile.name };
  }

  function drawMultiple(game, playerId, pileId, amount) {
    return drawMultipleDetailed(game, playerId, pileId, amount).drawnCards;
  }

  function drawMultipleDetailed(game, playerId, pileId, amount) {
    const drawnCards = [];
    const discardedDrawCards = [];
    const drawResults = [];
    for (let index = 0; index < amount; index += 1) {
      const drawn = drawCard(game, playerId, pileId, { silent: true });
      if (drawn) drawResults.push(drawn);
      if (drawn?.added) drawnCards.push(drawn.cardId);
      else if (drawn) discardedDrawCards.push(drawn.cardId);
    }
    return { drawnCards, discardedDrawCards, drawResults };
  }

  function logTopDrawResults(game, sourceName, results) {
    const entries = (results || []).filter(Boolean).map((drawn) => {
      const pileName = drawn.pileName || getPile(game, drawn.pileId)?.name || "山札";
      return `${pileName}から「${cards[drawn.cardId].name}」`;
    });
    if (entries.length === 0) return;
    addLog(game, `${sourceName}で${entries.join("、")}をドロー`);
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
        addLog(game, `${player.name}縺ｮ謇区惆縺・0譫壹・縺溘ａ縲・{cards[cardId].name}繧呈昏譛ｭ縺ｸ騾√ｊ縺ｾ縺励◆縲Ａ`);
      } else {
        player.hand.push(cardId);
        drawnCards.push(cardId);
      }
    }
    rebalanceDecksIfNeeded(game);
    return { drawnCards, discardedDrawCards };
  }

  function getEffectivePower(game, unit, targetUnit, reason, options = {}) {
    let power = unit.power;
    const card = cards[unit.cardId];
    const unitOwnerId = ownerOfUnit(game, unit.id);
    const targetOwnerId = targetUnit ? ownerOfUnit(game, targetUnit.id) : opponentOf(unitOwnerId);
    const powerIncreaseBlocked = hasAnyEffect(game, "ignorePowerIncreases");
    const shouldReveal = !options.silent;
    const powerContext = reason === "attack" || reason === "lifeAttack" || reason === "counter" || reason === "status";
    if (powerContext && unit.item && cards[unit.item.cardId].effectKey === "powerEqualsHp" && !powerIncreaseBlocked) {
      if (shouldReveal) revealItem(game, unit, "繝ｩ繧､繝輔ヱ繝ｯ繝ｼ縺ｧ繝代Ρ繝ｼ縺粂P縺ｨ蜷後§蛟､縺ｫ縺ｪ繧翫∪縺吶・");
      power = unit.hp;
    }
    if (powerContext && powerIncreaseBlocked) {
      power = Math.min(power, unit.basePower ?? cards[unit.cardId].power);
    }

    if ((reason === "attack" || reason === "lifeAttack" || reason === "status") && !powerIncreaseBlocked) {
      if ((reason === "attack" || reason === "lifeAttack") && card.effectKey === "attackPowerPlusThree") power += 3;
      if (reason === "attack" && targetUnit && hasEffect(game.players[unitOwnerId], "allyMonsterAttackPowerPlusTwo")) power += 2;
      if (card.effectKey === "powerPlusIfLifeTen" && game.players[unitOwnerId].life >= 10) power += 4;
      if (unit.item && cards[unit.item.cardId].effectKey === "attackPowerPlusTwo") {
        if (!isItemPowerBakedIntoUnit(unit, 2)) power += 2;
        if (shouldReveal) revealItem(game, unit, "諡倥ｊ驩｢蟾ｻ縺ｧ繝代Ρ繝ｼ+2縲・");
      }
      if (unit.cardId === "pikachu" && unit.item && cards[unit.item.cardId].effectKey === "pikachuPowerPlusSix") {
        if (!isItemPowerBakedIntoUnit(unit, 6)) power += 6;
        if (shouldReveal) revealItem(game, unit, "縺ｧ繧薙″縺縺ｾ縺ｧHP+6縲√ヱ繝ｯ繝ｼ+6縲・");
      }
    }

    return power;
  }

  function applyDamage(game, ownerId, unit, amount, context = {}) {
    amount = reduceDamageForPlayer(game, ownerId, amount);
    if (amount <= 0) return false;
    const beforeHp = unit.hp;
    if (unit.item && cards[unit.item.cardId].effectKey === "maxHpPlusTwo") revealItem(game, unit, "遯∵茶繝√Ι繝・く縺ｮHP+2縺悟ｽｱ髻ｿ縺励∪縺励◆縲・");
    if (unit.item && cards[unit.item.cardId].effectKey === "pikachuPowerPlusSix" && unit.cardId === "pikachu") revealItem(game, unit, "縺ｧ繧薙″縺縺ｾ縺ｮHP+6縺悟ｽｱ髻ｿ縺励∪縺励◆縲・");
    const hpForDamage = Number.isFinite(context.effectiveHp) ? Math.max(0, Number(context.effectiveHp)) : unit.hp;
    const wasFullHp = context.fullHpForSash ?? (unit.hp === unit.maxHp);
    const remainingHp = hpForDamage - amount;
    if (wasFullHp && remainingHp <= 0 && unit.item && cards[unit.item.cardId].effectKey === "surviveLethalAtOne") {
      revealItem(game, unit, `${cards[unit.cardId].name}縺ｯ豌怜粋縺・・繧ｿ繧ｹ繧ｭ縺ｧ謾ｻ謦・ｒ閠舌∴縺滂ｼ～`);
      game.lastMessage = `${cards[unit.cardId].name}縺ｯ豌怜粋縺・・繧ｿ繧ｹ繧ｭ縺ｧ謾ｻ謦・ｒ閠舌∴縺滂ｼ～`;
      addLog(game, game.lastMessage);
      discardItem(game, unit);
      unit.hp = 1;
      return false;
    }
    unit.hp = Math.max(0, Number.isFinite(context.effectiveHp) ? Math.min(unit.maxHp, remainingHp) : unit.hp - amount);
    return unit.hp <= 0;
  }

  function dealLifeDamage(game, playerId, amount, sourcePlayerId = null, sourceType = "attack") {
    if (sourcePlayerId !== null && sourcePlayerId !== playerId && sourceType !== "attack" && game.players[playerId].mysticGuardUntilTurn > game.turn) return 0;
    let damage = reduceDamageForPlayer(game, playerId, amount);
    if (game.players[playerId].lifeDamageReductionUntilTurn > game.turn) damage = Math.max(0, damage - 1);
    game.players[playerId].life = Math.max(0, game.players[playerId].life - damage);
    return damage;
  }

  function reduceDamageForPlayer(game, playerId, amount) {
    if (amount <= 0) return 0;
    return game.players[playerId].damageReductionUntilTurn > game.turn ? Math.max(0, amount - 2) : amount;
  }

  function resolveAttack(game, attackerOwnerId, attacker, defenderOwnerId, defender) {
    const attackerCard = cards[attacker.cardId];
    const itemCard = attacker.item ? cards[attacker.item.cardId] : null;
    const hitsAll = attackerCard.effectKey === "attackAllEnemies" || itemCard?.effectKey === "powerMinusOneAttackAll";
    if (!hitsAll) return resolveCombat(game, attackerOwnerId, attacker, defenderOwnerId, defender);

    let totalDefenderDamage = 0;
    let attackerDamage = 0;
    [...game.players[defenderOwnerId].field].forEach((target) => {
      const defenderDamage = getEffectivePower(game, attacker, target, "attack");
      const counterDamage = target.id === defender.id && !game.players[attackerOwnerId].noCounterThisTurn
        ? getEffectivePower(game, target, attacker, "counter")
        : 0;
      applyAttackDamageToDefender(game, attacker, defenderOwnerId, target, defenderDamage);
      if (counterDamage > 0) applyDamage(game, attackerOwnerId, attacker, counterDamage);
      resolveDestinyCloak(game, target, attacker);
      if (target.id === defender.id) resolveDestinyCloak(game, attacker, target);
      totalDefenderDamage += defenderDamage;
      attackerDamage += counterDamage;
    });
    return { defenderDamage: totalDefenderDamage, attackerDamage };
  }

  function resolveCombat(game, attackerOwnerId, attacker, defenderOwnerId, defender) {
    const defenderDamage = getEffectivePower(game, attacker, defender, "attack");
    const attackerDamage = game.players[attackerOwnerId].noCounterThisTurn ? 0 : getEffectivePower(game, defender, attacker, "counter");
    applyAttackDamageToDefender(game, attacker, defenderOwnerId, defender, defenderDamage);
    applyDamage(game, attackerOwnerId, attacker, attackerDamage, { source: cards[defender.cardId].name });
    resolveDestinyCloak(game, defender, attacker);
    resolveDestinyCloak(game, attacker, defender);
    return { attackerDamage, defenderDamage };
  }

  function applyAttackDamageToDefender(game, attacker, defenderOwnerId, defender, defenderDamage) {
    const gorillaAttack = ["useTargetPowerAsHp", "useTargetPowerAsHpNoSummonSick"].includes(cards[attacker.cardId].effectKey);
    const context = { source: cards[attacker.cardId].name };
    if (gorillaAttack) {
      context.effectiveHp = Math.min(defender.hp, Math.max(0, getEffectivePower(game, defender, attacker, "status")));
      context.fullHpForSash = defender.hp === defender.maxHp;
    }
    applyDamage(game, defenderOwnerId, defender, defenderDamage, context);
  }

  function onDeath(game, ownerId, unit) {
    const card = cards[unit.cardId];
    if (unit.item) discardItem(game, unit);
    game.discard.push(unit.cardId);
    addLog(game, `${card.name}縺ｯ蛟偵ｌ縺溘${card.name}繧呈昏譛ｭ縺ｫ騾√ｊ縺ｾ縺励◆縲Ａ`);
    if (card.effectKey === "drawTwoOnDeath") {
      drawAnyAvailableCard(game, ownerId);
      drawAnyAvailableCard(game, ownerId);
      addLog(game, `${card.name}縺ｮ豁ｻ莠｡譎ょ柑譫懊〒2繝峨Ο繝ｼ縲Ａ`);
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
      item: itemCardId ? { cardId: itemCardId, revealed: false, powerApplied: powerBonus > 0 } : null,
      sleepUntilTurn: 0,
    };
  }

  function enterField(game, playerId, cardId, enterReason = "summon", payload = {}) {
    const player = game.players[playerId];
    const opponentId = opponentOf(playerId);
    const card = cards[cardId];
    const unit = createUnit(cardId, game.turn);
    let onSummonEffect = "none";

    if (card.effectKey === "mustBeAttacked") {
      increasePower(game, unit, game.players[opponentId].field.length);
      onSummonEffect = "mustBeAttackedPower";
    }
    if (card.effectKey === "useTargetPowerAsHpNoSummonSick" || hasItemEffect(unit, "canActOnSummon")) {
      unit.canAct = true;
    }
    player.field.push(unit);

    if (card.effectKey === "enemyPowerMinusOneOnSummon") {
      game.players[opponentId].field.forEach((target) => lowerPower(game, opponentId, target, 1, playerId));
      onSummonEffect = "enemyPowerMinusOneOnSummon";
      addLog(game, `${card.name}縺ｮ蜿ｬ蝟壽凾蜉ｹ譫懊〒逶ｸ謇九Δ繝ｳ繧ｹ繧ｿ繝ｼ蜈ｨ菴薙・繝代Ρ繝ｼ-1縲Ａ`);
    }
    if (card.effectKey === "damageOnSummonZeroPowerAndReturn") {
      const target = findUnit(game.players[opponentId], payload.targetUnitId)
        || game.players[opponentId].field.slice().sort((a, b) => a.hp - b.hp)[0];
      if (target) {
        applyDamage(game, opponentId, target, 1, { source: card.name });
        discardDeadUnits(game);
        onSummonEffect = "damageOnSummon";
        addLog(game, `${card.name}縺ｮ蜿ｬ蝟壽凾蜉ｹ譫懊〒${cards[target.cardId].name}縺ｫ1繝繝｡繝ｼ繧ｸ縲Ａ`);
      }
    }
    return unit;
  }

  function publicUnit(game, unit, ownerId, viewerId) {
    const hiddenHpItem = ownerId !== viewerId && unit.item && !unit.item.revealed
      && ["maxHpPlusTwo", "pikachuPowerPlusSix"].includes(cards[unit.item.cardId].effectKey);
    const hiddenPowerItem = ownerId !== viewerId && unit.item && !unit.item.revealed
      && ["pikachuPowerPlusSix", "powerEqualsHp", "attackPowerPlusTwo"].includes(cards[unit.item.cardId].effectKey);
    let visiblePower = unit.item && cards[unit.item.cardId].effectKey === "powerEqualsHp" && (ownerId === viewerId || unit.item.revealed)
      ? unit.hp
      : getEffectivePower(game, unit, null, "status", { silent: true });
    if (hasAnyEffect(game, "ignorePowerIncreases")) {
      visiblePower = Math.min(visiblePower, unit.basePower ?? cards[unit.cardId].power);
    }
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
    addLog(game, `${cards[unit.cardId].name}繧呈昏譛ｭ縺ｫ騾√ｊ縺ｾ縺励◆縲Ａ`);
  }

  function moveUnitToHand(game, ownerId, unit) {
    const player = game.players[ownerId];
    const index = player.field.findIndex((candidate) => candidate.id === unit.id);
    if (index === -1) return;
    if (unit.item) discardItem(game, unit);
    player.field.splice(index, 1);
    player.hand.push(unit.cardId);
    addLog(game, `${cards[unit.cardId].name}繧呈焔譛ｭ縺ｫ謌ｻ縺励∪縺励◆縲Ａ`);
  }

  function discardHandCards(game, playerId, indexes, requiredCount) {
    const player = game.players[playerId];
    let chosen = normalizeIndexes(indexes);
    if (chosen.length < requiredCount) {
      return fail(game, `謐ｨ縺ｦ繧九き繝ｼ繝峨ｒ${requiredCount}譫夐∈繧薙〒縺上□縺輔＞縲Ａ`);
    }
    if (chosen.length < requiredCount) return fail(game, `謐ｨ縺ｦ繧九き繝ｼ繝峨ｒ${requiredCount}譫夐∈繧薙〒縺上□縺輔＞縲Ａ`);
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
      addLog(game, `${cards[unit.cardId].name}縺瑚・蛻・ｻ･螟悶・蜈ｨ繝｢繝ｳ繧ｹ繧ｿ繝ｼ縺ｫ1繝繝｡繝ｼ繧ｸ縲Ａ`);
    });
    discardDeadUnits(game);
  }

  function applyTurnEndEffects(game, playerId) {
    const player = game.players[playerId];
    player.field.forEach((unit) => {
      if (cards[unit.cardId].effectKey === "damageAllOthersTurnEnd") {
        game.players.forEach((candidate, ownerId) => {
          dealLifeDamage(game, ownerId, 1);
          candidate.field.forEach((target) => {
            if (target.id === unit.id) return;
            applyDamage(game, ownerId, target, 1);
          });
        });
        addLog(game, `${cards[unit.cardId].name}縺瑚・蛻・ｻ･螟悶・蜈ｨ菴薙↓1繝繝｡繝ｼ繧ｸ縲Ａ`);
      }
      if (cards[unit.cardId].effectKey === "healLifeOnTurnEnd") player.life += 1;
      if (cards[unit.cardId].effectKey === "maxHpPlusOneOnTurnEnd") {
        unit.maxHp += 1;
        unit.hp += 1;
      }
    });
    discardDeadUnits(game);
    checkWinner(game);
  }

  function ensureDecksHaveCards(game) {
    const totalDeckCards = game.piles.reduce((total, pile) => total + pile.deck.length, 0);
    if (totalDeckCards > 0) return;
    const pool = game.discard.splice(0);
    distributeCardsAcrossDecks(game, shuffle(pool.length > 0 ? pool : [...cardPool]));
    addLog(game, "螻ｱ譛ｭ繧貞・讒狗ｯ峨＠縺ｾ縺励◆縲・");
  }

  function rebalanceDecksIfNeeded(game) {
    const emptyCount = game.piles.filter((pile) => pile.deck.length === 0).length;
    if (emptyCount < 2) return;
    const pool = shuffle([...game.piles.flatMap((pile) => pile.deck), ...game.discard]);
    if (pool.length === 0) return;
    distributeCardsAcrossDecks(game, pool);
    addLog(game, "2縺､縺ｮ螻ｱ譛ｭ縺檎ｩｺ縺ｫ縺ｪ縺｣縺溘◆繧√∝ｱｱ譛ｭ縺ｨ謐ｨ譛ｭ繧偵☆縺ｹ縺ｦ繧ｷ繝｣繝・ヵ繝ｫ縺励※3螻ｱ縺ｫ蝮・ｭ牙・驟阪＠縺ｾ縺励◆縲・");
  }

  function reshuffleDecks(game) {
    const pool = shuffle(game.piles.flatMap((pile) => pile.deck));
    if (pool.length === 0) return;
    game.piles.forEach((pile) => { pile.deck = []; });
    pool.forEach((cardId, index) => {
      game.piles[index % game.piles.length].deck.push(cardId);
    });
    addLog(game, "繧ｶ繝ｻ繧ｵ繝ｼ繝√・蜉ｹ譫懊〒螻ｱ譛ｭ繧偵す繝｣繝・ヵ繝ｫ縺励※3螻ｱ縺ｫ蜀榊・驟阪＠縺ｾ縺励◆縲・");
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
    const deadName = cards[deadCandidate.cardId].name;
    const opposingName = cards[opposingUnit.cardId].name;
    revealItem(game, deadCandidate, `${deadName}縺ｯ驕馴｣繧後・繝ｳ繝医〒${opposingName}繧帝％騾｣繧後↓縺励◆・～`);
    opposingUnit.hp = 0;
  }

  function revealItem(game, unit, message) {
    if (!unit.item) return;
    const itemName = cards[unit.item.cardId].name;
    const serial = `${game.turn}:${game.log.length}:${unit.id}:${unit.item.cardId}`;
    if (unit.item.revealed) {
      game.lastMessage = `${itemName}: ${message}`;
      addLog(game, game.lastMessage);
      return;
    }
    unit.item.revealed = true;
    game.lastMessage = `${itemName}繧貞・髢九・{message}`;
    addLog(game, game.lastMessage);
    game.lastRevealedItem = {
      cardId: unit.item.cardId,
      unitCardId: unit.cardId,
      unitId: unit.id,
      message,
      serial,
    };
  }

  function discardItem(game, unit) {
    if (!unit.item) return;
    game.discard.push(unit.item.cardId);
    addLog(game, `${cards[unit.item.cardId].name}繧呈昏譛ｭ縺ｸ騾√ｊ縺ｾ縺励◆縲Ａ`);
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
      if (isItemPowerBakedIntoUnit(unit, 6)) unit.power = Math.max(0, unit.power - 6);
    }
    if (itemCard.effectKey === "attackPowerPlusTwo") {
      if (isItemPowerBakedIntoUnit(unit, 2)) unit.power = Math.max(0, unit.power - 2);
    }
  }

  function isItemPowerBakedIntoUnit(unit, bonus) {
    if (!unit.item) return false;
    if (typeof unit.item.powerApplied === "boolean") return unit.item.powerApplied;
    return unit.power > (unit.basePower ?? cards[unit.cardId].power);
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

  function canAttackLifeTarget(game, defenderOwnerId, attacker) {
    const defenderPlayer = game.players[defenderOwnerId];
    if (canIgnoreAttackRestrictions(attacker)) return true;
    if (hasEffect(defenderPlayer, "mustBeAttacked")) return false;
    return defenderPlayer.field.length < maxFieldSize;
  }

  function canTargetDefender(defenderPlayer, defender, attacker = null) {
    if (canIgnoreAttackRestrictions(attacker)) return true;
    const blockers = defenderPlayer.field.filter((unit) => cards[unit.cardId].effectKey === "mustBeAttacked");
    const allowed = blockers.length === 0 || blockers.some((unit) => unit.id === defender.id);
    return allowed;
  }

  function canIgnoreAttackRestrictions(unit) {
    return Boolean(unit && cards[unit.cardId]?.effectKey === "ignoreWallLifeAttack");
  }

  function isProtectedFromOpponentEffects(game, ownerId, sourcePlayerId) {
    return ownerId !== sourcePlayerId && game.players[ownerId].mysticGuardUntilTurn > game.turn;
  }

  function lowerPower(game, ownerId, unit, amount, sourcePlayerId) {
    if (amount <= 0) return;
    if (isProtectedFromOpponentEffects(game, ownerId, sourcePlayerId)) return;
    if (ownerId !== sourcePlayerId && hasItemEffect(unit, "powerDropTurnsToPlusFour")) {
      revealItem(game, unit, "螟ｩ驍ｪ鬯ｼ繝槭せ繧ｯ縺ｧ繝代Ρ繝ｼ+4縲・");
      increasePower(game, unit, 4);
      return;
    }
    unit.power = Math.max(0, unit.power - amount);
  }

  function increasePower(game, unit, amount) {
    if (amount <= 0) return false;
    if (hasAnyEffect(game, "ignorePowerIncreases")) return false;
    unit.power += amount;
    return true;
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
    if (!pending || pending.playerId !== playerId) return fail(game, "莠碁㍾繝√ぉ繝・け縺ｮ蜃ｦ逅・ｾ・■縺ｧ縺ｯ縺ゅｊ縺ｾ縺帙ｓ縲・");
    const opponent = game.players[pending.opponentId];
    const indexes = normalizeIndexes(opponentHandIndex).slice(0, pending.count || 1).sort((a, b) => b - a);
    if (indexes.length === 0) return fail(game, "逶ｸ謇九・謇区惆縺九ｉ繧ｫ繝ｼ繝峨ｒ驕ｸ繧薙〒縺上□縺輔＞縲・");
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
    return ok(game, { gainedCards: gained });
  }

  function resolvePendingDiscardSelection(game, playerId, handIndexes) {
    const pending = game.pendingDiscardSelection;
    if (!pending || pending.playerId !== playerId) return fail(game, "謐ｨ縺ｦ繧九き繝ｼ繝峨・驕ｸ謚槫ｾ・■縺ｧ縺ｯ縺ゅｊ縺ｾ縺帙ｓ縲・");
    const player = game.players[playerId];
    const indexes = player.hand.length <= pending.count ? player.hand.map((_, index) => index) : handIndexes;
    const result = discardHandCards(game, playerId, indexes, Math.min(pending.count, player.hand.length));
    if (!result.ok) return result;
    game.pendingDiscardSelection = null;
    game.lastMessage = `${game.players[playerId].name}縺梧焔譛ｭ繧・{pending.count}譫壽昏縺ｦ縺ｾ縺励◆縲Ａ`;
    addLog(game, game.lastMessage);
    rebalanceDecksIfNeeded(game);
    return ok(game);
  }

  function resolvePendingDiscardTake(game, playerId, discardIndex) {
    const pending = game.pendingDiscardTake;
    if (!pending || pending.playerId !== playerId) return fail(game, "謐ｨ譛ｭ縺九ｉ繧ｫ繝ｼ繝峨ｒ蜉縺医ｋ蜉ｹ譫懊・蜃ｦ逅・ｾ・■縺ｧ縺ｯ縺ゅｊ縺ｾ縺帙ｓ縲・");
    const index = Number(discardIndex);
    const cardId = game.discard[index];
    if (!cardId) return fail(game, "謐ｨ譛ｭ縺九ｉ繧ｫ繝ｼ繝峨ｒ驕ｸ繧薙〒縺上□縺輔＞縲・");
    game.discard.splice(index, 1);
    if (game.players[playerId].hand.length >= maxHandSize) game.discard.push(cardId);
    else game.players[playerId].hand.push(cardId);
    game.pendingDiscardTake = null;
    game.lastMessage = `${game.players[playerId].name}が捨札から${cards[cardId].name}を手札に加えました。`;
    addLog(game, game.lastMessage);
    return ok(game, { gainedCards: [cardId] });
  }

  function resolvePendingQuickReplay(game, playerId, payload = {}) {
    const pending = game.pendingQuickReplay;
    if (!pending || pending.playerId !== playerId) return fail(game, "譌ｩ讌ｭ縺ｮ2蝗樒岼蜃ｦ逅・ｾ・■縺ｧ縺ｯ縺ゅｊ縺ｾ縺帙ｓ縲・");
    if (!canAct(game, playerId)) return fail(game, "莉翫・縺昴・繝励Ξ繧､繝､繝ｼ縺ｮ繧ｿ繝ｼ繝ｳ縺ｧ縺ｯ縺ゅｊ縺ｾ縺帙ｓ縲・");
    const card = cards[pending.cardId];
    if (!card || card.type !== "action") return fail(game, "譌ｩ讌ｭ縺ｧ菴ｿ縺・き繝ｼ繝峨′隕九▽縺九ｊ縺ｾ縺帙ｓ縲・");

    const result = resolveActionCard(game, playerId, card, payload);
    if (!result.ok) return result;

    game.pendingQuickReplay = null;
    game.lastMessage = `${game.players[playerId].name}縺梧掠讌ｭ縺ｧ${card.name}繧偵ｂ縺・ｸ蠎ｦ菴ｿ逕ｨ縺励∪縺励◆縲Ａ`;
    addLog(game, game.lastMessage);
    checkWinner(game);
    rebalanceDecksIfNeeded(game);
    return ok(game, { drawnCards: result.drawnCards || [], discardedDrawCards: result.discardedDrawCards || [] });
  }

  function drawAnyAvailableCard(game, playerId) {
    const pile = game.piles.find((candidate) => candidate.deck.length > 0);
    const drawn = pile ? drawCard(game, playerId, pile.id, { silent: true }) : null;
    if (drawn) logTopDrawResults(game, "鮟偵ヰ繝・, [drawn]");
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
    game.pendingDiscardTake = null;
    game.pendingPileDrawSelection = null;
    game.pendingPileSearch = null;
    game.lastMessage = `豎ｺ逹・・{game.players[game.winner].name}縺ｮ蜍昴■縺ｧ縺吶Ａ`;
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

  function hasAnyEffect(game, effectKey) {
    return game.players.some((player) => hasEffect(player, effectKey));
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
    if (!message) return;
    game.log.unshift(message);
    game.log = game.log.slice(0, 32);
  }

  function addTurnSeparator(game, playerId) {
    addLog(game, `笏笏笏笏 ${game.players[playerId].name}縺ｮ繧ｿ繝ｼ繝ｳ 笏笏笏笏`);
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
    attackLifeWithAll,
    attackMonster,
    useUnitAbility,
    endTurn,
    surrender,
    addToDiscard,
    resolvePendingOpponentHandCheck,
    resolvePendingDiscardSelection,
    resolvePendingDiscardTake,
    resolvePendingPileDrawSelection,
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

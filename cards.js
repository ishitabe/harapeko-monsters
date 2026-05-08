(() => {
const CARD_DEFINITIONS = {
  zacian: { id: "zacian", name: "ザシアン", type: "unit", hp: 3, power: 2, effectKey: "attackPowerPlusThree", text: "攻撃時、パワー+3。" },
  calyrexShadow: { id: "calyrexShadow", name: "黒バド", type: "unit", hp: 1, power: 4, effectKey: "takeDiscardOnLifeAttack", text: "相手のライフを攻撃するたびに捨札から1枚好きなカードを手札に加える。" },
  zapdos: { id: "zapdos", name: "サンダー", type: "unit", hp: 3, power: 3, effectKey: "attackOrGainLife", text: "攻撃の代わりに自分のライフを+3できる。" },
  tyranitar: { id: "tyranitar", name: "バンギラス", type: "unit", hp: 5, power: 1, effectKey: "damageAllOthersTurnEnd", text: "ターン終了時、自分以外の全体に1ダメージ。ライフにもダメージを与える。" },
  rillaboom: { id: "rillaboom", name: "ゴリラ", type: "unit", hp: 3, power: 2, effectKey: "useTargetPowerAsHpNoSummonSick", text: "このモンスターは召喚酔いしない。モンスター攻撃時、相手はパワーをHPとして扱う。" },
  quagsire: { id: "quagsire", name: "ヌオー", type: "unit", hp: 3, power: 1, effectKey: "ignorePowerIncreases", text: "場にいる間、すべてのパワー上昇を無効化。持ち物による上昇も含む。" },
  snorlax: { id: "snorlax", name: "カビゴン", type: "unit", hp: 5, power: 0, effectKey: "mustBeAttacked", text: "召喚時、相手の場のモンスターの数だけパワーを増やす。相手はこのモンスターしか攻撃できない。" },
  pikachu: { id: "pikachu", name: "ピカチュウ", type: "unit", hp: 1, power: 1, effectKey: "none", text: "効果なし。" },
  ferrothorn: { id: "ferrothorn", name: "ナットレイ", type: "unit", hp: 2, power: 2, effectKey: "healLifeOnTurnEnd", text: "自分のターン終了時、ライフを+1する。" },
  kyogre: { id: "kyogre", name: "カイオーガ", type: "unit", hp: 3, power: 2, effectKey: "powerPlusIfLifeTen", text: "自分のライフが10以上ならパワー+4。" },
  eternatus: { id: "eternatus", name: "ムゲンダイナ", type: "unit", hp: 3, power: 2, effectKey: "maxHpPlusOneOnTurnEnd", text: "自分のターンが終わるたびに最大HPを+1する。" },
  landorus: { id: "landorus", name: "ランドロス", type: "unit", hp: 2, power: 3, effectKey: "enemyPowerMinusOneOnSummon", text: "召喚時、相手モンスター全員のパワー-1。" },
  incineroar: { id: "incineroar", name: "ガオガエン", type: "unit", hp: 2, power: 2, effectKey: "damageOnSummonZeroPowerAndReturn", text: "召喚時、好きな相手モンスター1体に1ダメージ。攻撃の代わりに相手モンスター1体のパワーを0にして、このカードを手札に戻せる。" },
  farigiraf: { id: "farigiraf", name: "リキキリン", type: "unit", hp: 1, power: 1, effectKey: "allyMonsterAttackPowerPlusTwo", text: "味方はモンスターに攻撃するときパワー+2。" },
  calyrexIce: { id: "calyrexIce", name: "白バド", type: "unit", hp: 4, power: 2, effectKey: "attackAllEnemies", text: "相手モンスター全体に攻撃する。" },
  mimikyu: { id: "mimikyu", name: "ミミッキュ", type: "unit", hp: 2, power: 2, effectKey: "doubleOwnPower", text: "攻撃の代わりに自分のパワーを2倍にできる。" },
  urshifu: { id: "urshifu", name: "ウーラオス", type: "unit", hp: 2, power: 4, effectKey: "ignoreWallLifeAttack", text: "このモンスターは相手のウォールを無視してライフを攻撃できる。" },
  hippowdon: { id: "hippowdon", name: "カバルドン", type: "unit", hp: 4, power: 1, effectKey: "sleepTargetNextTurn", text: "攻撃の代わりに相手モンスター1体を選び、次ターン行動できなくする。" },

  focusSash: { id: "focusSash", name: "気合いのタスキ", type: "item", effectKey: "surviveLethalAtOne", text: "致死ダメージ時、HP1で耐える。発動後捨札。" },
  choiceBand: { id: "choiceBand", name: "拘り鉢巻", type: "item", effectKey: "attackPowerPlusTwo", text: "パワー+2。" },
  assaultVest: { id: "assaultVest", name: "突撃チョッキ", type: "item", effectKey: "maxHpPlusTwo", text: "HP+2。" },
  destinyCloak: { id: "destinyCloak", name: "道連れマント", type: "item", effectKey: "destroyOpponentOnDeath", text: "モンスターの攻撃や反撃で倒された時、相手モンスターを捨札に送る。" },
  lightBall: { id: "lightBall", name: "でんきだま", type: "item", effectKey: "pikachuPowerPlusSix", text: "ピカチュウが持つとHP+6、パワー+6。" },
  boomerang: { id: "boomerang", name: "ブーメラン", type: "item", effectKey: "powerMinusOneAttackAll", text: "このモンスターの攻撃対象は相手の場全体になる。" },
  choiceScarf: { id: "choiceScarf", name: "拘りスカーフ", type: "item", effectKey: "canActOnSummon", text: "召喚酔いせずすぐに行動できる。" },
  contraryMask: { id: "contraryMask", name: "天邪鬼マスク", type: "item", effectKey: "powerDropTurnsToPlusFour", text: "相手にパワーを下げられた時、パワー+4。" },
  lifePower: { id: "lifePower", name: "ライフパワー", type: "item", effectKey: "powerEqualsHp", text: "このモンスターのパワーはHPと同じ値になる。" },

  robbery: { id: "robbery", name: "強奪", type: "action", effectKey: "stealOpponentItems", text: "相手のモンスターの持ち物をすべて自分の手札に加える。" },
  endingBell: { id: "endingBell", name: "終わりの鐘", type: "action", effectKey: "setAllMaxHpToOne", text: "相手の場の全てのモンスターの最大HPを1にする。" },
  erase: { id: "erase", name: "消し去る", type: "action", effectKey: "discardUnit", text: "モンスター1体を捨札に送る。" },
  courtChange: { id: "courtChange", name: "コートチェンジ", type: "action", effectKey: "swapUnits", text: "自分と相手の場のモンスターすべてを、持ち物ごと入れ替える。" },
  storm: { id: "storm", name: "嵐", type: "action", effectKey: "drawOneEachDiscardOne", text: "各山から1枚ずつドロー。" },
  reviveCrystal: { id: "reviveCrystal", name: "元気の塊", type: "action", effectKey: "reviveUnit", text: "捨札からモンスター1体を自分の場に出す。" },
  laboratory: { id: "laboratory", name: "研究室", type: "action", effectKey: "drawTwoGainAction", text: "1山から2枚ドローし、アクション権+1。同じ山から相手も2枚ドローする。" },
  excavation: { id: "excavation", name: "発掘", type: "action", effectKey: "takeDiscardToHandGainAction", text: "捨札からカード1枚を手札に加え、アクション権+1。" },
  doubleCheck: { id: "doubleCheck", name: "二重チェック", type: "action", effectKey: "discardOpponentHand", text: "相手の手札を見て1枚自分の手札に加える。" },
  stoneThrow: { id: "stoneThrow", name: "石投げ", type: "action", effectKey: "dealTwoToUnitOrLife", text: "モンスター1体、または相手ライフに3ダメージ。" },
  mysticGuard: { id: "mysticGuard", name: "神秘の守り", type: "action", effectKey: "mysticGuard", text: "次の自分のターンまで、相手のアクションや持ち物の効果を受けない。ライフも含む。さらに自分のライフへのダメージを-1する。" },
  redCard: { id: "redCard", name: "レッドカード", type: "action", effectKey: "redCard", text: "相手は手札をすべて捨て、3山から1枚ずつドローする。" },
  sacrifice: { id: "sacrifice", name: "生贄", type: "action", effectKey: "sacrifice", text: "手札からアクションカードを全て捨て、好きな自分の場のモンスターのパワー+3。" },
  shockWave: { id: "shockWave", name: "衝撃波", type: "action", effectKey: "shockWave", text: "相手モンスター全体の最大HPとパワーを-1。" },
  acrobat: { id: "acrobat", name: "アクロバット", type: "action", effectKey: "drawPileDiscardTwo", text: "山を1つ選び6枚ドロー。その後手札を3枚捨てる。" },
  protectivePads: { id: "protectivePads", name: "防護パッド", type: "action", effectKey: "noCounterThisTurn", text: "このターン、相手モンスターから反撃を受けない。" },
  healingWater: { id: "healingWater", name: "癒し水", type: "action", effectKey: "healLifeThree", text: "自分のライフ+4。好きな山から1枚ドロー。" },
  preparation: { id: "preparation", name: "下準備", type: "action", effectKey: "searchTwoFromPile", text: "好きな山を見て好きな2枚を自分の手札に加え、手札から好きな1枚を捨てる。" },
  battleDrum: { id: "battleDrum", name: "バトルドラム", type: "action", effectKey: "drawOneBuffOwnField", text: "山札から1枚ドロー。自分の場のモンスターのパワー+2。" },
  readyStance: { id: "readyStance", name: "構える", type: "action", effectKey: "buffHpByEnemyCount", text: "相手の場にいるモンスターの数だけ山札からドローし、自分の場全員のHPを1増やす。" },
  auroraVeil: { id: "auroraVeil", name: "オーロラベール", type: "action", effectKey: "damageMinusOneUntilNextTurn", text: "好きな山から1枚ドロー。次の自分のターンまで自分が受ける全てのダメージを-2する。" },
  theSearch: { id: "theSearch", name: "ザ・サーチ", type: "action", effectKey: "searchOneFromEachPile", text: "全ての山札からカードを1枚選び手札に加える。その後、山札をシャッフルして3山に再分配する。" },
  restock: { id: "restock", name: "補充", type: "action", effectKey: "discardAnyGainActions", text: "手札を好きな枚数捨てる。捨てた数+1だけアクション権を増やす。" },
};

const CARD_POOL = Object.keys(CARD_DEFINITIONS);
const PILE_DEFINITIONS = [
  { id: "pileA", name: "山札A" },
  { id: "pileB", name: "山札B" },
  { id: "pileC", name: "山札C" },
];

const cardGameCards = { CARD_DEFINITIONS, CARD_POOL, PILE_DEFINITIONS };
if (typeof window !== "undefined") window.CardGameCards = cardGameCards;
if (typeof module !== "undefined") module.exports = cardGameCards;
})();

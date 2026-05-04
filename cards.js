(() => {
const CARD_DEFINITIONS = {
  zacian: { id: "zacian", name: "ザシアン", type: "unit", hp: 3, power: 0, effectKey: "attackPowerPlusFive", text: "攻撃時、パワー+5。" },
  calyrexShadow: { id: "calyrexShadow", name: "黒バド", type: "unit", hp: 1, power: 4, effectKey: "drawFromPileOnKill", text: "このモンスターが相手モンスターを倒した時、好きな山から1枚ドローする。" },
  zapdos: { id: "zapdos", name: "サンダー", type: "unit", hp: 3, power: 3, effectKey: "attackOrGainLife", text: "攻撃の代わりに自分のライフを+3できる。" },
  tyranitar: { id: "tyranitar", name: "バンギ", type: "unit", hp: 4, power: 2, effectKey: "damageAllOthersTurnStart", text: "ターン開始時、自分以外の全モンスターに1ダメージ。" },
  rillaboom: { id: "rillaboom", name: "ゴリラ", type: "unit", hp: 3, power: 2, effectKey: "useTargetPowerAsHp", text: "モンスター攻撃時、相手はパワーをHPとして扱う。" },
  quagsire: { id: "quagsire", name: "ヌオー", type: "unit", hp: 3, power: 1, effectKey: "ignorePowerIncreases", text: "すべてのパワー上昇を無効化。持ち物による上昇も含む。" },
  snorlax: { id: "snorlax", name: "カビゴン", type: "unit", hp: 5, power: 1, effectKey: "mustBeAttacked", text: "相手はこのモンスターしか攻撃できない。" },
  pikachu: { id: "pikachu", name: "ピカチュウ", type: "unit", hp: 1, power: 1, effectKey: "none", text: "効果なし。" },
  ferrothorn: { id: "ferrothorn", name: "ナットレイ", type: "unit", hp: 2, power: 2, effectKey: "healLifeOnTurnEnd", text: "自分のターン終了時、ライフを+1する。" },
  kyogre: { id: "kyogre", name: "カイオーガ", type: "unit", hp: 3, power: 1, effectKey: "powerPlusIfLifeTen", text: "残りライフが10以上ならパワー+5。" },
  eternatus: { id: "eternatus", name: "ムゲンダイナ", type: "unit", hp: 3, power: 2, effectKey: "maxHpPlusOneOnTurnEnd", text: "自分のターンが終わるたびに最大HPを+1する。" },
  landorus: { id: "landorus", name: "ランドロス", type: "unit", hp: 2, power: 3, effectKey: "enemyPowerMinusOneOnSummon", text: "召喚時、相手モンスター全員のパワー-1。" },
  incineroar: { id: "incineroar", name: "ガオガエン", type: "unit", hp: 2, power: 2, effectKey: "zeroPowerAndReturn", text: "攻撃の代わりに相手モンスター1体のパワーを0にして、このカードを手札に戻せる。" },
  farigiraf: { id: "farigiraf", name: "リキキリン", type: "unit", hp: 1, power: 1, effectKey: "allyMonsterAttackPowerPlusTwo", text: "味方はモンスターに攻撃するときパワー+2。" },
  calyrexIce: { id: "calyrexIce", name: "白バド", type: "unit", hp: 4, power: 2, effectKey: "attackAllEnemies", text: "相手モンスター全体に攻撃する。" },
  mimikyu: { id: "mimikyu", name: "ミミッキュ", type: "unit", hp: 2, power: 2, effectKey: "doubleOwnPower", text: "攻撃の代わりに自分のパワーを2倍にできる。" },

  focusSash: { id: "focusSash", name: "気合いのタスキ", type: "item", effectKey: "surviveLethalAtOne", text: "致死ダメージ時、HP1で耐える。発動後捨札。" },
  choiceBand: { id: "choiceBand", name: "拘り鉢巻", type: "item", effectKey: "attackPowerPlusTwo", text: "パワー+2。" },
  assaultVest: { id: "assaultVest", name: "突撃チョッキ", type: "item", effectKey: "maxHpPlusTwo", text: "HP+2。外れたら効果も消える。" },
  destinyCloak: { id: "destinyCloak", name: "道連れマント", type: "item", effectKey: "destroyOpponentOnDeath", text: "モンスターが倒れた時、相手も破壊する。" },
  lightBall: { id: "lightBall", name: "でんきだま", type: "item", effectKey: "pikachuPowerPlusSix", text: "ピカチュウが持つとHP+6、パワー+6。" },
  boomerang: { id: "boomerang", name: "ブーメラン", type: "item", effectKey: "powerMinusOneAttackAll", text: "パワー-1。このモンスターの攻撃対象は相手モンスター全体になる。" },
  choiceScarf: { id: "choiceScarf", name: "拘りスカーフ", type: "item", effectKey: "canActOnSummon", text: "召喚したてでも行動できる。" },
  contraryMask: { id: "contraryMask", name: "天邪鬼マスク", type: "item", effectKey: "powerDropTurnsToPlusFour", text: "相手にパワーを下げられた時、パワー+4。" },
  lifePower: { id: "lifePower", name: "ライフパワー", type: "item", effectKey: "powerEqualsHp", text: "このモンスターのパワーはHPと同じ値になる。" },

  robbery: { id: "robbery", name: "強奪", type: "action", effectKey: "stealOpponentItems", text: "相手のモンスターの持ち物をすべて自分の手札に加える。" },
  endingBell: { id: "endingBell", name: "終わりの鐘", type: "action", effectKey: "setAllMaxHpToOne", text: "相手の場の全てのモンスターの最大HPを1にする。" },
  erase: { id: "erase", name: "消し去る", type: "action", effectKey: "discardUnit", text: "モンスター1体を捨札に送る。" },
  courtChange: { id: "courtChange", name: "コートチェンジ", type: "action", effectKey: "swapUnits", text: "自分と相手の場のモンスターすべてを、持ち物ごと入れ替える。" },
  storm: { id: "storm", name: "嵐", type: "action", effectKey: "drawOneEachDiscardOne", text: "各山から1枚ずつドロー。" },
  reviveCrystal: { id: "reviveCrystal", name: "元気の塊", type: "action", effectKey: "reviveUnit", text: "捨札からモンスター1体を自分の場に出す。" },
  laboratory: { id: "laboratory", name: "研究室", type: "action", effectKey: "drawTwoGainAction", text: "1山から2枚ドローし、アクション権+1。" },
  excavation: { id: "excavation", name: "発掘", type: "action", effectKey: "takeDiscardToHandGainAction", text: "捨札からカード1枚を手札に加え、アクション権+1。" },
  doubleCheck: { id: "doubleCheck", name: "二重チェック", type: "action", effectKey: "discardOpponentHand", text: "相手の手札を見て1枚自分の手札に加える。" },
  stoneThrow: { id: "stoneThrow", name: "石投げ", type: "action", effectKey: "dealTwoToUnitOrLife", text: "モンスター1体、または相手ライフに3ダメージ。" },
  mysticGuard: { id: "mysticGuard", name: "神秘の守り", type: "action", effectKey: "mysticGuard", text: "次の自分のターンまで、場のモンスターは相手のアクションや持ち物の効果を受けない。" },
  redCard: { id: "redCard", name: "レッドカード", type: "action", effectKey: "redCard", text: "相手は手札をすべて捨て、3山から1枚ずつドローする。" },
  sacrifice: { id: "sacrifice", name: "生贄", type: "action", effectKey: "sacrifice", text: "好きな自分の場のモンスターのパワー+3。" },
  shockWave: { id: "shockWave", name: "衝撃波", type: "action", effectKey: "shockWave", text: "相手モンスター全体のHPとパワーを-1。" },
  acrobat: { id: "acrobat", name: "アクロバット", type: "action", effectKey: "drawPileDiscardTwo", text: "好きな山のカードを全てドローする。その後手札を4枚捨てる。" },
  protectivePads: { id: "protectivePads", name: "防護パッド", type: "action", effectKey: "noCounterThisTurn", text: "このターン、相手モンスターから反撃を受けない。" },
  healingWater: { id: "healingWater", name: "癒し水", type: "action", effectKey: "healLifeThree", text: "自分のライフ+3。" },
  preparation: { id: "preparation", name: "下準備", type: "action", effectKey: "searchTwoFromPile", text: "好きな山を見て好きなカード2枚を手札に加える。" },
  battleDrum: { id: "battleDrum", name: "バトルドラム", type: "action", effectKey: "drawOneBuffOwnField", text: "山札から1枚ドロー。自分の場のモンスターのパワー+2。" },
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

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
let reconnectAttempted = false;
let titleActive = true;
let optionsOpen = false;
let titleLobbyOpen = false;
let titleLobbyMode = "menu";
let titleRulesOpen = false;
let titleCardsOpen = false;
let titleUpdatesOpen = false;
let titleRecordsOpen = false;
let titleCpuOpen = false;
let titleCardsFromBattle = false;
let profileEditorOpen = false;
let cpuDifficulty = "normal";
let rulesPageIndex = 0;
let selectedKey = null;
let detailKey = null;
let detailData = null;
let previousView = null;
let animationLock = false;
let hardCpuMatchActive = false;
let hardCpuResultHandled = false;
let restoredCpuBattle = false;
let suppressCpuBattleSave = false;
let sharedLeaderboard = [];
let sharedLeaderboardLoaded = false;
const pendingFx = new Map();
const AVATAR_DEFINITIONS = window.HarapekoAvatars || [];
const AVATAR_OPTIONS = AVATAR_DEFINITIONS.map((avatar) => avatar.src);
const AVATAR_BY_ID = new Map(AVATAR_DEFINITIONS.map((avatar) => [avatar.id, avatar.src]));
const AVATAR_ID_BY_SRC = new Map(AVATAR_DEFINITIONS.map((avatar) => [avatar.src, avatar.id]));
const AVATAR_FALLBACK_OPTIONS = [
  "assets/avatars/avatar-akudaruma.png",
  "assets/avatars/avatar-ashigatako.png",
  "assets/avatars/avatar-gollem.png",
  "assets/avatars/avatar-shadow.png",
  "assets/avatars/avatar-suffix.png",
  "assets/avatars/avatar-slime-platinum.png",
  "assets/avatars/avatar-sword-champ.png",
  "assets/avatars/avatar-takkun.png",
  "assets/avatars/avatar-bird.png",
  "assets/avatars/avatar-knuckle.png",
  "assets/avatars/avatar-niyao.png",
  "assets/avatars/avatar-badgyados.png",
  "assets/avatars/avatar-pandora.png",
  "assets/avatars/avatar-beach-princess.png",
  "assets/avatars/avatar-prince-slime.png",
  "assets/avatars/avatar-machine-1.png",
  "assets/avatars/avatar-muscle-dragon.png",
  "assets/avatars/avatar-love-king.png",
  "assets/avatars/avatar-warado.png",
  "assets/avatars/avatar-warabon.png",
  "assets/avatars/avatar-genius-slime.png",
];
if (AVATAR_OPTIONS.length === 0) AVATAR_OPTIONS.push(...AVATAR_FALLBACK_OPTIONS);
const AVATAR_ASSET_BY_ID = new Map(AVATAR_DEFINITIONS.map((avatar, index) => [avatar.id, AVATAR_FALLBACK_OPTIONS[index] || AVATAR_FALLBACK_OPTIONS[0]]));
const DEFAULT_LEADERBOARD_AVATAR = AVATAR_FALLBACK_OPTIONS[0];
const RANDOM_NAMES = ["アオイ", "ヒナタ", "レン", "ミナト", "ユウ", "ソラ", "ナギ", "ハル"];
let playerProfile = loadPlayerProfile();
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
const UPDATE_HISTORY = [
  {
    version: "v0.74",
    title: "ホーム画面追加に対応",
    items: [
      "iPhoneのSafariでホーム画面に追加した時、アプリのように起動しやすい表示に対応しました。",
      "オンライン接続がない時は、オンライン接続が必要であることを表示するようにしました。"
    ]
  },
  {
    version: "v0.73",
    title: "ランキングの過去アバター復元を修正",
    items: [
      "以前ランキングに保存されたアバター画像データから、元のアバターをできるだけ復元して表示するようにしました。",
      "復元できない場合だけデフォルトアバターを表示するようにしました。"
    ]
  },
  {
    version: "v0.72",
    title: "ランキングのアバター参照を修正",
    items: [
      "オンラインランキングのアバターが公開環境で壊れ画像になる不具合を修正しました。",
      "ランキングのアバターは、タイトル画面と同じ画像データから表示するようにしました。"
    ]
  },
  {
    version: "v0.71",
    title: "ランキングのアバター表示を再修正",
    items: [
      "オンラインランキングのアバター表示に、壊れた画像データを使わないようにしました。",
      "タイトル画面に表示されるバージョン表記を最新の内容に合わせました。"
    ]
  },
  {
    version: "v0.70",
    title: "ランキングのアバター保存を修正",
    items: [
      "オンラインランキングのアバターを、壊れにくい短いIDで保存するようにしました。",
      "スマホでランキングのアバター画像が表示されない場合でも、デフォルトアイコンを表示するようにしました。"
    ]
  },
  {
    version: "v0.69",
    title: "スマホのランキング表示を修正",
    items: [
      "スマホでオンラインランキングのアバターが表示されないことがある不具合を修正しました。",
      "スマホのランキングで長い名前と連勝数が読みやすくなるように配置を調整しました。"
    ]
  },
  {
    version: "v0.68",
    title: "ランキング表示を見やすく調整",
    items: [
      "オンライン共通ランキングで長い名前も最後まで表示されるようにしました。",
      "ランキングの難易度表示をなくし、1位から3位を目立つ色で表示するようにしました。",
      "スマホでもアバターが見やすいように表示を調整しました。"
    ]
  },
  {
    version: "v0.67",
    title: "ランキング表示の調整",
    items: [
      "オンライン共通ランキングを10位まで表示するようにしました。",
      "ランキングの名前の左に、登録時に使っていたアバターを表示するようにしました。"
    ]
  },
  {
    version: "v0.66",
    title: "オンラインランキングの記録方法を調整",
    items: [
      "CPU（強い）のオンラインランキングは、同じ連勝中の途中経過を何件も並べず、その挑戦の最高連勝だけを更新するようにしました。",
      "同じプレイヤーでも、別の挑戦で出した記録は別の記録として残ります。"
    ]
  },
  {
    version: "v0.65",
    title: "ライフクリック時の修正",
    items: [
      "相手ライフをクリックした時に画面が止まることがある不具合を修正しました。",
      "相手ライフの詳細パネルでは、全員ライフ攻撃の操作だけを分かりやすく表示するようにしました。"
    ]
  },
  {
    version: "v0.64",
    title: "ウーラオスとカビゴン周りの修正",
    items: [
      "ウーラオスは、相手のウォールやカビゴンの攻撃制限を無視して、ライフや好きな相手モンスターを攻撃できるようになりました。",
      "カビゴンがいる時の攻撃対象表示を修正し、攻撃できる対象が正しく表示されるようにしました。",
      "バトルログに不要な確認用メッセージが出ないようにしました。"
    ]
  },
  {
    version: "v0.63",
    title: "バトルの不具合修正",
    items: [
      "ゴリラがモンスターを攻撃した時、相手のパワーをHPとして扱う効果が正しく働くように修正しました。",
      "ゴリラにブーメランを持たせて全体攻撃した時も、ゴリラの効果が相手全体に正しく働くように修正しました。",
      "CPUがゴリラで倒せる相手を判断しやすくなるようにしました。"
    ]
  },
  {
    version: "v0.62",
    title: "タイトル画面とマルチ対戦メニューの整理",
    items: [
      "タイトル画面でプレイヤー名入力欄とアバター選択欄を常時表示する方式から、現在の名前とアバターだけを表示する方式に変更。",
      "タイトル画面にプロフィール編集ボタンを追加し、押した時だけ名前入力とアバター選択を表示するように変更。",
      "マルチ対戦画面、ランダム対戦画面、友達と対戦画面で使わない入力欄やボタンが残らないよう表示条件を変更。",
      "マルチ対戦メニューの入力欄配置を固定グリッドから必要なボタンだけが並ぶ表示に変更。"
    ]
  },
  {
    version: "v0.61",
    title: "ランキング、リキキリン新能力、召喚と攻撃処理の整理",
    items: [
      "CPU戦の記録をlocalStorageだけでなく、PostgreSQLのleaderboardテーブルにも保存できるように変更。",
      "RenderのDATABASE_URLが設定されている場合、GET /api/leaderboardで上位50件を取得し、POST /api/leaderboardでCPU戦の連勝記録を保存するように変更。",
      "タイトルの記録画面にオンライン共通ランキングTOP5を追加。",
      "リキキリンに、攻撃の代わりに場全体のHPとパワーを入れ替える能力を追加。",
      "モンスターが場に出る処理をenterFieldにまとめ、通常召喚と元気の塊で召喚酔いしない効果や召喚時効果が同じように処理されるように変更。",
      "ガオガエンの召喚時1ダメージが、通常召喚やCPU召喚で漏れにくいように変更。",
      "ゴリラの攻撃を通常のapplyDamage経由に変更し、気合いのタスキなど致死時持ち物が発動するように変更。",
      "カビゴンの攻撃誘導を対象制限として扱い、ダメージ軽減として混ざらないようにデバッグログを追加。",
      "バトルオプションにカード一覧を追加し、対戦中でも全カードを確認できるように変更。",
      "山札トップから引くドローは、ログに山とカード名を表示するように変更。山札を見て選ぶ効果はカード名をログに出さないように変更。"
    ]
  },
  {
    version: "v0.60",
    title: "CPU戦の連勝記録と対戦放棄対策",
    items: [
      "バトル中オプションからリセットボタンを削除。",
      "CPU戦中にタイトルへ戻る場合、対戦終了確認を表示し、承認した場合は敗北扱いで連勝を0に戻すように変更。",
      "CPU戦中のgameState、CPU難易度、連勝記録、battleStartedAtをlocalStorageのcurrentCpuBattleへ保存するように変更。",
      "CPU戦中にページをリロードした場合、新しいゲームを開始せず保存された途中状態を復元するように変更。",
      "CPU戦中にページを閉じる、または移動しようとした場合、「対戦を終了すると敗北になります」と警告するように変更。",
      "降参、タイトルへ戻る、不正終了、abandonCpuBattleをCPU戦の敗北扱いとして統一。",
      "CPU（強い）戦は勝利時だけ連勝数を+1し、敗北時や対戦放棄時は連勝数を0に戻すように変更。"
    ]
  },
  {
    version: "v0.59",
    title: "オンライン対戦の予期しない初期化防止",
    items: [
      "進行中のオンライン部屋でstartGameやinitializeGameが再実行されないよう、サーバー側にgameStartedによる初期化ガードを追加。",
      "連戦開始は決着後だけ許可するように変更し、対戦中の連戦要求では既存gameStateを維持してエラーを返すように変更。",
      "再接続処理はゲームを初期化せず、保存済みのroomIdとplayerTokenに一致する既存gameStateだけを返すように確認・補強。",
      "部屋作成、参加、ゲーム開始、初期化実行、初期化ブロック、再接続、切断、部屋削除のサーバーログを追加。",
      "部屋データにcreatedAt、lastUpdatedAt、resetReason、lastStartCaller、lastInitializeCallerを追加。",
      "リロード直後の再接続待ち中に、クライアントがローカル新規ゲームの初期状態を表示しないように変更。"
    ]
  },
  {
    version: "v0.58",
    title: "オンライン対戦の安定性強化",
    items: [
      "オンライン対戦のプレイヤー識別をsocket.idだけで行う方式から、サーバー発行のplayerTokenで同じプレイヤーとして識別する方式に変更。",
      "部屋作成、部屋参加、ランダム対戦成立時にplayerTokenを発行し、クライアントのlocalStorageに保存するように変更。",
      "リロード後、保存済みのroomIdとplayerTokenがある場合、room:reconnectで同じ部屋と席に復帰できるように変更。",
      "通信切断時、即敗北から60秒の再接続待機に変更。",
      "60秒以内に復帰した場合は対戦続行、60秒を超えた場合は切断負けに変更。",
      "オンライン対戦に90秒のターン制限時間を追加し、時間切れ時は自動でターン終了するように変更。",
      "3回連続で時間切れになった場合、時間切れ敗北になるように変更。",
      "効果処理中のpending状態をサーバー側で判定し、必要な選択以外の操作をエラーで返すように変更。",
      "pending状態が30秒以上続いた場合、安全のため自動でターン終了するように変更。",
      "オプション欄に相手の接続状態、再接続待ち秒数、ターン残り秒数、時間切れ回数を表示するように変更。"
    ]
  },
  {
    version: "v0.57",
    title: "強いCPUと思考ミスの調整",
    items: [
      "CPU（強い）の召喚判断を調整し、不利になりやすい召喚を減らすように変更。",
      "二重チェックを、相手手札0枚でも使用できる状態から、相手手札0枚では使用できない状態に変更。",
      "二重チェックを相手手札0枚で実行しようとした場合、カードやアクション権を消費する前に失敗するように変更。"
    ]
  },
  {
    version: "v0.56",
    title: "ログ、記録、スマホ表示の調整",
    items: [
      "ザ・サーチで手札に加える枚数を、空でない山の数だけから1枚だけに変更。",
      "攻撃ログを「同時処理: 相手に○、反撃で○ダメージ」から「○○が○○に攻撃　○ダメージ！」「○○が○○に反撃　○ダメージ！」に変更。",
      "モンスター死亡ログを「○○を捨札へ送りました」から「○○は倒れた　○○を捨札に送りました」に変更。",
      "持ち物公開時、画面メッセージとログの両方に「持ち物名を公開。効果内容」を表示するように変更。",
      "ログの保持件数を16件から32件に増やし、ターン開始ごとに区切り行を追加。",
      "召喚時ログから「召喚ターンは行動できません。」を削除。",
      "山札や捨札からカードを選ぶ効果を、名前だけの選択からカード風ボタンで効果文も見られる選択に変更。",
      "山を選んでドローする効果の選択肢に、山札トップカード名を表示するように変更。",
      "相手ライフクリックからの全員ライフ攻撃でエラーになることがある問題を修正。",
      "CPU（強い）戦だけを対象に、現在連勝数、最高連勝数、ローカル上位5件の記録を追加。",
      "CPU（強い）戦の決着前にリセット、タイトルへ戻る、降参で中断した場合、現在連勝数を0に戻すように変更。",
      "スマホ表示で相手HP欄が右に見切れないよう、相手手札とHPボックスの幅を調整。"
    ]
  },
  {
    version: "v0.55",
    title: "カード調整と表示改善",
    items: [
      "オーロラベールの軽減を-2に変更。",
      "衝撃波で最大HPが0になったモンスターは倒れるように変更。",
      "ヌオーが場にいる間、ミミッキュ倍化や持ち物などのパワー上昇を無効化。",
      "構える、下準備、神秘の守りを新仕様に変更。",
      "気合いのタスキと道連れマントの発動メッセージを追加。",
      "アップデート履歴画面を追加。"
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
  surrenderButton: document.querySelector("#surrenderButton"),
  optionsButton: document.querySelector("#optionsButton"),
  optionsPanel: document.querySelector("#optionsPanel"),
  closeOptionsButton: document.querySelector("#closeOptionsButton"),
  backTitleButton: document.querySelector("#backTitleButton"),
  battleCardListButton: document.querySelector("#battleCardListButton"),
  titleScreen: document.querySelector("#titleScreen"),
  startCpuButton: document.querySelector("#startCpuButton"),
  playerNameInput: document.querySelector("#playerNameInput"),
  avatarPicker: document.querySelector("#avatarPicker"),
  profileSummary: document.querySelector("#profileSummary"),
  profileSummaryAvatar: document.querySelector("#profileSummaryAvatar"),
  profileSummaryName: document.querySelector("#profileSummaryName"),
  editProfileButton: document.querySelector("#editProfileButton"),
  closeProfileButton: document.querySelector("#closeProfileButton"),
  profileEditor: document.querySelector("#profileEditor"),
  startMultiButton: document.querySelector("#startMultiButton"),
  showRulesButton: document.querySelector("#showRulesButton"),
  showCardsButton: document.querySelector("#showCardsButton"),
  showUpdatesButton: document.querySelector("#showUpdatesButton"),
  showRecordsButton: document.querySelector("#showRecordsButton"),
  titleCpu: document.querySelector("#titleCpu"),
  cpuNormalButton: document.querySelector("#cpuNormalButton"),
  cpuHardButton: document.querySelector("#cpuHardButton"),
  cpuBackButton: document.querySelector("#cpuBackButton"),
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
  titleUpdates: document.querySelector("#titleUpdates"),
  updateListBody: document.querySelector("#updateListBody"),
  updatesCloseButton: document.querySelector("#updatesCloseButton"),
  titleRecords: document.querySelector("#titleRecords"),
  recordListBody: document.querySelector("#recordListBody"),
  recordsCloseButton: document.querySelector("#recordsCloseButton"),
  titleLobby: document.querySelector("#titleLobby"),
  titleLobbyStatus: document.querySelector("#titleLobbyStatus"),
  titleLobbyNote: document.querySelector("#titleLobbyNote"),
  titleShareLink: document.querySelector("#titleShareLink"),
  titleRandomButton: document.querySelector("#titleRandomButton"),
  titleCreateRoomButton: document.querySelector("#titleCreateRoomButton"),
  titleJoinRoomButton: document.querySelector("#titleJoinRoomButton"),
  titleCopyPasswordButton: document.querySelector("#titleCopyPasswordButton"),
  titleCopyUrlButton: document.querySelector("#titleCopyUrlButton"),
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

function loadPlayerProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem("harapekoPlayerProfile") || "{}");
    return {
      name: String(saved.name || "").slice(0, 16),
      avatar: AVATAR_OPTIONS.includes(saved.avatar) ? saved.avatar : AVATAR_OPTIONS[0],
    };
  } catch {
    return { name: "", avatar: AVATAR_OPTIONS[0] };
  }
}

function currentPlayerProfile() {
  const name = elements.playerNameInput?.value.trim() || playerProfile.name || randomPlayerName();
  const avatar = playerProfile.avatar || AVATAR_OPTIONS[0];
  playerProfile = { name: name.slice(0, 16), avatar };
  try {
    localStorage.setItem("harapekoPlayerProfile", JSON.stringify(playerProfile));
  } catch {
    // localStorage is optional in private/restricted browsers.
  }
  return playerProfile;
}

function randomPlayerName() {
  return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
}

function saveOnlineSession(roomId, playerToken) {
  if (!roomId || !playerToken) return;
  try {
    localStorage.setItem("harapekoOnlineSession", JSON.stringify({ roomId, playerToken }));
  } catch {
    // localStorage is optional.
  }
}

function loadOnlineSession() {
  try {
    const saved = JSON.parse(localStorage.getItem("harapekoOnlineSession") || "{}");
    if (!saved.roomId || !saved.playerToken) return null;
    return { roomId: String(saved.roomId).toUpperCase(), playerToken: String(saved.playerToken) };
  } catch {
    return null;
  }
}

function clearOnlineSession() {
  try {
    localStorage.removeItem("harapekoOnlineSession");
  } catch {
    // localStorage is optional.
  }
}

function loadHardCpuRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem("harapekoHardCpuRecords") || "{}");
    return {
      current: Math.max(0, Number(saved.current) || 0),
      best: Math.max(0, Number(saved.best) || 0),
      ranking: Array.isArray(saved.ranking) ? saved.ranking
        .map((entry) => ({ name: String(entry.name || "ななし").slice(0, 16), best: Math.max(0, Number(entry.best) || 0) }))
        .filter((entry) => entry.best > 0)
        .sort((a, b) => b.best - a.best)
        .slice(0, 5) : [],
    };
  } catch {
    return { current: 0, best: 0, ranking: [] };
  }
}

function saveHardCpuRecords(records) {
  try {
    localStorage.setItem("harapekoHardCpuRecords", JSON.stringify(records));
  } catch {
    // localStorage is optional.
  }
}

function createHardCpuRunId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `hard-${Date.now()}-${random}`;
}

function loadHardCpuRunId() {
  try {
    const saved = localStorage.getItem("harapekoHardCpuRunId");
    return saved && saved.length <= 80 ? saved : "";
  } catch {
    return "";
  }
}

function ensureHardCpuRunId() {
  const current = loadHardCpuRunId();
  if (current) return current;
  const next = createHardCpuRunId();
  try {
    localStorage.setItem("harapekoHardCpuRunId", next);
  } catch {
    // localStorage is optional.
  }
  return next;
}

function saveHardCpuRunId(runId) {
  if (!runId) return;
  try {
    localStorage.setItem("harapekoHardCpuRunId", runId);
  } catch {
    // localStorage is optional.
  }
}

function clearHardCpuRunId() {
  try {
    localStorage.removeItem("harapekoHardCpuRunId");
  } catch {
    // localStorage is optional.
  }
}

function updateHardCpuRanking(records, name, streak) {
  const ranking = [...records.ranking];
  const existing = ranking.find((entry) => entry.name === name);
  if (existing) existing.best = Math.max(existing.best, streak);
  else ranking.push({ name, best: streak });
  records.ranking = ranking.sort((a, b) => b.best - a.best).slice(0, 5);
}

function resolveHardCpuResultIfNeeded(view) {
  if (!hardCpuMatchActive || hardCpuResultHandled || onlineMode || cpuDifficulty !== "hard" || view.winner === null) return null;
  const records = loadHardCpuRecords();
  const selfWon = view.winner === 0;
  if (selfWon) {
    records.current += 1;
    records.best = Math.max(records.best, records.current);
    updateHardCpuRanking(records, view.players[0].name, records.current);
  } else {
    records.current = 0;
    clearHardCpuRunId();
  }
  saveHardCpuRecords(records);
  hardCpuResultHandled = true;
  hardCpuMatchActive = false;
  return { selfWon, streak: records.current, best: records.best };
}

function resetHardCpuStreakForInterrupt() {
  if (!hardCpuMatchActive || hardCpuResultHandled || onlineMode || cpuDifficulty !== "hard" || game.winner !== null) return;
  const records = loadHardCpuRecords();
  records.current = 0;
  saveHardCpuRecords(records);
  clearHardCpuRunId();
  hardCpuMatchActive = false;
  hardCpuResultHandled = true;
}

function saveCurrentCpuBattle() {
  if (suppressCpuBattleSave || onlineMode || !cpuEnabled || titleActive || !game || game.winner !== null) return;
  const snapshot = {
    gameState: game,
    cpuDifficulty,
    hardCpuRecords: loadHardCpuRecords(),
    hardCpuRunId: loadHardCpuRunId(),
    hardCpuMatchActive,
    hardCpuResultHandled,
    battleStartedAt: loadCurrentCpuBattle()?.battleStartedAt || Date.now(),
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem("currentCpuBattle", JSON.stringify(snapshot));
  } catch {
    // localStorage is optional.
  }
}

function loadCurrentCpuBattle() {
  try {
    const saved = JSON.parse(localStorage.getItem("currentCpuBattle") || "{}");
    if (!saved.gameState || saved.gameState.winner !== null) return null;
    return saved;
  } catch {
    return null;
  }
}

function clearCurrentCpuBattle() {
  try {
    localStorage.removeItem("currentCpuBattle");
  } catch {
    // localStorage is optional.
  }
}

function restoreCpuBattleIfNeeded() {
  const saved = loadCurrentCpuBattle();
  if (!saved) return false;
  suppressCpuBattleSave = true;
  game = saved.gameState;
  cpuDifficulty = saved.cpuDifficulty === "hard" ? "hard" : "normal";
  cpuEnabled = true;
  cpuThinking = false;
  onlineMode = false;
  onlineState = null;
  onlinePlayerId = 0;
  lastOnlineStarted = false;
  hardCpuMatchActive = Boolean(saved.hardCpuMatchActive);
  hardCpuResultHandled = Boolean(saved.hardCpuResultHandled);
  if (saved.hardCpuRunId) saveHardCpuRunId(saved.hardCpuRunId);
  titleActive = false;
  titleLobbyOpen = false;
  titleRulesOpen = false;
  titleCardsOpen = false;
  titleUpdatesOpen = false;
  titleRecordsOpen = false;
  titleCpuOpen = false;
  optionsOpen = false;
  clearSelection();
  previousView = null;
  restoredCpuBattle = true;
  suppressCpuBattleSave = false;
  return true;
}

function isCpuBattleInProgress() {
  return !onlineMode && cpuEnabled && !titleActive && game && game.winner === null;
}

function abandonCpuBattle(reason = "abandon") {
  if (!isCpuBattleInProgress()) return false;
  if (cpuDifficulty === "hard") {
    const records = loadHardCpuRecords();
    records.current = 0;
    saveHardCpuRecords(records);
    clearHardCpuRunId();
  }
  hardCpuMatchActive = false;
  hardCpuResultHandled = true;
  cpuThinking = false;
  clearCurrentCpuBattle();
  console.warn("CPU battle abandoned as defeat", { reason, difficulty: cpuDifficulty });
  return true;
}

function completeCpuBattleIfNeeded(view) {
  if (onlineMode || !cpuEnabled || !game || view.winner === null) return null;
  const result = resolveHardCpuResultIfNeeded(view);
  if (result?.selfWon && result.streak >= 1) submitLeaderboard(result.streak);
  clearCurrentCpuBattle();
  return result;
}

async function submitLeaderboard(streak) {
  try {
    const profile = currentPlayerProfile();
    await fetch("/api/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        player_name: profile.name,
        avatar_id: avatarIdForLeaderboard(profile.avatar),
        mode: "cpu",
        difficulty: cpuDifficulty,
        win_streak: streak,
        run_id: cpuDifficulty === "hard" ? ensureHardCpuRunId() : "",
      }),
    });
  } catch {
    // Online ranking is optional during local/offline play.
  }
}

function avatarIdForLeaderboard(avatarSrc) {
  return AVATAR_ID_BY_SRC.get(avatarSrc) || avatarSrc || "akudaruma";
}

async function loadSharedLeaderboard() {
  try {
    const response = await fetch("/api/leaderboard");
    if (!response.ok) throw new Error("leaderboard failed");
    const body = await response.json();
    sharedLeaderboard = Array.isArray(body.entries) ? body.entries : [];
    sharedLeaderboardLoaded = true;
  } catch {
    sharedLeaderboard = [];
    sharedLeaderboardLoaded = true;
  }
  renderRecords();
}

function confirmCpuBattleExit() {
  if (!isCpuBattleInProgress()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const node = document.createElement("div");
    node.className = "confirm-overlay";
    node.innerHTML = `
      <div class="confirm-card">
        <h2>対戦を終了しますか？</h2>
        <p>CPU戦では敗北扱いになり、連勝記録が途切れます。</p>
        <div class="confirm-actions">
          <button type="button" class="danger-button" id="confirmCpuExitYes">はい</button>
          <button type="button" id="confirmCpuExitNo">いいえ</button>
        </div>
      </div>
    `;
    document.body.append(node);
    node.querySelector("#confirmCpuExitYes").addEventListener("click", () => {
      node.remove();
      resolve(true);
    });
    node.querySelector("#confirmCpuExitNo").addEventListener("click", () => {
      node.remove();
      resolve(false);
    });
  });
}

function setupProfileControls() {
  if (elements.playerNameInput) {
    elements.playerNameInput.value = playerProfile.name;
    elements.playerNameInput.addEventListener("input", () => {
      playerProfile.name = elements.playerNameInput.value.trim().slice(0, 16);
      try {
        localStorage.setItem("harapekoPlayerProfile", JSON.stringify(playerProfile));
      } catch {
        // localStorage is optional.
      }
      renderProfileSummary();
    });
  }
  if (!elements.avatarPicker) return;
  elements.avatarPicker.replaceChildren();
  AVATAR_OPTIONS.forEach((avatar) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `avatar-choice ${playerProfile.avatar === avatar ? "selected" : ""}`;
    button.innerHTML = `<img src="${avatar}" alt="">`;
    button.addEventListener("click", () => {
      playerProfile.avatar = avatar;
      try {
        localStorage.setItem("harapekoPlayerProfile", JSON.stringify(playerProfile));
      } catch {
        // localStorage is optional.
      }
      setupProfileControls();
      renderProfileSummary();
    });
    elements.avatarPicker.append(button);
  });
  renderProfileSummary();
}

function renderProfileSummary() {
  if (elements.profileSummaryAvatar) elements.profileSummaryAvatar.src = playerProfile.avatar || AVATAR_OPTIONS[0];
  if (elements.profileSummaryName) elements.profileSummaryName.textContent = playerProfile.name || "名前未設定";
}

function cpuProfile(difficulty) {
  const avatar = AVATAR_OPTIONS[Math.floor(Math.random() * AVATAR_OPTIONS.length)];
  return { name: difficulty === "hard" ? "CPU（強い）" : "CPU（普通）", avatar };
}

function render() {
  window.__CARD_APP_RENDERED = true;
  const view = getView();
  const selfId = getSelfId();
  const opponentId = selfId === 0 ? 1 : 0;
  const activePlayer = view.players[view.activePlayer];
  const lockedForCpu = !onlineMode && isCpuTurn(view);
  const lockedForOnline = onlineMode && (!onlineState?.started || view.activePlayer !== selfId || onlineState.gameStatus === "reconnecting" || onlineState.gameStatus === "disconnected");
  const locked = lockedForCpu || lockedForOnline || animationLock;
  renderBattleEvents(view);

  const turnNameClass = view.activePlayer === selfId ? "player-name-blue" : "player-name-red";
  const winnerNameClass = view.winner === selfId ? "player-name-blue" : "player-name-red";
  elements.turnLabel.innerHTML = view.winner === null
    ? `<span class="${turnNameClass}">${activePlayer.name}</span>のターン ${view.turn}`
    : `決着: <span class="${winnerNameClass}">${view.players[view.winner].name}</span>の勝ち`;
  elements.actionLabel.textContent = activePlayer.hasDrawnThisTurn
    ? `アクション ${activePlayer.actions}/2`
    : "山札を選んでドロー";
  if (onlineMode && onlineState?.started && view.winner === null) {
    elements.actionLabel.textContent += ` / 残り${Math.ceil((onlineState.turnRemainingMs || 0) / 1000)}秒`;
  }
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
  document.body.classList.toggle("title-updates-active", titleUpdatesOpen);
  document.body.classList.toggle("title-records-active", titleRecordsOpen);
  document.body.classList.toggle("title-cpu-active", titleCpuOpen);
  document.body.classList.toggle("profile-editor-active", profileEditorOpen);
  elements.titleLobby?.classList.toggle("hidden", !titleLobbyOpen);
  elements.titleRules?.classList.toggle("hidden", !titleRulesOpen);
  elements.titleCards?.classList.toggle("hidden", !titleCardsOpen);
  elements.titleUpdates?.classList.toggle("hidden", !titleUpdatesOpen);
  elements.titleRecords?.classList.toggle("hidden", !titleRecordsOpen);
  elements.titleCpu?.classList.toggle("hidden", !titleCpuOpen);
  elements.profileEditor?.classList.toggle("hidden", !profileEditorOpen);
  elements.profileSummary?.classList.toggle("hidden", profileEditorOpen || titleLobbyOpen || titleRulesOpen || titleCardsOpen || titleUpdatesOpen || titleRecordsOpen || titleCpuOpen);
  elements.optionsPanel?.classList.toggle("hidden", !optionsOpen);
  updateOptionsVisibility();

  renderOnlineStatus();
  renderTitleLobby();
  renderRules();
  renderCardList();
  renderUpdateHistory();
  renderRecords();
  updateTitleRecordButton();
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
  renderPendingDiscardTake();
  renderPendingPileDrawSelection();
  renderPendingPileSearch();
  updateDrawPrompt(view, locked);
  renderWinnerOverlay(view);
  flushFx();
  previousView = view;
  saveCurrentCpuBattle();
  if (!onlineMode) scheduleCpuTurn();
}

function getView() {
  if (onlineMode) return onlineState?.view || createOnlinePlaceholderView();
  return engine.getPublicState(game, getSelfId());
}

function createOnlinePlaceholderView() {
  const profile = playerProfile || {};
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
    lastMessage: "オンライン対戦に再接続中です。既存の対戦状態を取得しています。",
    log: ["再接続中です。ゲームは初期化しません。"],
    discard: [],
    piles: PILE_DEFINITIONS.map((pile) => ({ id: pile.id, name: pile.name, count: 0, topCardId: null })),
    players: [
      {
        name: profile.name || "あなた",
        avatar: profile.avatar || AVATAR_OPTIONS[0],
        life: 12,
        actions: 0,
        hasDrawnThisTurn: false,
        handCount: 0,
        hand: [],
        field: [],
      },
      {
        name: "相手",
        avatar: AVATAR_OPTIONS[1] || AVATAR_OPTIONS[0],
        life: 12,
        actions: 0,
        hasDrawnThisTurn: false,
        handCount: 0,
        hand: [],
        field: [],
      },
    ],
  };
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
    elements.playerName[slotId].className = slotId === 0 ? "player-name-blue" : "player-name-red";
    let streakNode = elements.playerName[slotId].parentElement.querySelector(".streak-note");
    if (!streakNode) {
      streakNode = document.createElement("small");
      streakNode.className = "streak-note";
      elements.playerName[slotId].after(streakNode);
    }
    if (!onlineMode && cpuDifficulty === "hard" && slotId === 0 && (hardCpuMatchActive || view.winner !== null)) {
      streakNode.textContent = `${loadHardCpuRecords().current}連勝中`;
      streakNode.hidden = false;
    } else {
      streakNode.hidden = true;
    }
    let avatarNode = elements.playerName[slotId].parentElement.querySelector(".player-avatar");
    if (!avatarNode) {
      avatarNode = document.createElement("img");
      avatarNode.className = "player-avatar";
      avatarNode.alt = "";
      elements.playerName[slotId].parentElement.prepend(avatarNode);
    }
    avatarNode.src = player.avatar || (slotId === 0 ? AVATAR_OPTIONS[0] : AVATAR_OPTIONS[1]);
    elements.life[slotId].textContent = `HP ${player.life}`;
    elements.life[slotId].onclick = null;
    if (slotId === 1) {
      elements.life[slotId].onclick = () => {
        const currentView = getView();
        if (!isMyTurn(currentView) || currentView.winner !== null || animationLock || !currentView.players[currentView.activePlayer].hasDrawnThisTurn) return;
        selectedKey = "life:opponent";
        detailKey = "life:opponent";
        detailData = { source: "opponentLife", zone: "相手ライフ", card: null };
        renderDetail();
      };
    }
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
  const opponentState = onlineState?.opponentConnected ? "相手接続中" : "相手切断中";
  const reconnectText = onlineState?.reconnectRemainingMs
    ? ` / 復帰待ち${Math.ceil(onlineState.reconnectRemainingMs / 1000)}秒`
    : "";
  const turnText = onlineState?.started && onlineState?.turnRemainingMs !== undefined
    ? ` / ターン残り${Math.ceil(onlineState.turnRemainingMs / 1000)}秒`
    : "";
  const timeoutText = onlineState?.timeoutCounts
    ? ` / 時間切れ 自分${onlineState.timeoutCounts[onlinePlayerId] || 0} 相手${onlineState.timeoutCounts[onlinePlayerId === 0 ? 1 : 0] || 0}`
    : "";
  elements.onlineStatus.textContent = onlineState?.started ? `オンライン対戦中（${opponentState}）` : "相手待ち";
  elements.onlineRoomLabel.textContent = `部屋 ${onlineState?.roomId || "-"} / あなたはプレイヤー${onlinePlayerId + 1}${reconnectText}${turnText}${timeoutText}`;
  elements.leaveRoomButton.disabled = false;
}

function updateOptionsVisibility() {
  const roomControls = [
    elements.createRoomButton,
    elements.roomIdInput,
    elements.joinRoomButton,
  ];
  const showRoomControls = false;
  roomControls.forEach((node) => {
    if (node) node.classList.toggle("hidden", !showRoomControls);
  });
  if (elements.leaveRoomButton) elements.leaveRoomButton.classList.add("hidden");
  if (elements.surrenderButton) elements.surrenderButton.classList.toggle("hidden", titleActive || getView().winner !== null);
}

function renderTitleLobby() {
  if (!elements.titleLobby) return;
  if (!titleLobbyOpen) return;
  const waiting = onlineMode && onlineState && !onlineState.started;
  const createdRoom = waiting && onlinePlayerId === 0;
  const joinedRoom = waiting && onlinePlayerId === 1;
  elements.titleRoomIdInput?.classList.toggle("hidden", titleLobbyMode !== "join" || waiting);
  elements.titleRandomButton?.classList.toggle("hidden", waiting || titleLobbyMode === "join" || titleLobbyMode === "friend" || titleLobbyMode === "random");
  elements.titleCreateRoomButton?.classList.toggle("hidden", joinedRoom || titleLobbyMode === "random");
  elements.titleJoinRoomButton?.classList.toggle("hidden", waiting || titleLobbyMode === "random");
  elements.titleCopyPasswordButton?.classList.toggle("hidden", !createdRoom);
  elements.titleCopyUrlButton?.classList.toggle("hidden", !createdRoom);
  if (!onlineMode) {
    elements.titleLobbyStatus.textContent = titleLobbyMode === "join" ? "部屋に入る" : titleLobbyMode === "friend" ? "友達と対戦" : titleLobbyMode === "random" ? "ランダム対戦" : "マルチ対戦";
    elements.titleLobbyNote.textContent = window.location.protocol === "file:"
      ? "オンライン対戦は npm start で起動したURLから使えます。"
      : titleLobbyMode === "join"
        ? "部屋を作った人から教えてもらったパスワードを入力してください。"
        : titleLobbyMode === "friend"
          ? "部屋を作るか、パスワードで部屋に入ってください。"
          : titleLobbyMode === "random"
            ? "ランダム対戦相手を探しています。"
            : "ランダム対戦か、友達と対戦を選んでください。";
    if (elements.titleRandomButton) elements.titleRandomButton.textContent = "ランダム対戦";
    if (elements.titleCreateRoomButton) elements.titleCreateRoomButton.textContent = titleLobbyMode === "join" ? "戻る" : titleLobbyMode === "friend" ? "部屋を作る" : "友達と対戦";
    if (elements.titleJoinRoomButton) elements.titleJoinRoomButton.textContent = titleLobbyMode === "join" ? "入る" : "部屋に入る";
    elements.titleCreateRoomButton?.classList.toggle("hidden", titleLobbyMode === "random");
    elements.titleJoinRoomButton?.classList.toggle("hidden", titleLobbyMode === "menu" || titleLobbyMode === "random");
    if (elements.titleRoomIdInput) elements.titleRoomIdInput.placeholder = "パスワード";
    elements.titleShareLink.textContent = "";
    return;
  }
  if (!onlineState?.started) {
    const link = makeRoomUrl(onlineState?.roomId || elements.titleRoomIdInput.value);
    elements.titleLobbyStatus.textContent = createdRoom ? "相手待ち" : "入室しました";
    elements.titleLobbyNote.textContent = createdRoom
      ? "このパスワードかURLをもう1人に送ってください。2人そろうとバトルが始まります。"
      : "部屋に入りました。作成者との接続を待っています。";
    if (elements.titleCreateRoomButton) elements.titleCreateRoomButton.textContent = "待機中";
    elements.titleCreateRoomButton?.classList.add("hidden");
    elements.titleShareLink.textContent = createdRoom
      ? `パスワード: ${onlineState.roomId}\nURL: ${link}`
      : `パスワード: ${onlineState.roomId}`;
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

function renderUpdateHistory() {
  if (!elements.titleUpdates || !titleUpdatesOpen) return;
  elements.updateListBody.replaceChildren();
  UPDATE_HISTORY.forEach((entry) => {
    const section = document.createElement("section");
    section.className = "update-entry";
    section.innerHTML = `
      <h3>${entry.version} ${entry.title}</h3>
      <ul>${entry.items.map((item) => `<li>${item}</li>`).join("")}</ul>
    `;
    elements.updateListBody.append(section);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function leaderboardAvatar(entry) {
  const value = String(entry.avatar_id || entry.avatarId || "");
  if (AVATAR_BY_ID.has(value)) return escapeHtml(AVATAR_BY_ID.get(value));
  const restored = restoreAvatarFromStoredValue(value);
  if (restored) return escapeHtml(restored);
  return escapeHtml(AVATAR_OPTIONS[0]);
}

function defaultLeaderboardAvatar() {
  return escapeHtml(AVATAR_OPTIONS[0]);
}

function restoreAvatarFromStoredValue(value) {
  if (!value) return "";
  if (value.startsWith("data:image/")) {
    return AVATAR_OPTIONS.find((avatar) => avatar.startsWith(value) || value.startsWith(avatar.slice(0, Math.min(800, avatar.length)))) || "";
  }
  if (value.startsWith("assets/avatars/")) {
    const filename = value.split("/").pop();
    const index = AVATAR_FALLBACK_OPTIONS.findIndex((avatar) => avatar.endsWith(filename));
    return index >= 0 ? AVATAR_OPTIONS[index] || "" : "";
  }
  return "";
}

function renderRecords() {
  if (!elements.titleRecords || !titleRecordsOpen) return;
  const records = loadHardCpuRecords();
  const rankingItems = records.ranking.length > 0
    ? records.ranking.map((entry, index) => `<li><b>${index + 1}位</b> ${escapeHtml(entry.name)} ${entry.best}連勝</li>`).join("")
    : "<li>まだ記録がありません。</li>";
  const sharedItems = !sharedLeaderboardLoaded
    ? "<li>読み込み中です。</li>"
    : sharedLeaderboard.length > 0
      ? sharedLeaderboard.slice(0, 10).map((entry, index) => `
        <li class="shared-rank-row rank-${index + 1}">
          <b>${index + 1}位</b>
          <span class="shared-rank-avatar" aria-hidden="true">
            <img src="${leaderboardAvatar(entry)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${defaultLeaderboardAvatar()}';">
          </span>
          <span class="shared-rank-name">${escapeHtml(entry.player_name)}</span>
          <strong>${Number(entry.win_streak) || 0}連勝</strong>
        </li>
      `).join("")
      : "<li>まだ共有記録がありません。</li>";
  elements.recordListBody.innerHTML = `
    <section class="record-summary">
      <div><span>現在</span><strong>${records.current}連勝</strong></div>
      <div><span>最高</span><strong>${records.best}連勝</strong></div>
    </section>
    <section class="record-ranking">
      <h3>ローカルランキング TOP5</h3>
      <ol>${rankingItems}</ol>
    </section>
    <section class="record-ranking">
      <h3>オンライン共通ランキング TOP10</h3>
      <ol class="shared-ranking-list">${sharedItems}</ol>
    </section>
  `;
}

function updateTitleRecordButton() {
  if (!elements.showRecordsButton) return;
  const records = loadHardCpuRecords();
  elements.showRecordsButton.textContent = `記録 ${records.current}連勝中`;
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
    if (entry.startsWith("────")) item.className = "log-turn-separator";
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

  if (detailData.source === "opponentLife") {
    elements.detailContent.innerHTML = `
      <div class="detail-card">
        <p class="eyebrow">${detailData.zone || "相手ライフ"}</p>
        <h2>相手ライフ</h2>
        <p class="card-text">行動可能なモンスター全員で、相手ライフへ攻撃できます。</p>
        <div class="detail-actions" id="detailActions"></div>
      </div>
    `;
    renderDetailActions(elements.detailContent.querySelector("#detailActions"), detailData);
    return;
  }

  const { card, zone, unit } = detailData;
  if (!card) {
    clearSelection();
    renderDetail();
    return;
  }
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
  detailData = { source: "pendingDoubleCheck", zone: "二重チェック", count: view.pendingOpponentHandCheck.count || 1, card: CARD_DEFINITIONS.doubleCheck };
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
  const card = pending.source === "preparation" ? CARD_DEFINITIONS.preparation : CARD_DEFINITIONS.acrobat;
  detailData = { source: "pendingDiscardSelection", zone: card.name, count: pending.count, card };
  renderDetail();
}

function renderPendingDiscardTake() {
  const view = getView();
  const pending = view.pendingDiscardTake;
  if (!pending || pending.playerId !== getSelfId() || isCpuTurn()) return;
  selectedKey = "pending:discardTake";
  detailKey = "pending:discardTake";
  detailData = { source: "pendingDiscardTake", zone: "黒バド", card: CARD_DEFINITIONS.calyrexShadow };
  renderDetail();
}

function renderPendingPileDrawSelection() {
  const view = getView();
  const pending = view.pendingPileDrawSelection;
  if (!pending || pending.playerId !== getSelfId() || isCpuTurn()) return;
  selectedKey = "pending:pileDrawSelection";
  detailKey = "pending:pileDrawSelection";
  detailData = { source: "pendingPileDrawSelection", zone: "構える", count: pending.count, card: CARD_DEFINITIONS.readyStance };
  renderDetail();
}

function renderPendingPileSearch() {
  const view = getView();
  const pending = view.pendingPileSearch;
  if (!pending || pending.playerId !== getSelfId() || isCpuTurn()) return;
  selectedKey = "pending:pileSearch";
  detailKey = "pending:pileSearch";
  detailData = { source: "pendingPileSearch", zone: pending.allPiles ? "ザ・サーチ" : "下準備", count: pending.count, cards: pending.cards, entries: pending.entries, card: pending.allPiles ? CARD_DEFINITIONS.theSearch : CARD_DEFINITIONS.preparation };
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
    const choices = opponent.hand.map((cardId, index) => [String(index), CARD_DEFINITIONS[cardId].name]);
    const picker = appendClickMultiPicker(container, "加える手札", choices, data.count || 1);
    container.append(createSmallButton("手札に加える", choices.length === 0, () => {
      const opponentHandIndex = picker.getSelectedValues();
      runGameAction("doubleCheck", { opponentHandIndex }, () => engine.resolvePendingOpponentHandCheck(game, game.activePlayer, opponentHandIndex));
      clearSelection();
      if (!onlineMode) render();
    }));
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

  if (data.source === "pendingDiscardTake") {
    renderDiscardTakeControls(container, view);
    return;
  }

  if (data.source === "pendingPileDrawSelection") {
    renderPileDrawSelectionControls(container, data.count, view);
    return;
  }

  if (data.source === "pendingPileSearch") {
    renderPileSearchControls(container, data);
    return;
  }

  if (data.source === "opponentLife") {
    const opponentId = view.activePlayer === 0 ? 1 : 0;
    const attackers = activePlayer.field.filter((unit) => unit.canAct && canAttackLifeTargetView(view, opponentId, unit));
    container.append(createSmallButton("全員ライフ攻撃", disabled || attackers.length === 0, async () => {
      await playAttackSequence(null, null, opponentId);
      const result = runGameAction("attackLifeAll", {}, () => engine.attackLifeWithAll(game, getSelfId()));
      if (!result || result.ok !== false) showFloat("全員でライフ攻撃！", "damage");
      clearSelection();
      if (!onlineMode) render();
    }));
    return;
  }

  if (data.source === "hand") {
    if (data.card.type === "unit") {
      if (data.card.effectKey === "damageOnSummonZeroPowerAndReturn" && view.players[view.activePlayer === 0 ? 1 : 0].field.length > 0) {
        const opponentId = view.activePlayer === 0 ? 1 : 0;
        view.players[opponentId].field.forEach((target) => {
          container.append(createSmallButton(`${CARD_DEFINITIONS[target.cardId].name}に1ダメージして召喚`, disabled || activePlayer.actions <= 0 || activePlayer.field.length >= view.maxFieldSize, () => {
            playSound("summon");
            runGameAction("summon", { handIndex: data.handIndex, payload: { targetUnitId: target.id } }, () => engine.summonFromHand(game, game.activePlayer, data.handIndex, { targetUnitId: target.id }));
            showFloat(`${data.card.name}を召喚！`, "summon");
            clearSelection();
            if (!onlineMode) render();
          }));
        });
        return;
      }
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
      const ignoresRestrictions = canIgnoreAttackRestrictions(unit);
      container.append(createSmallButton(opponentHasSnorlax && !ignoresRestrictions ? "カビゴンでライフ攻撃不可" : opponentHasWall && !ignoresRestrictions ? "壁でライフ攻撃不可" : "ライフを攻撃", disabled || !unit.canAct || !canAttackLifeTargetView(view, view.activePlayer === 0 ? 1 : 0, unit), async () => {
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
      if (CARD_DEFINITIONS[unit.cardId].effectKey === "damageOnSummonZeroPowerAndReturn") {
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
      if (unit.cardId === "farigiraf") {
        container.append(createSmallButton("場全体のHPとパワーを入れ替える", disabled || !unit.canAct, () => {
          getAllUnits(view).forEach((entry) => addFx(`field:${entry.ownerId}:${entry.unit.id}`, "fx-stat-up"));
          runGameAction("unitAbility", { ability: "swapAllHpPower", unitId: unit.id }, () => engine.useUnitAbility(game, game.activePlayer, { ability: "swapAllHpPower", unitId: unit.id }));
          showFloat("HP / パワー入れ替え！", "action");
          clearSelection();
          if (!onlineMode) render();
        }));
      }
      if (CARD_DEFINITIONS[unit.cardId].effectKey === "sleepTargetNextTurn") {
        const opponentId = view.activePlayer === 0 ? 1 : 0;
        view.players[opponentId].field.forEach((target) => {
          container.append(createSmallButton(`${CARD_DEFINITIONS[target.cardId].name}を召喚酔い`, disabled || !unit.canAct, () => {
            runGameAction("unitAbility", { ability: "sleepTargetNextTurn", unitId: unit.id, targetUnitId: target.id }, () => engine.useUnitAbility(game, game.activePlayer, { ability: "sleepTargetNextTurn", unitId: unit.id, targetUnitId: target.id }));
            clearSelection();
            if (!onlineMode) render();
          }));
        });
      }
      const opponentId = view.activePlayer === 0 ? 1 : 0;
      const defenders = filterAttackTargets(view.players[opponentId].field, unit);
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
      const targetUnit = view.players[data.ownerId]?.field.find((candidate) => candidate.id === data.unitId);
      const attackers = activePlayer.field.filter((attacker) => targetUnit && canTargetDefenderView(view.players[data.ownerId].field, targetUnit, attacker));
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
  if (card.effectKey === "discardOpponentHand") {
    const opponentId = view.activePlayer === 0 ? 1 : 0;
    return view.players[opponentId].handCount <= 0;
  }
  return false;
}

function filterAttackTargets(field, attacker = null) {
  if (canIgnoreAttackRestrictions(attacker)) return field;
  const snorlax = field.filter((unit) => CARD_DEFINITIONS[unit.cardId].effectKey === "mustBeAttacked");
  return snorlax.length > 0 ? snorlax : field;
}

function canAttackLifeTargetView(view, opponentId, attacker) {
  if (canIgnoreAttackRestrictions(attacker)) return true;
  if (view.players[opponentId].field.some((target) => CARD_DEFINITIONS[target.cardId].effectKey === "mustBeAttacked")) return false;
  return view.players[opponentId].field.length < view.maxFieldSize;
}

function canTargetDefenderView(defenderField, defender, attacker = null) {
  if (canIgnoreAttackRestrictions(attacker)) return true;
  const blockers = defenderField.filter((unit) => CARD_DEFINITIONS[unit.cardId].effectKey === "mustBeAttacked");
  return blockers.length === 0 || blockers.some((unit) => unit.id === defender.id);
}

function canIgnoreAttackRestrictions(unit) {
  return Boolean(unit && CARD_DEFINITIONS[unit.cardId]?.effectKey === "ignoreWallLifeAttack");
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

  if (["drawTwoGainAction", "drawPileDiscardTwo", "searchTwoFromPile", "drawOneBuffOwnField", "healLifeThree", "damageMinusOneUntilNextTurn"].includes(card.effectKey)) {
    controls.pile = appendSelect(form, "山札", view.piles.map((pile) => [pile.id, pileChoiceLabel(pile)]));
  }
  if (["discardUnit"].includes(card.effectKey)) {
    controls.target = appendSelect(form, "対象", orderedUnitOptions(view));
  }
  if (card.effectKey === "sacrifice") {
    controls.target = appendSelect(form, "対象", ownUnitOptions(view));
  }
  if (card.effectKey === "discardAnyGainActions") {
    const choices = active.hand
      .map((cardId, index) => [String(index), CARD_DEFINITIONS[cardId].name])
      .filter(([value]) => Number(value) !== actionHandIndex);
    controls.discards = appendClickMultiPicker(form, "捨てる手札", choices, choices.length);
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
    controls.discard = appendClickMultiPicker(form, "捨札", view.discard
      .map((cardId, index) => [String(index), CARD_DEFINITIONS[cardId].name, CARD_DEFINITIONS[cardId].type])
      .filter((entry) => entry[2] === "unit")
      .map(([value, label]) => [value, label, view.discard[Number(value)]]), 1);
  }
  if (card.effectKey === "takeDiscardToHandGainAction") {
    controls.discard = appendClickMultiPicker(form, "捨札", view.discard.map((cardId, index) => [String(index), CARD_DEFINITIONS[cardId].name, cardId]), 1);
  }
  return controls;
}

function renderDiscardSelectionControls(container, count, view) {
  const form = document.createElement("div");
  form.className = "action-form";
  const note = document.createElement("p");
  note.className = "empty-note";
  note.textContent = `効果処理です。捨てる手札を${count}枚選んでください。`;
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
  const choices = hand.map((cardId, index) => [String(index), CARD_DEFINITIONS[cardId].name, cardId]);
  const picker = appendClickMultiPicker(form, "捨てる手札", choices, count);
  form.append(createSmallButton(`${count}枚捨てる`, hand.length < count, () => {
    const handIndexes = picker.getSelectedValues();
    runGameAction("discardSelection", { handIndexes }, () => engine.resolvePendingDiscardSelection(game, game.activePlayer, handIndexes));
    clearSelection();
    if (!onlineMode) render();
  }));
  container.append(form);
}

function renderDiscardTakeControls(container, view) {
  const form = document.createElement("div");
  form.className = "action-form";
  const note = document.createElement("p");
  note.className = "empty-note";
  note.textContent = "黒バドの効果です。捨札から手札に加えるカードを1枚選んでください。";
  form.append(note);
  const choices = view.discard.map((cardId, index) => [String(index), CARD_DEFINITIONS[cardId].name, cardId]);
  const picker = appendClickMultiPicker(form, "捨札", choices, 1);
  form.append(createSmallButton("手札に加える", view.discard.length === 0, () => {
    const [discardIndex] = picker.getSelectedValues();
    runGameAction("discardTake", { discardIndex }, () => engine.resolvePendingDiscardTake(game, game.activePlayer, discardIndex));
    clearSelection();
    if (!onlineMode) render();
  }));
  container.append(form);
}

function renderPileDrawSelectionControls(container, count, view) {
  const form = document.createElement("div");
  form.className = "action-form";
  const note = document.createElement("p");
  note.className = "empty-note";
  note.textContent = `構えるの効果です。山札を${count}回分選んでドローしてください。同じ山を複数回選べます。`;
  form.append(note);
  const selects = [];
  for (let index = 0; index < count; index += 1) {
    selects.push(appendSelect(form, `ドロー${index + 1}`, view.piles.map((pile) => [pile.id, pileChoiceLabel(pile)])));
  }
  form.append(createSmallButton("ドローする", false, () => {
    const pileIds = selects.map((select) => select.value);
    runGameAction("pileDrawSelection", { pileIds }, () => engine.resolvePendingPileDrawSelection(game, game.activePlayer, pileIds), showDrawnCards);
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
  const choices = data.entries
    ? data.entries.map((entry) => [entry.value, entry.label, entry.cardId])
    : (data.cards || []).map((cardId, index) => [String(index), CARD_DEFINITIONS[cardId].name, cardId]);
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
  if (controls.discard) payload.discardIndex = controls.discard.getSelectedValues ? controls.discard.getSelectedValues()[0] : controls.discard.value;
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
  const hardResult = completeCpuBattleIfNeeded(view);
  const winner = view.players[view.winner];
  const selfWon = view.winner === getSelfId();
  const hardStreakLine = hardResult
    ? `<p class="winner-streak">${hardResult.selfWon ? `${hardResult.streak}連勝目！` : "連勝は0に戻りました。"}</p>`
    : "";
  node = document.createElement("div");
  node.id = "winnerOverlay";
  node.className = "winner-overlay";
  node.innerHTML = `
    <div class="winner-card">
      <p>${selfWon ? "勝利" : "敗北"}</p>
      <img class="winner-avatar" src="${winner.avatar || AVATAR_OPTIONS[view.winner] || AVATAR_OPTIONS[0]}" alt="">
      <h2>${winner.name}の勝ち！</h2>
      ${hardStreakLine}
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
      socket?.emit("room:rematch", {}, (result) => {
        if (!result?.ok) showFloat(result?.message || "連戦できません", "damage");
      });
      return;
    }
    startCpuGame(cpuDifficulty);
  });
  node.querySelector("#winnerTitle").addEventListener("click", () => {
    node.remove();
    backToTitle({ skipCpuConfirm: true });
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
  options.forEach(([value, text, cardId]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.value = value;
    if (cardId && CARD_DEFINITIONS[cardId]) {
      button.className = `choice-card ${CARD_DEFINITIONS[cardId].type}`;
      button.innerHTML = compactCardMarkup(CARD_DEFINITIONS[cardId]);
      const source = document.createElement("span");
      source.className = "choice-source";
      source.textContent = text;
      button.prepend(source);
    } else {
      button.textContent = text;
    }
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

function pileChoiceLabel(pile) {
  const topCard = pile.topCardId ? CARD_DEFINITIONS[pile.topCardId] : null;
  return `${pile.name} 残り${pile.count}枚 / トップ: ${topCard ? topCard.name : "なし"}`;
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
  const turnChanged = view.winner === null && previousView.activePlayer !== view.activePlayer;
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
  if (turnChanged) {
    setTimeout(() => showTurnBanner(`${view.players[view.activePlayer].name}のターン`), 1450);
  }
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
    else {
      if (afterResult) afterResult(result);
      saveCurrentCpuBattle();
    }
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

function startCpuSetup() {
  profileEditorOpen = false;
  titleCpuOpen = true;
  titleLobbyOpen = false;
  titleRulesOpen = false;
  titleCardsOpen = false;
  titleUpdatesOpen = false;
  titleRecordsOpen = false;
  render();
}

function startCpuGame(difficulty = "normal") {
  if (loadCurrentCpuBattle()) {
    restoreCpuBattleIfNeeded();
    render();
    showFloat("進行中のCPU戦に復帰しました", "draw");
    return;
  }
  if (socket) socket.emit("room:leave");
  clearOnlineSession();
  cpuDifficulty = difficulty;
  onlineMode = false;
  onlineState = null;
  onlinePlayerId = 0;
  lastOnlineStarted = false;
  cpuEnabled = true;
  cpuThinking = false;
  game = engine.createGame();
  const selfProfile = currentPlayerProfile();
  const opponentProfile = cpuProfile(difficulty);
  hardCpuMatchActive = difficulty === "hard";
  hardCpuResultHandled = false;
  game.players[0].name = selfProfile.name;
  game.players[0].avatar = selfProfile.avatar;
  game.players[1].name = opponentProfile.name;
  game.players[1].avatar = opponentProfile.avatar;
  titleActive = false;
  titleLobbyOpen = false;
  titleRulesOpen = false;
  titleCardsOpen = false;
  titleUpdatesOpen = false;
  titleRecordsOpen = false;
  titleCpuOpen = false;
  optionsOpen = false;
  clearSelection();
  previousView = null;
  clearCurrentCpuBattle();
  saveCurrentCpuBattle();
  render();
  showBattleStart(engine.getPublicState(game, 0), 0);
  setTimeout(() => showTurnBanner(`${game.players[game.activePlayer].name}のターン`), 1300);
}

function startMultiSetup() {
  abandonCpuBattle("start-multi");
  profileEditorOpen = false;
  if (socket) socket.emit("room:leave");
  clearOnlineSession();
  onlineMode = false;
  onlineState = null;
  onlinePlayerId = 0;
  lastOnlineStarted = false;
  cpuEnabled = false;
  cpuThinking = false;
  titleActive = true;
  titleLobbyOpen = true;
  titleLobbyMode = "menu";
  titleRulesOpen = false;
  titleCardsOpen = false;
  titleUpdatesOpen = false;
  titleRecordsOpen = false;
  titleCpuOpen = false;
  profileEditorOpen = false;
  optionsOpen = false;
  clearSelection();
  previousView = null;
  render();
}

async function backToTitle(options = {}) {
  if (!options.skipCpuConfirm) {
    const accepted = await confirmCpuBattleExit();
    if (!accepted) return;
  }
  abandonCpuBattle("back-to-title");
  if (socket) socket.emit("room:leave");
  clearOnlineSession();
  onlineMode = false;
  onlineState = null;
  onlinePlayerId = 0;
  lastOnlineStarted = false;
  cpuThinking = false;
  optionsOpen = false;
  titleActive = true;
  titleLobbyOpen = false;
  titleLobbyMode = "menu";
  titleRulesOpen = false;
  titleCardsOpen = false;
  titleUpdatesOpen = false;
  titleRecordsOpen = false;
  titleCpuOpen = false;
  profileEditorOpen = false;
  clearSelection();
  render();
}

elements.endTurnButton.addEventListener("click", () => {
  runGameAction("endTurn", {}, () => engine.endTurn(game, game.activePlayer));
  clearSelection();
  if (!onlineMode) render();
});

elements.startCpuButton?.addEventListener("click", startCpuSetup);
elements.cpuNormalButton?.addEventListener("click", () => startCpuGame("normal"));
elements.cpuHardButton?.addEventListener("click", () => startCpuGame("hard"));
elements.cpuBackButton?.addEventListener("click", () => {
  titleCpuOpen = false;
  render();
});
elements.startMultiButton?.addEventListener("click", startMultiSetup);
elements.editProfileButton?.addEventListener("click", () => {
  profileEditorOpen = true;
  titleLobbyOpen = false;
  titleRulesOpen = false;
  titleCardsOpen = false;
  titleUpdatesOpen = false;
  titleRecordsOpen = false;
  titleCpuOpen = false;
  render();
});
elements.closeProfileButton?.addEventListener("click", () => {
  profileEditorOpen = false;
  render();
});
elements.showRulesButton?.addEventListener("click", () => {
  profileEditorOpen = false;
  titleRulesOpen = true;
  titleCardsOpen = false;
  titleUpdatesOpen = false;
  titleRecordsOpen = false;
  titleCpuOpen = false;
  titleLobbyOpen = false;
  rulesPageIndex = 0;
  render();
});
elements.showCardsButton?.addEventListener("click", () => {
  profileEditorOpen = false;
  titleCardsFromBattle = false;
  titleCardsOpen = true;
  titleRulesOpen = false;
  titleUpdatesOpen = false;
  titleRecordsOpen = false;
  titleCpuOpen = false;
  titleLobbyOpen = false;
  render();
});
elements.cardsCloseButton?.addEventListener("click", () => {
  titleCardsOpen = false;
  if (titleCardsFromBattle) {
    titleActive = false;
    titleCardsFromBattle = false;
  }
  render();
});
elements.battleCardListButton?.addEventListener("click", () => {
  titleCardsFromBattle = true;
  titleActive = true;
  titleCardsOpen = true;
  titleRulesOpen = false;
  titleUpdatesOpen = false;
  titleRecordsOpen = false;
  titleCpuOpen = false;
  titleLobbyOpen = false;
  optionsOpen = false;
  render();
});
elements.showUpdatesButton?.addEventListener("click", () => {
  profileEditorOpen = false;
  titleUpdatesOpen = true;
  titleCardsOpen = false;
  titleRulesOpen = false;
  titleRecordsOpen = false;
  titleCpuOpen = false;
  titleLobbyOpen = false;
  render();
});
elements.updatesCloseButton?.addEventListener("click", () => {
  titleUpdatesOpen = false;
  render();
});
elements.showRecordsButton?.addEventListener("click", () => {
  profileEditorOpen = false;
  titleRecordsOpen = true;
  titleUpdatesOpen = false;
  titleCardsOpen = false;
  titleRulesOpen = false;
  titleCpuOpen = false;
  titleLobbyOpen = false;
  sharedLeaderboardLoaded = false;
  loadSharedLeaderboard();
  render();
});
elements.recordsCloseButton?.addEventListener("click", () => {
  titleRecordsOpen = false;
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
  if (socket) socket.emit("room:leave");
  clearOnlineSession();
  titleLobbyOpen = false;
  titleLobbyMode = "menu";
  titleRulesOpen = false;
  titleCardsOpen = false;
  titleCpuOpen = false;
  onlineMode = false;
  onlineState = null;
  render();
});
elements.titleCreateRoomButton?.addEventListener("click", async () => {
  if (onlineMode && onlineState && !onlineState.started && onlinePlayerId === 0) {
    const link = makeRoomUrl(onlineState.roomId);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
      showFloat("URLをコピーしました", "draw");
    }
    return;
  }
  if (titleLobbyMode === "join") {
    titleLobbyMode = "friend";
    render();
    return;
  }
  if (titleLobbyMode === "menu") {
    titleLobbyMode = "friend";
    render();
    return;
  }
  await createOnlineRoom({ fromTitle: true });
});
elements.titleRandomButton?.addEventListener("click", async () => {
  await joinRandomRoom({ fromTitle: true });
});
elements.titleJoinRoomButton?.addEventListener("click", async () => {
  if (titleLobbyMode !== "join") {
    titleLobbyMode = "join";
    render();
    return;
  }
  const password = elements.titleRoomIdInput.value.trim().toUpperCase();
  await joinOnlineRoom(password, { fromTitle: true });
});
elements.titleCopyPasswordButton?.addEventListener("click", async () => {
  if (!onlineState?.roomId) return;
  await copyText(onlineState.roomId, "パスワードをコピーしました");
});
elements.titleCopyUrlButton?.addEventListener("click", async () => {
  if (!onlineState?.roomId) return;
  await copyText(makeRoomUrl(onlineState.roomId), "URLをコピーしました");
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

elements.surrenderButton?.addEventListener("click", () => {
  if (getView().winner !== null) return;
  const accepted = typeof window.confirm === "function" ? window.confirm("降参しますか？") : true;
  if (!accepted) return;
  runGameAction("surrender", {}, () => engine.surrender(game, getSelfId()));
  if (!onlineMode) {
    completeCpuBattleIfNeeded(engine.getPublicState(game, 0));
    clearCurrentCpuBattle();
  }
  optionsOpen = false;
  clearSelection();
  if (!onlineMode) render();
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
  socket.emit("room:create", { player: currentPlayerProfile() }, (result) => {
    if (!result?.ok) {
      showFloat(result?.message || "部屋作成に失敗", "damage");
      return;
    }
    onlineMode = true;
    onlinePlayerId = result.playerId;
    saveOnlineSession(result.roomId, result.playerToken);
    titleActive = fromTitle;
    titleLobbyOpen = fromTitle;
    titleLobbyMode = "waiting";
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
    showFloat("パスワードを入力", "damage");
    return;
  }
  socket.emit("room:join", { password: roomId, player: currentPlayerProfile() }, (result) => {
    if (!result?.ok) {
      showFloat(result?.message || "参加に失敗", "damage");
      return;
    }
    onlineMode = true;
    onlinePlayerId = result.playerId;
    saveOnlineSession(result.roomId, result.playerToken);
    titleActive = fromTitle;
    titleLobbyOpen = fromTitle;
    titleLobbyMode = "waiting";
    titleRulesOpen = false;
    titleCardsOpen = false;
    optionsOpen = false;
    elements.roomIdInput.value = result.roomId;
    if (elements.titleRoomIdInput) elements.titleRoomIdInput.value = result.roomId;
    history.replaceState(null, "", makeRoomUrl(result.roomId));
    showFloat(`部屋 ${result.roomId} 参加`, "draw");
  });
}

async function joinRandomRoom({ fromTitle }) {
  if (!await ensureSocket()) return;
  titleLobbyMode = "random";
  render();
  socket.emit("room:random", { player: currentPlayerProfile() }, (result) => {
    if (!result?.ok) {
      showFloat(result?.message || "ランダム対戦に失敗", "damage");
      titleLobbyMode = "menu";
      render();
      return;
    }
    if (result.waiting) {
      onlineMode = false;
      onlineState = null;
      titleActive = fromTitle;
      titleLobbyOpen = fromTitle;
      titleLobbyMode = "random";
      showFloat("相手を探しています", "draw");
      render();
      return;
    }
    onlineMode = true;
    onlinePlayerId = result.playerId;
    saveOnlineSession(result.roomId, result.playerToken);
    titleActive = fromTitle;
    titleLobbyOpen = fromTitle;
    titleLobbyMode = "waiting";
    optionsOpen = false;
    showFloat("ランダム対戦成立", "draw");
  });
}

async function copyText(text, message) {
  if (!text) return;
  if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
  showFloat(message, "draw");
}

elements.leaveRoomButton?.addEventListener("click", () => {
  abandonCpuBattle("leave-room");
  if (socket) socket.emit("room:leave");
  clearOnlineSession();
  onlineMode = false;
  onlineState = null;
  onlinePlayerId = 0;
  lastOnlineStarted = false;
  optionsOpen = true;
  clearSelection();
  render();
});

window.addEventListener("beforeunload", (event) => {
  if (!isCpuBattleInProgress()) return;
  saveCurrentCpuBattle();
  event.preventDefault();
  event.returnValue = "対戦を終了すると敗北になります";
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
    attemptOnlineReconnect();
    renderOnlineStatus();
  });
  socket.on("disconnect", () => {
    if (onlineMode && onlineState) {
      onlineState = { ...onlineState, opponentConnected: false, gameStatus: "disconnected" };
    }
    reconnectAttempted = false;
    render();
  });
  socket.on("room:matched", (result) => {
    if (!result?.ok) return;
    onlineMode = true;
    onlinePlayerId = result.playerId;
    saveOnlineSession(result.roomId, result.playerToken);
    showFloat("ランダム対戦成立", "draw");
  });
  socket.on("room:state", (state) => {
    onlineMode = true;
    onlineState = state;
    onlinePlayerId = state.playerId;
    if (state.playerToken) saveOnlineSession(state.roomId, state.playerToken);
    titleLobbyMode = state.started ? "menu" : "waiting";
    titleActive = !state.started && titleLobbyOpen;
    if (state.started && !lastOnlineStarted) {
      titleActive = false;
      titleLobbyOpen = false;
      titleRulesOpen = false;
      titleCardsOpen = false;
      showBattleStart(state.view, state.playerId);
      setTimeout(() => showTurnBanner(`${state.view.players[state.view.activePlayer].name}のターン`), 1300);
    }
    lastOnlineStarted = Boolean(state.started);
    if (elements.roomIdInput && state.roomId) elements.roomIdInput.value = state.roomId;
    if (elements.titleRoomIdInput && state.roomId) elements.titleRoomIdInput.value = state.roomId;
    render();
  });
  return true;
}

function attemptOnlineReconnect() {
  if (reconnectAttempted) return;
  const session = loadOnlineSession();
  if (!session) return;
  reconnectAttempted = true;
  onlineMode = true;
  onlineState ||= {
    roomId: session.roomId,
    playerId: onlinePlayerId,
    playerToken: session.playerToken,
    started: false,
    gameStarted: false,
    gameStatus: "reconnecting",
    opponentConnected: false,
    reconnectRemainingMs: 0,
    turnRemainingMs: 0,
    turnLimitMs: 90000,
    timeoutCounts: [0, 0],
    connected: [false, false],
    pending: null,
    view: createOnlinePlaceholderView(),
  };
  titleActive = false;
  render();
  socket.emit("room:reconnect", session, (result) => {
    if (!result?.ok) {
      showFloat(result?.message || "対戦に復帰できませんでした", "damage");
      clearOnlineSession();
      onlineMode = false;
      onlineState = null;
      titleActive = true;
      render();
      return;
    }
    onlineMode = true;
    onlinePlayerId = result.playerId;
    saveOnlineSession(result.roomId, result.playerToken);
    showFloat("対戦に復帰しました", "draw");
  });
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
  if (attackerKey) addFx(attackerKey, "fx-attack-charge", 1300);
  render();
  await delay(620);
  if (attackerKey) addFx(attackerKey, "fx-attack");
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

function showBattleStart(view, selfId = getSelfId()) {
  const opponentId = selfId === 0 ? 1 : 0;
  const node = document.createElement("div");
  node.className = "battle-start-overlay";
  node.innerHTML = `
    <div class="battle-start-card">
      <div class="battle-start-player self">
        <img src="${view.players[selfId].avatar || AVATAR_OPTIONS[0]}" alt="">
        <strong>${view.players[selfId].name}</strong>
      </div>
      <div class="battle-start-vs">
        <span>BATTLE</span>
        <b>START</b>
      </div>
      <div class="battle-start-player opponent">
        <img src="${view.players[opponentId].avatar || AVATAR_OPTIONS[1]}" alt="">
        <strong>${view.players[opponentId].name}</strong>
      </div>
    </div>
  `;
  document.body.append(node);
  playSound("turn");
  setAnimationLock(1250);
  setTimeout(() => node.remove(), 1250);
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
  if (cpuDifficulty === "hard") {
    await runHardCpuTurn();
    return;
  }
  await runCpuOpeningDraw();
  await runCpuPendingDiscardTake();
  await runCpuSummon();
  await runCpuActions();
  await runCpuAttacks();
  await runCpuPendingDiscardTake();
  if (game.winner === null && game.activePlayer === 1) {
    await cpuStep("ターン終了", () => engine.endTurn(game, 1), "turn");
  }
}

async function runHardCpuTurn() {
  await runCpuOpeningDraw();
  await runCpuPendingDiscardTake();
  await runCpuEquipItems();
  let guard = 0;
  while (game.winner === null && game.activePlayer === 1 && game.players[1].actions > 0 && guard < 8) {
    guard += 1;
    const choice = chooseHardCpuMainAction();
    if (!choice || choice.score < 90) break;
    const result = await executeHardCpuChoice(choice);
    if (!result?.ok) break;
    await runCpuEquipItems();
  }
  await runHardCpuUnitAbilities();
  await runCpuPendingDiscardTake();
  await runCpuEquipItems();
  await runHardCpuAttacks();
  await runCpuPendingDiscardTake();
  if (game.winner === null && game.activePlayer === 1) {
    await cpuStep("CPU ターン終了", () => engine.endTurn(game, 1), "turn");
  }
}

async function runCpuOpeningDraw() {
  const view = engine.getPublicState(game, 0);
  if (view.players[1].hasDrawnThisTurn) return;
  const pile = cpuDifficulty === "hard"
    ? chooseBestCpuPile()
    : [...game.piles].filter((candidate) => candidate.deck.length > 0).sort((a, b) => b.deck.length - a.deck.length)[0];
  if (pile) {
    await cpuStep("CPU ドロー", () => {
      addFx(`deck:${pile.id}`, "fx-draw");
      return engine.drawFromPile(game, 1, pile.id);
    }, "draw");
  }
}

async function runCpuPendingDiscardTake() {
  if (game.pendingDiscardTake?.playerId !== 1) return;
  const index = game.discard
    .map((cardId, discardIndex) => ({ discardIndex, score: hardCardIdScore(cardId) }))
    .sort((a, b) => b.score - a.score)[0]?.discardIndex ?? 0;
  await cpuStep("CPU 捨札回収", () => engine.resolvePendingDiscardTake(game, 1, index), "select");
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
    const choice = cpuDifficulty === "hard" ? chooseHardCpuItemEquip() : chooseCpuItemEquip();
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

function chooseHardCpuItemEquip() {
  const player = game.players[1];
  const candidates = player.field.filter((unit) => !unit.item);
  if (candidates.length === 0) return null;
  return player.hand
    .map((cardId, handIndex) => ({ cardId, handIndex, card: CARD_DEFINITIONS[cardId] }))
    .filter((entry) => entry.card.type === "item")
    .flatMap((entry) => candidates.map((unit) => ({
      handIndex: entry.handIndex,
      unit,
      score: scoreItemOnUnit(entry.cardId, unit),
    })))
    .filter((choice) => choice.score > 0)
    .sort((a, b) => b.score - a.score)[0] || null;
}

function scoreItemOnUnit(itemId, unit) {
  const card = CARD_DEFINITIONS[unit.cardId];
  const base = unitThreat(unit);
  if (itemId === "lightBall") return unit.cardId === "pikachu" ? 900 : -1000;
  if (itemId === "choiceScarf") return unit.canAct ? 40 : 420 + hardUnitCardScore(card) + immediateAttackValue(unit) * 0.45;
  if (itemId === "lifePower") {
    const powerGain = Math.max(0, unit.hp - unit.power);
    return Math.max(80, unit.hp * 130 + powerGain * 115 - Math.max(0, unit.power) * 25)
      + (unit.maxHp >= 5 ? 260 : 0)
      + (card.effectKey === "mustBeAttacked" ? 320 : 0)
      + (card.effectKey === "powerPlusIfLifeTen" ? 140 : 0)
      + (card.effectKey === "healLifeOnTurnEnd" ? 90 : 0)
      + immediateAttackValue({ ...unit, power: Math.max(unit.power, unit.hp) }) * 0.2;
  }
  if (itemId === "choiceBand") return 260 + Math.max(0, unit.hp - 1) * 25 + base * 0.15 + immediateAttackValue(unit) * 0.25;
  if (itemId === "assaultVest") return 220
    + (card.effectKey === "mustBeAttacked" ? 210 : 0)
    + (card.effectKey === "powerPlusIfLifeTen" ? 120 : 0)
    + (card.effectKey === "healLifeOnTurnEnd" ? 90 : 0)
    + base * 0.12;
  if (itemId === "focusSash") return (unit.maxHp <= 2 ? 340 : 180)
    + (unit.power >= 3 ? 120 : 0)
    + (card.effectKey === "attackPowerPlusThree" ? 130 : 0);
  if (itemId === "destinyCloak") return (unit.hp <= 2 ? 290 : 170)
    + (card.effectKey === "mustBeAttacked" ? 240 : 0)
    + (unit.power <= 1 ? 50 : 0);
  if (itemId === "boomerang") return unit.power >= 2
    ? 300 + game.players[0].field.length * 90 + (card.effectKey === "attackAllEnemies" ? -120 : 0)
    : 50;
  if (itemId === "contraryMask") return game.players[0].hand.some((id) => ["shockWave", "battleDrum"].includes(id)) ? 160 : 90;
  return 80;
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
      const indexes = game.pendingPileSearch.allPiles
        ? game.piles.flatMap((pile) => pile.deck
          .map((cardId, index) => ({ value: `${pile.id}:${index}`, card: CARD_DEFINITIONS[cardId] }))
          .sort((a, b) => cardScore(b.card) - cardScore(a.card))
          .slice(0, 1)
          .map((entry) => entry.value))
        : game.piles.find((pile) => pile.id === game.pendingPileSearch.pileId)?.deck
          .map((cardId, index) => ({ cardId, index, card: CARD_DEFINITIONS[cardId] }))
          .sort((a, b) => cardScore(b.card) - cardScore(a.card))
          .slice(0, game.pendingPileSearch.count)
          .map((entry) => entry.index) || [];
      await cpuStep("CPU 下準備", () => engine.resolvePendingPileSearch(game, 1, indexes), "draw");
    }
    if (game.pendingPileDrawSelection?.playerId === 1) {
      const pileIds = chooseCpuPileDrawIds(game.pendingPileDrawSelection.count);
      await cpuStep("CPU 構えるドロー", () => engine.resolvePendingPileDrawSelection(game, 1, pileIds), "draw");
    }
  }
}

function chooseHardCpuMainAction() {
  const player = game.players[1];
  const choices = [
    ...hardActionChoices(),
    ...hardSummonChoices(),
  ];
  return choices
    .map((choice) => ({ ...choice, score: choice.score + hardChoiceLookaheadScore(choice) }))
    .sort((a, b) => b.score - a.score)[0] || null;
}

async function executeHardCpuChoice(choice) {
  if (choice.type === "summon") {
    return cpuStep("CPU 召喚", () => engine.summonFromHand(game, 1, choice.handIndex), "summon");
  }
  if (choice.type === "action") {
    const card = CARD_DEFINITIONS[game.players[1].hand[choice.handIndex]];
    await showCardCast(card);
    const result = await cpuStep(`CPU ${card.name}`, () => engine.playAction(game, 1, choice.handIndex, choice.payload || {}), "select");
    await resolveCpuPendingChoices();
    return result;
  }
  return { ok: false };
}

async function resolveCpuPendingChoices() {
  if (game.pendingOpponentHandCheck?.playerId === 1) {
    const indexes = game.players[0].hand
      .map((cardId, index) => ({ index, score: hardCardIdScore(cardId) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, game.pendingOpponentHandCheck.count || 1)
      .map((entry) => entry.index);
    await cpuStep("CPU 二重チェック", () => engine.resolvePendingOpponentHandCheck(game, 1, indexes), "select");
  }
  if (game.pendingDiscardSelection?.playerId === 1) {
    const indexes = chooseHardCpuDiscardIndexes(game.pendingDiscardSelection.count);
    await cpuStep("CPU 捨てる", () => engine.resolvePendingDiscardSelection(game, 1, indexes), "select");
  }
  if (game.pendingPileSearch?.playerId === 1) {
    const indexes = chooseHardCpuPileSearchIndexes();
    await cpuStep("CPU サーチ", () => engine.resolvePendingPileSearch(game, 1, indexes), "draw");
  }
  if (game.pendingPileDrawSelection?.playerId === 1) {
    const pileIds = chooseCpuPileDrawIds(game.pendingPileDrawSelection.count);
    await cpuStep("CPU 構えるドロー", () => engine.resolvePendingPileDrawSelection(game, 1, pileIds), "draw");
  }
  await runCpuPendingDiscardTake();
}

function chooseCpuPileDrawIds(count) {
  const ids = [];
  for (let index = 0; index < count; index += 1) {
    ids.push(chooseBestCpuPile()?.id || game.piles.find((pile) => pile.deck.length > 0)?.id);
  }
  return ids.filter(Boolean);
}

function hardSummonChoices() {
  const player = game.players[1];
  if (player.field.length >= engine.getPublicState(game, 0).maxFieldSize) return [];
  return player.hand
    .map((cardId, handIndex) => ({ cardId, handIndex, card: CARD_DEFINITIONS[cardId] }))
    .filter((entry) => entry.card.type === "unit")
    .filter((entry) => !(entry.cardId === "tyranitar" && player.life <= 4))
    .map((entry) => {
      let score = 120 + hardUnitCardScore(entry.card);
      if (player.field.length === 0) score += 180;
      if (player.field.length === 2) score += 160;
      if (entry.cardId === "tyranitar" && player.life <= 6) score -= 420;
      if (entry.cardId === "quagsire") score += quagsireSummonAdjustment();
      if (entry.cardId === "pikachu" && player.hand.includes("lightBall")) score += 520;
      score += bestItemComboBonusForUnit(entry.cardId);
      if (entry.card.effectKey === "mustBeAttacked") score += game.players[0].field.length * 85;
      if (entry.card.effectKey === "ignoreWallLifeAttack" && game.players[0].field.length >= 3) score += 300;
      if (entry.card.effectKey === "powerPlusIfLifeTen" && player.life >= 10) score += 260;
      if (entry.card.effectKey === "healLifeOnTurnEnd" && player.life <= 10) score += 150;
      if (entry.card.effectKey === "attackAllEnemies" && game.players[0].field.length >= 2) score += 280;
      if (entry.card.effectKey === "allyMonsterAttackPowerPlusTwo" && player.field.some((unit) => unit.canAct)) score += 240;
      if (entry.card.effectKey === "enemyPowerMinusOneOnSummon" && game.players[0].field.length >= 2) score += 220;
      if (entry.card.effectKey === "damageOnSummonZeroPowerAndReturn" && game.players[0].field.some((unit) => unit.hp <= 1 || unit.power >= 3)) score += 220;
      return { type: "summon", handIndex: entry.handIndex, score };
    });
}

function hardActionChoices() {
  const player = game.players[1];
  return player.hand
    .map((cardId, handIndex) => ({ cardId, handIndex, card: CARD_DEFINITIONS[cardId] }))
    .filter((entry) => entry.card.type === "action")
    .flatMap((entry) => hardActionCandidates(entry.handIndex, entry.cardId));
}

function quagsireSummonAdjustment() {
  const cpu = game.players[1];
  const opponent = game.players[0];
  const ownBestBuff = strongestPowerIncrease(cpu.field);
  const enemyBestBuff = strongestPowerIncrease(opponent.field);
  const enemyThreat = opponent.field.reduce((sum, unit) => sum + Math.max(0, unit.power), 0);
  const lethalRisk = enemyThreat >= cpu.life || opponent.field.some((unit) => unit.power >= 5 || unit.cardId === "mimikyu");
  let score = 0;
  if (ownBestBuff > 0 && enemyBestBuff <= ownBestBuff && !lethalRisk) score -= 1200 + ownBestBuff * 180;
  if (enemyBestBuff > ownBestBuff) score += 520 + (enemyBestBuff - ownBestBuff) * 180;
  if (lethalRisk) score += 760;
  return score;
}

function strongestPowerIncrease(field) {
  return field.reduce((best, unit) => {
    const base = unit.basePower ?? CARD_DEFINITIONS[unit.cardId]?.power ?? 0;
    return Math.max(best, Math.max(0, unit.power - base));
  }, 0);
}

function hardActionCandidates(handIndex, cardId) {
  const player = game.players[1];
  const opponent = game.players[0];
  const card = CARD_DEFINITIONS[cardId];
  const choices = [];
  const add = (score, payload = {}) => choices.push({ type: "action", handIndex, payload, score });
  const enemyTargets = opponent.field;
  const strongestEnemy = [...opponent.field].sort((a, b) => unitThreat(b) - unitThreat(a))[0];
  const bestOwn = [...player.field].sort((a, b) => unitThreat(b) - unitThreat(a))[0];
  const bestPile = chooseBestCpuPile();

  switch (card.effectKey) {
    case "dealTwoToUnitOrLife":
      if (opponent.life <= 3) add(12000, { targetType: "life" });
      enemyTargets.forEach((unit) => {
        const kill = unit.hp <= 3;
        if (kill) add(620 + unitThreat(unit), { unitId: unit.id });
      });
      if (opponent.life <= 8 || opponent.field.length === 0) add(300 + (12 - opponent.life) * 35, { targetType: "life" });
      break;
    case "discardUnit":
      opponent.field.forEach((unit) => {
        add(260 + unitThreat(unit) + (unit.cardId === "snorlax" ? 250 : 0), { unitId: unit.id });
      });
      break;
    case "setAllMaxHpToOne":
      if (opponent.field.length > 0) {
        const value = opponent.field.reduce((sum, unit) => sum + Math.max(0, unit.maxHp - 1) * 90 + unitThreat(unit) * 0.2, 0);
        add(value);
      }
      break;
    case "shockWave": {
      const kills = opponent.field.filter((unit) => unit.hp <= 1).length;
      if (opponent.field.length > 0) add(150 + opponent.field.length * 90 + kills * 430);
      break;
    }
    case "redCard":
      if (opponent.hand.length >= 4) add(230 + opponent.hand.length * 45);
      break;
    case "discardOpponentHand":
      if (opponent.hand.length > 0 && player.hand.length <= 8) add(260 + Math.min(2, opponent.hand.length) * 120);
      break;
    case "healLifeThree":
      if (player.life <= 10) add(170 + (12 - player.life) * 55);
      break;
    case "damageMinusOneUntilNextTurn":
      if (opponent.field.some((unit) => unit.canAct)) add(250 + opponent.field.reduce((sum, unit) => sum + Math.max(0, unit.power) * 20, 0));
      break;
    case "mysticGuard":
      if (player.field.length > 0 && opponent.hand.length >= 3) add(220 + player.field.length * 55);
      break;
    case "noCounterThisTurn":
      if (player.field.some((unit) => unit.canAct) && opponent.field.length > 0) add(260 + opponent.field.length * 45);
      break;
    case "buffHpByEnemyCount":
      if (player.field.length > 0 && opponent.field.length > 0) add(130 + player.field.length * opponent.field.length * 75);
      break;
    case "drawOneBuffOwnField":
      if (player.field.length > 0 && bestPile) {
        const buffedLifeDamage = totalPossibleLifeDamage(2);
        const lethalBonus = canCpuAttackLifeNow() && opponent.life <= buffedLifeDamage ? 9000 : 0;
        add(260 + player.field.length * 120 + pileTopScore(bestPile) * 0.2 + lethalBonus, { pileId: bestPile.id });
      }
      break;
    case "drawTwoGainAction":
      if (bestPile && drawRoomAfterPlaying() >= 2) add(280 + pileTopScore(bestPile) * 0.3, { pileId: bestPile.id });
      break;
    case "searchTwoFromPile":
      if (bestPile && drawRoomAfterPlaying() >= 3) add(360 + bestKnownPileScore(bestPile, 3) * 0.25, { pileId: bestPile.id });
      break;
    case "searchOneFromEachPile":
      if (drawRoomAfterPlaying() >= 1 && game.piles.some((pile) => pile.deck.length > 0)) add(420);
      break;
    case "drawPileDiscardTwo":
      if (bestPile && drawRoomAfterPlaying() >= 4) add(330 + bestKnownPileScore(bestPile, 6) * 0.12, { pileId: bestPile.id });
      break;
    case "takeDiscardToHandGainAction": {
      const best = bestDiscardCardIndex();
      if (best) add(220 + best.score, { discardIndex: best.index });
      break;
    }
    case "reviveUnit": {
      if (player.field.length < engine.getPublicState(game, 0).maxFieldSize) {
        const best = bestDiscardUnitIndex();
        if (best) add(260 + best.score, { discardIndex: best.index });
      }
      break;
    }
    case "sacrifice":
      if (bestOwn) {
        const otherActionCount = player.hand.filter((id, index) => index !== handIndex && CARD_DEFINITIONS[id]?.type === "action").length;
        const lethalBonus = canCpuAttackLifeNow() && opponent.life <= totalPossibleLifeDamage(3) ? 8500 : 0;
        if (otherActionCount <= 1 || lethalBonus > 0) add(210 + unitThreat(bestOwn) * 0.2 + lethalBonus, { unitId: bestOwn.id });
      }
      break;
    case "discardAnyGainActions": {
      const discards = chooseRestockDiscardIndexes(handIndex);
      if (discards.length >= 2) add(160 + discards.length * 85, { discardHandIndexes: discards });
      break;
    }
    case "stealOpponentItems": {
      const itemCount = opponent.field.filter((unit) => unit.item).length;
      if (itemCount > 0) add(250 + itemCount * 180);
      break;
    }
    case "swapUnits":
      if (opponent.field.length > player.field.length || (strongestEnemy && unitThreat(strongestEnemy) > unitThreat(bestOwn || { hp: 0, power: 0 }))) add(220);
      break;
    default:
      break;
  }
  return choices;
}

function chooseBestCpuPile() {
  return [...game.piles]
    .filter((pile) => pile.deck.length > 0)
    .sort((a, b) => bestKnownPileScore(b, 3) - bestKnownPileScore(a, 3))[0] || null;
}

function pileTopScore(pile) {
  return hardCardIdScore(pile.deck[0]);
}

function bestKnownPileScore(pile, count) {
  return pile.deck
    .map((cardId) => hardCardIdScore(cardId))
    .sort((a, b) => b - a)
    .slice(0, count)
    .reduce((sum, score) => sum + score, 0);
}

function bestDiscardUnitIndex() {
  return game.discard
    .map((cardId, index) => ({ index, cardId, score: hardCardIdScore(cardId) }))
    .filter((entry) => CARD_DEFINITIONS[entry.cardId]?.type === "unit")
    .sort((a, b) => b.score - a.score)[0] || null;
}

function bestDiscardCardIndex() {
  return game.discard
    .map((cardId, index) => ({ index, cardId, score: hardCardIdScore(cardId) }))
    .sort((a, b) => b.score - a.score)[0] || null;
}

function chooseHardCpuDiscardIndexes(count) {
  return game.players[1].hand
    .map((cardId, index) => ({ index, score: hardCardIdScore(cardId) + keepComboBonus(cardId) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
    .map((entry) => entry.index);
}

function chooseHardCpuPileSearchIndexes() {
  const pending = game.pendingPileSearch;
  if (!pending) return [];
  if (pending.allPiles) {
    return game.piles.flatMap((pile) => pile.deck
      .map((cardId, index) => ({ value: `${pile.id}:${index}`, score: hardCardIdScore(cardId) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 1)
      .map((entry) => entry.value));
  }
  const pile = game.piles.find((candidate) => candidate.id === pending.pileId);
  if (!pile) return [];
  return pile.deck
    .map((cardId, index) => ({ index, score: hardCardIdScore(cardId) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, pending.count)
    .map((entry) => entry.index);
}

function chooseRestockDiscardIndexes(actionHandIndex) {
  return game.players[1].hand
    .map((cardId, index) => ({ cardId, index, score: hardCardIdScore(cardId) + keepComboBonus(cardId) }))
    .filter((entry) => entry.index !== actionHandIndex && entry.score < 150)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((entry) => entry.index);
}

function drawRoomAfterPlaying() {
  return Math.max(0, 10 - (game.players[1].hand.length - 1));
}

function hardChoiceLookaheadScore(choice) {
  const before = evaluateCpuPosition(game);
  const simulated = cloneGameForCpu(game);
  let result = null;
  try {
    if (choice.type === "summon") {
      result = engine.summonFromHand(simulated, 1, choice.handIndex);
    } else if (choice.type === "action") {
      result = engine.playAction(simulated, 1, choice.handIndex, clonePayload(choice.payload || {}));
      resolveSimulatedCpuPending(simulated);
    }
  } catch (_error) {
    return -500;
  }
  if (!result?.ok) return -450;
  if (simulated.winner === 1) return 20000;
  if (simulated.winner === 0) return -20000;
  return (evaluateCpuPosition(simulated) - before) * 0.45;
}

function evaluateCpuPosition(targetGame) {
  const player = targetGame.players[1];
  const opponent = targetGame.players[0];
  const ownField = player.field.reduce((sum, unit) => sum + evaluateUnitForGame(targetGame, 1, unit), 0);
  const enemyField = opponent.field.reduce((sum, unit) => sum + evaluateUnitForGame(targetGame, 0, unit), 0);
  const ownHand = player.hand.reduce((sum, cardId) => sum + hardCardIdScore(cardId) * 0.32, 0);
  const enemyHand = opponent.hand.length * 80;
  const wallBonus = player.field.length >= 3 ? 260 : 0;
  const enemyWallPenalty = opponent.field.length >= 3 ? 210 : 0;
  const actionValue = player.actions * 90;
  const enemyDanger = opponent.field.reduce((sum, unit) => sum + dangerScoreForGame(targetGame, unit, 1), 0);
  const ownDanger = player.field.reduce((sum, unit) => sum + dangerScoreForGame(targetGame, unit, 0), 0);
  return ownField - enemyField + ownHand - enemyHand + (player.life - opponent.life) * 130 + wallBonus - enemyWallPenalty + actionValue + ownDanger * 0.18 - enemyDanger * 0.32;
}

function evaluateUnitForGame(targetGame, ownerId, unit) {
  const card = CARD_DEFINITIONS[unit.cardId] || {};
  const tempOwner = targetGame.players[ownerId];
  const power = Math.max(0, unit.power);
  let value = Math.max(0, unit.hp) * 70 + power * 105 + hardUnitCardScore(card) * 0.5;
  if (unit.item) value += hardCardIdScore(unit.item.cardId) * 0.6;
  if (unit.canAct) value += 90;
  if (card.effectKey === "mustBeAttacked") value += targetGame.players[ownerId === 0 ? 1 : 0].field.length * 70;
  if (card.effectKey === "healLifeOnTurnEnd") value += tempOwner?.life <= 10 ? 120 : 60;
  if (card.effectKey === "maxHpPlusOneOnTurnEnd") value += 85;
  if (card.effectKey === "allyMonsterAttackPowerPlusTwo") value += targetGame.players[ownerId].field.length * 70;
  return value;
}

function dangerScoreForGame(targetGame, unit, threatenedPlayerId) {
  const card = CARD_DEFINITIONS[unit.cardId] || {};
  const threatened = targetGame.players[threatenedPlayerId];
  const power = unit.item?.cardId === "lifePower" ? Math.max(unit.power, unit.hp) : unit.power;
  let score = Math.max(0, power) * 90 + Math.max(0, unit.hp) * 35;
  if (power >= threatened.life) score += 1000;
  if (card.effectKey === "attackPowerPlusThree" && power + 3 >= threatened.life) score += 900;
  if (card.effectKey === "attackAllEnemies") score += threatened.field.length * 160;
  if (card.effectKey === "allyMonsterAttackPowerPlusTwo") score += targetGame.players[threatenedPlayerId === 0 ? 1 : 0].field.length * 130;
  if (card.effectKey === "ignoreWallLifeAttack") score += 240;
  if (card.effectKey === "doubleOwnPower") score += 180;
  return score;
}

function resolveSimulatedCpuPending(simulated) {
  if (simulated.pendingOpponentHandCheck?.playerId === 1) {
    const indexes = simulated.players[0].hand
      .map((cardId, index) => ({ index, score: hardCardIdScore(cardId) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, simulated.pendingOpponentHandCheck.count || 1)
      .map((entry) => entry.index);
    engine.resolvePendingOpponentHandCheck(simulated, 1, indexes);
  }
  if (simulated.pendingDiscardSelection?.playerId === 1) {
    const indexes = simulated.players[1].hand
      .map((cardId, index) => ({ index, score: hardCardIdScore(cardId) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, simulated.pendingDiscardSelection.count)
      .map((entry) => entry.index);
    engine.resolvePendingDiscardSelection(simulated, 1, indexes);
  }
  if (simulated.pendingPileSearch?.playerId === 1) {
    const pending = simulated.pendingPileSearch;
    const indexes = pending.allPiles
      ? simulated.piles.flatMap((pile) => pile.deck
        .map((cardId, index) => ({ value: `${pile.id}:${index}`, score: hardCardIdScore(cardId) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 1)
        .map((entry) => entry.value))
      : (simulated.piles.find((pile) => pile.id === pending.pileId)?.deck || [])
        .map((cardId, index) => ({ index, score: hardCardIdScore(cardId) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, pending.count)
        .map((entry) => entry.index);
    engine.resolvePendingPileSearch(simulated, 1, indexes);
  }
  if (simulated.pendingPileDrawSelection?.playerId === 1) {
    const count = simulated.pendingPileDrawSelection.count;
    const pileIds = Array.from({ length: count }, () => simulated.piles.find((pile) => pile.deck.length > 0)?.id).filter(Boolean);
    engine.resolvePendingPileDrawSelection(simulated, 1, pileIds);
  }
}

function cloneGameForCpu(source) {
  return JSON.parse(JSON.stringify(source));
}

function clonePayload(payload) {
  return JSON.parse(JSON.stringify(payload));
}

function bestItemComboBonusForUnit(cardId) {
  const hand = game.players[1].hand;
  let bonus = 0;
  if (cardId === "pikachu" && hand.includes("lightBall")) bonus += 700;
  if (["snorlax", "kyogre", "ferrothorn", "eternatus", "zapdos"].includes(cardId) && hand.includes("lifePower")) bonus += 360;
  if (["zacian", "calyrexShadow", "urshifu", "calyrexIce"].includes(cardId) && hand.includes("focusSash")) bonus += 180;
  if (["zacian", "calyrexShadow", "urshifu", "calyrexIce", "rillaboom"].includes(cardId) && hand.includes("choiceBand")) bonus += 190;
  if (["calyrexIce", "urshifu", "zacian"].includes(cardId) && hand.includes("choiceScarf")) bonus += 160;
  if (["snorlax", "mimikyu", "zapdos"].includes(cardId) && hand.includes("destinyCloak")) bonus += 170;
  if (["calyrexIce", "zacian", "urshifu", "rillaboom"].includes(cardId) && hand.includes("boomerang")) bonus += 150;
  return bonus;
}

function immediateAttackValue(unit) {
  if (!unit.canAct && !game.players[1].hand.includes("choiceScarf")) return 0;
  const targets = filterAttackTargets(game.players[0].field, unit);
  const bestKill = targets
    .map((target) => {
      const damage = engine.getEffectivePower(game, unit, target, "attack");
      return effectiveDefenderHpForAttack(unit, target) <= damage ? 450 + unitThreat(target) : damage * 35;
    })
    .sort((a, b) => b - a)[0] || 0;
  const lifeDamage = canCpuAttackLifeNow(unit) ? engine.getEffectivePower(game, unit, null, "lifeAttack") * 95 : 0;
  return Math.max(bestKill, lifeDamage);
}

function totalPossibleLifeDamage(extraPower = 0) {
  return game.players[1].field
    .filter((unit) => unit.canAct)
    .reduce((sum, unit) => sum + engine.getEffectivePower(game, unit, null, "lifeAttack") + extraPower, 0);
}

function canCpuAttackLifeNow(attacker = null) {
  if (hasCpuMustAttackTarget(attacker)) return false;
  if (game.players[0].field.length < 3) return true;
  return attacker ? canIgnoreAttackRestrictions(attacker) : game.players[1].field.some((unit) => canIgnoreAttackRestrictions(unit));
}

function keepComboBonus(cardId) {
  const player = game.players[1];
  if (cardId === "lightBall" && (player.hand.includes("pikachu") || player.field.some((unit) => unit.cardId === "pikachu"))) return 700;
  if (cardId === "pikachu" && player.hand.includes("lightBall")) return 650;
  if (cardId === "choiceScarf" && player.hand.some((id) => CARD_DEFINITIONS[id]?.type === "unit")) return 180;
  if (cardId === "boomerang" && player.field.some((unit) => unit.power >= 3)) return 160;
  return 0;
}

function hardCardIdScore(cardId) {
  return hardCardScore(CARD_DEFINITIONS[cardId]);
}

function hardCardScore(card) {
  if (!card) return 0;
  if (card.type === "unit") return hardUnitCardScore(card);
  if (card.type === "item") {
    const values = {
      lightBall: 520,
      lifePower: 340,
      choiceBand: 300,
      boomerang: 280,
      choiceScarf: 260,
      assaultVest: 230,
      focusSash: 220,
      destinyCloak: 210,
      contraryMask: 120,
    };
    return values[card.id] || 170;
  }
  if (card.type === "action") {
    const values = {
      stoneThrow: 360,
      erase: 430,
      doubleCheck: 380,
      theSearch: 390,
      preparation: 360,
      laboratory: 350,
      battleDrum: 340,
      shockWave: 330,
      endingBell: 310,
      redCard: 300,
      reviveCrystal: 290,
      healingWater: 240,
      auroraVeil: 240,
      acrobat: 230,
      excavation: 220,
      protectivePads: 210,
      readyStance: 210,
      mysticGuard: 190,
      restock: 170,
      sacrifice: 160,
      courtChange: 150,
      storm: 140,
      robbery: 130,
    };
    return values[card.id] || 180;
  }
  return 0;
}

function hardUnitCardScore(card) {
  if (!card) return 0;
  const effectBonus = {
    attackPowerPlusThree: 210,
    drawFromPileOnKill: 180,
    attackOrGainLife: 190,
    damageAllOthersTurnEnd: 170,
    useTargetPowerAsHpNoSummonSick: 190,
    ignorePowerIncreases: 140,
    mustBeAttacked: 230,
    healLifeOnTurnEnd: 160,
    powerPlusIfLifeTen: 220,
    maxHpPlusOneOnTurnEnd: 170,
    enemyPowerMinusOneOnSummon: 200,
    damageOnSummonZeroPowerAndReturn: 190,
    allyMonsterAttackPowerPlusTwo: 210,
    attackAllEnemies: 240,
    doubleOwnPower: 190,
    ignoreWallLifeAttack: 260,
    sleepTargetNextTurn: 190,
  };
  return 100 + (card.hp || 0) * 45 + (card.power || 0) * 70 + (effectBonus[card.effectKey] || 0);
}

function unitThreat(unit) {
  const card = CARD_DEFINITIONS[unit.cardId] || {};
  const displayedPower = unit.item?.cardId === "lifePower" ? Math.max(unit.power, unit.hp) : unit.power;
  return Math.max(0, unit.hp) * 45 + Math.max(0, displayedPower) * 80 + hardUnitCardScore(card) * 0.45 + (unit.item ? 100 : 0);
}

function effectiveDefenderHpForAttack(attacker, target) {
  if (!target) return 0;
  const attackerEffect = attacker ? CARD_DEFINITIONS[attacker.cardId]?.effectKey : null;
  if (["useTargetPowerAsHp", "useTargetPowerAsHpNoSummonSick"].includes(attackerEffect)) {
    return Math.max(0, engine.getEffectivePower(game, target, attacker, "status"));
  }
  return target.hp;
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

  index = findAction("buffHpByEnemyCount");
  if (index !== -1 && opponent.field.length > 0 && player.field.length > 0) return { handIndex: index, payload: {} };

  index = findAction("damageMinusOneUntilNextTurn");
  if (index !== -1 && opponent.field.some((unit) => unit.canAct)) return { handIndex: index, payload: {} };

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

  index = findAction("searchOneFromEachPile");
  if (index !== -1 && player.hand.length <= 7) return { handIndex: index, payload: {} };

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

async function runHardCpuUnitAbilities() {
  let acted = true;
  let guard = 0;
  while (game.winner === null && acted && guard < 6) {
    guard += 1;
    acted = false;
    const choice = chooseHardCpuUnitAbility();
    if (!choice || choice.score < 160) return;
    const result = await cpuStep(choice.label, () => {
      if (choice.targetId) addFx(`field:0:${choice.targetId}`, "fx-stat-down");
      addFx(`field:1:${choice.unitId}`, choice.fx || "fx-stat-up");
      return choice.kind === "gainLife"
        ? engine.gainLifeWithUnit(game, 1, choice.unitId)
        : engine.useUnitAbility(game, 1, choice.payload);
    }, choice.sound || "select");
    acted = result.ok;
  }
}

function chooseHardCpuUnitAbility() {
  const player = game.players[1];
  const opponent = game.players[0];
  const choices = [];
  player.field.filter((unit) => unit.canAct).forEach((unit) => {
    const card = CARD_DEFINITIONS[unit.cardId];
    if (card.effectKey === "attackOrGainLife" && player.life <= 9) {
      choices.push({ kind: "gainLife", unitId: unit.id, score: 180 + (12 - player.life) * 45, label: "CPU ライフ回復", sound: "heal" });
    }
    if (card.effectKey === "doubleOwnPower" && unit.power <= 5) {
      const score = scoreDoublePowerAbility(unit);
      if (score > 0) {
        choices.push({ unitId: unit.id, score, label: "CPU パワー倍化", payload: { ability: "doubleOwnPower", unitId: unit.id } });
      }
    }
    if (card.effectKey === "sleepTargetNextTurn") {
      opponent.field.forEach((target) => {
        if (target.canAct || dangerScore(target) >= 420) {
          choices.push({ unitId: unit.id, targetId: target.id, score: 230 + dangerScore(target) * 0.35, label: "CPU 召喚酔い", payload: { ability: "sleepTargetNextTurn", unitId: unit.id, targetUnitId: target.id }, fx: "fx-item" });
        }
      });
    }
    if (card.effectKey === "damageOnSummonZeroPowerAndReturn") {
      opponent.field.forEach((target) => {
        if (target.power >= 2) {
          choices.push({
            unitId: unit.id,
            targetId: target.id,
            score: 210 + target.power * 90 + unitThreat(target) * 0.2,
            label: "CPU 威嚇",
            payload: { ability: "zeroPowerAndReturn", unitId: unit.id, targetUnitId: target.id },
            fx: "fx-attack",
          });
        }
      });
    }
  });
  return choices.sort((a, b) => b.score - a.score)[0] || null;
}

function scoreDoublePowerAbility(unit) {
  const doubledPower = unit.power * 2;
  const room = setupRoomForDoublePower(unit);
  let score = 80 + unit.power * 35 + room * 180;
  if (room < 0) score -= 1200;
  if (room >= 2) score += 320;
  if (game.players[1].field.length >= 3) score += 140;
  if (game.players[1].damageReductionUntilTurn > game.turn) score += 180;
  if (game.players[1].mysticGuardUntilTurn > game.turn) score += 180;
  if (game.players[0].field.length === 0) score += 220;
  if (doubledPower >= game.players[0].life && canCpuAttackLifeNow(unit)) score += 500;
  return score;
}

function setupRoomForDoublePower(unit) {
  const opponentReadyDamage = game.players[0].field
    .filter((enemy) => enemy.canAct)
    .map((enemy) => engine.getEffectivePower(game, enemy, unit, "attack"))
    .sort((a, b) => b - a)[0] || 0;
  const canBeKilledByBoard = opponentReadyDamage >= unit.hp;
  const enemyCanRemoveByAction = game.players[0].hand.some((cardId) => ["stoneThrow", "erase", "endingBell", "shockWave"].includes(cardId));
  const cpuHasWall = game.players[1].field.length >= 3 || game.players[1].field.some((ally) => ally.cardId === "snorlax");
  const opponentLowActions = game.players[0].actions <= 1 || game.players[0].actionPenaltyNextTurn > 0;
  let room = 0;
  if (cpuHasWall) room += 1;
  if (opponentLowActions) room += 1;
  if (game.players[1].life > 6) room += 1;
  if (canBeKilledByBoard) room -= 3;
  if (enemyCanRemoveByAction) room -= 1;
  if (game.players[0].field.some((enemy) => dangerScore(enemy) >= 700)) room -= 1;
  return room;
}

async function runHardCpuAttacks() {
  let acted = true;
  let guard = 0;
  while (game.winner === null && acted && guard < 8) {
    guard += 1;
    acted = false;
    const choice = chooseHardCpuAttack();
    if (!choice || choice.score < 80) return;
    const result = await cpuStep(choice.label, () => {
      addFx(`field:1:${choice.attackerId}`, "fx-attack");
      if (choice.defenderId) addFx(`field:0:${choice.defenderId}`, "fx-hit");
      return choice.defenderId
        ? engine.attackMonster(game, 1, choice.attackerId, choice.defenderId)
        : engine.attackLife(game, 1, choice.attackerId);
    }, "attack");
    acted = result.ok;
  }
}

function chooseHardCpuAttack() {
  const player = game.players[1];
  const opponent = game.players[0];
  const choices = [];
  player.field.filter((unit) => unit.canAct).forEach((attacker) => {
    const lifeDamage = engine.getEffectivePower(game, attacker, null, "lifeAttack");
    const ignoresWall = canIgnoreAttackRestrictions(attacker);
    const canAttackLife = !hasCpuMustAttackTarget(attacker) && (opponent.field.length < 3 || ignoresWall);
    if (canAttackLife) {
      choices.push({
        attackerId: attacker.id,
        score: opponent.life <= lifeDamage ? 20000 : 180 + lifeDamage * 120 + (opponent.life <= 6 ? 260 : 0),
        label: "CPU ライフ攻撃",
      });
    }
    filterAttackTargets(opponent.field, attacker).forEach((target) => {
      const damage = engine.getEffectivePower(game, attacker, target, "attack");
      const counter = player.noCounterThisTurn ? 0 : engine.getEffectivePower(game, target, attacker, "counter");
      const kills = effectiveDefenderHpForAttack(attacker, target) <= damage;
      const survives = attacker.hp > counter;
      const targetMustBeAttacked = CARD_DEFINITIONS[target.cardId]?.effectKey === "mustBeAttacked";
      let score = damage * 45 - counter * 35 + unitThreat(target) * (kills ? 0.75 : 0.18);
      if (kills) score += 520;
      const combinedPlan = dangerousTargetPlan(target);
      if (!kills && combinedPlan.canKill && combinedPlan.attackers.includes(attacker.id)) {
        score += 520 + dangerScore(target) * 0.55 + damage * 55;
      }
      if (!kills && dangerScore(target) >= 520 && damage > 0) {
        score += damage * 70;
      }
      if (!survives) score -= 420 + unitThreat(attacker) * 0.25;
      if (targetMustBeAttacked && !kills && !survives) score -= 10000;
      if (targetMustBeAttacked && !kills && !dangerousTargetPlan(target).canKill) score -= 1800;
      if (kills && !survives && unitThreat(target) > unitThreat(attacker) + 160) score += 260;
      if (CARD_DEFINITIONS[attacker.cardId]?.effectKey === "attackAllEnemies" || attacker.item?.cardId === "boomerang") {
        const allKills = opponent.field.filter((unit) => effectiveDefenderHpForAttack(attacker, unit) <= damage).length;
        score += opponent.field.length * 80 + allKills * 330;
      }
      choices.push({
        attackerId: attacker.id,
        defenderId: target.id,
        score,
        label: kills ? "CPU 撃破狙い" : "CPU 戦闘",
      });
    });
  });
  return choices
    .map((choice) => ({ ...choice, score: choice.score + hardAttackLookaheadScore(choice) }))
    .sort((a, b) => b.score - a.score)[0] || null;
}

function hardAttackLookaheadScore(choice) {
  if (choice.defenderId && isSuicideIntoUnkillableWall(choice)) return -20000;
  const before = evaluateCpuPosition(game);
  const simulated = cloneGameForCpu(game);
  let result = null;
  try {
    result = choice.defenderId
      ? engine.attackMonster(simulated, 1, choice.attackerId, choice.defenderId)
      : engine.attackLife(simulated, 1, choice.attackerId);
  } catch (_error) {
    return -500;
  }
  if (!result?.ok) return -450;
  if (simulated.winner === 1) return 30000;
  if (simulated.winner === 0) return -30000;
  return (evaluateCpuPosition(simulated) - before) * 0.65;
}

function isSuicideIntoUnkillableWall(choice) {
  const attacker = game.players[1].field.find((unit) => unit.id === choice.attackerId);
  const defender = game.players[0].field.find((unit) => unit.id === choice.defenderId);
  if (!attacker || !defender) return false;
  if (CARD_DEFINITIONS[defender.cardId]?.effectKey !== "mustBeAttacked") return false;
  const damage = engine.getEffectivePower(game, attacker, defender, "attack");
  const counter = game.players[1].noCounterThisTurn ? 0 : engine.getEffectivePower(game, defender, attacker, "counter");
  const kills = effectiveDefenderHpForAttack(attacker, defender) <= damage;
  const survives = attacker.hp > counter;
  return !kills && !survives && !dangerousTargetPlan(defender).canKill;
}

function dangerousTargetPlan(target) {
  const attackers = game.players[1].field.filter((unit) => unit.canAct)
    .map((unit) => ({
      id: unit.id,
      damage: engine.getEffectivePower(game, unit, target, "attack"),
      risk: engine.getEffectivePower(game, target, unit, "counter") >= unit.hp ? unitThreat(unit) * 0.25 : 0,
    }))
    .filter((entry) => entry.damage > 0)
    .sort((a, b) => (b.damage - b.risk) - (a.damage - a.risk));
  let total = 0;
  const used = [];
  for (const entry of attackers) {
    total += entry.damage;
    used.push(entry.id);
    if (total >= effectiveDefenderHpForAttack(null, target)) break;
  }
  return { canKill: total >= effectiveDefenderHpForAttack(null, target) && dangerScore(target) >= 420, attackers: used, totalDamage: total };
}

function dangerScore(unit) {
  const card = CARD_DEFINITIONS[unit.cardId] || {};
  const nextLifeDamage = Math.max(0, unit.power) + (card.effectKey === "attackPowerPlusThree" ? 3 : 0);
  let score = unitThreat(unit) + nextLifeDamage * 80;
  if (nextLifeDamage >= game.players[1].life) score += 1200;
  if (card.effectKey === "attackAllEnemies") score += game.players[1].field.length * 180;
  if (card.effectKey === "allyMonsterAttackPowerPlusTwo") score += game.players[0].field.length * 150;
  if (card.effectKey === "ignoreWallLifeAttack") score += 280;
  if (card.effectKey === "drawFromPileOnKill") score += 180;
  if (card.effectKey === "doubleOwnPower") score += 220;
  if (unit.item) score += 160;
  return score;
}

function hasCpuMustAttackTarget(attacker = null) {
  return !canIgnoreAttackRestrictions(attacker) && game.players[0].field.some((unit) => CARD_DEFINITIONS[unit.cardId]?.effectKey === "mustBeAttacked");
}

async function runCpuAttacks() {
  let acted = true;
  while (game.winner === null && acted) {
    acted = false;
    const attacker = game.players[1].field.find((unit) => unit.canAct);
    if (!attacker) return;
    if (cpuDifficulty === "hard") {
      const easyKill = chooseCpuOneSidedKill(attacker);
      if (easyKill) {
        const monsterResult = await cpuStep("CPU 戦闘", () => {
          addFx(`field:1:${attacker.id}`, "fx-attack");
          addFx(`field:0:${easyKill.id}`, "fx-hit");
          return engine.attackMonster(game, 1, attacker.id, easyKill.id);
        }, "attack");
        acted = monsterResult.ok;
        continue;
      }
    }
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

function chooseCpuOneSidedKill(attacker) {
  const targets = filterAttackTargets(game.players[0].field, attacker);
  return targets.find((target) => {
    const damage = engine.getEffectivePower(game, attacker, target, "attack");
    const counter = game.players[1].noCounterThisTurn ? 0 : engine.getEffectivePower(game, target, attacker, "counter");
    return effectiveDefenderHpForAttack(attacker, target) <= damage && attacker.hp > counter;
  });
}

function chooseCpuAttackTarget(attacker) {
  const targets = filterAttackTargets(game.players[0].field, attacker);
  if (targets.length === 0) return null;
  return [...targets].sort((a, b) => {
    const aDamage = engine.getEffectivePower(game, attacker, a, "attack");
    const bDamage = engine.getEffectivePower(game, attacker, b, "attack");
    const aKill = effectiveDefenderHpForAttack(attacker, a) <= aDamage ? 1 : 0;
    const bKill = effectiveDefenderHpForAttack(attacker, b) <= bDamage ? 1 : 0;
    if (aKill !== bKill) return bKill - aKill;
    return (a.hp + a.power) - (b.hp + b.power);
  })[0];
}

async function cpuStep(label, action, sound) {
  showFloat(label, "cpu");
  playSound(sound);
  const result = await action();
  render();
  saveCurrentCpuBattle();
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
  titleLobbyMode = "join";
  titleRulesOpen = false;
  titleCardsOpen = false;
  cpuEnabled = false;
  if (elements.roomIdInput) elements.roomIdInput.value = roomId.toUpperCase();
  if (elements.titleRoomIdInput) elements.titleRoomIdInput.value = roomId.toUpperCase();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(location.hostname)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // PWA support is optional during local development.
    });
  });
}

setupProfileControls();
initializeFromUrl();
registerServiceWorker();
const savedOnlineSession = loadOnlineSession();
if (restoreCpuBattleIfNeeded()) {
  showFloat("CPU戦を復元しました", "draw");
} else if (savedOnlineSession) {
  onlineMode = true;
  onlineState = {
    roomId: savedOnlineSession.roomId,
    playerId: 0,
    playerToken: savedOnlineSession.playerToken,
    started: false,
    gameStarted: false,
    gameStatus: "reconnecting",
    opponentConnected: false,
    reconnectRemainingMs: 0,
    turnRemainingMs: 0,
    turnLimitMs: 90000,
    timeoutCounts: [0, 0],
    connected: [false, false],
    pending: null,
    view: createOnlinePlaceholderView(),
  };
  titleActive = false;
  ensureSocket();
}
render();
})();

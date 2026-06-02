(() => {
  const DAILY_CHALLENGE_START_DATE = "2026-05-21";
  const DAILY_CHALLENGE_SEQUENCE = [
    "suddenDeath",
    "enhancedArmy",
    "rush",
    "oneTurnKill",
    "deepBattle",
    "specialUser"
  ];

  const CHALLENGE_DEFINITIONS = [
    {
      challengeId: "suddenDeath",
      name: "サドンデス",
      description: "ライフ1で勝ち抜け！",
      rules: [
        "自分ライフ1",
        "相手ライフ12",
        "回復などは通常通り"
      ],
      rewardCoins: 300,
      cpuName: "サドンデス君",
      cpuIcon: "gollem",
      cpuDifficulty: "strong",
      ruleModifiers: {
        playerLife: 1,
        cpuLife: 12
      }
    },
    {
      challengeId: "rush",
      name: "生き急ぎ",
      description: "召喚即行動！",
      rules: [
        "全モンスターが召喚酔いしない",
        "召喚したターンからすぐ行動できる",
        "自分もCPUも同じルール"
      ],
      rewardCoins: 200,
      cpuName: "せっかち君",
      cpuIcon: "shadow",
      cpuDifficulty: "strong",
      ruleModifiers: {
        noSummonSickness: true
      }
    },
    {
      challengeId: "enhancedArmy",
      name: "強化軍団",
      description: "敵のモンスターはみんな一回り強い！",
      rules: [
        "CPU側のモンスターは場に出た時、最大HP+1",
        "CPU側のモンスターは場に出た時、現在HP+1",
        "CPU側のモンスターは場に出た時、パワー+1"
      ],
      rewardCoins: 200,
      cpuName: "強化付与くん",
      cpuIcon: "akudaruma",
      cpuDifficulty: "strong",
      ruleModifiers: {
        cpuEnterFieldBuff: {
          maxHp: 1,
          currentHp: 1,
          power: 1
        }
      }
    },
    {
      challengeId: "oneTurnKill",
      name: "ワンターンキル",
      description: "削っても無駄！一撃で倒せ！",
      rules: [
        "自分のターン開始時、相手ライフが12になる",
        "ライフ回復ではなく、直接12に設定される",
        "CPU側のターン開始時には発動しない"
      ],
      rewardCoins: 300,
      cpuName: "全快くん",
      cpuIcon: "takkun",
      cpuDifficulty: "strong",
      ruleModifiers: {
        resetOpponentLifeOnPlayerTurnStart: 12
      }
    },
    {
      challengeId: "deepBattle",
      name: "ディープバトル",
      description: "まだまだ終わらない！",
      rules: [
        "ゲーム開始時、自分ライフ24",
        "ゲーム開始時、CPUライフ24",
        "その他は通常ルール"
      ],
      rewardCoins: 200,
      cpuName: "長丁場くん",
      cpuIcon: "sword-champ",
      cpuDifficulty: "strong",
      ruleModifiers: {
        playerLife: 24,
        cpuLife: 24,
        startLog: "ディープバトル！ライフ24で開始"
      }
    },
    {
      challengeId: "specialUser",
      name: "スペシャル使い",
      description: "次から次へとスペシャル！",
      rules: [
        "CPUのターン開始時、スペシャルカードを1枚生成する",
        "生成カードはCPUの手札に加わる",
        "この効果では手札上限を無視する"
      ],
      rewardCoins: 200,
      cpuName: "スペシャルマン",
      cpuIcon: "warado",
      cpuDifficulty: "strong",
      ruleModifiers: {
        cpuTurnStartSpecialAction: true
      }
    }
  ];

  window.AppChallenges = {
    dailyStartDate: DAILY_CHALLENGE_START_DATE,
    dailySequence: DAILY_CHALLENGE_SEQUENCE,
    challenges: CHALLENGE_DEFINITIONS
  };
})();

(() => {
  const DAILY_CHALLENGE_START_DATE = "2026-05-21";
  const DAILY_CHALLENGE_SEQUENCE = ["suddenDeath", "enhancedArmy", "rush"];

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
      rewardCoins: 200,
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
    }
  ];

  window.AppChallenges = {
    dailyStartDate: DAILY_CHALLENGE_START_DATE,
    dailySequence: DAILY_CHALLENGE_SEQUENCE,
    challenges: CHALLENGE_DEFINITIONS
  };
})();

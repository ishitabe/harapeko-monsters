(() => {
  const DAILY_CHALLENGE_START_DATE = "2026-05-21";
  const DAILY_CHALLENGE_SEQUENCE = ["suddenDeath", "rush"];

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
    }
  ];

  window.AppChallenges = {
    dailyStartDate: DAILY_CHALLENGE_START_DATE,
    dailySequence: DAILY_CHALLENGE_SEQUENCE,
    challenges: CHALLENGE_DEFINITIONS
  };
})();

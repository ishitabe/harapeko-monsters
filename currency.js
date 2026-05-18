(function () {
  function createHapiCoinWallet(config) {
    const appId = config?.APP_INTERNAL_ID || "summon-happys";
    const storageKey = `${appId}-hapi-coins`;

    function sanitizeAmount(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return 0;
      return Math.max(0, Math.floor(number));
    }

    function getHapiCoins() {
      try {
        const raw = localStorage.getItem(storageKey);
        const amount = sanitizeAmount(raw);
        if (raw !== null && String(amount) !== String(raw)) localStorage.setItem(storageKey, String(amount));
        return amount;
      } catch {
        return 0;
      }
    }

    function setHapiCoins(amount) {
      const safeAmount = sanitizeAmount(amount);
      try {
        localStorage.setItem(storageKey, String(safeAmount));
      } catch {
        // localStorage is optional.
      }
      return safeAmount;
    }

    function addHapiCoins(amount, reason = "") {
      const safeAmount = sanitizeAmount(amount);
      if (safeAmount <= 0) return { added: 0, total: getHapiCoins(), reason };
      const total = setHapiCoins(getHapiCoins() + safeAmount);
      return { added: safeAmount, total, reason };
    }

    return {
      storageKey,
      getHapiCoins,
      setHapiCoins,
      addHapiCoins
    };
  }

  window.HapiCoinWallet = createHapiCoinWallet;
})();

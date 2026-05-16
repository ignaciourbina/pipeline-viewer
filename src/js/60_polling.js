PV.polling = (function () {
  const { setStatusLine } = PV.util;
  const INTERVAL_MS = 5000;

  async function tick() {
    try {
      const tag = await PV.data.fetchModified();
      if (tag && tag !== PV.state.lastModified) {
        if (PV.state.lastModified != null) {
          setStatusLine("change detected — reloading…");
          await PV.app.reload();
        }
        PV.state.lastModified = tag;
      }
    } catch (_) { /* ignore */ }
  }

  function start() {
    stop();
    PV.state.pollTimer = setInterval(tick, INTERVAL_MS);
  }
  function stop() {
    if (PV.state.pollTimer) {
      clearInterval(PV.state.pollTimer);
      PV.state.pollTimer = null;
    }
  }
  async function prime() {
    PV.state.lastModified = await PV.data.fetchModified();
  }

  return { start, stop, prime, tick };
})();

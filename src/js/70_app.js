PV.app = (function () {
  const { $, $$, el, setStatusLine } = PV.util;

  function renderBanner() {
    const raw = PV.state.raw || {};
    const titleNode = $("#banner-title");
    if (raw.study) titleNode.textContent = raw.study + " · pipeline";
    document.title = (raw.study || "pipeline") + " · pipeline viewer";

    const bits = [];
    if (raw.version != null) bits.push("v" + raw.version);
    if (raw.last_updated) bits.push("updated " + raw.last_updated);
    bits.push((PV.state.steps.length || 0) + " steps");
    $("#banner-meta").textContent = bits.join(" · ");

    const tgt = $("#target");
    tgt.textContent = raw.target || "";
  }

  function setTab(name) {
    PV.state.activeTab = name;
    $$(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
    $("#view-table").classList.toggle("active", name === "table");
    $("#view-dag").classList.toggle("active", name === "dag");
    if (name === "dag") PV.dag.render();
  }

  function select(stepId) {
    PV.state.selected = stepId;
    PV.table.highlightSelected();
    PV.dag.highlightSelected();
    PV.detail.render();
  }

  function refresh() {
    PV.table.renderChips();
    PV.table.render();
    if (PV.state.activeTab === "dag") PV.dag.render();
    PV.detail.render();
  }

  async function reload() {
    await PV.data.load();
    renderBanner();
    refresh();
  }

  function wireGlobal() {
    $$(".tab").forEach(b => {
      b.addEventListener("click", () => setTab(b.dataset.tab));
    });
    $("#reload").addEventListener("click", reload);
    $("#dark").addEventListener("change", e => {
      document.body.classList.toggle("theme-dark", e.target.checked);
      document.body.classList.toggle("theme-light", !e.target.checked);
      try { localStorage.setItem("pv.dark", e.target.checked ? "1" : "0"); } catch (_) {}
    });
    $("#auto-refresh").addEventListener("change", async e => {
      if (e.target.checked) {
        await PV.polling.prime();
        PV.polling.start();
        setStatusLine("auto-refresh on");
      } else {
        PV.polling.stop();
        setStatusLine("auto-refresh off");
      }
      try { localStorage.setItem("pv.auto", e.target.checked ? "1" : "0"); } catch (_) {}
    });
    try {
      if (localStorage.getItem("pv.dark") === "1") {
        $("#dark").checked = true;
        document.body.classList.add("theme-dark");
        document.body.classList.remove("theme-light");
      }
      if (localStorage.getItem("pv.auto") === "1") {
        $("#auto-refresh").checked = true;
      }
    } catch (_) {}
  }

  async function init() {
    wireGlobal();
    PV.table.wire();
    try {
      await PV.data.load();
    } catch (e) {
      setStatusLine("failed to load: " + e.message);
      return;
    }
    renderBanner();
    refresh();
    if ($("#auto-refresh").checked) {
      await PV.polling.prime();
      PV.polling.start();
    }
  }

  document.addEventListener("DOMContentLoaded", init);

  return { init, select, refresh, reload, setTab };
})();

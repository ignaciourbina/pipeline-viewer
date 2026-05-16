PV.detail = (function () {
  const { $, el, statusClass } = PV.util;

  function render() {
    const empty = $("#detail-empty");
    const body = $("#detail-body");
    const id = PV.state.selected;
    if (!id || !PV.state.byStep[id]) {
      empty.classList.remove("hidden");
      body.classList.add("hidden");
      body.innerHTML = "";
      return;
    }
    const s = PV.state.byStep[id];
    empty.classList.add("hidden");
    body.classList.remove("hidden");
    body.innerHTML = "";

    body.appendChild(el("h2", null, [
      el("span", { class: "step-id" }, s.step),
      document.createTextNode(s.label || ""),
    ]));

    const meta = el("div", { class: "detail-meta" });
    if (s.status) meta.appendChild(el("span", {
      class: "pill pill-" + statusClass(s.status)
    }, s.status));
    if (s.stage) meta.appendChild(el("span", { class: "kv" }, [
      el("b", null, "stage"), document.createTextNode(s.stage)
    ]));
    if (s.language) meta.appendChild(el("span", { class: "kv" }, [
      el("b", null, "lang"), document.createTextNode(s.language)
    ]));
    if (s.path) meta.appendChild(el("span", { class: "kv" }, [
      el("b", null, "path"), document.createTextNode(s.path)
    ]));
    body.appendChild(meta);

    if (s.description) {
      body.appendChild(el("div", { class: "desc" }, s.description));
    }

    const inputs = Array.isArray(s.inputs) ? s.inputs : [];
    if (inputs.length) {
      const sec = el("section", null, [
        el("h3", null, "inputs"),
        el("ul", { class: "mono" }, inputs.map(i => el("li", null, i))),
      ]);
      body.appendChild(sec);
    }

    const outputs = Array.isArray(s.outputs) ? s.outputs : [];
    if (outputs.length) {
      const sec = el("section", null, [
        el("h3", null, "outputs"),
        el("ul", { class: "mono" }, outputs.map(o => el("li", null, o))),
      ]);
      body.appendChild(sec);
    }

    const deps = Array.isArray(s.depends_on) ? s.depends_on : [];
    if (deps.length) {
      const sec = el("section", null, [el("h3", null, "depends on")]);
      const wrap = el("div");
      for (const d of deps) {
        const target = PV.state.byStep[d];
        const lbl = target ? `${d} · ${target.label || ""}` : d;
        wrap.appendChild(el("a", {
          class: "dep-link",
          href: "#",
          onclick: (e) => { e.preventDefault(); PV.app.select(d); },
        }, lbl));
      }
      sec.appendChild(wrap);
      body.appendChild(sec);
    }

    const downstream = PV.state.reverseDeps[s.step] || [];
    if (downstream.length) {
      const sec = el("section", null, [el("h3", null, "depended on by")]);
      const wrap = el("div");
      for (const d of downstream) {
        const target = PV.state.byStep[d];
        const lbl = target ? `${d} · ${target.label || ""}` : d;
        wrap.appendChild(el("a", {
          class: "dep-link",
          href: "#",
          onclick: (e) => { e.preventDefault(); PV.app.select(d); },
        }, lbl));
      }
      sec.appendChild(wrap);
      body.appendChild(sec);
    }
  }

  return { render };
})();

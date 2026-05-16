PV.table = (function () {
  const { $, $$, el, statusClass, unique } = PV.util;

  function cmp(a, b) {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b), undefined, { numeric: true });
  }

  function applyFilter(steps) {
    const f = PV.state.filter;
    const text = f.text.trim().toLowerCase();
    return steps.filter(s => {
      if (f.stages.size && !f.stages.has(s.stage)) return false;
      if (f.statuses.size && !f.statuses.has(s.status)) return false;
      if (f.languages.size && !f.languages.has(s.language)) return false;
      if (text) {
        const hay = [s.label, s.description, s.path, s.step]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(text)) return false;
      }
      return true;
    });
  }

  function applySort(steps) {
    const { col, dir } = PV.state.sort;
    const sorted = steps.slice().sort((a, b) => cmp(a[col], b[col]));
    if (dir === "desc") sorted.reverse();
    return sorted;
  }

  function render() {
    const tbody = $("#steps-table tbody");
    tbody.innerHTML = "";
    let rows = applyFilter(PV.state.steps);
    rows = applySort(rows);

    $$("#steps-table th").forEach(th => {
      if (th.dataset.sort === PV.state.sort.col) {
        th.setAttribute("data-sort-active", PV.state.sort.dir);
      } else {
        th.removeAttribute("data-sort-active");
      }
    });

    if (!rows.length) {
      $("#table-empty").classList.remove("hidden");
      return;
    }
    $("#table-empty").classList.add("hidden");

    const frag = document.createDocumentFragment();
    for (const s of rows) {
      const tr = el("tr", {
        dataset: { step: s.step },
        onclick: () => PV.app.select(s.step),
      }, [
        el("td", { class: "col-step" }, s.step),
        el("td", { class: "col-label" }, s.label || ""),
        el("td", null, s.stage || ""),
        el("td", null, [
          el("span", { class: "pill pill-" + statusClass(s.status) }, s.status || "")
        ]),
        el("td", null, s.language || ""),
        el("td", { class: "col-path" }, s.path || ""),
      ]);
      if (PV.state.selected === s.step) tr.classList.add("selected");
      frag.appendChild(tr);
    }
    tbody.appendChild(frag);
  }

  function renderChips() {
    renderChipGroup("#chip-stages",
      unique(PV.state.steps.map(s => s.stage)).sort(),
      PV.state.filter.stages, "stage");
    renderChipGroup("#chip-statuses",
      unique(PV.state.steps.map(s => s.status)).sort(),
      PV.state.filter.statuses, "status");
    renderChipGroup("#chip-langs",
      unique(PV.state.steps.map(s => s.language)).sort(),
      PV.state.filter.languages, "lang");
  }

  function renderChipGroup(sel, values, activeSet, label) {
    const root = $(sel);
    root.innerHTML = "";
    if (!values.length) return;
    root.appendChild(el("span", { class: "chip-label muted" }, label + ":"));
    for (const v of values) {
      const isActive = activeSet.has(v);
      const chip = el("span", {
        class: "chip" + (isActive ? " active" : ""),
        onclick: () => {
          if (activeSet.has(v)) activeSet.delete(v); else activeSet.add(v);
          PV.app.refresh();
        },
      }, v);
      root.appendChild(chip);
    }
  }

  function wire() {
    $("#filter").addEventListener("input", e => {
      PV.state.filter.text = e.target.value;
      render();
    });
    $$("#steps-table th").forEach(th => {
      th.addEventListener("click", () => {
        const col = th.dataset.sort;
        if (!col) return;
        if (PV.state.sort.col === col) {
          PV.state.sort.dir = PV.state.sort.dir === "asc" ? "desc" : "asc";
        } else {
          PV.state.sort.col = col;
          PV.state.sort.dir = "asc";
        }
        render();
      });
    });
  }

  function highlightSelected() {
    $$("#steps-table tbody tr").forEach(tr => {
      tr.classList.toggle("selected", tr.dataset.step === PV.state.selected);
    });
  }

  return { render, renderChips, wire, highlightSelected };
})();

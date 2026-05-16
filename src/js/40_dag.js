PV.dag = (function () {
  const { $, $$, el, svgEl, statusClass } = PV.util;

  /* Compute depth of each node as the longest path from any root.
     Nodes with no incoming edges get depth 0. Cycles (shouldn't exist) are
     broken by capping depth at #nodes. */
  function computeLayers(steps) {
    const depth = {};
    const byStep = PV.state.byStep;
    const N = steps.length;

    function dfs(stepId, stack) {
      if (depth[stepId] != null) return depth[stepId];
      const node = byStep[stepId];
      if (!node) return 0;
      if (stack.has(stepId)) return 0;
      stack.add(stepId);
      const deps = Array.isArray(node.depends_on) ? node.depends_on : [];
      let d = 0;
      for (const p of deps) {
        if (!byStep[p]) continue;
        d = Math.max(d, 1 + dfs(p, stack));
      }
      stack.delete(stepId);
      depth[stepId] = Math.min(d, N);
      return depth[stepId];
    }

    for (const s of steps) dfs(s.step, new Set());

    const layers = [];
    for (const s of steps) {
      const d = depth[s.step] || 0;
      layers[d] = layers[d] || [];
      layers[d].push(s);
    }
    for (const lay of layers) {
      if (lay) lay.sort((a, b) => String(a.step).localeCompare(String(b.step), undefined, { numeric: true }));
    }
    return { depth, layers };
  }

  function render() {
    const root = $("#dag-canvas");
    root.innerHTML = "";
    const steps = PV.state.steps;
    if (!steps.length) {
      root.appendChild(el("div", { class: "muted empty" }, "no steps to render."));
      return;
    }
    const { depth, layers } = computeLayers(steps);

    const NODE_W = 170, NODE_H = 42, COL_GAP = 60, ROW_GAP = 24;
    const PAD = 24;

    const cols = layers.length;
    const maxRows = layers.reduce((m, l) => Math.max(m, l ? l.length : 0), 0);

    const width = PAD * 2 + cols * NODE_W + (cols - 1) * COL_GAP;
    const height = PAD * 2 + maxRows * NODE_H + (maxRows - 1) * ROW_GAP;

    const positions = {};
    for (let c = 0; c < cols; c++) {
      const lay = layers[c] || [];
      for (let r = 0; r < lay.length; r++) {
        const s = lay[r];
        positions[s.step] = {
          x: PAD + c * (NODE_W + COL_GAP),
          y: PAD + r * (NODE_H + ROW_GAP),
        };
      }
    }

    const svg = svgEl("svg", {
      width: String(width),
      height: String(height),
      viewBox: `0 0 ${width} ${height}`,
    });

    /* arrowhead marker */
    const defs = svgEl("defs");
    const marker = svgEl("marker", {
      id: "pv-arrow",
      viewBox: "0 0 10 10",
      refX: "9",
      refY: "5",
      markerWidth: "7",
      markerHeight: "7",
      orient: "auto-start-reverse",
    });
    marker.appendChild(svgEl("path", {
      d: "M 0 0 L 10 5 L 0 10 z",
      class: "dag-arrowhead",
    }));
    defs.appendChild(marker);
    svg.appendChild(defs);

    /* edges */
    const edgesGroup = svgEl("g");
    for (const s of steps) {
      const to = positions[s.step];
      if (!to) continue;
      const deps = Array.isArray(s.depends_on) ? s.depends_on : [];
      for (const p of deps) {
        const from = positions[p];
        if (!from) continue;
        const x1 = from.x + NODE_W;
        const y1 = from.y + NODE_H / 2;
        const x2 = to.x;
        const y2 = to.y + NODE_H / 2;
        const mx = (x1 + x2) / 2;
        const path = svgEl("path", {
          class: "dag-edge",
          d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`,
          "marker-end": "url(#pv-arrow)",
        });
        edgesGroup.appendChild(path);
      }
    }
    svg.appendChild(edgesGroup);

    /* nodes */
    const nodesGroup = svgEl("g");
    for (const s of steps) {
      const p = positions[s.step];
      if (!p) continue;
      const g = svgEl("g", {
        class: "dag-node " + statusClass(s.status)
          + (PV.state.selected === s.step ? " selected" : ""),
        transform: `translate(${p.x}, ${p.y})`,
        onclick: () => PV.app.select(s.step),
      });
      g.setAttribute("data-step", s.step);
      g.appendChild(svgEl("rect", {
        class: "dag-node-rect",
        width: String(NODE_W),
        height: String(NODE_H),
        rx: "4",
      }));
      const stepText = svgEl("text", {
        class: "dag-node-step",
        x: "8",
        y: "14",
      });
      stepText.textContent = s.step + " · " + (s.stage || "");
      g.appendChild(stepText);
      const labelText = svgEl("text", {
        class: "dag-node-label",
        x: "8",
        y: "32",
      });
      const lbl = s.label || "";
      labelText.textContent = lbl.length > 26 ? lbl.slice(0, 25) + "…" : lbl;
      const title = svgEl("title");
      title.textContent = (s.label || s.step) + " — " + (s.status || "");
      g.appendChild(labelText);
      g.appendChild(title);
      nodesGroup.appendChild(g);
    }
    svg.appendChild(nodesGroup);
    root.appendChild(svg);
  }

  function highlightSelected() {
    $$("#dag-canvas .dag-node").forEach(n => {
      n.classList.toggle("selected", n.getAttribute("data-step") === PV.state.selected);
    });
  }

  return { render, highlightSelected };
})();

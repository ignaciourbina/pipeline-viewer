PV.data = (function () {
  const { getQueryParam, setStatusLine } = PV.util;

  function resolveJsonUrl() {
    return getQueryParam("json") || "./pipeline.json";
  }

  async function readInline() {
    const node = document.getElementById("pv-data");
    if (!node) return null;
    const txt = node.textContent.trim();
    if (!txt) return null;
    try { return JSON.parse(txt); }
    catch (e) {
      console.error("inline JSON parse error", e);
      return null;
    }
  }

  async function readFetch() {
    const url = resolveJsonUrl();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("fetch " + url + " -> " + res.status);
    return await res.json();
  }

  async function load() {
    const inline = await readInline();
    if (inline) {
      ingest(inline);
      setStatusLine("loaded (inline)");
      return inline;
    }
    try {
      const j = await readFetch();
      ingest(j);
      setStatusLine("loaded " + resolveJsonUrl());
      return j;
    } catch (e) {
      setStatusLine("error: " + e.message);
      throw e;
    }
  }

  function ingest(raw) {
    PV.state.raw = raw;
    const steps = Array.isArray(raw.steps) ? raw.steps.slice() : [];
    PV.state.steps = steps;
    const byStep = {};
    const reverse = {};
    for (const s of steps) {
      byStep[s.step] = s;
      reverse[s.step] = reverse[s.step] || [];
    }
    for (const s of steps) {
      const deps = Array.isArray(s.depends_on) ? s.depends_on : [];
      for (const d of deps) {
        reverse[d] = reverse[d] || [];
        reverse[d].push(s.step);
      }
    }
    PV.state.byStep = byStep;
    PV.state.reverseDeps = reverse;
  }

  async function loadFromBlob(file) {
    let text;
    try {
      text = await file.text();
    } catch (e) {
      setStatusLine("read error: " + e.message);
      throw e;
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      setStatusLine("parse error in " + file.name + ": " + e.message);
      throw e;
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      const msg = "not a pipeline.json (top-level must be an object)";
      setStatusLine(msg);
      throw new Error(msg);
    }
    if (!Array.isArray(data.steps)) {
      const msg = "not a pipeline.json (missing 'steps' array)";
      setStatusLine(msg);
      throw new Error(msg);
    }
    ingest(data);
    PV.state.loadedFilename = file.name;
    setStatusLine(
      "loaded " + file.name + " (" + file.size.toLocaleString() + " bytes, "
      + data.steps.length + " steps)"
    );
    return data;
  }

  async function fetchModified() {
    const url = resolveJsonUrl();
    try {
      const res = await fetch(url, { method: "HEAD", cache: "no-store" });
      return res.headers.get("Last-Modified") || res.headers.get("ETag") || null;
    } catch (_) { return null; }
  }

  return { load, ingest, loadFromBlob, resolveJsonUrl, fetchModified };
})();

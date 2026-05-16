PV.util = (function () {
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === "class") node.className = attrs[k];
        else if (k === "dataset") {
          for (const d in attrs.dataset) node.dataset[d] = attrs.dataset[d];
        } else if (k.startsWith("on") && typeof attrs[k] === "function") {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (k === "html") {
          node.innerHTML = attrs[k];
        } else {
          node.setAttribute(k, attrs[k]);
        }
      }
    }
    if (children) {
      const arr = Array.isArray(children) ? children : [children];
      for (const c of arr) {
        if (c == null) continue;
        node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      }
    }
    return node;
  }

  function svgEl(tag, attrs) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === "class") node.setAttribute("class", attrs[k]);
        else if (k.startsWith("on") && typeof attrs[k] === "function") {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else {
          node.setAttribute(k, attrs[k]);
        }
      }
    }
    return node;
  }

  function statusClass(s) {
    if (s === "implemented") return "status-implemented";
    if (s === "todo") return "status-todo";
    return "status-other";
  }

  function unique(arr) {
    return Array.from(new Set(arr.filter(x => x != null)));
  }

  function fmtDate(s) {
    if (!s) return "";
    return s;
  }

  function getQueryParam(name) {
    try {
      const u = new URL(window.location.href);
      return u.searchParams.get(name);
    } catch (_) { return null; }
  }

  function setStatusLine(msg) {
    const node = $("#status-line");
    if (node) node.textContent = msg;
  }

  return { $, $$, el, svgEl, statusClass, unique, fmtDate, getQueryParam, setStatusLine };
})();

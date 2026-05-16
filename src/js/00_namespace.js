window.PV = window.PV || {
  state: {
    raw: null,
    steps: [],
    byStep: {},
    reverseDeps: {},
    filter: {
      text: "",
      stages: new Set(),
      statuses: new Set(),
      languages: new Set(),
    },
    sort: { col: "step", dir: "asc" },
    selected: null,
    activeTab: "table",
    lastModified: null,
    pollTimer: null,
    loadedFilename: null,
  },
};

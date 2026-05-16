# pipeline-viewer

HTML frontend + tooling for `pipeline.json` manifests (script metadata +
dependency graph). Generic over any JSON conforming to
[`pipeline.schema.json`](pipeline.schema.json).

```
tooling/pipeline-viewer/
├── pipeline.schema.json     JSON Schema 2020-12 contract
├── pipeline.template.json   minimal 2-step skeleton to fork
├── check.py                 stdlib-only validator
├── build.py                 builds dist/
├── serve.sh                 wraps `python3 -m http.server` against dist/
├── src/                     viewer source (template, styles, js)
├── dist/                    build output (viewer.html, index.html, pipeline.json)
└── docs/
    ├── SCHEMA.md            field-by-field reference
    └── CHECKER.md           how to run check.py, what it enforces
```

No npm. No `node_modules`. No CDN dependencies. Vanilla JS + a hand-rolled
SVG DAG; works fully offline.

---

## Quick start

```bash
# 1. Validate a manifest
./check.py ../../study2-chile-v2/pipeline.json

# 2. Build the viewer against it
./build.py --json ../../study2-chile-v2/pipeline.json

# 3. View — either open dist/viewer.html directly (file://), or serve:
./serve.sh 8766
xdg-open http://localhost:8766/
```

---

## Schema

The contract is [`pipeline.schema.json`](pipeline.schema.json) (JSON Schema
2020-12). Required: top-level `study` + `steps[]`, and per-step `step` +
`label` + `path`. Everything else optional but typed when present.

See [`docs/SCHEMA.md`](docs/SCHEMA.md) for the full field-by-field reference
(types, requirements, examples, conventions).

Editors that understand JSON Schema can validate live — reference the
schema from your `pipeline.json`:

```json
{ "$schema": "../tooling/pipeline-viewer/pipeline.schema.json", ... }
```

---

## Template

[`pipeline.template.json`](pipeline.template.json) is a minimal 2-step
skeleton with `depends_on` wired up. Copy it into a new study and edit in
place:

```bash
cp tooling/pipeline-viewer/pipeline.template.json studyN-name/pipeline.json
```

---

## Checker

`check.py` validates schema conformance and runs the structural checks the
schema can't express (unique step ids, no dangling `depends_on`, no cycles,
soft warning on out-of-order step ids). Stdlib only.

```bash
./check.py path/to/pipeline.json          # exit 0 = OK, 1 = errors
./check.py path/to/pipeline.json --strict # warnings become errors
./check.py --template                     # validate the bundled template
```

Output is `path: $.locator: severity: message`, one finding per line. See
[`docs/CHECKER.md`](docs/CHECKER.md) for exit codes, the full list of
checks, output format, and a sample pre-commit hook.

---

## Build

```bash
./build.py
./build.py --json ../../study2-chile-v2/pipeline.json --title "study2-v2"
./build.py --static-only           # only viewer.html
```

Default `--json` is `../../study2-chile-v2/pipeline.json`. Build emits:

- `dist/viewer.html` — self-contained, JSON inlined, opens via `file://`.
- `dist/index.html` — fetches `./pipeline.json` (or `?json=<url>`).
- `dist/pipeline.json` — copied from the `--json` source.

---

## View

- `dist/viewer.html` — double-click; the JSON is inlined, so it works
  under `file://` with no server.
- `dist/index.html` — needs a server because `fetch()` on `file://` is
  blocked by browsers. Run `./serve.sh [port]` (default `8765`) and open
  `http://localhost:<port>/`. The dynamic page also accepts
  `?json=<url>` to point at a different JSON.

---

## UI

- **Table tab** (default) — sortable columns (step / label / stage /
  status / lang / path), free-text filter over label + description + path
  + step, chip filters for stage / status / language. Click a row to
  select.
- **DAG tab** — topo-layered SVG (top→bottom by longest path from a
  root). Nodes are color-coded by status. Click a node to select.
- **Detail pane** (right) — description, inputs, outputs, and clickable
  links for `depends_on` and the computed `depended on by` (reverse
  edges).
- **Auto-refresh** — polls the JSON's `Last-Modified` / `ETag` every 5s
  (dynamic build only; static `viewer.html` has nothing to poll).
- **Dark mode** — toggle persists in `localStorage`.

---

## Reusing for another study

Either build a dedicated viewer:

```bash
./build.py --json ../../studyN/pipeline.json --title "studyN"
```

Or share a single dynamic dist and switch JSONs at view-time:

```
http://localhost:8766/?json=/path/to/other/pipeline.json
```

---

## See also

- [`docs/SCHEMA.md`](docs/SCHEMA.md) — field reference and conventions
- [`docs/CHECKER.md`](docs/CHECKER.md) — checker usage, exit codes,
  pre-commit recipe

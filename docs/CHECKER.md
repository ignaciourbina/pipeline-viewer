# check.py — validating a pipeline.json

`check.py` is a stdlib-only Python validator. No `pip install`, no
`jsonschema` — it ships with what Python 3.10+ already has.

It does two things:

1. **Schema validation** — mirrors [`pipeline.schema.json`](../pipeline.schema.json)
   but emits human-readable error messages instead of raw JSON-Schema
   diagnostics.
2. **Structural checks** — cross-step rules the schema can't express:
   unique step ids, no dangling `depends_on` targets, no cycles, and a soft
   warning when array order doesn't match the natural sort of step ids.

---

## Usage

```bash
./check.py path/to/pipeline.json
./check.py path/to/pipeline.json --strict     # warnings become errors
./check.py --template                         # validate the bundled template
./check.py                                    # same as --template
```

From any working directory:

```bash
python3 tooling/pipeline-viewer/check.py study2-chile-v2/pipeline.json
```

---

## Output format

One finding per line:

```
<path>: <locator>: <severity>: <message>
```

Where `<locator>` is a JSONPath-style pointer (e.g. `$.steps[3].depends_on[0]`)
and `<severity>` is `error` or `warning`. Findings are followed by a one-line
summary on stderr when any are present, or a single `OK` line on stdout when
clean.

Examples:

```
pipeline.json: $.steps[3].depends_on[1]: error: target '99' does not match any step id
pipeline.json: $.steps[5].step: warning: step id '04' comes after '07' in the array but sorts before it
pipeline.json: 1 error(s), 1 warning(s)
```

---

## Exit codes

| Code | Meaning                                                       |
|------|---------------------------------------------------------------|
| 0    | No errors. Warnings may have been printed; tool returned OK.  |
| 1    | At least one error (or any warning under `--strict`).         |
| 2    | Bad invocation, file missing, or JSON itself unparsable.      |

Suitable for CI gates and pre-commit hooks. Example pre-commit step (drop into
`.git/hooks/pre-commit`):

```bash
#!/usr/bin/env bash
set -e
for f in $(git diff --cached --name-only --diff-filter=ACMR | grep 'pipeline\.json$'); do
  ./tooling/pipeline-viewer/check.py "$f" || exit 1
done
```

---

## Checks performed

### Schema-level (errors)

- Top-level must be an object; `study` (non-empty string) and `steps`
  (non-empty array) are required.
- `target`, `version`, `last_updated`, `notes` validated when present.
- `last_updated` must match `YYYY-MM-DD`.
- Per step: `step`, `label`, `path` required and non-empty.
- Per step: `language`, `stage`, `status`, `description` must be strings if
  present.
- Per step: `inputs`, `outputs`, `depends_on` must be arrays of strings if
  present.

### Structural (errors)

- **Duplicate step ids.** Two entries with the same `step` value. The
  message points to the second occurrence and tells you where the first one
  is.
- **Dangling `depends_on`.** Every dependency id must match an existing
  step. Reports the offending entry by JSONPath.
- **Self-loops.** A step whose `depends_on` contains its own id.
- **Cycles.** Detected via iterative DFS with white/gray/black coloring;
  the message lists the cycle as `A -> B -> ... -> A`. Multiple cycles
  sharing the same node set are deduplicated.

### Structural (warnings)

- **Step-id ordering.** Emits a warning when a step's id sorts earlier
  (numeric-aware) than its predecessor's. Useful for catching renumbering
  drift; not an error because deliberate inserts (e.g. `10a` between `10`
  and `11`) are routine.

  Use `--strict` to upgrade warnings to errors.

---

## What `check.py` does *not* check

- **Filesystem existence.** `path`, `inputs`, `outputs` are treated as
  free-form strings. The checker does not stat the filesystem; that would
  couple it to the study's checkout state and break in CI sandboxes.
- **Script content.** It doesn't read the scripts referenced by `path` or
  compare their declared inputs/outputs against the manifest.
- **`status` accuracy.** Whether a step labelled `implemented` actually
  works is out of scope.
- **Cross-pipeline references.** Each `pipeline.json` is validated in
  isolation.

---

## Extending

The validator is a single file (`check.py`), structured as a list of
`Finding` records produced by independent functions
(`validate_schema`, `check_duplicates`, `check_dep_targets_exist`,
`check_cycles`, `check_ordering`). Adding a new check means adding one
function and calling it from `run()`.

If a future need pushes complexity past a single file, consider switching
to the upstream `jsonschema` package and embedding the structural checks
as `additionalProperties` validators — but the current version is
intentionally dependency-free to match the viewer's "no `pip install`
ethos."

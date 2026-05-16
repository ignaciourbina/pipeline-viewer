# pipeline.json — schema reference

The formal contract lives at [`pipeline.schema.json`](../pipeline.schema.json)
(JSON Schema 2020-12). This page is the human-readable companion: every field,
its type, whether it's required, and what it's for.

Editors that understand JSON Schema (VS Code with the JSON language server,
JetBrains IDEs) can validate against the schema live — reference it from your
`pipeline.json` via:

```json
{ "$schema": "../tooling/pipeline-viewer/pipeline.schema.json", ... }
```

The path is illustrative; use whatever relative path reaches the schema from
your study's `pipeline.json`. The `$schema` key is ignored by
`tooling/pipeline-viewer/check.py` and by the viewer itself, so it is safe to
include.

For the structural checks the schema can't express (unique step ids,
acyclicity, depends_on targets exist), see [CHECKER.md](CHECKER.md).

---

## Top-level object

| Field          | Type     | Required | Description                                                                                                  |
|----------------|----------|----------|--------------------------------------------------------------------------------------------------------------|
| `study`        | string   | yes      | Short identifier of the study (e.g. `"study2-chile-v2"`). Shown in the viewer's banner.                      |
| `target`       | string   | no       | One-paragraph statement of what the pipeline produces and the identification strategy it implements.        |
| `version`      | integer  | no       | Manifest version *for the study* (not for this schema). Bump on canonical-step changes.                      |
| `last_updated` | string   | no       | ISO date `YYYY-MM-DD`. The checker enforces the format.                                                      |
| `notes`        | string[] | no       | Free-form notes about conventions, exclusions, and how to keep the manifest in sync.                         |
| `steps`        | object[] | yes      | Ordered array of step entries (see below). Must contain at least one entry.                                  |

Additional top-level properties are tolerated (the schema sets
`additionalProperties: true`) — useful if a downstream tool wants to attach
extra metadata. The viewer ignores anything it doesn't recognise.

---

## Step object

| Field         | Type     | Required | Description                                                                                                                                                              |
|---------------|----------|----------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `step`        | string   | yes      | Canonical id. Typically a zero-padded ordinal (`"00"`, `"01"`, `"10a"`). Must be unique within the file.                                                                 |
| `label`       | string   | yes      | Short human-readable label, snake_case recommended. Should match the script's stem.                                                                                       |
| `path`        | string   | yes      | Relative path from the study root to the script.                                                                                                                          |
| `language`    | string   | no       | Implementation language. Suggested values: `python`, `R`, `sh`, `stata`, `matlab`. Open enum; new values pass validation.                                                |
| `stage`       | string   | no       | Pipeline stage (e.g. `data_prep`, `crosswalk`, `imputed_positions`, `estimation`). Open enum; the viewer derives chip filters from the set of values present.            |
| `status`      | string   | no       | Implementation status. Suggested values: `implemented`, `todo`. The viewer color-codes the first two and renders any other value as a neutral pill.                       |
| `description` | string   | no       | Plain-text paragraph describing what the step does. Newlines preserved when rendered (the viewer uses `white-space: pre-wrap`). Not Markdown.                            |
| `inputs`      | string[] | no       | Paths or glob patterns the step reads. Free-form strings; not validated against the filesystem.                                                                           |
| `outputs`     | string[] | no       | Paths the step writes.                                                                                                                                                    |
| `depends_on`  | string[] | no       | List of step ids this step depends on. Each id must reference an existing step in the same file. Must not contain self-loops or form cycles. Enforced by `check.py`.     |

Additional per-step properties are tolerated. The viewer ignores them.

---

## Conventions (not enforced)

These are repo conventions, not schema rules — the checker won't flag
violations:

- **`step` ids** are usually two-digit zero-padded ordinals. Suffix letters
  (`"10a"`, `"10b"`) are fine for sub-steps inserted between integers.
- **Array order** of `steps` should match `step`-id order. The checker emits
  a warning (not an error) when they diverge.
- **Validation / diagnostic scripts** are excluded from `pipeline.json`. Only
  list scripts required to reproduce the final estimand.
- **Bump `last_updated`** whenever you reshuffle step numbers or refresh
  `depends_on`.

---

## See also

- [`pipeline.template.json`](../pipeline.template.json) — minimal 2-step
  skeleton you can fork.
- [`pipeline.schema.json`](../pipeline.schema.json) — the machine-readable
  contract.
- [CHECKER.md](CHECKER.md) — how to run `check.py`, the structural rules it
  enforces, and how to read its output.

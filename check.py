#!/usr/bin/env python3
"""Validate a pipeline.json against the pipeline-viewer contract.

Stdlib only — no jsonschema dependency. Mirrors pipeline.schema.json but
adds the cross-step structural checks the schema can't express:

  - duplicate step ids                         (error)
  - depends_on targets must exist              (error)
  - depends_on must be acyclic                 (error)
  - step ids should be in sorted order         (warning)

Output: one finding per line, formatted as

  <path>: <locator>: <severity>: <message>

where <locator> is a JSONPath-style pointer (e.g. `$.steps[3].depends_on[0]`).

Exit codes
----------
  0   no errors (warnings are allowed)
  1   at least one error
  2   bad invocation / file not found / invalid JSON

Usage
-----
  ./check.py path/to/pipeline.json
  ./check.py path/to/pipeline.json --strict       # warnings become errors
  ./check.py --template                           # check the bundled template
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent

# ---------- finding model ----------

@dataclass
class Finding:
    severity: str  # "error" | "warning"
    locator: str
    message: str


# ---------- type guards ----------

def _is_str(x: Any) -> bool:    return isinstance(x, str)
def _is_int(x: Any) -> bool:    return isinstance(x, int) and not isinstance(x, bool)
def _is_list(x: Any) -> bool:   return isinstance(x, list)
def _is_dict(x: Any) -> bool:   return isinstance(x, dict)


# ---------- schema validation ----------

def validate_schema(doc: Any) -> list[Finding]:
    out: list[Finding] = []
    if not _is_dict(doc):
        out.append(Finding("error", "$", "top-level value must be an object"))
        return out

    # required top-level fields
    if "study" not in doc:
        out.append(Finding("error", "$.study", "required field missing"))
    elif not _is_str(doc["study"]) or not doc["study"]:
        out.append(Finding("error", "$.study", "must be a non-empty string"))

    if "steps" not in doc:
        out.append(Finding("error", "$.steps", "required field missing"))
        return out
    if not _is_list(doc["steps"]):
        out.append(Finding("error", "$.steps", "must be an array"))
        return out
    if len(doc["steps"]) == 0:
        out.append(Finding("error", "$.steps", "must contain at least one step"))

    # optional top-level fields
    if "target" in doc and not _is_str(doc["target"]):
        out.append(Finding("error", "$.target", "must be a string"))
    if "version" in doc and not _is_int(doc["version"]):
        out.append(Finding("error", "$.version", "must be an integer"))
    if "last_updated" in doc:
        v = doc["last_updated"]
        if not _is_str(v):
            out.append(Finding("error", "$.last_updated", "must be a string"))
        else:
            ok = (
                len(v) == 10
                and v[4] == "-" and v[7] == "-"
                and v[:4].isdigit() and v[5:7].isdigit() and v[8:10].isdigit()
            )
            if not ok:
                out.append(Finding(
                    "error", "$.last_updated",
                    f"must match YYYY-MM-DD (got {v!r})"
                ))
    if "notes" in doc:
        if not _is_list(doc["notes"]):
            out.append(Finding("error", "$.notes", "must be an array of strings"))
        else:
            for i, n in enumerate(doc["notes"]):
                if not _is_str(n):
                    out.append(Finding("error", f"$.notes[{i}]", "must be a string"))

    # per-step
    for i, step in enumerate(doc["steps"]):
        out.extend(_validate_step(step, i))

    return out


def _validate_step(step: Any, i: int) -> list[Finding]:
    base = f"$.steps[{i}]"
    out: list[Finding] = []
    if not _is_dict(step):
        out.append(Finding("error", base, "step entry must be an object"))
        return out

    # required
    for key in ("step", "label", "path"):
        if key not in step:
            out.append(Finding("error", f"{base}.{key}", "required field missing"))
        elif not _is_str(step[key]) or not step[key]:
            out.append(Finding("error", f"{base}.{key}", "must be a non-empty string"))

    # optional strings
    for key in ("language", "stage", "status", "description"):
        if key in step and not _is_str(step[key]):
            out.append(Finding("error", f"{base}.{key}", "must be a string"))

    # optional string arrays
    for key in ("inputs", "outputs", "depends_on"):
        if key in step:
            v = step[key]
            if not _is_list(v):
                out.append(Finding("error", f"{base}.{key}", "must be an array of strings"))
            else:
                for j, item in enumerate(v):
                    if not _is_str(item):
                        out.append(Finding("error", f"{base}.{key}[{j}]", "must be a string"))

    return out


# ---------- structural checks ----------

def check_duplicates(doc: dict) -> list[Finding]:
    out: list[Finding] = []
    seen: dict[str, int] = {}
    for i, step in enumerate(doc.get("steps", [])):
        if not _is_dict(step):
            continue
        sid = step.get("step")
        if not _is_str(sid):
            continue
        if sid in seen:
            out.append(Finding(
                "error", f"$.steps[{i}].step",
                f"duplicate step id {sid!r} (also at $.steps[{seen[sid]}].step)"
            ))
        else:
            seen[sid] = i
    return out


def check_dep_targets_exist(doc: dict) -> list[Finding]:
    out: list[Finding] = []
    steps = doc.get("steps", [])
    ids = {s.get("step") for s in steps if _is_dict(s) and _is_str(s.get("step"))}
    for i, step in enumerate(steps):
        if not _is_dict(step):
            continue
        deps = step.get("depends_on")
        if not _is_list(deps):
            continue
        for j, dep in enumerate(deps):
            if not _is_str(dep):
                continue
            if dep not in ids:
                out.append(Finding(
                    "error", f"$.steps[{i}].depends_on[{j}]",
                    f"target {dep!r} does not match any step id"
                ))
            if dep == step.get("step"):
                out.append(Finding(
                    "error", f"$.steps[{i}].depends_on[{j}]",
                    f"step {dep!r} depends on itself"
                ))
    return out


def check_cycles(doc: dict) -> list[Finding]:
    """Detect cycles via iterative DFS with WHITE/GRAY/BLACK coloring."""
    out: list[Finding] = []
    steps = doc.get("steps", [])

    # First pass: collect all valid step ids and their positions.
    pos: dict[str, int] = {}
    for i, s in enumerate(steps):
        if _is_dict(s) and _is_str(s.get("step")):
            pos[s["step"]] = i

    # Second pass: build the dependency graph, restricted to known ids.
    graph: dict[str, list[str]] = {}
    for s in steps:
        if not _is_dict(s) or not _is_str(s.get("step")):
            continue
        sid = s["step"]
        deps = s.get("depends_on") if _is_list(s.get("depends_on")) else []
        graph[sid] = [d for d in deps if _is_str(d) and d in pos]

    WHITE, GRAY, BLACK = 0, 1, 2
    color: dict[str, int] = {sid: WHITE for sid in graph}
    reported: set[tuple] = set()

    def dfs(start: str) -> None:
        stack: list[tuple[str, int]] = [(start, 0)]
        path: list[str] = []
        color[start] = GRAY
        path.append(start)
        while stack:
            node, idx = stack[-1]
            children = graph.get(node, [])
            if idx >= len(children):
                color[node] = BLACK
                path.pop()
                stack.pop()
                continue
            stack[-1] = (node, idx + 1)
            child = children[idx]
            if child not in color:
                continue
            if color[child] == GRAY:
                # cycle: child appears in `path`
                if child in path:
                    cyc = path[path.index(child):] + [child]
                    key = tuple(sorted(set(cyc)))
                    if key not in reported:
                        reported.add(key)
                        out.append(Finding(
                            "error", f"$.steps[{pos.get(child, '?')}].depends_on",
                            "dependency cycle: " + " -> ".join(cyc)
                        ))
            elif color[child] == WHITE:
                color[child] = GRAY
                path.append(child)
                stack.append((child, 0))

    for sid in graph:
        if color[sid] == WHITE:
            dfs(sid)
    return out


def check_ordering(doc: dict) -> list[Finding]:
    """Warn if step ids aren't in sorted (numeric-aware) order."""
    out: list[Finding] = []
    steps = doc.get("steps", [])
    ids = [s.get("step") for s in steps if _is_dict(s) and _is_str(s.get("step"))]

    def _key(sid: str) -> tuple:
        # split into runs of digits / non-digits so '10' sorts after '9'
        parts: list = []
        buf = ""
        is_digit = sid[:1].isdigit() if sid else False
        for ch in sid:
            if ch.isdigit() == is_digit:
                buf += ch
            else:
                parts.append(int(buf) if is_digit else buf)
                buf = ch
                is_digit = ch.isdigit()
        if buf:
            parts.append(int(buf) if is_digit else buf)
        # pad with type tag so int and str sort comparably
        return tuple((0, p) if isinstance(p, int) else (1, p) for p in parts)

    for i in range(1, len(ids)):
        if _key(ids[i]) < _key(ids[i - 1]):
            out.append(Finding(
                "warning", f"$.steps[{i}].step",
                f"step id {ids[i]!r} comes after {ids[i-1]!r} in the array but sorts before it"
            ))
    return out


# ---------- driver ----------

def run(json_path: Path, *, strict: bool) -> int:
    try:
        raw = json_path.read_text(encoding="utf-8")
    except OSError as e:
        print(f"error: cannot read {json_path}: {e}", file=sys.stderr)
        return 2
    try:
        doc = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"{json_path}:{e.lineno}:{e.colno}: error: invalid JSON: {e.msg}",
              file=sys.stderr)
        return 2

    findings: list[Finding] = []
    findings.extend(validate_schema(doc))
    if _is_dict(doc):
        findings.extend(check_duplicates(doc))
        findings.extend(check_dep_targets_exist(doc))
        findings.extend(check_cycles(doc))
        findings.extend(check_ordering(doc))

    errors = sum(1 for f in findings if f.severity == "error")
    warnings = sum(1 for f in findings if f.severity == "warning")

    for f in findings:
        print(f"{json_path}: {f.locator}: {f.severity}: {f.message}")

    summary = f"{errors} error(s), {warnings} warning(s)"
    if not findings:
        print(f"{json_path}: OK ({len(doc.get('steps', [])) if _is_dict(doc) else 0} steps)")
    else:
        print(f"{json_path}: {summary}", file=sys.stderr)

    if errors or (strict and warnings):
        return 1
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("json_path", nargs="?", type=Path,
                    help="path to a pipeline.json to validate "
                         "(omit to check the bundled pipeline.template.json)")
    ap.add_argument("--template", action="store_true",
                    help="explicitly validate pipeline.template.json")
    ap.add_argument("--strict", action="store_true",
                    help="treat warnings as errors")
    args = ap.parse_args()

    if args.template or args.json_path is None:
        path = HERE / "pipeline.template.json"
    else:
        path = args.json_path
    return run(path, strict=args.strict)


if __name__ == "__main__":
    sys.exit(main())

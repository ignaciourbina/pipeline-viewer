#!/usr/bin/env python3
"""Build the pipeline-viewer from layered source.

Source tree (under `src/`):

    src/template.html         skeleton with @CSS@ @JS@ @DATA_BLOCK@ @TITLE@
    src/styles/*.css          alphabetised; concatenated and inlined in <style>
    src/js/*.js               alphabetised; concatenated and inlined in <script>

Outputs (under `dist/`):

    dist/viewer.html          self-contained, JSON inlined, opens via file://
    dist/index.html           dynamic version (fetches ./pipeline.json)
    dist/pipeline.json        copied from --json source

Usage:
    ./build.py
    ./build.py --json ../../study2-chile-v2/pipeline.json --title "study2-v2"
    ./build.py --static-only
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
DIST = ROOT / "dist"

TEMPLATE = SRC / "template.html"
STYLES_DIR = SRC / "styles"
JS_DIR = SRC / "js"

DEFAULT_JSON = ROOT.parent.parent / "study2-chile-v2" / "pipeline.json"


def _read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def _concat(dir: Path, ext: str, header_fmt: str) -> str:
    chunks: list[str] = []
    for f in sorted(dir.glob(f"*{ext}")):
        if f.name.startswith("_"):
            continue
        chunks.append(header_fmt.format(name=f.name))
        chunks.append(_read(f))
    return "\n".join(chunks)


def assemble_css() -> str:
    return _concat(STYLES_DIR, ".css", header_fmt="/* === {name} === */")


def assemble_js() -> str:
    return _concat(JS_DIR, ".js", header_fmt="/* === {name} === */")


def render(template: str, *, css: str, js: str, title: str, data_block: str) -> str:
    return (template
            .replace("@CSS@", css)
            .replace("@JS@", js)
            .replace("@TITLE@", title)
            .replace("@DATA_BLOCK@", data_block))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--json",
        default=str(DEFAULT_JSON),
        help=f"path to the pipeline JSON (default: {DEFAULT_JSON})",
    )
    ap.add_argument(
        "--title",
        default=None,
        help="page title (default: derived from JSON 'study' field, fallback 'pipeline')",
    )
    ap.add_argument("--static-only", action="store_true",
                    help="only emit dist/viewer.html (no dist/index.html or copy)")
    args = ap.parse_args()

    json_path = Path(args.json).expanduser().resolve()
    if not json_path.is_file():
        print(f"error: --json not found: {json_path}", file=sys.stderr)
        return 2

    try:
        raw_text = json_path.read_text(encoding="utf-8")
        data = json.loads(raw_text)
    except Exception as e:
        print(f"error: failed to parse JSON {json_path}: {e}", file=sys.stderr)
        return 2

    title = args.title or (str(data.get("study") or "pipeline") + " · pipeline viewer")

    template = _read(TEMPLATE)
    css = assemble_css()
    js = assemble_js()

    DIST.mkdir(parents=True, exist_ok=True)

    # Static viewer with JSON inlined as a <script type="application/json"> block.
    # We re-serialise the parsed data (rather than splicing raw text) so any
    # stray </script> in the source can't break out.
    inlined_json = json.dumps(data, ensure_ascii=False)
    inlined_json = inlined_json.replace("</", "<\\/")
    data_block = (
        '<script id="pv-data" type="application/json">\n'
        + inlined_json
        + "\n</script>"
    )
    viewer_html = render(template, css=css, js=js, title=title, data_block=data_block)
    (DIST / "viewer.html").write_text(viewer_html, encoding="utf-8")
    print(f"wrote {DIST/'viewer.html'} ({len(viewer_html):,} bytes)")

    if args.static_only:
        return 0

    # Dynamic version: empty data block; the JS data layer fetches ./pipeline.json
    # (or ?json=... if provided in the URL).
    dynamic_html = render(template, css=css, js=js, title=title, data_block="")
    (DIST / "index.html").write_text(dynamic_html, encoding="utf-8")
    print(f"wrote {DIST/'index.html'} ({len(dynamic_html):,} bytes)")

    shutil.copyfile(json_path, DIST / "pipeline.json")
    print(f"copied {json_path} -> {DIST/'pipeline.json'}")

    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Validate governed 420Docs page reachability from navigation and approved entry pages."""

from __future__ import annotations

import fnmatch
import json
import re
import sys
from collections import deque
from pathlib import Path
from urllib.parse import unquote, urlsplit

import yaml

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
MKDOCS = ROOT / "mkdocs.yml"
POLICY = ROOT / "docs" / "ci" / "orphan-policy.json"
LINK = re.compile(r"(?<!!)\[[^\]]*\]\(([^)]+)\)")
EXTERNAL_SCHEMES = {"http", "https", "mailto", "tel"}


def fail(message: str) -> None:
    print(f"420Docs orphan navigation ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"cannot read {path.relative_to(ROOT).as_posix()}: {exc}")
    if not isinstance(value, dict):
        fail(f"{path.relative_to(ROOT).as_posix()} must contain an object")
    return value


def load_nav() -> set[str]:
    try:
        config = yaml.safe_load(MKDOCS.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as exc:
        fail(f"cannot read mkdocs.yml: {exc}")
    nav = config.get("nav") if isinstance(config, dict) else None
    if not isinstance(nav, list):
        fail("mkdocs.yml nav must be a list")
    pages: set[str] = set()

    def walk(node: object) -> None:
        if isinstance(node, str):
            candidate = DOCS / node
            if candidate.is_file() and candidate.suffix.lower() == ".md":
                pages.add(candidate.relative_to(ROOT).as_posix())
            return
        if isinstance(node, list):
            for item in node:
                walk(item)
            return
        if isinstance(node, dict):
            for value in node.values():
                walk(value)

    walk(nav)
    return pages


def governed_pages(policy: dict) -> set[str]:
    excluded = set(policy.get("excluded_paths", []))
    globs = list(policy.get("excluded_globs", []))
    pages: set[str] = set()
    for raw_root in policy.get("governed_roots", []):
        root = ROOT / raw_root
        if not root.is_dir():
            fail(f"governed root missing: {raw_root}")
        for path in root.rglob("*.md"):
            rel = path.relative_to(ROOT).as_posix()
            if rel in excluded or any(fnmatch.fnmatch(rel, pattern) for pattern in globs):
                continue
            pages.add(rel)
    return pages


def resolve_target(source: Path, raw: str) -> Path | None:
    target = raw.strip().split(maxsplit=1)[0]
    if not target or target.startswith("#"):
        return source
    parts = urlsplit(target)
    if parts.scheme.lower() in EXTERNAL_SCHEMES or parts.netloc:
        return None
    path_part = unquote(parts.path)
    if not path_part:
        return source
    if path_part.startswith("/"):
        candidate = DOCS / path_part.lstrip("/")
    else:
        candidate = source.parent / path_part
    if candidate.suffix:
        return candidate.resolve()
    md = candidate.with_suffix(".md")
    if md.is_file():
        return md.resolve()
    index = candidate / "index.md"
    if index.is_file():
        return index.resolve()
    return candidate.resolve()


def page_edges(page: str, governed: set[str]) -> set[str]:
    path = ROOT / page
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        fail(f"cannot read {page}: {exc}")
    targets: set[str] = set()
    for raw in LINK.findall(text):
        target = resolve_target(path, raw)
        if target is None:
            continue
        try:
            rel = target.relative_to(ROOT).as_posix()
        except ValueError:
            continue
        if rel in governed:
            targets.add(rel)
    return targets


def main() -> int:
    policy = load_json(POLICY)
    governed = governed_pages(policy)
    nav_pages = load_nav()
    errors: list[str] = []

    entries = set(policy.get("approved_entry_pages", []))
    required_audience = set(policy.get("required_audience_entry_pages", []))
    for page in sorted(entries | required_audience):
        if not (ROOT / page).is_file():
            errors.append(f"entry page missing: {page}")
    for page in sorted(required_audience):
        if page not in nav_pages:
            errors.append(f"required audience entry page is not present in MkDocs navigation: {page}")

    traversal_seeds = {page for page in (nav_pages | entries) if (ROOT / page).is_file()}
    queue: deque[str] = deque(sorted(traversal_seeds))
    traversed = set(traversal_seeds)
    reachable = traversal_seeds & governed
    graph_edges = 0
    while queue:
        page = queue.popleft()
        for target in page_edges(page, governed):
            graph_edges += 1
            reachable.add(target)
            if target not in traversed:
                traversed.add(target)
                queue.append(target)

    allowed = set(policy.get("allowed_orphans", []))
    unknown_allowed = sorted(allowed - governed)
    for page in unknown_allowed:
        errors.append(f"allowed orphan is not a governed page: {page}")

    orphans = sorted(governed - reachable - allowed)
    for page in orphans:
        errors.append(f"governed page is unreachable from navigation/approved entry pages: {page}")

    if errors:
        print(f"420Docs orphan navigation FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        f"420Docs orphan navigation PASS: {len(governed)} governed page(s); "
        f"{len(nav_pages & governed)} governed nav page(s); {len(reachable)} reachable; "
        f"{graph_edges} governed link edge(s); {len(allowed)} approved orphan(s)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

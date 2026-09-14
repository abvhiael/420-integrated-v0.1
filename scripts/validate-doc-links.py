#!/usr/bin/env python3
"""Validate governed 420Docs relative links and practical Markdown anchors."""

from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit

import markdown

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
POLICY_PATH = DOCS / "ci" / "link-policy.json"
LINK_RE = re.compile(r"(?<!!)\[[^\]]*\]\(([^)]+)\)")


class IdCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for key, value in attrs:
            if key == "id" and value:
                self.ids.add(value)


def fatal(message: str) -> None:
    print(f"420Docs links ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_policy() -> dict:
    try:
        data = json.loads(POLICY_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fatal(f"cannot read policy {POLICY_PATH.relative_to(ROOT)}: {exc}")
    if not isinstance(data, dict):
        fatal("link policy must be a JSON object")
    return data


def governed_markdown(policy: dict) -> list[Path]:
    result: set[Path] = set()
    for raw_root in policy.get("governed_roots", []):
        root = ROOT / raw_root
        if not root.is_dir():
            fatal(f"governed root does not exist: {raw_root}")
        result.update(root.rglob("*.md"))
    return sorted(result)


def normalize_inline_target(raw: str) -> str:
    target = raw.strip()
    if target.startswith("<") and target.endswith(">"):
        target = target[1:-1].strip()
    # Strip an optional Markdown link title: path "title" or path 'title'.
    match = re.match(r"^(\S+)(?:\s+[\"'].*[\"'])$", target)
    return match.group(1) if match else target


def is_exception(source: Path, target: str, values: list[str]) -> bool:
    rel = source.relative_to(ROOT).as_posix()
    key = f"{rel} -> {target}"
    return key in set(values)


def resolve_target(source: Path, path_part: str) -> Path | None:
    decoded = unquote(path_part)
    if not decoded:
        return source
    if decoded.startswith("/"):
        candidate = DOCS / decoded.lstrip("/")
    else:
        candidate = source.parent / decoded

    candidates = [candidate]
    if candidate.suffix == "":
        candidates.extend([candidate.with_suffix(".md"), candidate / "index.md"])
    if candidate.is_dir():
        candidates.append(candidate / "index.md")

    for value in candidates:
        try:
            resolved = value.resolve()
        except OSError:
            continue
        if resolved == DOCS.resolve() or DOCS.resolve() in resolved.parents:
            if resolved.is_file():
                return resolved
    return None


def anchor_ids(path: Path, cache: dict[Path, set[str]]) -> set[str]:
    if path in cache:
        return cache[path]
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        cache[path] = set()
        return cache[path]
    renderer = markdown.Markdown(extensions=["toc", "attr_list"])
    html = renderer.convert(text)
    collector = IdCollector()
    collector.feed(html)
    cache[path] = collector.ids
    return cache[path]


def validate_page(path: Path, policy: dict, cache: dict[Path, set[str]]) -> tuple[int, list[str]]:
    rel = path.relative_to(ROOT)
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return 0, [f"{rel}: cannot read file: {exc}"]

    errors: list[str] = []
    checked = 0
    external_schemes = set(policy.get("external_schemes", []))

    for match in LINK_RE.finditer(text):
        raw = normalize_inline_target(match.group(1))
        if not raw or raw.startswith("#"):
            split = urlsplit(raw)
        else:
            split = urlsplit(raw)

        if split.scheme:
            if split.scheme.lower() in external_schemes:
                continue
            # Unknown schemes are non-repository resources and remain outside target validation.
            continue
        if raw.startswith("//"):
            continue

        checked += 1
        target = resolve_target(path, split.path)
        if target is None:
            if not is_exception(path, raw, policy.get("target_exceptions", [])):
                errors.append(f"{rel}: missing internal target '{raw}'")
            continue

        if split.fragment and target.suffix.lower() == ".md":
            fragment = unquote(split.fragment)
            if fragment not in anchor_ids(target, cache):
                if not is_exception(path, raw, policy.get("anchor_exceptions", [])):
                    errors.append(
                        f"{rel}: missing anchor '#{fragment}' in {target.relative_to(ROOT)}"
                    )

    return checked, errors


def main() -> int:
    policy = load_policy()
    pages = governed_markdown(policy)
    if not pages:
        fatal("policy selected no governed Markdown pages")

    cache: dict[Path, set[str]] = {}
    errors: list[str] = []
    checked = 0
    for path in pages:
        page_checked, page_errors = validate_page(path, policy, cache)
        checked += page_checked
        errors.extend(page_errors)

    if errors:
        print(f"420Docs links FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(f"420Docs links PASS: {checked} internal link(s) checked across {len(pages)} governed pages")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

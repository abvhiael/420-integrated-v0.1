#!/usr/bin/env python3
"""Qualify the built 420Docs site for navigation, search and version publication safety."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
SITE = ROOT / "site"

AUDIENCE_SECTIONS = {
    "getting-started": "Get Started",
    "users": "Use",
    "developers": "Build",
    "operators": "Operate",
    "architecture": "Architecture",
    "reference": "Reference",
    "troubleshooting": "Troubleshooting",
}


def fail(message: str) -> None:
    print(f"420Docs qualification FAILED: {message}", file=sys.stderr)
    raise SystemExit(1)


def require_file(path: Path, description: str) -> None:
    if not path.is_file():
        fail(f"missing {description}: {path.relative_to(ROOT)}")


def normalized_location(value: str) -> str:
    value = value.split("#", 1)[0].lstrip("./")
    if value.endswith("index.html"):
        value = value[: -len("index.html")]
    return value.strip("/")


def qualify_version_publication() -> None:
    result = subprocess.run(
        [sys.executable, "scripts/validate-doc-versioning-ci.py", "--site-dir", "site"],
        cwd=ROOT,
        check=False,
    )
    if result.returncode != 0:
        fail("versioning publication-safety qualification failed")


def main() -> None:
    require_file(ROOT / "mkdocs.yml", "MkDocs configuration")
    require_file(DOCS / "index.md", "documentation landing page")
    require_file(SITE / "index.html", "built documentation landing page")

    mkdocs_text = (ROOT / "mkdocs.yml").read_text(encoding="utf-8")
    if "- search" not in mkdocs_text:
        fail("MkDocs search plugin is not enabled")

    for section in AUDIENCE_SECTIONS:
        require_file(DOCS / section / "index.md", f"{section} source entry page")
        require_file(SITE / section / "index.html", f"{section} built entry page")

    search_index_path = SITE / "search" / "search_index.json"
    require_file(search_index_path, "MkDocs search index")

    try:
        search_index = json.loads(search_index_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"search index is not valid JSON: {exc}")

    entries = search_index.get("docs")
    if not isinstance(entries, list) or not entries:
        fail("search index contains no document entries")

    indexed_locations = {
        normalized_location(str(entry.get("location", "")))
        for entry in entries
        if isinstance(entry, dict)
    }

    for section, label in AUDIENCE_SECTIONS.items():
        if not any(location == section or location.startswith(f"{section}/") for location in indexed_locations):
            fail(f"search index does not expose the {label} section ({section}/)")

    readme_path = ROOT / "README.md"
    require_file(readme_path, "repository README")
    readme = readme_path.read_text(encoding="utf-8")
    required_readme_markers = [
        "https://abvhiael.github.io/420-integrated-v0.1/",
        "docs/getting-started/",
        "docs/developers/",
        "docs/operators/",
        "docs/architecture/",
        "docs/reference/",
        "docs/troubleshooting/",
    ]
    missing_markers = [marker for marker in required_readme_markers if marker not in readme]
    if missing_markers:
        fail("README is missing documentation entry points: " + ", ".join(missing_markers))

    qualify_version_publication()

    print(
        "420Docs qualification PASS: strict build output, audience navigation, "
        "search indexing, repository discoverability and version publication safety are present."
    )


if __name__ == "__main__":
    main()

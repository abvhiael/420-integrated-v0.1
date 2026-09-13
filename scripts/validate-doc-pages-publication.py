#!/usr/bin/env python3
"""Validate the DOC-17 GitHub Pages publication contract."""
from __future__ import annotations
import sys
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "docs-pages.yml"


def main() -> int:
    errors: list[str] = []
    try:
        data = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"420Docs Pages publication FAILED: cannot read workflow: {exc}", file=sys.stderr)
        return 1
    jobs = data.get("jobs", {}) if isinstance(data, dict) else {}
    build = jobs.get("build", {}) if isinstance(jobs, dict) else {}
    deploy = jobs.get("deploy", {}) if isinstance(jobs, dict) else {}
    steps = build.get("steps", []) if isinstance(build, dict) else []
    runs = [s.get("run", "") for s in steps if isinstance(s, dict)]
    uses = [s.get("uses", "") for s in steps if isinstance(s, dict)]
    names = [s.get("name", "") for s in steps if isinstance(s, dict)]

    qualify_idx = next((i for i, s in enumerate(steps) if isinstance(s, dict) and s.get("run") == "python scripts/qualify-documentation.py"), None)
    upload_idx = next((i for i, s in enumerate(steps) if isinstance(s, dict) and str(s.get("uses", "")).startswith("actions/upload-pages-artifact@")), None)
    manifest_idx = next((i for i, s in enumerate(steps) if isinstance(s, dict) and s.get("name") == "Record publication commit"), None)
    if qualify_idx is None:
        errors.append("build must run unified scripts/qualify-documentation.py")
    if upload_idx is None:
        errors.append("build must upload a Pages artifact")
    if qualify_idx is not None and upload_idx is not None and qualify_idx > upload_idx:
        errors.append("unified qualification must run before artifact upload")
    if manifest_idx is None:
        errors.append("build must record publication commit identity")
    elif upload_idx is not None and manifest_idx > upload_idx:
        errors.append("publication commit identity must be recorded before artifact upload")
    if deploy.get("needs") != "build":
        errors.append("deploy must depend on successful build job")
    env = deploy.get("environment", {}) if isinstance(deploy, dict) else {}
    if not isinstance(env, dict) or env.get("name") != "github-pages":
        errors.append("deploy environment must be github-pages")
    perms = data.get("permissions", {}) if isinstance(data, dict) else {}
    for key, expected in {"contents":"read", "pages":"write", "id-token":"write"}.items():
        if not isinstance(perms, dict) or perms.get(key) != expected:
            errors.append(f"workflow permission {key} must be {expected}")
    concurrency = data.get("concurrency", {}) if isinstance(data, dict) else {}
    if not isinstance(concurrency, dict) or concurrency.get("group") != "pages" or concurrency.get("cancel-in-progress") is not False:
        errors.append("Pages concurrency must remain group=pages, cancel-in-progress=false")
    if errors:
        print(f"420Docs Pages publication FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for e in errors: print(f"- {e}", file=sys.stderr)
        return 1
    print("420Docs Pages publication PASS: unified qualification gates upload, commit identity is embedded, deploy depends on build, and Pages permissions/concurrency are safe")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

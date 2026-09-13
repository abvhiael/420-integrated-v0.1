#!/usr/bin/env python3
"""Validate DOC-13.9 rendered authority, navigation, triggers and Pages publication."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = ROOT / "docs" / "versioning" / "versioning-ci-policy.json"
OPTION_RE = re.compile(r'<option\s+value="([^"]+)"[^>]*data-route="([^"]+)"', re.IGNORECASE)
HREF_RE = re.compile(r'href=["\'](/versions/[^"\'#?]+)', re.IGNORECASE)


def load_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"420Docs versioning CI ERROR: cannot read {path}: {exc}", file=sys.stderr)
        raise SystemExit(1)
    if not isinstance(value, dict):
        print(f"420Docs versioning CI ERROR: {path} must contain an object", file=sys.stderr)
        raise SystemExit(1)
    return value


def expected_choices(registry: dict) -> dict[str, str]:
    choices: dict[str, str] = {}
    releases = registry.get("releases", {})
    for environment, track in sorted(registry.get("tracks", {}).items()):
        if not isinstance(track, dict) or track.get("environment") != environment:
            continue
        published = track.get("published", [])
        current = track.get("current")
        if isinstance(current, str) and current in published:
            choices[f"{environment}/current"] = f"/versions/{environment}/current/{{path}}"
        for release_id in published:
            release = releases.get(release_id)
            if isinstance(release, dict) and release.get("environment") == environment and bool(release.get("immutable", False)):
                choices[f"{environment}/{release_id}"] = f"/versions/{environment}/{release_id}/{{path}}"
    return choices


def registry_errors(registry: dict) -> list[str]:
    errors: list[str] = []
    aliases = registry.get("aliases", {})
    releases = registry.get("releases", {})
    for environment, track in sorted(registry.get("tracks", {}).items()):
        if not isinstance(track, dict):
            errors.append(f"track {environment} must be an object")
            continue
        published = track.get("published", [])
        current = track.get("current")
        if not isinstance(published, list):
            errors.append(f"track {environment} published must be a list")
            continue
        alias = f"{environment}/current"
        if current is None:
            if published:
                errors.append(f"track {environment} publishes releases without current")
            if alias in aliases:
                errors.append(f"unpublished track {environment} defines current alias")
        else:
            if current not in published:
                errors.append(f"track {environment} current release is not published")
            if aliases.get(alias) != current:
                errors.append(f"track {environment} current alias mismatch")
        for release_id in published:
            release = releases.get(release_id)
            if not isinstance(release, dict):
                errors.append(f"published release missing: {release_id}")
                continue
            if release.get("environment") != environment:
                errors.append(f"release environment mismatch: {environment}/{release_id}")
            manifest = release.get("manifest")
            if not isinstance(manifest, str) or not (ROOT / manifest).is_file():
                errors.append(f"release manifest missing: {environment}/{release_id}")
    return errors


def context_errors(site_dir: Path, choices: dict[str, str]) -> list[str]:
    errors: list[str] = []
    try:
        context = json.loads((site_dir / "version-context.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [f"rendered version context unavailable: {exc}"]
    if not isinstance(context, dict):
        return ["rendered version context must contain an object"]
    if context.get("cross_environment_fallback") is not False:
        errors.append("rendered context enables cross-environment fallback")
    if context.get("cross_release_fallback") is not False:
        errors.append("rendered context enables cross-release fallback")

    actual: dict[str, str] = {}
    for environment, track in sorted(context.get("tracks", {}).items()):
        if not isinstance(track, dict):
            continue
        if isinstance(track.get("current"), str) and isinstance(track.get("current_route"), str):
            actual[f"{environment}/current"] = track["current_route"]
        for release in track.get("releases", []):
            if isinstance(release, dict) and bool(release.get("immutable", False)):
                release_id = release.get("id")
                route = release.get("path_template")
                if isinstance(release_id, str) and isinstance(route, str):
                    actual[f"{environment}/{release_id}"] = route
    if actual != choices:
        missing = sorted(set(choices) - set(actual))
        extra = sorted(set(actual) - set(choices))
        mismatch = sorted(k for k in set(actual) & set(choices) if actual[k] != choices[k])
        if missing:
            errors.append("rendered context missing: " + ", ".join(missing))
        if extra:
            errors.append("rendered context advertises unpublished choices: " + ", ".join(extra))
        if mismatch:
            errors.append("rendered context route mismatch: " + ", ".join(mismatch))
    return errors


def html_errors(site_dir: Path, choices: dict[str, str]) -> tuple[list[str], int, int]:
    errors: list[str] = []
    pages = sorted(site_dir.rglob("*.html"))
    expected = set(choices)
    selector_pages = 0
    link_count = 0
    for page in pages:
        text = page.read_text(encoding="utf-8")
        options = dict(OPTION_RE.findall(text))
        if options:
            selector_pages += 1
            if set(options) != expected:
                errors.append(f"selector choices differ from registry on {page.relative_to(site_dir)}")
            for key, route in options.items():
                if choices.get(key) != route:
                    errors.append(f"selector route mismatch for {key} on {page.relative_to(site_dir)}")
        for href in HREF_RE.findall(text):
            link_count += 1
            parts = href.strip("/").split("/")
            if len(parts) < 3 or f"{parts[1]}/{parts[2]}" not in expected:
                errors.append(f"unpublished version-qualified link on {page.relative_to(site_dir)}: {href}")
    if not pages:
        errors.append("no rendered HTML pages found")
    elif selector_pages != len(pages):
        errors.append(f"version selector missing from {len(pages) - selector_pages} rendered page(s)")
    return errors, len(pages), link_count


def workflow_errors(policy: dict) -> list[str]:
    errors: list[str] = []
    workflow_policy = load_json(ROOT / "docs" / "ci" / "workflow-policy.json")
    pr = {str(v) for v in workflow_policy.get("required_pull_request_triggers", [])}
    push = {str(v) for v in workflow_policy.get("required_push_triggers", [])}
    stages = {str(v) for v in workflow_policy.get("required_runner_stages", [])}
    for validator in policy.get("required_versioning_validators", []):
        validator = str(validator)
        if validator not in pr:
            errors.append(f"missing PR trigger contract: {validator}")
        if validator not in push:
            errors.append(f"missing push trigger contract: {validator}")
    if "versioning-publication-safety" not in stages:
        errors.append("versioning-publication-safety missing from required runner stages")

    pages_path = ROOT / str(policy.get("pages_workflow", ""))
    try:
        workflow = yaml.load(pages_path.read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    except (OSError, yaml.YAMLError) as exc:
        return errors + [f"cannot read Pages workflow: {exc}"]
    jobs = workflow.get("jobs") if isinstance(workflow, dict) else None
    build = jobs.get("build") if isinstance(jobs, dict) else None
    steps = build.get("steps") if isinstance(build, dict) else None
    if not isinstance(steps, list):
        return errors + ["Pages build job must define steps"]
    command = str(policy.get("pages_qualification_command", ""))
    command_index = next((i for i, step in enumerate(steps) if isinstance(step, dict) and str(step.get("run", "")) == command), None)
    upload_index = next((i for i, step in enumerate(steps) if isinstance(step, dict) and str(step.get("uses", "")).startswith("actions/upload-pages-artifact@")), None)
    if command_index is None:
        errors.append(f"Pages workflow missing unified qualification command: {command}")
    if upload_index is None:
        errors.append("Pages workflow missing Pages artifact upload")
    if command_index is not None and upload_index is not None and command_index > upload_index:
        errors.append("Pages artifact is uploaded before unified qualification")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site-dir", default="site")
    args = parser.parse_args()
    site_dir = Path(args.site_dir)
    if not site_dir.is_absolute():
        site_dir = ROOT / site_dir

    policy = load_json(POLICY_PATH)
    registry = load_json(ROOT / str(policy.get("registry", "")))
    choices = expected_choices(registry)
    errors = registry_errors(registry)
    errors.extend(context_errors(site_dir, choices))
    rendered_errors, pages, links = html_errors(site_dir, choices)
    errors.extend(rendered_errors)
    errors.extend(workflow_errors(policy))

    if errors:
        print(f"420Docs versioning CI FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        "420Docs versioning CI PASS: "
        f"{len(choices)} authoritative choice(s); {pages} rendered page(s); "
        f"{links} version-qualified link(s); unified Pages gate enforced"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Validate 420Docs workflow integration and local/CI equivalence."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = ROOT / "docs" / "ci" / "workflow-policy.json"


def fail(message: str) -> None:
    print(f"420Docs workflow integration ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_policy() -> dict:
    try:
        value = json.loads(POLICY_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"cannot read docs/ci/workflow-policy.json: {exc}")
    if not isinstance(value, dict):
        fail("workflow policy must contain an object")
    return value


def load_workflow(path: Path) -> dict:
    try:
        value = yaml.load(path.read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    except (OSError, yaml.YAMLError) as exc:
        fail(f"cannot read {path.relative_to(ROOT).as_posix()}: {exc}")
    if not isinstance(value, dict):
        fail("documentation workflow must contain a mapping")
    return value


def as_list(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item) for item in value]
    return [str(value)]


def main() -> int:
    policy = load_policy()
    workflow_path = ROOT / str(policy.get("workflow", ""))
    runner_path = ROOT / str(policy.get("runner", ""))
    errors: list[str] = []

    if not workflow_path.is_file():
        errors.append(f"workflow missing: {workflow_path.relative_to(ROOT).as_posix()}")
    if not runner_path.is_file():
        errors.append(f"runner missing: {runner_path.relative_to(ROOT).as_posix()}")
    if errors:
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    workflow = load_workflow(workflow_path)
    events = workflow.get("on")
    if not isinstance(events, dict):
        errors.append("workflow 'on' section must be a mapping")
        events = {}

    pr = events.get("pull_request") if isinstance(events, dict) else None
    push = events.get("push") if isinstance(events, dict) else None
    pr_paths = set(as_list(pr.get("paths") if isinstance(pr, dict) else None))
    push_paths = set(as_list(push.get("paths") if isinstance(push, dict) else None))

    for path in policy.get("required_pull_request_triggers", []):
        if str(path) not in pr_paths:
            errors.append(f"pull_request path trigger missing: {path}")
    for path in policy.get("required_push_triggers", []):
        if str(path) not in push_paths:
            errors.append(f"push path trigger missing: {path}")

    push_branches = set(as_list(push.get("branches") if isinstance(push, dict) else None))
    required_branch = str(policy.get("required_push_branch", ""))
    if required_branch and required_branch not in push_branches:
        errors.append(f"push branch trigger missing: {required_branch}")

    concurrency = workflow.get("concurrency")
    required_concurrency = policy.get("required_concurrency", {})
    if not isinstance(concurrency, dict):
        errors.append("workflow concurrency must be configured")
    else:
        group = str(concurrency.get("group", ""))
        needle = str(required_concurrency.get("group_contains", ""))
        if needle and needle not in group:
            errors.append(f"concurrency group must contain: {needle}")
        expected_cancel = bool(required_concurrency.get("cancel_in_progress", False))
        actual_cancel = str(concurrency.get("cancel-in-progress", "")).lower() == "true"
        if actual_cancel != expected_cancel:
            errors.append(f"concurrency cancel-in-progress must be {str(expected_cancel).lower()}")

    jobs = workflow.get("jobs")
    qualify = jobs.get("qualify") if isinstance(jobs, dict) else None
    steps = qualify.get("steps") if isinstance(qualify, dict) else None
    if not isinstance(steps, list):
        errors.append("workflow qualify job must define steps")
        steps = []
    runs = [str(step.get("run")) for step in steps if isinstance(step, dict) and step.get("run") is not None]
    command = str(policy.get("ci_command", ""))
    if command and command not in runs:
        errors.append(f"CI command missing from qualify job: {command}")

    try:
        runner_text = runner_path.read_text(encoding="utf-8")
    except OSError as exc:
        fail(f"cannot read {runner_path.relative_to(ROOT).as_posix()}: {exc}")
    names = re.findall(r'Stage\("([^"]+)"', runner_text)
    expected_names = [str(item) for item in policy.get("required_runner_stages", [])]
    missing_stages = [name for name in expected_names if name not in names]
    if missing_stages:
        errors.extend(f"runner stage missing: {name}" for name in missing_stages)

    if errors:
        print(f"420Docs workflow integration FAILED: {len(errors)} defect(s)", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print(
        "420Docs workflow integration PASS: "
        f"{len(expected_names)} required runner stage(s); "
        f"{len(pr_paths)} PR path trigger(s); {len(push_paths)} push path trigger(s); "
        "local/CI command and superseded-run cancellation preserved"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

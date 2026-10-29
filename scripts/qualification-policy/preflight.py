#!/usr/bin/env python3
"""Repository-wide qualification preflight, using only Python stdlib.

The gate is intentionally fail-closed for a frozen candidate. GitHub branch
protection must require the resulting check to make merging impossible without it.
"""
import argparse
import fnmatch
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
CLASSES = {"implementation", "tests", "documentation", "evidence-only", "ci-infrastructure"}
LEVELS = {"L1", "L2", "L3"}
GLOBAL = ("contracts-foundry", "genesis", "integrated", "docs-qualify", "global-level3", "qualification.yml")
REQUIRED = ("step", "roadmap", "level", "base_sha", "candidate_sha",
            "classification", "scope", "tests", "required_workflows", "exit_criteria",
            "frozen_inputs", "external_gates")


def fail(reason):
    raise ValueError("qualification-preflight: " + reason)


def git(*args):
    p = subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True, check=False)
    if p.returncode:
        fail("git " + " ".join(args) + ": " + (p.stderr.strip() or str(p.returncode)))
    return p.stdout.strip()


def sha256_file(name):
    p = ROOT / name
    if not p.is_file():
        fail("missing frozen input: " + name)
    return hashlib.sha256(p.read_bytes()).hexdigest()


def safe_path(path):
    if not isinstance(path, str) or not path or path.startswith("/") or "\\" in path:
        fail("unsafe relative path")
    if ".." in Path(path).parts or Path(path).as_posix() != path:
        fail("unsafe relative path: " + str(path))
    return path


def check_manifest(data, changed, head, base, *, require_exact_head=True):
    if not isinstance(data, dict) or set(data) != set(REQUIRED):
        fail("manifest fields must match required contract exactly")
    if not isinstance(data["step"], str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{2,79}", data["step"]):
        fail("invalid canonical step")
    if not isinstance(data["roadmap"], str) or not (ROOT / safe_path(data["roadmap"])).is_file():
        fail("missing canonical roadmap")
    if data["level"] not in LEVELS:
        fail("invalid qualification level")
    if data["classification"] not in CLASSES:
        fail("invalid change classification")
    if not re.fullmatch(r"[0-9a-f]{40}", data["base_sha"]) or data["base_sha"] != base:
        fail("stale reconciliation base SHA")
    if not re.fullmatch(r"[0-9a-f]{40}", data["candidate_sha"]):
        fail("candidate must be full SHA")
    if require_exact_head and data["candidate_sha"] != head:
        fail("candidate does not match checked-out exact HEAD")
    if not isinstance(changed, list) or not changed:
        fail("no changes to audit")
    for key in ("scope", "tests", "required_workflows", "exit_criteria", "external_gates"):
        if not isinstance(data[key], list) or (key in ("scope", "tests", "exit_criteria") and not data[key]):
            fail("missing " + key)
    if len(set(data["scope"])) != len(data["scope"]) or set(changed) - set(data["scope"]):
        fail("unclassified changed paths: " + ", ".join(sorted(set(changed) - set(data["scope"]))))
    for path in data["scope"]:
        safe_path(path)
    for item in data["tests"]:
        if not isinstance(item, dict) or set(item) != {"command", "owner"} or not all(isinstance(x, str) and x for x in item.values()):
            fail("invalid test ownership")
    if not all(isinstance(x, str) and x for x in data["exit_criteria"]):
        fail("missing exit criteria")
    if not isinstance(data["frozen_inputs"], dict):
        fail("invalid frozen inputs")
    if data["level"] == "L3" and not data["frozen_inputs"]:
        fail("Level 3 requires frozen input inventory")
    for name, digest in data["frozen_inputs"].items():
        safe_path(name)
        if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
            fail("invalid SHA256 digest: " + name)
        if sha256_file(name) != digest:
            fail("stale SHA256 frozen input: " + name)
    if data["classification"] == "evidence-only" and any(
        x.startswith(("services/", "contracts/", "apps/", "packages/", "clients/", ".github/", "scripts/"))
        for x in changed
    ):
        fail("executable or workflow change disguised as evidence-only")
    if data["level"] != "L3" and any(any(g in str(w).lower() for g in GLOBAL) for w in data["required_workflows"]):
        fail("ordinary step schedules global qualification")
    for workflow in data["required_workflows"]:
        if not isinstance(workflow, str) or not workflow.startswith(".github/workflows/") or not (ROOT / safe_path(workflow)).is_file():
            fail("required workflow not registered: " + str(workflow))
    return {"step": data["step"], "level": data["level"], "candidate": head,
            "changed_count": len(changed), "frozen_inputs": len(data["frozen_inputs"]),
            "required_workflows": data["required_workflows"], "status": "PASS"}


def diff_names(base, head):
    raw = git("diff", "--name-only", "--diff-filter=ACDMRT", base + "..." + head)
    return [x for x in raw.splitlines() if x]


def audit_triggers(paths):
    """Flag newly changed workflow files with unscoped expensive PR triggering."""
    failures = []
    for name in paths:
        if not name.startswith(".github/workflows/") or not name.endswith((".yml", ".yaml")):
            continue
        p = ROOT / name
        if not p.exists():
            continue
        content = p.read_text()
        # The check is conservative: it detects PR triggers that have no path
        # filters, rather than claiming to model all YAML expressions.
        if re.search(r"(?m)^\s{0,2}pull_request\s*:", content):
            section = content.split("pull_request:", 1)[1].split("\n  workflow_dispatch:", 1)[0]
            if not re.search(r"(?m)^\s+paths(?:-ignore)?\s*:", section):
                failures.append(name + ": pull_request trigger missing paths filtering")
    if failures:
        fail("; ".join(failures))


def main():
    a = argparse.ArgumentParser()
    a.add_argument("--manifest", required=True)
    a.add_argument("--base", required=True)
    a.add_argument("--head", required=True)
    a.add_argument("--output")
    args = a.parse_args()
    base = git("rev-parse", args.base)
    head = git("rev-parse", args.head)
    if git("rev-parse", "HEAD") != head:
        fail("checked-out HEAD differs from target SHA")
    if not git("merge-base", "--is-ancestor", base, head) == "":
        # merge-base --is-ancestor exits nonzero for divergence (handled by git)
        pass
    changed = diff_names(base, head)
    audit_triggers(changed)
    manifest = json.loads((ROOT / safe_path(args.manifest)).read_text())
    certificate = check_manifest(manifest, changed, head, base)
    encoded = json.dumps(certificate, sort_keys=True, indent=2) + "\n"
    if args.output:
        (ROOT / args.output).write_text(encoded)
    print(encoded)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(exc, file=sys.stderr)
        sys.exit(1)

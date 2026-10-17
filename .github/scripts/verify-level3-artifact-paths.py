#!/usr/bin/env python3
"""Fast repository-wide changed-workflow artifact-path consistency gate.

Verifies simple literal evidence paths of workflow run steps that create an
artifact directory, write a SHA/file beneath it, and upload that directory.
Complex dynamic expressions cannot be reliably determined statically and
must be explicitly checked in phase preflight.
"""
import re
import subprocess
import sys
from pathlib import Path

def validate(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    problems = []
    created = set(re.findall(r"(?m)^\s*mkdir\s+-p\s+([A-Za-z0-9_.-]+-evidence)\s*$", text))
    writes = set(re.findall(r"(?m)^\s*git\s+rev-parse\s+HEAD\s*>\s*([A-Za-z0-9_.-]+-evidence)/[^\s#]+", text))
    if not created and not writes:
        return problems
    for directory in sorted(writes - created):
        problems.append(f"{path}: SHA written into {directory} but no matching mkdir -p")
    for directory in sorted(created - writes):
        problems.append(f"{path}: evidence directory {directory} created but SHA writes elsewhere")
    upload_paths = set(re.findall(r"(?m)^\s*path:\s*([A-Za-z0-9_.-]+-evidence)/\s*$", text))
    if "actions/upload-artifact@" in text:
        for directory in sorted(created - upload_paths):
            problems.append(f"{path}: evidence directory {directory} does not match an upload-artifact path")
    return problems

def main() -> int:
    if len(sys.argv) > 1:
        files = [Path(arg) for arg in sys.argv[1:]]
    else:
        files = list(Path(".github/workflows").glob("*.yml"))
    checked = 0
    errors = []
    for path in files:
        if path.exists() and path.suffix in (".yml", ".yaml"):
            checked += 1
            errors.extend(validate(path))
    for error in errors:
        print("FAIL:", error)
    print(f"Level 3 evidence output preflight: {checked} workflow files; {len(errors)} errors")
    return 1 if errors else 0

if __name__ == "__main__":
    raise SystemExit(main())

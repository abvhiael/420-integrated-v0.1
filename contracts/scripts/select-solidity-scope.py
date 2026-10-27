#!/usr/bin/env python3
"""Fail-closed scope selector. Mixed, shared-security and closeout changes require Level 3."""
import fnmatch
import json
import pathlib
import sys

def classify(paths, manifest):
    if not paths:
        return "full-level3"
    if any(p in manifest["closeout_markers"] for p in paths):
        return "full-level3"
    for name, item in manifest["scope"].items():
        allowed = item["paths"]
        required = item["required_change"]
        if all(any(fnmatch.fnmatchcase(p, pattern) for pattern in allowed) for p in paths) and any(
            any(fnmatch.fnmatchcase(p, pattern) for pattern in required) for p in paths
        ):
            return name
    return "full-level3"

def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: select-solidity-scope.py CHANGED_PATHS MAP_JSON")
    manifest = json.loads(pathlib.Path(sys.argv[2]).read_text())
    assert manifest["schema"] == "420.solidity.qualifications.v1"
    assert manifest["default"] == "full-level3"
    paths = [line.strip() for line in pathlib.Path(sys.argv[1]).read_text().splitlines() if line.strip()]
    result = classify(paths, manifest)
    print(result)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

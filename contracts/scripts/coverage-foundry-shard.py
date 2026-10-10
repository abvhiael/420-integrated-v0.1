#!/usr/bin/env python3
"""Instrument the already assigned canonical inventory, within runner memory."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys


def partition(inventory, targets, shard, count):
    if count < 1 or not 0 <= shard < count or not inventory:
        raise ValueError("Invalid coverage shard")
    if inventory != sorted(set(inventory)) or targets != inventory[shard::count]:
        raise ValueError("Coverage must reuse the exact canonical primary partition")
    for path in inventory:
        if not path.endswith(".sol") or not path.startswith(("src/", "test/", "script/")) or ".." in Path(path).parts:
            raise ValueError("Invalid primary source path")
    tests = [path for path in targets if path.startswith("test/")]
    if not tests:
        raise ValueError("Coverage shard has no assigned test sources")
    # Keep every production source emitted in each context. A test in one shard
    # can exercise a source primarily assigned to another; its runtime source map
    # must remain available for faithful union coverage. Only other shards' test
    # and script targets are omitted from output selection.
    selected = set(targets)
    return tests, [path for path in inventory if path not in selected and not path.startswith("src/")]


def main():
    root = Path("../artifacts/contracts")
    if sys.argv[1:] == ["--prepare-main-inventory"]:
        # The main job has already built/tested the full canonical inventory.
        # Prepare only its coverage partition; do not run another CI inventory.
        inventory = sorted(str(path) for directory in ("src", "test", "script")
                           for path in Path(directory).rglob("*.sol"))
        if not inventory:
            raise ValueError("Empty main inventory")
        root.mkdir(parents=True, exist_ok=True)
        for shard in range(4):
            (root / f"primary-inventory-shard-{shard}.txt").write_text("\n".join(inventory) + "\n")
            (root / f"shard-{shard}-targets.txt").write_text("\n".join(inventory[shard::4]) + "\n")
        return 0
    shard, count = map(int, sys.argv[1:])
    inventory = (root / f"primary-inventory-shard-{shard}.txt").read_text().splitlines()
    targets = (root / f"shard-{shard}-targets.txt").read_text().splitlines()
    tests, skip = partition(inventory, targets, shard, count)
    evidence = root / f"coverage-shard-{shard}"
    evidence.mkdir(parents=True, exist_ok=True)
    candidate = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    (evidence / "qualified-candidate.txt").write_text(candidate + "\n")
    (evidence / "foundry-version.txt").write_text(subprocess.check_output(["forge", "--version"], text=True))
    (evidence / "primary-targets.txt").write_text("\n".join(targets) + "\n")
    env = dict(os.environ, FOUNDRY_PROFILE="coverage", COVERAGE_EVIDENCE_DIR=str(evidence))
    command = ["forge", "coverage", "--use", "./scripts/coverage-solc.py", "--ir-minimum",
        "--match-path", "{" + ",".join(tests) + "}", "--report", "summary", "--report", "lcov",
        "--lcov-version", "1.0", "--report-file", str(evidence / "lcov.info")]
    # Primary ownership follows CI; all production dependencies retain source maps.
    # The test filter prevents duplicate test execution across coverage contexts.
    for path in skip:
        command.extend(["--skip", path])
    with (evidence / "coverage.log").open("w") as log:
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                   env=env, text=True, bufsize=1)
        for line in process.stdout:
            print(line, end="", flush=True)
            log.write(line)
        result = process.wait()
    if result:
        return result
    content = (evidence / "coverage.log").read_text()
    summaries = re.findall(r"(\d+) tests passed, (\d+) failed, (\d+) skipped", content)
    if not summaries or any(int(failed) or int(skipped) for _, failed, skipped in summaries):
        raise ValueError("Coverage execution must retain successful, non-skipped test summaries")
    if not (evidence / "lcov.info").stat().st_size:
        raise ValueError("Coverage report is empty")
    (evidence / "complete.json").write_text(json.dumps({"candidate_sha": candidate,
        "shard": shard, "count": count, "profile": "coverage", "result": "PASS",
        "primary_units": len(targets), "assigned_test_sources": len(tests),
        "test_summaries": summaries}, indent=2) + "\n")
    print(f"COVERAGE SHARD {shard}/{count} COMPLETE: assigned sources and tests passed")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"Coverage shard failed: {error}", file=sys.stderr)
        sys.exit(1)

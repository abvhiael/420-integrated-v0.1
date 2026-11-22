#!/usr/bin/env python3
"""Instrument the already assigned canonical inventory, within runner memory."""
import json
import os
from pathlib import Path
import re
import runpy
import subprocess
import sys

CONTEXTS_PER_SHARD = 16


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
    selected = set(targets)
    return tests, [path for path in inventory if path not in selected]


def context_partitions(inventory, targets, shard, count):
    partition(inventory, targets, shard, count)
    groups = []
    for segment in range(CONTEXTS_PER_SHARD):
        selected = targets[segment::CONTEXTS_PER_SHARD]
        partition(inventory, selected, shard + segment * count, count * CONTEXTS_PER_SHARD)
        groups.append(selected)
    return groups


def dependency_closure(cache, targets):
    closure = set(targets)
    pending = list(targets)
    while pending:
        path = pending.pop()
        if path not in cache:
            raise ValueError(f"Canonical compilation cache lacks source {path}")
        for dependency in cache[path]["imports"]:
            if dependency not in closure:
                closure.add(dependency)
                pending.append(dependency)
    return closure



def write_graph_snapshot(path, cache, targets, candidate, shard, count, profile):
    # Capture immediately after the complete assigned build. Later sparse
    # forge test/coverage commands may prune script or unrelated cache entries.
    dependency_closure(cache, targets)
    path.write_text(json.dumps({"candidate_sha": candidate, "shard": shard,
        "count": count, "profile": profile, "targets": targets, "files": cache},
        indent=2) + "\n")


def read_graph_snapshot(path, targets, candidate, shard, count):
    snapshot = json.loads(path.read_text())
    if (snapshot.get("candidate_sha") != candidate or snapshot.get("shard") != shard
            or snapshot.get("count") != count or snapshot.get("profile") != "ci"
            or snapshot.get("targets") != targets):
        raise ValueError("Wrong-SHA, profile or partition in canonical compilation graph")
    cache = snapshot["files"]
    dependency_closure(cache, targets)
    return cache


def run_context(inventory, targets, shard, count, evidence, candidate, cache):
    tests, _ = partition(inventory, targets, shard, count)
    closure = dependency_closure(cache, targets)
    # Sparse artifact handling must also retain imported contracts. Merely
    # requesting their output from Solc does not retain their Foundry artifacts.
    skip = [path for path in inventory if path not in closure]
    evidence.mkdir(parents=True, exist_ok=True)
    (evidence / "complete.json").unlink(missing_ok=True)
    (evidence / "lcov.info").unlink(missing_ok=True)
    (evidence / "qualified-candidate.txt").write_text(candidate + "\n")
    (evidence / "foundry-version.txt").write_text(subprocess.check_output(["forge", "--version"], text=True))
    (evidence / "primary-targets.txt").write_text("\n".join(targets) + "\n")
    (evidence / "dependency-context.txt").write_text("\n".join(sorted(closure)) + "\n")
    env = dict(os.environ, FOUNDRY_PROFILE="coverage", FOUNDRY_DYNAMIC_TEST_LINKING="false",
               COVERAGE_EVIDENCE_DIR=str(evidence))
    command = ["forge", "coverage", "--use", "./scripts/coverage-solc.py", "--ir-minimum",
        "--match-path", "{" + ",".join(tests) + "}", "--report", "summary", "--report", "lcov",
        "--lcov-version", "1.0", "--report-file", str(evidence / "lcov.info")]
    # Select bounded primaries; Foundry resolves their full dependency closure.
    # The bridge emits every dependency runtime map; test paths stay unique.
    for path in skip:
        command.extend(["--skip", path])
    with (evidence / "coverage.log").open("w") as log:
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                   env=env, text=True, bufsize=1)
        for line in process.stdout:
            print(line, end="", flush=True)
            log.write(line)
        result = process.wait()
    attempts_file = evidence / "compiler-attempts.json"
    if attempts_file.exists():
        print("COVERAGE COMPILER ATTEMPTS: " + json.dumps({
            "candidate_sha": candidate, "context": evidence.name,
            "attempts": json.loads(attempts_file.read_text())}), flush=True)
    if result:
        raise subprocess.CalledProcessError(result, command)
    content = (evidence / "coverage.log").read_text()
    summaries = re.findall(r"(\d+) tests passed, (\d+) failed, (\d+) skipped", content)
    if not summaries or any(int(failed) or int(skipped) for _, failed, skipped in summaries):
        raise ValueError("Coverage execution must retain successful, non-skipped test summaries")
    if not (evidence / "lcov.info").stat().st_size:
        raise ValueError("Coverage report is empty")
    complete = {"candidate_sha": candidate,
        "shard": shard, "count": count, "profile": "coverage", "result": "PASS",
        "primary_units": len(targets), "assigned_test_sources": len(tests),
        "test_summaries": summaries}
    (evidence / "complete.json").write_text(json.dumps(complete, indent=2) + "\n")
    return complete


def compiled_batch_path(root, shard):
    return root / f"compiled-cache-shard-{shard}.json"


def capture_compiled_batch(root, shard, count, segment, contexts, candidate, profile):
    """Combine actual Foundry cache records from bounded compilation batches."""
    inventory = (root / f"primary-inventory-shard-{shard}.txt").read_text().splitlines()
    targets = (root / f"shard-{shard}-targets.txt").read_text().splitlines()
    partition(inventory, targets, shard, count)
    if not (1 <= contexts <= len(targets) and 0 <= segment < contexts):
        raise ValueError("Invalid compilation batch")
    selected = targets[segment::contexts]
    live = json.loads(Path("cache/solidity-files-cache.json").read_text())["files"]
    if not isinstance(live, dict) or not all(p in live for p in selected):
        raise ValueError("Actual Foundry cache missing batch primary")
    for record in live.values():
        if not isinstance(record, dict) or not isinstance(record.get("imports"), list):
            raise ValueError("Malformed Foundry compilation graph")
    path = compiled_batch_path(root, shard)
    if segment == 0:
        evidence = {"candidate_sha": candidate, "profile": profile, "shard": shard,
                    "count": count, "contexts": contexts, "targets": targets,
                    "completed_segments": [], "files": {}}
    else:
        evidence = json.loads(path.read_text())
    if (evidence["candidate_sha"] != candidate or evidence["profile"] != profile
            or evidence["shard"] != shard or evidence["count"] != count
            or evidence["contexts"] != contexts or evidence["targets"] != targets
            or evidence["completed_segments"] != list(range(segment))):
        raise ValueError("Wrong candidate, partition, or missing compilation batch")
    union = evidence["files"]
    for path_name, record in live.items():
        if path_name in union and union[path_name]["imports"] != record["imports"]:
            raise ValueError("Conflicting compiled import graph: " + path_name)
        union[path_name] = record
    evidence["completed_segments"].append(segment)
    path.write_text(json.dumps(evidence, indent=2) + "\n")
    print(f"COMPILED BATCH {segment + 1}/{contexts}: {len(selected)} primaries; "
          f"{len(union)} actual compiler-cache records", flush=True)


def snapshot_compiled_batches(root, shard, count, candidate, profile):
    record = json.loads(compiled_batch_path(root, shard).read_text())
    inventory = (root / f"primary-inventory-shard-{shard}.txt").read_text().splitlines()
    targets = (root / f"shard-{shard}-targets.txt").read_text().splitlines()
    partition(inventory, targets, shard, count)
    if (record["candidate_sha"] != candidate or record["profile"] != profile
            or record["shard"] != shard or record["count"] != count
            or record["targets"] != targets
            or record["completed_segments"] != list(range(record["contexts"]))):
        raise ValueError("Incomplete, stale, or wrong-SHA compilation sequence")
    dependency_closure(record["files"], targets)
    write_graph_snapshot(root / f"compilation-graph-shard-{shard}.json",
                         record["files"], targets, candidate, shard, count, profile)


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
    if sys.argv[1:2] == ["--capture-compiled-batch"]:
        shard, count, segment, contexts = map(int, sys.argv[2:])
        sha = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
        capture_compiled_batch(root, shard, count, segment, contexts, sha,
                               os.environ.get("FOUNDRY_PROFILE", "default"))
        return 0
    if sys.argv[1:2] == ["--snapshot-canonical-graph"]:
        shard, count = map(int, sys.argv[2:])
        sha = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
        snapshot_compiled_batches(root, shard, count, sha,
                                  os.environ.get("FOUNDRY_PROFILE", "default"))
        return 0
    shard, count = map(int, sys.argv[1:])
    inventory = (root / f"primary-inventory-shard-{shard}.txt").read_text().splitlines()
    targets = (root / f"shard-{shard}-targets.txt").read_text().splitlines()
    tests, _ = partition(inventory, targets, shard, count)
    evidence = root / f"coverage-shard-{shard}"
    evidence.mkdir(parents=True, exist_ok=True)
    (evidence / "complete.json").unlink(missing_ok=True)
    (evidence / "lcov.info").unlink(missing_ok=True)
    candidate = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    (evidence / "qualified-candidate.txt").write_text(candidate + "\n")
    (evidence / "foundry-version.txt").write_text(subprocess.check_output(["forge", "--version"], text=True))
    (evidence / "primary-targets.txt").write_text("\n".join(targets) + "\n")
    cache = read_graph_snapshot(root / f"compilation-graph-shard-{shard}.json",
        targets, candidate, shard, count)
    contexts = []
    for segment, selected in enumerate(context_partitions(inventory, targets, shard, count)):
        contexts.append(run_context(inventory, selected,
            shard + segment * count, count * CONTEXTS_PER_SHARD, evidence / f"context-{segment}", candidate, cache))
    merge = runpy.run_path(str(Path(__file__).with_name("merge-coverage.py")))["merge_lcov"]
    content, source_records = merge([evidence / f"context-{segment}/lcov.info" for segment in range(CONTEXTS_PER_SHARD)])
    (evidence / "lcov.info").write_text(content)
    (evidence / "complete.json").write_text(json.dumps({"candidate_sha": candidate,
        "shard": shard, "count": count, "profile": "coverage", "result": "PASS",
        "primary_units": len(targets), "assigned_test_sources": len(tests),
        "source_records": source_records, "contexts": contexts,
        "test_summaries": [summary for context in contexts for summary in context["test_summaries"]]}, indent=2) + "\n")
    print(f"COVERAGE SHARD {shard}/{count} COMPLETE: all assigned sources and tests passed")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f"Coverage shard failed: {error}", file=sys.stderr)
        sys.exit(1)

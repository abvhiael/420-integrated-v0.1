#!/usr/bin/env python3
"""Require four exact-SHA partitions before merging diagnostic LCOV 1.0 data."""
import json
from pathlib import Path
import subprocess
import sys


def merge_lcov(paths):
    sources = {}
    for path in paths:
        current = None
        for line in path.read_text().splitlines():
            if line.startswith("SF:"):
                current = sources.setdefault(line[3:], {"fn": set(), "fnda": {}, "da": {}, "brda": {}})
            elif line == "end_of_record":
                current = None
            elif line.startswith("TN:") or line.startswith(("FNF:", "FNH:", "LF:", "LH:", "BRF:", "BRH:")):
                continue
            elif current is None:
                raise ValueError(f"Unexpected LCOV record: {line}")
            elif line.startswith("FN:"):
                current["fn"].add(line[3:])
            elif line.startswith("FNDA:"):
                value, name = line[5:].split(",", 1)
                current["fnda"][name] = current["fnda"].get(name, 0) + int(value)
            elif line.startswith("DA:"):
                number, value = line[3:].split(",")
                current["da"][int(number)] = current["da"].get(int(number), 0) + int(value)
            elif line.startswith("BRDA:"):
                number, block, branch, value = line[5:].split(",")
                key = (int(number), block, branch)
                old = current["brda"].get(key, "-")
                current["brda"][key] = old if value == "-" else (0 if old == "-" else old) + int(value)
            else:
                raise ValueError(f"Unsupported LCOV 1.0 record: {line}")
    if not sources:
        raise ValueError("No coverage source records")
    output = []
    for source, record in sorted(sources.items()):
        output.extend(["TN:", f"SF:{source}"])
        output.extend("FN:" + item for item in sorted(record["fn"]))
        output.extend(f"FNDA:{count},{name}" for name, count in sorted(record["fnda"].items()))
        output.extend([f"FNF:{len(record['fn'])}", f"FNH:{sum(value > 0 for value in record['fnda'].values())}"])
        output.extend(f"DA:{number},{count}" for number, count in sorted(record["da"].items()))
        output.extend([f"LF:{len(record['da'])}", f"LH:{sum(value > 0 for value in record['da'].values())}"])
        output.extend(f"BRDA:{number},{block},{branch},{count}" for (number, block, branch), count in sorted(record["brda"].items()))
        output.extend([f"BRF:{len(record['brda'])}", f"BRH:{sum(value != '-' and value > 0 for value in record['brda'].values())}", "end_of_record"])
    return "\n".join(output) + "\n", len(sources)


def main():
    directory, output = map(Path, sys.argv[1:])
    candidate = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    partitions, reports, details = [], [], []
    for shard in range(4):
        evidence = directory / f"coverage-shard-{shard}"
        complete = json.loads((evidence / "complete.json").read_text())
        if (complete.get("candidate_sha") != candidate or complete.get("shard") != shard
                or complete.get("count") != 4 or complete.get("profile") != "coverage"
                or complete.get("result") != "PASS"):
            raise ValueError(f"Unqualified or wrong-SHA coverage shard {shard}")
        targets = (evidence / "primary-targets.txt").read_text().splitlines()
        expected = (directory / f"shard-{shard}-targets.txt").read_text().splitlines()
        if targets != expected or len(targets) != complete["primary_units"]:
            raise ValueError(f"Coverage partition does not match canonical shard {shard}")
        contexts = complete.get("contexts", [])
        if len(contexts) != 16:
            raise ValueError(f"Missing bounded coverage contexts in shard {shard}")
        for segment, context in enumerate(contexts):
            actual = (evidence / f"context-{segment}/primary-targets.txt").read_text().splitlines()
            if (actual != targets[segment::16] or context.get("candidate_sha") != candidate
                    or context.get("shard") != shard + segment * 4 or context.get("count") != 64
                    or context.get("result") != "PASS" or context.get("primary_units") != len(actual)):
                raise ValueError(f"Unqualified bounded coverage context {shard}/{segment}")
        partitions.extend(targets)
        reports.append(evidence / "lcov.info")
        details.append(complete)
    if len(set(partitions)) != len(partitions):
        raise ValueError("Duplicated primary coverage assignments")
    expected = (directory / "primary-inventory-shard-0.txt").read_text().splitlines()
    if sorted(partitions) != expected:
        raise ValueError("Incomplete canonical coverage inventory")
    for shard in range(1, 4):
        if (directory / f"primary-inventory-shard-{shard}.txt").read_text().splitlines() != expected:
            raise ValueError("Canonical inventories disagree")
    content, source_records = merge_lcov(reports)
    output.mkdir(parents=True, exist_ok=True)
    (output / "lcov.info").write_text(content)
    (output / "complete.json").write_text(json.dumps({"candidate_sha": candidate,
        "result": "PASS", "canonical_primary_units": len(expected), "source_records": source_records,
        "source_mapping": "approximate optimized IR; diagnostic percentages only", "shards": details}, indent=2) + "\n")
    print(f"COVERAGE COMPLETE: four exact-SHA shards, {len(expected)} primary units, {source_records} diagnostic LCOV source records")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f"Coverage aggregation failed: {error}", file=sys.stderr)
        sys.exit(1)

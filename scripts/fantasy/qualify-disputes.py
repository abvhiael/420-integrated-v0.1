#!/usr/bin/env python3
"""Execute scoped Level 1 tests and bind raw evidence to a clean exact source SHA."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]


def git(*args):
    return subprocess.check_output(
        ["git", "-c", "safe.directory=" + ROOT.as_posix(), *args], cwd=ROOT, text=True
    ).strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--forge", default="forge")
    parser.add_argument("--solc", default="0.8.30")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    # Remove an earlier certificate before work, so a failed rerun cannot look green.
    certificate = output / "qualification.json"
    certificate.unlink(missing_ok=True)
    sha = git("rev-parse", "HEAD")
    if git("status", "--porcelain", "--untracked-files=no"):
        raise RuntimeError("tracked working tree must match the exact qualified SHA")
    test_path = ROOT / "contracts/test/fantasy/FantasyDisputeController420.t.sol"
    expected = set(re.findall(r"function\s+(test\w+)\s*\(", test_path.read_text()))
    if len(expected) < 59:
        raise RuntimeError("required dispute test inventory missing")
    source_paths = ["contracts/src/bet/fantasy/FantasyDisputeController420.sol",
                    "contracts/src/bet/fantasy/IFantasyDisputeHost420.sol",
                    "contracts/test/fantasy/FantasyDisputeController420.t.sol",
                    "scripts/fantasy/qualify-disputes.py"]
    for path in source_paths:
        git("ls-files", "--error-unmatch", path)
    env = dict(os.environ, FOUNDRY_PROFILE="pr", FOUNDRY_SRC="src/bet/fantasy",
               FOUNDRY_TEST="test/fantasy", FOUNDRY_OUT=str(output / "build"),
               FOUNDRY_CACHE_PATH=str(output / "cache"), FOUNDRY_FUZZ_RUNS="2500",
               FOUNDRY_VIA_IR="true")
    command = [args.forge, "test", "--no-dynamic-test-linking", "--use", args.solc, "--match-contract", "FantasyDisputeController420Test", "--json"]
    started = datetime.now(timezone.utc).isoformat()
    result = subprocess.run(command, cwd=ROOT / "contracts", env=env, capture_output=True)
    (output / "foundry.json").write_bytes(result.stdout)
    (output / "foundry.stderr.log").write_bytes(result.stderr)
    if result.returncode:
        raise RuntimeError("actual Foundry execution failed; inspect raw output")
    suites = json.loads(result.stdout.decode("utf-8-sig"))
    tests = {}
    for suite in suites.values():
        tests.update(suite["test_results"])
    if {name.split("(")[0] for name in tests} != expected:
        raise RuntimeError("actual executed tests differ from required inventory")
    if any(t["status"] != "Success" for t in tests.values()):
        raise RuntimeError("failed or skipped native test")
    fuzz = {name: t["kind"]["Fuzz"]["runs"] for name, t in tests.items() if "Fuzz" in t["kind"]}
    if len(fuzz) < 2 or any(runs < 2500 for runs in fuzz.values()):
        raise RuntimeError("required fuzz execution missing")
    artifact = json.loads((output / "build/FantasyDisputeController420.sol/FantasyDisputeController420.json").read_text())
    runtime = bytes.fromhex(artifact["deployedBytecode"]["object"].removeprefix("0x"))
    if not runtime or len(runtime) > 24576:
        raise RuntimeError("controller exceeds deployable runtime size")
    metadata = artifact["metadata"]
    if isinstance(metadata, str):
        metadata = json.loads(metadata)
    test_artifact = json.loads((output / "build/FantasyDisputeController420.t.sol/FantasyDisputeController420Test.json").read_text())
    test_metadata = test_artifact["metadata"]
    if isinstance(test_metadata, str):
        test_metadata = json.loads(test_metadata)
    graph = {}
    for path in sorted(set(metadata["sources"]) | set(test_metadata["sources"]) | set(source_paths)):
        relative = path if path.startswith(("contracts/", "scripts/")) else "contracts/" + path
        git("ls-files", "--error-unmatch", relative)
        graph[relative] = hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()
    if git("rev-parse", "HEAD") != sha or git("status", "--porcelain", "--untracked-files=no"):
        raise RuntimeError("source changed during qualification")
    report = {
        "level": 1, "scope": "fantasy dispute controller; contest boundary is a test harness",
        "qualifiedSHA": sha, "tree": git("rev-parse", "HEAD^{tree}"),
        "startedAt": started, "completedAt": datetime.now(timezone.utc).isoformat(),
        "command": command, "testCount": len(tests), "passed": len(tests), "skipped": 0,
        "fuzzRuns": fuzz, "runtimeBytes": len(runtime),
        "runtimeSHA256": hashlib.sha256(runtime).hexdigest(), "sourceSHA256": graph,
        "rawExecutionSHA256": hashlib.sha256(result.stdout).hexdigest(),
        "forgeVersion": subprocess.check_output([args.forge, "--version"], text=True).strip(),
        "compilerVersion": metadata["compiler"]["version"],
        "notQualified": ["production fantasy host and prize/entry escrow integration",
                         "licensed live NHL source adapters", "full fantasy Level 2", "live deployment"]
    }
    certificate.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("qualifiedSHA", "level", "testCount", "fuzzRuns", "runtimeBytes")}))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)

#!/usr/bin/env python3
"""Execute scoped Level 1/2 fantasy integration and bind all raw evidence to an exact SHA."""
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
MODULES = ["FantasyContestEngine420", "FantasyDisputeController420", "FantasySlateBook420",
           "FantasyNHLScoring420", "FantasyAdmission420", "FantasyRankingBook420", "FantasyPayoutPolicy420"]
OWNERS = {"FantasyContestEngine420Test": 72, "FantasyDisputeController420Test": 63, "FantasyRankingBook420Test": 3,
          "FantasySlatePublication420Test":6,"FantasyMixedGames420Test":1}


def git(*args):
    return subprocess.check_output(["git", "-c", "safe.directory=" + ROOT.as_posix(), *args], cwd=ROOT, text=True).strip()


def execute(command, cwd, env, stdout, stderr):
    result = subprocess.run(command, cwd=cwd, env=env, capture_output=True)
    stdout.write_bytes(result.stdout)
    stderr.write_bytes(result.stderr)
    if result.returncode:
        raise RuntimeError("actual execution failed: " + " ".join(map(str, command)))
    return result


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--forge", default="forge")
    p.add_argument("--solc", default="0.8.30")
    p.add_argument("--node", default="node")
    p.add_argument("--output", required=True)
    args = p.parse_args()
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    certificate = output / "qualification.json"
    certificate.unlink(missing_ok=True)
    sha = git("rev-parse", "HEAD")
    if git("status", "--porcelain", "--untracked-files=no"):
        raise RuntimeError("tracked working tree must exactly match qualification SHA")
    tracked = git("ls-files", "contracts/src/bet/fantasy", "contracts/test/fantasy", "clients/420bet-fantasy", "scripts/fantasy").splitlines()
    if not all(git("ls-files", "--error-unmatch", "contracts/src/bet/fantasy/" + module + ".sol") for module in MODULES):
        raise RuntimeError("untracked implementation")
    expected = {}
    for owner, minimum in OWNERS.items():
        path = ROOT / "contracts/test/fantasy" / (owner.removesuffix("Test") + ".t.sol")
        names = set(re.findall(r"function\s+(test\w+)\s*\(", path.read_text()))
        if len(names) < minimum:
            raise RuntimeError("required native inventory missing: " + owner)
        expected[owner] = names
    env = dict(os.environ, FOUNDRY_PROFILE="pr", FOUNDRY_SRC="src/bet/fantasy", FOUNDRY_TEST="test/fantasy",
               FOUNDRY_OUT=str(output / "build"), FOUNDRY_CACHE_PATH=str(output / "cache"),
               FOUNDRY_FUZZ_RUNS="2500", FOUNDRY_VIA_IR="true", NO_COLOR="1")
    started = datetime.now(timezone.utc).isoformat()
    command = [args.forge, "test", "--no-dynamic-test-linking", "--use", args.solc]
    result = execute(command + ["--json"], ROOT / "contracts", env, output / "foundry.json", output / "foundry.stderr.log")
    suites = json.loads(result.stdout.decode("utf-8-sig"))
    counts = {}
    fuzz = {}
    for suite_name, suite in suites.items():
        owner = suite_name.split(":")[-1]
        if owner not in expected:
            raise RuntimeError("unexpected qualification owner: " + owner)
        tests = suite["test_results"]
        if {name.split("(")[0] for name in tests} != expected[owner] or any(t["status"] != "Success" for t in tests.values()):
            raise RuntimeError("missing, failed or skipped actual test: " + owner)
        counts[owner] = len(tests)
        for name, test in tests.items():
            if "Fuzz" in test["kind"]:
                fuzz[owner + ":" + name] = test["kind"]["Fuzz"]["runs"]
    if set(counts) != set(OWNERS) or len(fuzz) < 5 or any(runs < 2500 for runs in fuzz.values()):
        raise RuntimeError("incomplete actual native/fuzz execution")
    execute([sys.executable, "-m", "unittest", "discover", "-s", "clients/420bet-fantasy", "-p", "test_nhl.py", "-v"],
            ROOT, env, output / "client.stdout.log", output / "client.stderr.log")
    client_log = (output / "client.stderr.log").read_text()
    client_count = int(re.search(r"Ran (\d+) tests", client_log)[1])
    if client_count < 18 or "\nOK\n" not in client_log:
        raise RuntimeError("missing independent client execution")
    execute([args.node,"--test","--test-reporter=tap","clients/420bet-fantasy/slate-time.test.mjs"], ROOT, env,
            output / "timezone.stdout.log", output / "timezone.stderr.log")
    timezone_log = (output / "timezone.stdout.log").read_text()
    timezone_count = int(re.search(r"# tests (\d+)",timezone_log)[1])
    if timezone_count < 6 or not re.search(r"# fail 0\b",timezone_log):
        raise RuntimeError("missing exact timezone/DST execution")
    execute(command + ["--match-contract", "FantasyContestEngine420Test", "--match-test", "testThreeEntrantsTiedSecondShareOccupiedRankPrizes", "-vvvv"],
            ROOT / "contracts", env, output / "legitimate-trace.log", output / "trace.stderr.log")
    execute([sys.executable, str(ROOT / "scripts/fantasy/replay-contest.py"), str(output / "legitimate-trace.log"), str(output / "independent-replay.json")],
            ROOT, env, output / "replay.stdout.log", output / "replay.stderr.log")
    execute([sys.executable, str(ROOT / "scripts/fantasy/test-replay-tampering.py"), str(output / "legitimate-trace.log"), str(output / "replay-tampering.json")],
            ROOT, env, output / "tampering.stdout.log", output / "tampering.stderr.log")
    replay = json.loads((output / "independent-replay.json").read_text())
    tampering = json.loads((output / "replay-tampering.json").read_text())
    if tampering["rejectedCount"] < 10 or replay["statMerkleProofsVerified"] != 21 or replay["receiptSignaturesVerified"] != 3:
        raise RuntimeError("incomplete independent verification")
    sys.path.insert(0, str(ROOT / "clients/420bet-fantasy"))
    from nhl import k256
    trace = (output / "legitimate-trace.log").read_text(encoding="utf-8-sig")
    deployed = {}
    for line in trace.splitlines():
        if "emit ModuleIdentity(" not in line:
            continue
        hashes = re.findall(r"0x[0-9a-fA-F]{64}\b", line)
        address = re.search(r"0x[0-9a-fA-F]{40}\b", line)[0]
        deployed[hashes[0][2:].lower()] = {"address": address, "runtimeCodeHash": hashes[1],
                                         "runtimeBytes": int(re.search(r"runtimeBytes: (\d+)", line)[1])}
    module_evidence = {}
    external_module_evidence={"DevelopmentCompensationVault420":deployed[k256(b"DevelopmentCompensationVault420").hex()]}
    graph = set(tracked)
    compiler = None
    for module in MODULES:
        artifact = json.loads((output / "build" / (module + ".sol") / (module + ".json")).read_text())
        metadata = artifact["metadata"]
        if isinstance(metadata, str):
            metadata = json.loads(metadata)
        compiler = metadata["compiler"]["version"]
        graph.update("contracts/" + path for path in metadata["sources"])
        runtime = bytes.fromhex(artifact["deployedBytecode"]["object"].removeprefix("0x"))
        initcode = bytes.fromhex(artifact["bytecode"]["object"].removeprefix("0x"))
        identity = deployed[k256(module.encode()).hex()]
        if not runtime or len(runtime) > 24576 or len(initcode) > 49152 or identity["runtimeBytes"] != len(runtime):
            raise RuntimeError("invalid/deployment-size evidence: " + module)
        module_evidence[module] = dict(identity, initcodeBytes=len(initcode),
                                       compiledRuntimeTemplateSHA256=hashlib.sha256(runtime).hexdigest())
    for owner in OWNERS:
        metadata = json.loads((output / "build" / (owner.removesuffix("Test") + ".t.sol") / (owner + ".json")).read_text())["metadata"]
        if isinstance(metadata, str):
            metadata = json.loads(metadata)
        graph.update("contracts/" + path for path in metadata["sources"])
    sources = {}
    for path in sorted(graph):
        git("ls-files", "--error-unmatch", path)
        sources[path] = hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
    if git("rev-parse", "HEAD") != sha or git("status", "--porcelain", "--untracked-files=no"):
        raise RuntimeError("source changed during execution")
    report = {"qualifiedSHA": sha, "tree": git("rev-parse", "HEAD^{tree}"), "scope": "daily NHL contest-engine integration",
              "levels": [1, 2], "dataClassification": "deterministic NHL-shaped fixtures; no licensed/live source evidence claimed",
              "startedAt": started, "completedAt": datetime.now(timezone.utc).isoformat(), "nativeOwners": counts,
              "nativePassed": sum(counts.values()), "nativeSkipped": 0, "fuzzRuns": fuzz, "clientTestsPassed": client_count+timezone_count,
              "pythonClientPassed":client_count,"timezonePassed":timezone_count,
              "independentReplay": replay, "tampering": tampering, "deployedModules": module_evidence,
              "canonicalExternalModules":external_module_evidence,
              "sourceSHA256": sources, "compilerVersion": compiler,
              "forgeVersion": subprocess.check_output([args.forge, "--version"], text=True).strip(),
              "rawEvidenceSHA256": {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in output.iterdir() if path.is_file()},
              "notQualified": ["licensed live NHL adapters and source-control independence", "custodian production operations",
                               "official testnet deployment and independent production acceptance", "other fantasy formats", "app Level 3"]}
    certificate.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("qualifiedSHA", "levels", "nativePassed", "clientTestsPassed")}))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)

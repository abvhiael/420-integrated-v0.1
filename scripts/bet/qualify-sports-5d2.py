"""Reproducible native registry integration, fuzz, replay, bytecode and static qualification."""
import argparse
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = "850817a3a60c1dc56dfa8d1297a33925ebf14c3a"
SCOPE = ["contracts/src/bet/sports", "contracts/test/sports-5d2", "scripts/bet/qualify-sports-5d2.py",
         "scripts/bet/replay-sports-5d2.py", "docs/bet/BET-AUDIT-5D.1-SPORTSBOOK-ARCHITECTURE.md",
         "docs/bet/BET-AUDIT-5D.2-EVENTS-LEAGUES-MARKET-REGISTRY.md", "docs/bet/SPORTS-5D.2-CATALOG.json",
         ".github/workflows/420bet-sports-5d2-level2.yml", "docs/420BET-TESTNET-WORK-ROADMAP.md"]


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(cmd, cwd, env, out, name, allow_findings=False):
    print("Executing " + name, flush=True)
    r = subprocess.run(list(map(str, cmd)), cwd=cwd, env=env, capture_output=True)
    (out / (name + ".stdout.log")).write_bytes(r.stdout)
    (out / (name + ".stderr.log")).write_bytes(r.stderr)
    if r.returncode and not allow_findings:
        raise RuntimeError(name + " failed; inspect retained logs")
    return r


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--forge", default="forge")
    p.add_argument("--solc", default="0.8.30")
    p.add_argument("--analyzer-solc", default="solc")
    p.add_argument("--output", required=True)
    a = p.parse_args()
    out = Path(a.output).resolve()
    out.mkdir(parents=True, exist_ok=True)
    if any(out.iterdir()):
        raise RuntimeError("fresh evidence directory required")
    if git("status", "--porcelain", "--", *SCOPE):
        raise RuntimeError("qualification requires committed, clean scope")
    commit = git("rev-parse", "HEAD")
    subprocess.check_call(["git", "merge-base", "--is-ancestor", BASE, commit], cwd=ROOT)
    changed = git("diff", "--name-only", BASE, commit).splitlines()
    if any(not any(f == s or f.startswith(s + "/") for s in SCOPE) for f in changed):
        raise RuntimeError("unrelated source modifications")
    paths = git("ls-files", "--", *SCOPE).splitlines()
    sources = {f:sha(ROOT/f) for f in paths}
    env = dict(os.environ, FOUNDRY_SRC="src/bet/sports", FOUNDRY_TEST="test/sports-5d2",
               FOUNDRY_SCRIPT="script/__empty__", FOUNDRY_OUT=str(out/"build"), FOUNDRY_CACHE_PATH=str(out/"cache"),
               FOUNDRY_FUZZ_RUNS="2500", FOUNDRY_VIA_IR="true", FOUNDRY_OPTIMIZER="true", FOUNDRY_OPTIMIZER_RUNS="200",
               NO_COLOR="1", PYTHONUTF8="1")
    native = run([a.forge,"test","--no-dynamic-test-linking","--use",a.solc,"--json","-vv"],ROOT/"contracts",env,out,"native")
    suites = json.loads(native.stdout.decode("utf-8-sig"))
    tests = {n:t for s in suites.values() for n,t in s["test_results"].items()}
    inventory = set(re.findall(r"function\s+(test\w+)\s*\(", (ROOT/"contracts/test/sports-5d2/SportsRegistry420.t.sol").read_text()))
    if {n.split("(")[0] for n in tests} != inventory or len(tests) < 54 or any(t["status"] != "Success" for t in tests.values()):
        raise RuntimeError("native inventory missing or failing")
    fuzz = {n:t["kind"]["Fuzz"]["runs"] for n,t in tests.items() if "Fuzz" in t["kind"]}
    if len(fuzz) != 5 or min(fuzz.values()) < 2500:
        raise RuntimeError("incomplete fuzz execution")
    catalog = json.loads((ROOT/"docs/bet/SPORTS-5D.2-CATALOG.json").read_text())
    expected_tests = {"testCatalog"+c["testSuffix"]+"()" for c in catalog["competitions"]}
    if len(expected_tests) != 15 or not expected_tests.issubset(tests):
        raise RuntimeError("competition coverage incomplete")
    # Independent replay consumes emitted EVM observations, not a hand-authored success file.
    spec = importlib.util.spec_from_file_location("replay", ROOT/"scripts/bet/replay-sports-5d2.py")
    replay = importlib.util.module_from_spec(spec); spec.loader.exec_module(replay)
    replay_result = replay.verify(out/"native.stdout.log")
    (out/"replay.json").write_text(json.dumps(replay_result,indent=2)+"\n")
    # Verify the replay checker also rejects missing, duplicate and tampered observations.
    replay_negatives = 0
    for mode in ("missing", "duplicate", "tampered"):
        altered = json.loads(native.stdout.decode("utf-8-sig"))
        target = next(s["test_results"]["testNativeReplayExport()"] for s in altered.values() if "testNativeReplayExport()" in s["test_results"])
        logs = target["logs"]
        candidates = [i for i,l in enumerate(logs) if len(l.get("topics", [])) == 2 and len(str(l.get("data", "")).removeprefix("0x")) == 320]
        if not candidates:
            raise RuntimeError("native ABI checkpoints absent")
        i = candidates[0]
        if mode == "missing": logs.pop(i)
        elif mode == "duplicate": logs.append(logs[i])
        else:
            raw = logs[i]["data"].removeprefix("0x"); logs[i]["data"] = "0x" + "0"*64 + raw[64:]
        mutant = out/("replay-negative-"+mode+".json"); mutant.write_text(json.dumps(altered))
        try: replay.verify(mutant)
        except ValueError: replay_negatives += 1
        else: raise RuntimeError("replay accepted " + mode)
    closure = {}
    identities = {}
    for f in sorted((out/"build").rglob("*.json")):
        artifact = json.loads(f.read_text())
        if "abi" not in artifact or not f.name.startswith("Sports") or f.name.endswith("Test.json"):
            continue
        runtime = artifact.get("deployedBytecode",{}).get("object","").removeprefix("0x")
        creation = artifact.get("bytecode",{}).get("object","").removeprefix("0x")
        if len(runtime)//2 > 24576 or len(creation)//2 > 49152:
            raise RuntimeError("non-deployable contract " + f.name)
        if any(x.get("stateMutability") == "payable" for x in artifact["abi"]):
            raise RuntimeError("unexpected custody surface " + f.name)
        identities[f.name] = {"runtimeBytes":len(runtime)//2,"creationBytes":len(creation)//2,"artifactSHA256":sha(f)}
        metadata = artifact.get("metadata", {})
        if isinstance(metadata,str): metadata=json.loads(metadata)
        for source in metadata.get("sources",{}):
            closure[source] = sha(ROOT/"contracts"/source)
    if not all(n+".json" in identities for n in ("SportsCompetitionRegistry420","SportsEventRegistry420","SportsMarketRegistry420")):
        raise RuntimeError("missing compiled registry")
    (out/"compiled-identities.json").write_text(json.dumps(identities,indent=2)+"\n")
    staticenv = dict(env)
    if os.name == "nt": staticenv.setdefault("VIRTUAL_ENV",str(out/"analyzer-state"))
    run([sys.executable,"-m","slither","contracts/src/bet/sports/SportsMarketRegistry420.sol",
         "--compile-force-framework","solc","--solc",a.analyzer_solc,"--solc-args",
         "--optimize --optimize-runs 200 --via-ir --evm-version cancun","--json",str(out/"static.json")],ROOT,staticenv,out,"static",True)
    static = json.loads((out/"static.json").read_text())
    if not static.get("success") or any(f["impact"] in ("High","Medium") for f in static["results"]["detectors"]):
        raise RuntimeError("failed analyzer or unresolved High/Medium finding")
    if git("rev-parse","HEAD") != commit or git("status","--porcelain","--",*SCOPE) or any(sha(ROOT/f)!=h for f,h in sources.items()) or any(sha(ROOT/"contracts"/f)!=h for f,h in closure.items()):
        raise RuntimeError("source drift during execution")
    report = dict(schema="420bet-sports-registry-5d2-v1", qualifiedSHA=commit, baseSHA=BASE,
                  tree=git("rev-parse","HEAD^{tree}"), localRegistryLevel1=True, localRegistryIntegrationLevel2=True,
                  nativeTests=len(tests), fuzzRuns=fuzz, competitions=15, marketScenarios=45,
                  independentReplay=replay_result, replayNegativeChecks=replay_negatives,
                  staticHighMedium=0, staticFindings=[{"check":f["check"],"impact":f["impact"]} for f in static["results"]["detectors"]],
                  sourceSHA256=sources, compiledClosureSHA256=closure,
                  liveSourcesQualified=False, officialDeploymentAccepted=False, wageringImplemented=False, productionApproved=False,
                  completedAt=datetime.now(timezone.utc).isoformat())
    report["evidenceSHA256"] = {f.relative_to(out).as_posix():sha(f) for f in out.rglob("*") if f.is_file() and not any(x in f.relative_to(out).parts for x in ("build","cache","analyzer-state"))}
    (out/"qualification.json").write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps({k:report[k] for k in ("qualifiedSHA","nativeTests","competitions","marketScenarios","localRegistryIntegrationLevel2","productionApproved")}),flush=True)


if __name__ == "__main__": main()

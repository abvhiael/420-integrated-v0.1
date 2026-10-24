#!/usr/bin/env python3
"""Issue Level 2 evidence only from matching actual execution reports."""
import hashlib
import json
import os
import subprocess
from pathlib import Path

sha = os.environ["EXPECTED_SHA"]
assert subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip() == sha
paths = [Path("artifacts/ws8-crypto/execution.json"), Path("artifacts/ws8-funded/execution.json"), Path("artifacts/ws8-funded/independent-outcome.json"), Path("artifacts/poker-5a5/execution.json")]
crypto, funded, replay, betting = [json.loads(p.read_text(encoding="utf-8")) for p in paths]
assert all(r["qualifiedSHA"] == sha and r["trackedWorkingTreeDirty"] is False for r in [crypto, funded, replay, betting])
assert len(betting['mandatoryTests']) == 30 and set(betting['mandatoryTests'].values()) == {'Success'}
assert betting['independentTestsPassed'] >= 23
runtime = json.loads(Path('artifacts/poker-5a5/runtime-size.json').read_text(encoding='utf-8'))
assert runtime['sourceCommit'] == sha
assert crypto["genuineProofsVerified"] == 41
assert len(funded["mandatoryTests"]) == 11 and set(funded["mandatoryTests"].values()) == {"Success"}
assert funded["totalPassed"] >= 15
assert len(replay["statements"]) == 41 and replay["balances"] == [399, 399] and replay["fee"] == 2
assert sum(replay["balances"]) + replay["fee"] == 800
out = Path("artifacts/ws8-certificate");out.mkdir(parents=True, exist_ok=True)
report = {"level": 2, "qualifiedSHA": sha, "acceptance": "passed", "genuineProofsVerified": 41,
    "betting5A5Tests": betting['mandatoryTests'], "freshNativeOwners": betting['nativeOwners'],
    "scope": "Level 2 local rules and cryptographic integration; not Level 3 or live deployment acceptance",
    "liveDeploymentReady": runtime['liveDeploymentReady'], "compiledRuntimeSizes": runtime['contracts'],
    "mandatoryTests": funded["mandatoryTests"], "scopedTestsPassed": funded["totalPassed"],
    "handId": replay["handId"], "terminalTranscript": replay["terminalTranscript"],
    "runURL": f"https://github.com/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{os.environ['GITHUB_RUN_ID']}",
    "executionReportSHA256": {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}}
(out / "level2.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, indent=2))

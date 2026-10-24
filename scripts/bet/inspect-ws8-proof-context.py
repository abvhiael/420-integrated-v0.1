#!/usr/bin/env python3
"""WS8 step 2: compare actual funded-hand Groth16 scope to inherited WS2/WS3 context.
A mismatch is a mandatory proving task, NEVER permission to modify verifier inputs.
"""
import json
import re
import sys
from pathlib import Path

FR=21888242871839275222246405745257275088548364400416034343698204186575808495617
if len(sys.argv)!=3:
    raise SystemExit("usage: inspect-ws8-proof-context.py <forge-log> <report.json>")
raw=Path(sys.argv[1]).read_text()
match=re.search(r"WS8ProverHandScope\([^\n]*?scope:\s*(\d+)",raw)
if not match:
    raise SystemExit("FAIL: missing contract-derived WS8ProverHandScope event")
scope=int(match.group(1))
if not 0<scope<FR:
    raise SystemExit("FAIL: invalid exported BN254 scope")
report={
    "contractDerivedHandScope":str(scope),
    "previousProofScope":"420",
    "scopeCompatibleWithPreviouslyQualifiedWS2WS3":scope==420,
    "action":"reuse existing scope-bound proofs" if scope==420 else
        "generate new legitimate proofs for this exact hand context with existing circuit and qualified VK; reuse only source-identical proving setup",
    "qualification":"NOT A PROOF VERIFICATION OR WS8 LEVEL 2 ACCEPTANCE"
}
Path(sys.argv[2]).parent.mkdir(parents=True,exist_ok=True)
Path(sys.argv[2]).write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(report,indent=2))

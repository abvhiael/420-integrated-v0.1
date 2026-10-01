#!/usr/bin/env python3
import json, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
CFG=ROOT/"contracts/config/compute-market/cmp-1.4.4-signed-verdict-provenance.json"
ROADMAP=ROOT/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
DOC=ROOT/"docs/compute-market/CMP-1.4.4-SIGNED-VERDICTS-AND-DECISION-PROVENANCE.md"
SRC=ROOT/"contracts/src/compute/ComputeJobIndependentVerification420.sol"
STRICT=ROOT/"contracts/src/compute/ComputeJobMatchedWorkerEvidence420.sol"
SNAP=ROOT/"contracts/src/compute/ComputeJobWorkerSnapshotEvidence420.sol"
def fail(m): print("CMP-1.4.4 verification failed: "+m,file=sys.stderr); raise SystemExit(1)
d=json.loads(CFG.read_text())
if d.get("step")!="CMP-1.4.4": fail("wrong step")
if d.get("canonical_requirement")!="Bind every verdict to chain, contract, job, unit, attempt, worker, result, verifier, policy, evidence, nonce and expiry.": fail("canonical requirement drift")
if "### CMP-1.4.4 — Signed verdicts and decision provenance" not in ROADMAP.read_text(): fail("roadmap definition missing")
for p in [DOC,SRC,STRICT,SNAP]:
    if not p.is_file(): fail("missing "+str(p.relative_to(ROOT)))
s=SRC.read_text()
for token in ["DecisionProvenance","PROVENANCE_TYPEHASH","provenanceHash","decisionProvenance","verdictContext","policyRevision","policyCommitment","evidenceCommitment"]:
    if token not in s: fail("missing signed provenance token "+token)
if "block.chainid" not in s or "address(this)" not in s: fail("chain/contract domain binding missing")
if "usedNonce" not in s or "v.expiry" not in s: fail("nonce/expiry binding missing")
for w in [STRICT.read_text(),SNAP.read_text()]:
    if "function verdictContext" not in w: fail("worker verdict context missing")
if d.get("no_fixed_genesis_predeploy") is not True or d.get("live_deployment") is not False: fail("deployment boundary drift")
print("CMP-1.4.4 signed verdict provenance: repository implementation ready for qualification")

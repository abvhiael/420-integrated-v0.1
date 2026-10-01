#!/usr/bin/env python3
import json, pathlib, subprocess, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
CFG=ROOT/"contracts/config/compute-market/cmp-1.4.12-phase-closeout.json"
DOC=ROOT/"docs/compute-market/CMP-1.4.12-VERIFIER-REGISTRY-PHASE-CLOSEOUT.md"
ROADMAP=ROOT/"docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
RELEASE=ROOT/"contracts/config/compute-market/cmp-1.4.11-verifier-release-candidate.json"
def fail(m): print("CMP-1.4.12 closeout verification failed: "+m,file=sys.stderr); raise SystemExit(1)
d=json.loads(CFG.read_text())
if d.get("step")!="CMP-1.4.12" or d.get("canonical_definition")!="Phase closeout": fail("step/definition drift")
if d.get("status") not in {"QUALIFICATION_PENDING","COMPLETE_REPOSITORY_QUALIFIED"}: fail("invalid closeout status")
if d.get("repository_closeout_candidate") is not True or d.get("live_deployment_qualified") is not False: fail("repository/live classification drift")
expected=[f"CMP-1.4.{i}" for i in range(13)]
if d.get("phase_steps")!=expected: fail("phase step inventory is not exactly CMP-1.4.0 through CMP-1.4.12")
r=ROADMAP.read_text()
if "### CMP-1.4.12 — Phase closeout" not in r: fail("canonical closeout step missing")
if "### CMP-1.5.0 — Stake architecture" not in r: fail("next canonical step missing")
for rel in d.get("phase_evidence",[]):
    if not (ROOT/rel).is_file(): fail("missing phase evidence "+rel)
if not DOC.is_file(): fail("missing closeout document")
rel=json.loads(RELEASE.read_text())
deps=rel.get("dependency_reconciliation",{}); gates=rel.get("release_gates",{})
if deps.get("cmp_1_4_4_signed_verdict_provenance_complete") is not True: fail("CMP-1.4.4 remains incomplete")
if deps.get("cmp_1_4_4_internal_release_blocker") is not False: fail("CMP-1.4.4 blocker remains open")
if gates.get("cmp_1_4_4_signed_verdict_provenance") is not True: fail("CMP-1.4.4 release gate remains closed")
if rel.get("repository_ready") is not True or rel.get("live_qualified") is not False: fail("release candidate repository/live state invalid")
if deps.get("no_fixed_genesis_predeploy_allocated") is not True: fail("fixed Genesis predeploy introduced")
if rel.get("protocol_registry",{}).get("address")!="0x0000000000000000000000000000000000000434": fail("ProtocolRegistry address drift")
if rel.get("protocol_registry",{}).get("publication_api")!="publishRegisteredService": fail("Registry publication API drift")
if not d.get("retained_external_blockers"): fail("live blockers missing")
checks=[
"scripts/verify-cmp-1-4-0-verifier-architecture.py",
"scripts/verify-cmp-1-4-1-verifier-lifecycle.py",
"scripts/verify-cmp-1-4-2-verifier-capabilities.py",
"scripts/verify-cmp-1-4-3-verification-policy.py",
"scripts/verify-cmp-1-4-4-signed-verdict-provenance.py",
"scripts/verify-cmp-1-4-5-independent-selection.py",
"scripts/verify-cmp-1-4-6-replicated-verification.py",
"scripts/verify-cmp-1-4-7-deterministic-adapters.py",
"scripts/verify-cmp-1-4-8-scientific-verification.py",
"scripts/verify-cmp-1-4-9-challenge-appeal-hooks.py",
"scripts/verify-cmp-1-4-10-cross-verifier-adversarial.py"
]
for relpath in checks:
    p=ROOT/relpath
    if not p.is_file(): fail("missing verifier "+relpath)
    subprocess.run([sys.executable,str(p)],cwd=ROOT,check=True)
subprocess.run([sys.executable,str(ROOT/"scripts/verify-cmp-1-4-11-verifier-release-candidate.py"),"--repository-ready"],cwd=ROOT,check=True)
live=subprocess.run([sys.executable,str(ROOT/"scripts/verify-cmp-1-4-11-verifier-release-candidate.py")],cwd=ROOT)
if live.returncode==0: fail("live verifier readiness unexpectedly passed")
print("CMP-1.4.12 phase closeout reconciliation: READY FOR EXACT-HEAD LEVEL 3 QUALIFICATION")

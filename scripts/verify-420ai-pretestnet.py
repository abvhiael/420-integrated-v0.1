#!/usr/bin/env python3
from __future__ import annotations
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
ROADMAP=ROOT/"docs/audit/420AI-AUDIT-REMEDIATION-ROADMAP.md"
EVIDENCE=ROOT/"docs/audit/420AI-AUDIT-QUALIFICATION-EVIDENCE.json"
DOC=ROOT/"docs/apps/ai/pretestnet-qualification.md"
WORKFLOW=ROOT/".github/workflows/420ai-audit.yml"
PKG=ROOT/"services/420ai-provider/package.json"
DEPLOY=ROOT/"contracts/config/ai/ai-audit-9-deployment-package.json"
errors=[]

for p in [ROADMAP,EVIDENCE,DOC,WORKFLOW,PKG,DEPLOY]:
    if not p.is_file(): errors.append(f"missing required file: {p.relative_to(ROOT)}")

if not errors:
    roadmap=ROADMAP.read_text()
    evidence=json.loads(EVIDENCE.read_text())
    doc=DOC.read_text()
    workflow=WORKFLOW.read_text()
    pkg=json.loads(PKG.read_text())
    deploy=json.loads(DEPLOY.read_text())

    for token in [
        "AI-AUDIT-9 — deployment and Genesis materialization",
        "Repository-side status: COMPLETE",
        "AI-AUDIT-10 — exact-head pre-testnet qualification",
        "AI-AUDIT-11 — production-equivalent testnet qualification",
        "BLOCKED until the production-equivalent 420Integrated testnet"
    ]:
        if token not in roadmap: errors.append(f"roadmap missing: {token}")

    if evidence.get("step_qualifications",{}).get("AI-AUDIT-9",{}).get("status")!="COMPLETE":
        errors.append("AI-AUDIT-9 durable evidence is not COMPLETE")

    required_doc_tokens=[
        "forge clean","AI*420.t.sol","RegistryApiReconciliation420.t.sol",
        "RegistryIdentityNames420.t.sol","Identity420Compatibility.t.sol",
        "Slither","npm run build","no tracked or untracked repository drift"
    ]
    for token in required_doc_tokens:
        if token not in doc: errors.append(f"pretestnet doc missing: {token}")

    for token in [
        "pretestnet-qualification:","pretestnet-security:",
        "Verify exact AI qualification head","forge clean",
        "RegistryApiReconciliation420.t.sol","RegistryIdentityNames420.t.sol",
        "Identity420Compatibility.t.sol","Targeted AI Slither high-severity gate",
        "Verify no repository drift"
    ]:
        if token not in workflow: errors.append(f"workflow missing: {token}")

    if pkg.get("scripts",{}).get("build")!="npm test":
        errors.append("provider package must expose deterministic build qualification")

    live=deploy.get("liveFields",{})
    for key,value in live.items():
        if value not in (None,{},[]):
            errors.append(f"AI-AUDIT-9 live field must remain unset before testnet: {key}")

if errors:
    print("420AI AI-AUDIT-10 pre-testnet verifier FAILED")
    for e in errors: print(f"- {e}")
    raise SystemExit(1)
print("420AI AI-AUDIT-10 pre-testnet verifier PASSED")

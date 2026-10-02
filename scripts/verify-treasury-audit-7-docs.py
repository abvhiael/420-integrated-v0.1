#!/usr/bin/env python3
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]
OP=ROOT/"docs/apps/treasury/operator-guide.md"
REF=ROOT/"docs/apps/treasury/reference.md"
ROAD=ROOT/"docs/audit/420TREASURY-AUDIT-REMEDIATION-ROADMAP.md"
CFG=ROOT/"contracts/config/420treasury-genesis.json"
REL=ROOT/"contracts/config/treasury/treasury-audit-6-release-materialization.json"
ARCH=ROOT/"docs/architecture/decisions/TREASURY-AUDIT-4-VAULT-RELEASE-EVIDENCE-MODEL.md"

errors=[]
def need(cond,msg):
    if not cond: errors.append(msg)

for p in [OP,REF,ROAD,CFG,REL,ARCH]:
    need(p.exists(),f"missing required Treasury closeout file: {p.relative_to(ROOT)}")
if errors:
    print(json.dumps({"pass":False,"errors":errors},indent=2)); raise SystemExit(1)

op=OP.read_text()
ref=REF.read_text()
road=ROAD.read_text()
cfg=json.loads(CFG.read_text())
rel=json.loads(REL.read_text())
arch=ARCH.read_text()

required_operator_sections=[
    "# 420Treasury operator guide",
    "## Deployment and configuration authority",
    "## Roles and permissions",
    "## Normal operating procedure",
    "## Monitoring and reconciliation",
    "## Incident response",
    "## Recovery boundaries",
    "## Known limitations",
    "### Vault release evidence model",
    "## Read/API reference",
    "## Exact repository qualification commands",
    "## Qualification evidence",
]
for token in required_operator_sections:
    need(token in op,f"operator guide missing section: {token}")

for token in [
    "420Vault VAULT_TREASURY",
    "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS",
    "0x0000000000000000000000000000000000000429",
    "0x0000000000000000000000000000000000000434",
    "CANDIDATE_NOT_DEPLOYED_NOT_FROZEN",
    "420/service/treasury/v1",
    "executed <= committed <= ceiling",
    "authoritative: false",
    "does **not** cryptographically prove",
    "TREASURY-AUDIT-8",
    "TREASURY-AUDIT-9",
    "python3 scripts/verify-treasury-audit-7-docs.py",
]:
    need(token in op,f"operator guide missing canonical token: {token}")

required_reference=[
    "# 420Treasury events, errors and API reference",
    "TreasuryAuthorization420",
    "TreasuryPolicyRegistry420",
    "TreasuryBudgetRegistry420",
    "TreasuryDisbursementRegistry420",
    "TreasuryRouter420",
    "EpochDurationImmutable()",
    "ControllerAlreadySet()",
    "ExecutionUnauthorized()",
    "EpochLimit()",
    "AssetPolicySet(",
    "BudgetCreated(",
    "BudgetCommitmentChanged(",
    "DisbursementScheduled(",
    "DisbursementExecuted(",
    "DisbursementCancelled(",
    "GET /v1/treasury/budgets/:budgetId",
    "GET /v1/treasury/disbursements/:disbursementId",
    "authoritative: false",
    "invalid_request",
    "not_found",
    "method_not_allowed",
    "internal_error",
]
for token in required_reference:
    need(token in ref,f"reference missing canonical token: {token}")

evidence=cfg.get("vault_release_evidence_model",{})
need(evidence.get("version")=="420/TREASURY/VAULT_RELEASE_COMMITMENT/V1","Vault evidence model version drift")
need(evidence.get("mode")=="AUTHORIZED_EXECUTOR_COMMITMENT_ONLY","Vault evidence mode drift")
need(evidence.get("treasury_verifies_vault_release") is False,"Treasury verifier claim drift")
need(evidence.get("custody_authority")=="420Vault VAULT_TREASURY","custody authority drift")

need(rel.get("step")=="TREASURY-AUDIT-6","release materialization authority drift")
need(rel.get("live_qualified") is False,"operator docs must not claim live qualification")
need(rel.get("address_policy",{}).get("treasury_router_status")=="REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS","router address policy drift")
need(rel.get("live_testnet_evidence",{}).get("required_in_step")=="TREASURY-AUDIT-8","live evidence owner drift")

need("AUTHORIZED_EXECUTOR_COMMITMENT_ONLY" in arch,"architecture decision release mode drift")
need("TREASURY-AUDIT-7 — documentation/operator closeout" in road,"roadmap step missing")

# No false standalone-site requirement.
need("A standalone public-facing Treasury website is not required" in road,"standalone-site classification drift")
need("No standalone Treasury website requirement" in op,"operator site classification missing")

if errors:
    print(json.dumps({"pass":False,"errors":errors},indent=2))
    raise SystemExit(1)

print(json.dumps({
    "pass":True,
    "step":"TREASURY-AUDIT-7",
    "operatorGuide":"docs/apps/treasury/operator-guide.md",
    "reference":"docs/apps/treasury/reference.md",
    "vaultReleaseEvidenceModel":evidence.get("version"),
    "liveEvidenceOwner":"TREASURY-AUDIT-8",
    "standaloneTreasuryWebsiteRequired":False
},indent=2))

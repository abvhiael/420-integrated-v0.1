#!/usr/bin/env python3
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parents[1]
OP=ROOT/"docs/apps/grants/operator-guide.md"
THREAT=ROOT/"docs/apps/grants/threat-model.md"
REPORT=ROOT/"docs/audit/420GRANTS-AUDIT-REPORT.md"
ROAD=ROOT/"docs/audit/420GRANTS-AUDIT-REMEDIATION-ROADMAP.md"
ARCH=ROOT/"docs/architecture/protocols/stake-governance-treasury-grants.md"
CFG=ROOT/"contracts/config/420grants-genesis.json"
REL=ROOT/"contracts/config/grants/grants-audit-5-release-materialization.json"

errors=[]
def need(cond,msg):
    if not cond: errors.append(msg)

for p in [OP,THREAT,REPORT,ROAD,ARCH,CFG,REL]:
    need(p.exists(),f"missing required Grants AUDIT-7 file: {p.relative_to(ROOT)}")
if errors:
    print(json.dumps({"pass":False,"errors":errors},indent=2)); raise SystemExit(1)

op=OP.read_text()
threat=THREAT.read_text()
report=REPORT.read_text()
road=ROAD.read_text()
arch=ARCH.read_text()
cfg=json.loads(CFG.read_text())
rel=json.loads(REL.read_text())

for token in [
    "# 420Grants operator guide",
    "## Deployment and configuration authority",
    "## Roles and permissions",
    "## Normal operating procedure",
    "## Monitoring and reconciliation",
    "## Incident response",
    "## Incident evidence preservation checklist",
    "## Recovery boundaries",
    "## Known limitations",
    "## Read/API reference",
    "## Exact repository qualification commands",
    "## Qualification evidence",
]:
    need(token in op,f"operator guide missing section: {token}")

for token in [
    "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS",
    "0x0000000000000000000000000000000000000429",
    "0x0000000000000000000000000000000000000434",
    "0x0000000000000000000000000000000000000447",
    "CANDIDATE_NOT_DEPLOYED_NOT_FROZEN",
    "420/service/grants/v1",
    "SmartAccount420",
    "authoritative: false",
    "does **not** cryptographically prove",
    "GRANTS-AUDIT-8",
    "GRANTS-AUDIT-9",
    "GRANTS-AUDIT-10",
    "python3 scripts/verify-grants-audit-7-docs.py",
]:
    need(token in op,f"operator guide missing canonical token: {token}")

for token in [
    "# 420Grants threat model",
    "## Security objectives",
    "## Trust boundaries",
    "## Threats and mitigations",
    "## Abuse cases that must fail closed",
    "## Monitoring signals",
    "## Recovery principles",
    "## Residual risks and live-only evidence",
    "T1 — governance authority bypass",
    "T9 — false PAID evidence",
    "T10 — direct custody/transfer expansion",
    "T12 — derived-state authority confusion",
    "GRANTS-AUDIT-9",
]:
    need(token in threat,f"threat model missing canonical token: {token}")

for token in [
    "# 420Grants audit report",
    "## Scope and classification",
    "## Repository audit status",
    "## Canonical implementation inventory",
    "## Key remediations",
    "## Address/deployment state",
    "## Client/indexer state",
    "## Threat model summary",
    "## Known trust limitation",
    "## Qualification ownership",
    "## Explicit live/testnet blockers",
    "## Production readiness boundary",
    "GRANTS-AUDIT-8",
    "GRANTS-AUDIT-9",
    "GRANTS-AUDIT-10",
]:
    need(token in report,f"audit report missing canonical token: {token}")

for token in [
    "420 Grants builds a governed grant lifecycle",
    "Treasury disbursement",
    "Vault release commitment",
    "Recover from canonical chain state outward",
    "GOVF-013",
    "GOVF-014",
    "GOVF-015",
    "GOVF-016",
]:
    need(token in arch,f"architecture missing Grants canonical token: {token}")

need(cfg.get("schema")=="420-grants-genesis-v1","Grants config schema drift")
need(cfg.get("class")=="GENESIS_IMPLEMENTATION_PROTOCOL","Grants classification drift")
need(cfg.get("publicStandaloneApplication") is False,"Grants standalone-app classification drift")
need(cfg.get("deployment",{}).get("addressModel")=="REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS","Grants address model drift")
need(cfg.get("deployment",{}).get("releaseMaterialization")=="contracts/config/grants/grants-audit-5-release-materialization.json","Grants release materialization pointer drift")

invariants=cfg.get("invariants",[])
for n in range(1,20):
    prefix=f"GRANT-INV-{n:03d}:"
    need(any(x.startswith(prefix) for x in invariants),f"missing {prefix[:-1]}")

need(rel.get("step")=="GRANTS-AUDIT-5","release materialization authority drift")
need(rel.get("repository_ready") is True,"repository release readiness drift")
need(rel.get("live_qualified") is False,"AUDIT-7 docs must not claim live qualification")
need(rel.get("address_policy",{}).get("grants_router_status")=="REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS","router address policy drift")
need(rel.get("canonical_dependencies",{}).get("governance_timelock",{}).get("address")=="0x0000000000000000000000000000000000000429","GovernanceTimelock drift")
need(rel.get("canonical_dependencies",{}).get("protocol_registry",{}).get("address")=="0x0000000000000000000000000000000000000434","ProtocolRegistry drift")
need(rel.get("canonical_dependencies",{}).get("capability_registry",{}).get("status")=="CANDIDATE_NOT_DEPLOYED_NOT_FROZEN","CapabilityRegistry status drift")
need(rel.get("live_testnet_evidence",{}).get("required_in_step")=="GRANTS-AUDIT-9","live evidence owner drift")

need("GRANTS-AUDIT-7 — documentation, threat model and operator guidance" in road,"roadmap step missing")
road_plain=road.replace("**","")
need("separate Grants website" in road_plain and "not required" in road_plain.lower(),"standalone-site classification drift")
need("No standalone Grants website is required" in op,"operator site classification missing")
need("does **not** custody or transfer Treasury assets" in op,"operator custody boundary missing")
need("does not own Treasury custody" in threat,"threat-model custody boundary missing")

if errors:
    print(json.dumps({"pass":False,"errors":errors},indent=2))
    raise SystemExit(1)

print(json.dumps({
    "pass":True,
    "step":"GRANTS-AUDIT-7",
    "operatorGuide":"docs/apps/grants/operator-guide.md",
    "threatModel":"docs/apps/grants/threat-model.md",
    "auditReport":"docs/audit/420GRANTS-AUDIT-REPORT.md",
    "standaloneGrantsWebsiteRequired":False,
    "liveEvidenceOwner":"GRANTS-AUDIT-9",
    "invariants":len(invariants)
},indent=2))

#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
M=ROOT/"contracts/config/treasury/treasury-audit-6-release-materialization.json"
NS=ROOT/"contracts/config/genesis-address-namespace.json"
CANON=ROOT/"contracts/config/genesis-canonical-addresses.json"
TEST=ROOT/"contracts/test/TreasuryDeploymentBinding420.t.sol"

errors=[]
def need(cond,msg):
    if not cond: errors.append(msg)

d=json.loads(M.read_text())
ns=json.loads(NS.read_text())
canon=json.loads(CANON.read_text())
test=TEST.read_text()

need(d.get("schema")=="420-treasury-audit-6-release-materialization-v1","schema drift")
need(d.get("step")=="TREASURY-AUDIT-6","step drift")
need(d.get("live_qualified") is False,"fabricated live qualification")
need(d.get("address_policy",{}).get("treasury_router_status")=="REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS","router address policy drift")
need(d.get("address_policy",{}).get("new_frozen_predeploy_required") is False,"unexpected frozen predeploy")
need(d.get("address_policy",{}).get("create2_policy")=="NOT_ADOPTED_DO_NOT_INVENT","CREATE2 policy drift")

deps=d.get("canonical_dependencies",{})
need(deps.get("governance_timelock",{}).get("address")=="0x0000000000000000000000000000000000000429","GovernanceTimelock drift")
need(deps.get("protocol_registry",{}).get("address")=="0x0000000000000000000000000000000000000434","ProtocolRegistry drift")
need(deps.get("capability_registry",{}).get("candidate_address")=="0x0000000000000000000000000000000000000447","CapabilityRegistry candidate drift")
need(deps.get("capability_registry",{}).get("status")=="CANDIDATE_NOT_DEPLOYED_NOT_FROZEN","CapabilityRegistry live-state drift")

registry={x.get("id"):x for x in ns.get("registryResolved",[])}
router=registry.get("treasury-router")
need(router is not None,"treasury-router missing from namespace")
if router:
    need(router.get("contract")=="TreasuryRouter420.sol","treasury-router contract drift")
    need(router.get("status")=="REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS","treasury-router namespace status drift")

fixed={x.get("name"):x.get("address") for x in ns.get("fixedAssignments",[])}
need("TreasuryRouter420" not in fixed and "TreasuryRouter" not in fixed,"TreasuryRouter became fixed predeploy")
need(fixed.get("GovernanceTimelock")=="0x0000000000000000000000000000000000000429","fixed GovernanceTimelock drift")
need(fixed.get("ProtocolRegistry")=="0x0000000000000000000000000000000000000434","fixed ProtocolRegistry drift")

active={x.get("name"):x for x in ns.get("activeNonPredeployReservations",[])}
cap=active.get("CapabilityRegistry420")
need(cap is not None,"CapabilityRegistry reservation missing")
if cap:
    need(cap.get("address")=="0x0000000000000000000000000000000000000447","CapabilityRegistry reservation address drift")
    need(cap.get("status")=="CANDIDATE_NOT_DEPLOYED_NOT_FROZEN","CapabilityRegistry reservation status drift")

order=d.get("deployment_order",[])
need([x.get("order") for x in order]==list(range(1,8)),"deployment order is not deterministic 1..7")
expected=[
 ("TreasuryAuthorization420",["CapabilityRegistry420"]),
 ("TreasuryPolicyRegistry420",["GovernanceTimelock"]),
 ("TreasuryBudgetRegistry420",["GovernanceTimelock","TreasuryPolicyRegistry420"]),
 ("TreasuryDisbursementRegistry420",["GovernanceTimelock","TreasuryAuthorization420","TreasuryPolicyRegistry420","TreasuryBudgetRegistry420"]),
]
for i,(name,args) in enumerate(expected):
    item=order[i] if i < len(order) else {}
    need(item.get("contract")==name,f"deployment order contract drift at {i+1}")
    need(item.get("constructor")==args,f"constructor binding drift for {name}")
need(order[4].get("action")=="setController" and order[4].get("args")==["TreasuryDisbursementRegistry420"] and order[4].get("one_time") is True,"budget controller post-init drift")
need(order[5].get("contract")=="TreasuryRouter420" and order[5].get("constructor")==["TreasuryBudgetRegistry420","TreasuryDisbursementRegistry420"],"router binding drift")
need(order[6].get("contract")=="ProtocolRegistry" and order[6].get("action")=="publishRegisteredService","Registry publication path drift")
need(order[6].get("service_id_preimage")=="420/service/treasury/v1","Treasury service id drift")
need(order[6].get("implementation")=="TreasuryRouter420","Treasury service implementation drift")

for token in [
    'new TreasuryAuthorization420(address(e.caps))',
    'new TreasuryPolicyRegistry420(address(this))',
    'new TreasuryBudgetRegistry420(address(this), address(e.policy))',
    'new TreasuryDisbursementRegistry420(',
    'e.budgets.setController(address(e.disbursements))',
    'new TreasuryRouter420(address(e.budgets), address(e.disbursements))',
    'publishRegisteredService(',
    'TREASURY_SERVICE_ID',
    'address(e.router).codehash',
    'registerComponent(',
]:
    need(token in test,f"deployment binding test missing token: {token}")

live=d.get("live_testnet_evidence",{})
need(live.get("required_in_step")=="TREASURY-AUDIT-8","live evidence owner drift")
for key in ["chain_id","genesis_hash","evidence_block","evidence_block_hash"]:
    need(live.get(key) is None,f"fabricated live {key}")
need(live.get("deployment_transactions")==[] and live.get("registry_transactions")==[],"fabricated live transactions")

# Canonical mirror must agree that treasury-router is registry resolved.
canon_entries={x.get("id"):x for x in canon.get("registry_resolved", canon.get("registryResolved", []))}
if "treasury-router" in canon_entries:
    need(canon_entries["treasury-router"].get("contract") in ("TreasuryRouter420","TreasuryRouter420.sol"),"canonical router contract drift")

if errors:
    print(json.dumps({"pass":False,"errors":errors},indent=2))
    raise SystemExit(1)

print(json.dumps({
    "pass":True,
    "step":"TREASURY-AUDIT-6",
    "deploymentOrder":[x.get("contract") + (":" + x.get("action") if x.get("action") else "") for x in order],
    "treasuryRouterNamespace":router,
    "liveQualified":False,
    "liveEvidenceOwner":"TREASURY-AUDIT-8"
},indent=2))

#!/usr/bin/env python3
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
M=ROOT/"contracts/config/launchpad/launchpad-audit-4-release-materialization.json"
NS=ROOT/"contracts/config/genesis-address-namespace.json"
CANON=ROOT/"contracts/config/genesis-canonical-addresses.json"
HIST=ROOT/"contracts/config/w14-7-4-global-address-reconciliation.json"
TEST=ROOT/"contracts/test/LaunchpadDeploymentBinding420.t.sol"
FOUNDRY=ROOT/"contracts/foundry.toml"
SERVICE_IDS=ROOT/"contracts/src/libraries/ServiceIds420.sol"
IDS=ROOT/"contracts/src/launchpad/LaunchpadIds420.sol"

errors=[]
def need(cond,msg):
    if not cond: errors.append(msg)

d=json.loads(M.read_text())
ns=json.loads(NS.read_text())
canon=json.loads(CANON.read_text())
hist=json.loads(HIST.read_text())
test=TEST.read_text()
foundry=FOUNDRY.read_text()
service_ids=SERVICE_IDS.read_text()
ids=IDS.read_text()

need(d.get("schema")=="420-launchpad-audit-4-release-materialization-v1","schema drift")
need(d.get("step")=="LAUNCHPAD-AUDIT-4","step drift")
need(d.get("live_qualified") is False,"fabricated live qualification")
policy=d.get("address_policy",{})
need(policy.get("launchpad_router_status")=="REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS","router policy drift")
need(policy.get("new_frozen_predeploy_required") is False,"unexpected frozen predeploy")
need(policy.get("create2_policy")=="NOT_ADOPTED_DO_NOT_INVENT","invented CREATE2 policy")
need(policy.get("superseded_historical_candidate")=="0x000000000000000000000000000000000000045c","historical candidate evidence drift")

fixed={x.get("name"):x.get("address") for x in ns.get("fixedAssignments",[])}
need(fixed.get("GovernanceTimelock")=="0x0000000000000000000000000000000000000429","GovernanceTimelock drift")
need(fixed.get("ProtocolRegistry")=="0x0000000000000000000000000000000000000434","ProtocolRegistry drift")
need(fixed.get("Identity420")=="0x0000000000000000000000000000000000000436","Identity420 drift")
need("LaunchpadRouter420" not in fixed and "LaunchpadRouter" not in fixed,"Launchpad router became fixed predeploy")

registry={x.get("id"):x for x in ns.get("registryResolved",[])}
router=registry.get("launchpad-router")
need(router is not None,"launchpad-router missing from namespace")
if router:
    need(router.get("contract")=="LaunchpadRouter420.sol","launchpad-router contract drift")
    need(router.get("status")=="REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS","launchpad-router namespace status drift")

canon_entries={x.get("id"):x for x in canon.get("registry_resolved",canon.get("registryResolved",[]))}
need("launchpad-router" in canon_entries,"launchpad-router missing from canonical mirror")
if "launchpad-router" in canon_entries:
    need(canon_entries["launchpad-router"].get("contract") in ("LaunchpadRouter420","LaunchpadRouter420.sol"),"canonical router contract drift")

need(hist.get("status")=="SUPERSEDED_HISTORICAL_PROPOSAL_NOT_ACTIVE","historical reconciliation unexpectedly active")
hist_map={x[0]:x[2] for x in hist.get("canonicalAuthorities",[]) if isinstance(x,list) and len(x)>=3}
need(hist_map.get("launchpad-router")=="0x045c","historical 0x045c provenance drift")
need(hist.get("supersededBy")=="contracts/config/genesis-address-namespace.json","historical proposal no longer superseded by namespace authority")

auth=d.get("canonical_authorities",{})
need(auth.get("governance_timelock",{}).get("address")=="0x0000000000000000000000000000000000000429","manifest GovernanceTimelock drift")
need(auth.get("protocol_registry",{}).get("address")=="0x0000000000000000000000000000000000000434","manifest ProtocolRegistry drift")
need(auth.get("protocol_registry",{}).get("publication_api")=="publishRegisteredService","Registry publication API drift")
need(auth.get("launchpad_component",{}).get("component_id_preimage")=="420/COMPONENT/LAUNCHPAD/V1","Launchpad component preimage drift")

need('LAUNCHPAD = keccak256("420/service/launchpad/v1")' in service_ids,"canonical Launchpad service ID drift")
need('COMPONENT_LAUNCHPAD = keccak256("420/COMPONENT/LAUNCHPAD/V1")' in ids,"canonical Launchpad component ID drift")

order=d.get("deployment_order",[])
need([x.get("order") for x in order]==list(range(1,11)),"deployment order must be deterministic 1..10")
expected=[
 ("LaunchpadAuthorization420",["CapabilityRegistry420"]),
 ("LaunchpadProjectRegistry420",["GovernanceTimelock"]),
 ("LaunchpadSaleRegistry420",["GovernanceTimelock","LaunchpadProjectRegistry420"]),
 ("LaunchpadAllocationRegistry420",["LaunchpadAuthorization420","LaunchpadSaleRegistry420"]),
]
for i,(name,args) in enumerate(expected):
    item=order[i] if i<len(order) else {}
    need(item.get("contract")==name,f"deployment order drift at {i+1}")
    need(item.get("constructor")==args,f"constructor binding drift for {name}")
need(order[4].get("action")=="setController" and order[4].get("args")==["LaunchpadAllocationRegistry420"] and order[4].get("one_time") is True,"Sale controller wiring drift")
need(order[5].get("contract")=="LaunchpadCrowdfundingIntegration420","crowdfunding deployment order drift")
need(order[5].get("constructor")==[
 "LaunchpadAllocationRegistry420","PaymentRegistry420","Identity420",
 "ArbitrationCaseRegistry420","ArbitrationRulingRegistry420"
],"crowdfunding constructor graph drift")
need(order[6].get("action")=="setCrowdfundingIntegration" and order[6].get("args")==["LaunchpadCrowdfundingIntegration420"] and order[6].get("one_time") is True,"crowdfunding one-shot wiring drift")
need(order[7].get("contract")=="LaunchpadRouter420" and order[7].get("constructor")==["LaunchpadSaleRegistry420","LaunchpadAllocationRegistry420"],"router constructor drift")
need(order[8].get("action")=="registerComponent" and order[8].get("component_id_preimage")=="420/COMPONENT/LAUNCHPAD/V1","component registration drift")
need(order[8].get("implementation")=="LaunchpadRouter420","component implementation drift")
need(order[9].get("action")=="publishRegisteredService","service publication action drift")
need(order[9].get("service_id_preimage")=="420/service/launchpad/v1","service preimage drift")
need(order[9].get("implementation")=="LaunchpadRouter420","service implementation drift")
need(order[9].get("component_type")=="SERVICE","service component type drift")

artifact=d.get("artifact_identity",{})
need(artifact.get("compiler")=="Solidity 0.8.24","compiler identity drift")
need(artifact.get("evm_version")=="cancun","EVM version drift")
need(artifact.get("optimizer") is True and artifact.get("optimizer_runs")==200,"optimizer identity drift")
need(artifact.get("via_ir") is True,"via-IR identity drift")
for token in ['solc_version = "0.8.24"','evm_version = "cancun"','optimizer = true','optimizer_runs = 200','via_ir = true']:
    need(token in foundry,f"Foundry compiler setting drift: {token}")

for token in [
 'new LaunchpadAuthorization420(address(e.caps))',
 'new LaunchpadProjectRegistry420(address(this))',
 'new LaunchpadSaleRegistry420(address(this),address(e.projects))',
 'new LaunchpadAllocationRegistry420(address(e.auth),address(e.sales))',
 'e.sales.setController(address(e.allocations))',
 'new LaunchpadCrowdfundingIntegration420(',
 'e.allocations.setCrowdfundingIntegration(address(e.crowdfunding))',
 'new LaunchpadRouter420(address(e.sales),address(e.allocations))',
 'registerComponent(',
 'publishRegisteredService(',
 'address(e.router).codehash',
 'remainingSaleCapacity',
]:
    need(token in test,f"deployment binding test missing token: {token}")

live=d.get("live_testnet_evidence",{})
need(live.get("required_in_step")=="LAUNCHPAD-AUDIT-6","live evidence owner drift")
for key in ["chain_id","genesis_hash","evidence_block","evidence_block_hash"]:
    need(live.get(key) is None,f"fabricated live {key}")
need(live.get("deployed_addresses")=={} and live.get("runtime_code_hashes")=={},"fabricated live address/hash evidence")
need(live.get("deployment_transactions")==[] and live.get("registry_transactions")==[],"fabricated live transactions")

if errors:
    print(json.dumps({"pass":False,"errors":errors},indent=2))
    raise SystemExit(1)

print(json.dumps({
 "pass":True,
 "step":"LAUNCHPAD-AUDIT-4",
 "deploymentOrder":[x.get("contract")+(":"+x.get("action") if x.get("action") else "") for x in order],
 "launchpadRouterNamespace":router,
 "historical045cActive":False,
 "liveQualified":False,
 "liveEvidenceOwner":"LAUNCHPAD-AUDIT-6"
},indent=2))

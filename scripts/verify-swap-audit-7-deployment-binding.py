#!/usr/bin/env python3
import json, pathlib, sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
M=ROOT/"contracts/config/swap/swap-audit-7-deployment-binding.json"
PAY=ROOT/"contracts/config/420pay-genesis-wiring.json"
PRE=ROOT/"contracts/config/predeploy"

EXPECTED_FROZEN={
"GenesisDEXFactory":("0x000000000000000000000000000000000000042b","0x71cfd26ecde73f51a93cbce4877fd4edd6882c9d5d51b40c25df97e2348d106f"),
"PublicBatchAuction":("0x000000000000000000000000000000000000042c","0xeeb69fc49b1ff4edd0d8bf94f7ec8e1f75cd064720226a4856043b531cf3c228"),
"TWAPOracle":("0x000000000000000000000000000000000000042d","0x7ad49e839308f3e0d9c0047203cf007bfc9b978608e4eca838f751f5f78f36ca"),
"ApprovedQuoteAssetRegistry":("0x0000000000000000000000000000000000000439","0x6ffa02b1b5638190a68fa72faf1465d9f0e52b479cc9d5920d83f3c55a4b3b37"),
}

def fail(msg):
    print("FAIL: "+msg,file=sys.stderr); raise SystemExit(1)

d=json.loads(M.read_text())
if d.get("schema")!="420-swap-audit-7-deployment-binding-v1": fail("schema")
if d.get("step")!="SWAP-AUDIT-7": fail("step")
if d.get("repository_ready") is not True: fail("repository_ready")
if d.get("live_qualified") is not False: fail("fabricated live qualification")
if d.get("status")!="REPOSITORY_QUALIFIED_LIVE_TESTNET_DEFERRED": fail("status")
if d.get("interface_verifier")!="scripts/verify-420swap-interface-v1.py": fail("interface verifier authority")

reg=d.get("protocol_registry",{})
if reg.get("frozen_address")!="0x0000000000000000000000000000000000000434": fail("registry address")
if reg.get("component_registration_api")!="registerComponent": fail("registry API")
if reg.get("required_lifecycle")!="ACTIVE": fail("registry lifecycle")
if reg.get("runtime_code_hash_source")!="EXTCODEHASH_DERIVED_BY_PROTOCOL_REGISTRY": fail("registry hash source")

seen={}
for item in d.get("frozen_swap_predeploys",[]):
    seen[item["contract"]]=(item["address"],item["runtime_code_hash"])
if seen!=EXPECTED_FROZEN: fail("frozen predeploy binding drift")
for name,(addr,hsh) in EXPECTED_FROZEN.items():
    state=json.loads((PRE/f"{name}-predeploy-state.json").read_text())
    if state.get("address")!=addr or state.get("runtimeCodeHash")!=hsh: fail(name+" retained state mismatch")
    if state.get("status")!="SWAP_AUDIT_6_FINAL_PREDEPLOY_STATE": fail(name+" not final")

required_components={
"CanonicalMarketRegistry":"420/APP/420SWAP/CANONICAL_MARKET_REGISTRY",
"CanonicalSwapExecutor420":"420/APP/420SWAP/CANONICAL_SWAP_EXECUTOR",
"CanonicalSettlementAdapter420":"420/APP/420PAY/SETTLEMENT_ADAPTER",
"PaymentRouter420":"420/APP/420PAY/PAYMENT_ROUTER",
}
components=d.get("registry_resolved_components",[])
if {x.get("contract"):x.get("component_id_preimage") for x in components}!=required_components: fail("registry component inventory")
for x in components:
    for fld in ("address","runtime_code_hash","registry_revision"):
        if x.get(fld) is not None: fail(f"{x['contract']}: fabricated live {fld}")

pool=d.get("canonical_pool",{})
if pool.get("contract")!="CanonicalConstantProductPool420": fail("pool contract")
for fld in ("address","runtime_code_hash"):
    if pool.get(fld) is not None: fail("fabricated concrete pool "+fld)
if pool.get("factory_registration_required") is not True or pool.get("canonical_market_registration_required") is not True: fail("pool binding gates")

bindings=d.get("required_bindings",{})
for key in (
"payment_router_settlement_adapter","settlement_adapter_swap_executor","executor_trusted_caller",
"factory_pool_implementation","factory_pool_registration","market_registration","registry_components_active"
):
    if not bindings.get(key): fail("missing binding "+key)

local=d.get("local_evm_qualification",{})
if local.get("required") is not True or local.get("test")!="contracts/test/SwapDeploymentBinding420.t.sol": fail("local qualification")
if len(local.get("proves",[]))<6: fail("insufficient local proof inventory")

live=d.get("live_testnet_evidence",{})
if live.get("required_in_step")!="SWAP-AUDIT-8": fail("live step ownership")
for key in ("chain_id","evidence_block","evidence_block_hash"):
    if live.get(key) is not None: fail("fabricated live "+key)
for key in ("deployment_transactions","registry_transactions","binding_transactions"):
    if live.get(key)!=[]: fail("fabricated live transactions "+key)

pay=json.loads(PAY.read_text())
if pay.get("deployment_binding_verified") is not False: fail("420Pay falsely claims live deployment binding")
if pay.get("repository_binding_qualified") is not True: fail("420Pay repository binding qualification missing")
if pay.get("binding_qualification_test")!="contracts/test/SwapDeploymentBinding420.t.sol": fail("420Pay binding test drift")
if pay.get("status")!="REPOSITORY_QUALIFIED_LIVE_BINDING_PENDING": fail("420Pay status")

print("SWAP_AUDIT_7_DEPLOYMENT_BINDING=PASS")
print("repository_ready=true")
print("live_qualified=false")
print("live_owner=SWAP-AUDIT-8")

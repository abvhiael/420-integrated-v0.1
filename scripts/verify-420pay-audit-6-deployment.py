#!/usr/bin/env python3
"""Independent static verifier for the retained PAY-AUDIT-6 deployment package."""
from __future__ import annotations
import json, pathlib, subprocess, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
PKG=ROOT/"contracts/config/pay/pay-audit-6-deployment-package.json"
WIRING=ROOT/"contracts/config/420pay-genesis-wiring.json"
ROADMAP=ROOT/"docs/audit/420PAY-AUDIT-REMEDIATION-ROADMAP.md"
RUNBOOK=ROOT/"docs/apps/pay/deployment-operations.md"
EXPECTED={
"MerchantRegistry420":"420/APP/420PAY/MERCHANT_REGISTRY",
"InvoiceRegistry420":"420/APP/420PAY/INVOICE_REGISTRY",
"PaymentRegistry420":"420/APP/420PAY/PAYMENT_REGISTRY",
"PaymentRouter420":"420/APP/420PAY/PAYMENT_ROUTER",
"SettlementRouter420":"420/APP/420PAY/SETTLEMENT_ROUTER",
"RefundManager420":"420/APP/420PAY/REFUND_MANAGER",
"GasSponsor420":"420/APP/420PAY/GAS_SPONSOR",
"CanonicalSettlementAdapter420":"420/APP/420PAY/SETTLEMENT_ADAPTER",
"CanonicalSwapHealthAdapter420":"420/APP/420PAY/SWAP_HEALTH_ADAPTER",
}
def fail(m): print("FAIL: "+m,file=sys.stderr); raise SystemExit(1)
d=json.loads(PKG.read_text())
if d.get("schema")!="420pay-audit-6-deployment-package-v1" or d.get("step")!="PAY-AUDIT-6": fail("package identity")
if d.get("status")!="IMPLEMENTED_LEVEL_1_QUALIFICATION_PENDING": fail("status")
if d.get("repository_ready") is not False or d.get("live_qualified") is not False: fail("readiness semantics")
if d.get("address_policy")!="REGISTRY_RESOLVED_NO_FIXED_PAY_ADDRESSES": fail("address policy")
if d.get("governance_timelock")!="0x0000000000000000000000000000000000000429": fail("timelock")
if d.get("protocol_registry")!="0x0000000000000000000000000000000000000434": fail("registry")
if d.get("genesis_config_hash")!="0x01aea63faef55d711e5f93e800b04702177874f4015375b659038ce991d20921": fail("genesis config")
rs=d.get("residents",[])
if {x.get("contract"):x.get("component_id_preimage") for x in rs}!=EXPECTED: fail("resident inventory/component ids")
for x in rs:
    if x.get("deployment_address") is not None: fail(x["contract"]+" invented address")
    h=x.get("runtime_code_hash","")
    if not isinstance(h,str) or len(h)!=66 or not h.startswith("0x"): fail(x["contract"]+" runtime hash")
    if not x.get("immutable_materialization"): fail(x["contract"]+" immutable evidence")
live=d.get("live_testnet_evidence",{})
for k in ("chain_id","evidence_block","evidence_block_hash"):
    if live.get(k) is not None: fail("fabricated live "+k)
for k in ("deployment_transactions","registry_transactions","binding_transactions"):
    if live.get(k)!=[]: fail("fabricated live "+k)
if live.get("addresses")!={}: fail("fabricated live addresses")
if live.get("owner")!="PAY-AUDIT-7": fail("live evidence owner")
ctor=d.get("constructor_manifest",{})
if set(ctor)!=set(EXPECTED): fail("constructor manifest inventory")
for name,item in ctor.items():
    if item.get("governance_timelock")!=d.get("governance_timelock"): fail(name+" constructor timelock")
    if item.get("protocol_registry")!=d.get("protocol_registry"): fail(name+" constructor registry")
    if item.get("genesis_config_hash")!=d.get("genesis_config_hash"): fail(name+" constructor config")
    if name=="CanonicalSettlementAdapter420":
        if "executor_" not in item.get("constructor_signature",""): fail("adapter constructor executor")
        if not item.get("additional_arguments",{}).get("canonical_swap_executor"): fail("adapter executor manifest")
    elif item.get("additional_arguments")!={}: fail(name+" unexpected constructor dependency")
rp=d.get("registry_publication",{})
if rp.get("api")!="registerComponent" or rp.get("version")!={"major":1,"minor":0,"patch":0}: fail("Registry publication")
if rp.get("staging_lifecycle")!="SUSPENDED" or rp.get("activation_lifecycle")!="ACTIVE": fail("Registry lifecycle staging")
for key in ("payment_router_settlement_adapter","settlement_adapter_swap_executor","executor_trusted_caller","replay_domain_consumer","registry_identity","governance_handoff"):
    if not d.get("required_bindings",{}).get(key): fail("binding "+key)
w=json.loads(WIRING.read_text())
if w.get("deployment_binding_verified") is not False: fail("wiring falsely claims live deployment")
if w.get("pay_audit_6_repository_package")!="contracts/config/pay/pay-audit-6-deployment-package.json": fail("wiring package link")
if w.get("pay_audit_6_qualification_test")!="contracts/test/PayAudit6DeploymentPackage420.t.sol": fail("wiring test link")
if not RUNBOOK.is_file(): fail("operator runbook missing")
r=RUNBOOK.read_text()
for token in ("Rollback / recovery","Registry publication","Governance handoff","PAY-AUDIT-7","Indexer recovery"):
    if token not in r: fail("runbook section "+token)
road=ROADMAP.read_text()
if "PAY-AUDIT-6 — deterministic deployment package and Registry publication" not in road: fail("roadmap definition")
subprocess.check_call([sys.executable,str(ROOT/"scripts/generate-420pay-audit-6-deployment.py"),"--check"],cwd=ROOT)
subprocess.check_call([sys.executable,str(ROOT/"scripts/420pay-audit-6-deployment-plan.py"),"--check"],cwd=ROOT)
print("PAY_AUDIT_6_DEPLOYMENT_VERIFIER=PASS")

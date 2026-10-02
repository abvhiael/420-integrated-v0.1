#!/usr/bin/env python3
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
errors=[]

def read(path):
    p=ROOT/path
    if not p.exists():
        errors.append(f"missing {path}")
        return ""
    return p.read_text()

adapter=read("contracts/src/pay/adapters/CanonicalSettlementAdapter420.sol")
for token in ["address public paymentRouter", "setPaymentRouter", "msg.sender == paymentRouter"]:
    if token not in adapter: errors.append(f"adapter authority missing: {token}")

router=read("contracts/src/pay/PaymentRouter420.sol")
for token in ["_requirePayerOrGovernance", "_consumeSharedReplay", "PAY_SETTLEMENT", "_requireSharedFeeQuote", "merchant underpaid"]:
    if token not in router: errors.append(f"router invariant missing: {token}")

wiring=json.loads(read("contracts/config/420pay-genesis-wiring.json") or "{}")
if wiring.get("deployment_binding_verified") is not False:
    errors.append("live deployment binding must remain false until chain evidence exists")
if "payment_router_binding" not in wiring.get("settlement_adapter", {}):
    errors.append("settlement adapter payment-router binding missing from wiring manifest")

dep=json.loads(read("contracts/config/interfaces/420pay-dependency-reconciliation.json") or "{}")
required=set(dep.get("required_dependencies", []))
for name in ["ProtocolRegistry","CanonicalAssetRegistry","GovernanceAuthority","PauseRegistry","SettlementHealth","FeeQuote","SystemSafety","ReplayProtection","ChainContext","MetadataCommitment","AssetCapabilities"]:
    if name not in required: errors.append(f"required dependency missing: {name}")

lifecycle=read("420-indexer/src/lifecycle-reducer.ts")
for stale in ["PaymentCreated", "PaymentSettled", "PaymentRefunded", "PaymentCancelled", "PaymentExpired"]:
    pay_start=lifecycle.find("{ protocol: '420Pay'")
    bridge_start=lifecycle.find("{ protocol: '420Bridge'")
    if pay_start >= 0 and bridge_start > pay_start and stale in lifecycle[pay_start:bridge_start]:
        errors.append(f"stale Pay lifecycle event retained: {stale}")
for token in ["PaymentSet", "PaymentAuthorized", "stateField", "stateMap"]:
    if token not in lifecycle: errors.append(f"Pay lifecycle handling missing: {token}")

abi=read("420-indexer/src/abi-manifest.ts")
for name in ["InvoiceRegistry420","PaymentRegistry420","PaymentRouter420","SettlementRouter420","RefundManager420","GasSponsor420","CanonicalSettlementAdapter420"]:
    if f"{name}: '420Pay'" not in abi: errors.append(f"Indexer 420Pay classification missing: {name}")

genesis_apps=json.loads(read("config/genesis-applications.json") or "{}")
names={x.get("name") for x in genesis_apps.get("apps",[])}
if "420 Pay" in names or "420Pay" in names:
    errors.append("audit assumption changed: frozen Genesis application catalogue now contains 420Pay; reconcile audit report")

summary={
 "schema":"420pay-complete-audit-verifier-v1",
 "pass":not errors,
 "errors":errors,
 "known_blockers_enforced":[
   "deployment binding remains unverified until live evidence",
   "frozen Genesis user-application catalogue currently omits 420Pay",
   "external security audit remains separate production gate"
 ]
}
print(json.dumps(summary, indent=2))
sys.exit(0 if not errors else 2)

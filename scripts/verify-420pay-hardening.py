#!/usr/bin/env python3
import pathlib,json,sys
root=pathlib.Path(__file__).resolve().parents[1]; errors=[]
required=[
"contracts/src/pay/adapters/CanonicalSwapHealthAdapter420.sol","contracts/src/pay/adapters/CanonicalSettlementAdapter420.sol",
"contracts/src/interfaces/ICanonicalSettlement420.sol","contracts/test/SettlementRouter420Fuzz.t.sol",
"contracts/test/InvoiceRegistry420Fuzz.t.sol","contracts/test/RefundManager420Fuzz.t.sol",
"contracts/test/PaymentRouter420Limits.t.sol","contracts/test/GasSponsor420Limits.t.sol",
"contracts/test/PaymentAtomicSettlement420.t.sol","contracts/test/PaymentGenesisIntegration420.t.sol",
"contracts/test/PaymentInvariant420.t.sol","contracts/test/PaySwapGenesisIntegration420.t.sol"
]
for f in required:
    if not (root/f).exists(): errors.append("missing "+f)
router=(root/"contracts/src/pay/PaymentRouter420.sol").read_text()
for t in ["merchant underpaid","input overspend","gas overspend","slippage","consumedPaymentAuthorization","_requireSharedFeeQuote","IReplayProtection420"]:
    if t not in router: errors.append("router missing "+t)
sett=(root/"contracts/src/pay/adapters/CanonicalSettlementAdapter420.sol").read_text()
for t in ["quote replay","stale quote","_requireHealthyMarket","_canonicalSettlementAsset","under settlement","merchant underpaid","consumedQuote"]:
    if t not in sett: errors.append("settlement adapter missing "+t)
health=(root/"contracts/src/pay/adapters/CanonicalSwapHealthAdapter420.sol").read_text()
if "legacy compatibility facade" not in health.lower() or "mapping" in health:
    errors.append("legacy health adapter can diverge from shared health")
refund=(root/"contracts/src/pay/RefundManager420.sol").read_text()
if "refund exceeds payment" not in refund: errors.append("refund bound")
plan=json.loads((root/"contracts/config/pay/hardening-test-plan.json").read_text())
out={"pass":not errors,"errors":errors,"declared_test_suites":len(plan.get("suites",[])),"adapted_test_files":len([f for f in required if f.startswith("contracts/test/")])}
(root/"contracts/config/pay/hardening-verification.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2));sys.exit(0 if not errors else 2)

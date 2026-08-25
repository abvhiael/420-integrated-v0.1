#!/usr/bin/env python3
import json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[1]; errors=[]
files=[
"contracts/src/pay/InvoiceRegistry420.sol","contracts/src/pay/PaymentRegistry420.sol",
"contracts/src/pay/MerchantRegistry420.sol","contracts/src/pay/PaymentRouter420.sol",
"contracts/src/pay/SettlementRouter420.sol","contracts/src/pay/RefundManager420.sol",
"contracts/src/pay/GasSponsor420.sol","contracts/src/pay/AccountingCommitment420.sol",
]
for f in files:
    if not (root/f).exists(): errors.append("missing "+f)
resident=(root/"contracts/src/system/GenesisResidentAccess420.sol").read_text()
for tok in ["IGenesisResident420","IProtocolRegistry420","runtimeCodeHash","_requireOperational","_requireGenesisGovernance"]:
    if tok not in resident: errors.append("shared resident guard missing "+tok)
sett=(root/"contracts/src/pay/SettlementRouter420.sol").read_text()
for tok in ["MAX_RECIPIENTS = 8","BPS = 10_000","amount - assigned","_canonicalSettlementAsset","_requireHealthyMarket"]:
    if tok not in sett: errors.append("settlement invariant "+tok)
router=(root/"contracts/src/pay/PaymentRouter420.sol").read_text()
for tok in ["QUOTE_LIFETIME = 42 seconds","DEFAULT_MAX_SLIPPAGE_BPS = 42","PROTOCOL_FEE_BPS = 0",
            "input overspend","gas overspend","tip overspend","_requireHealthyMarket","IFeeQuote420","IReplayProtection420"]:
    if tok not in router: errors.append("router invariant "+tok)
sponsor=(root/"contracts/src/pay/GasSponsor420.sol").read_text()
for tok in ["420_000","0.042 ether","0.084 ether","17.64 ether","176.4 ether","4_200","1_000","_requireOperational"]:
    if tok not in sponsor: errors.append("sponsor invariant "+tok)
invoice=(root/"contracts/src/pay/InvoiceRegistry420.sol").read_text()
for tok in ["420/APP/420PAY_INVOICE","SINGLE_USE","quoteMaxSlippageBps <= 42","IMetadataCommitment420"]:
    if tok not in invoice: errors.append("invoice invariant "+tok)
payment=(root/"contracts/src/pay/PaymentRegistry420.sol").read_text()
for tok in ["420/APP/420PAY_PAYMENT_ID","payerNonce","duplicate"]:
    if tok not in payment: errors.append("payment invariant "+tok)
d4=json.loads((root/"contracts/config/pay/420pay-decision-4.json").read_text())
if d4.get("status")!="FROZEN": errors.append("decision4 not frozen")
out={"pass":not errors,"errors":errors,"contract_count":len(files),"shared_interface_v1":True}
(root/"contracts/config/pay/implementation-verification.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2));sys.exit(0 if not errors else 2)

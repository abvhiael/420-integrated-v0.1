#!/usr/bin/env python3
import json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[1];errors=[]
p=json.loads((root/"contracts/config/pay/420pay-parameters.json").read_text())
if p["status"]!="FROZEN":errors.append("not frozen")
if p["acceptance"]["default"]!="FINALIZED":errors.append("acceptance")
if p["invoice"]["default_mode"]!="SINGLE_USE":errors.append("invoice mode")
if p["invoice"]["partial_payment_default"] is not False:errors.append("partial default")
if p["invoice"]["quote_lifetime_seconds"]!=42:errors.append("quote lifetime")
if p["settlement"]["swap_assisted_execution"]!="ATOMIC_OR_REVERT":errors.append("atomic")
if p["settlement"]["centralized_price_fallback"] is not False:errors.append("fallback")
if p["settlement"]["settlement_asset_unavailable"]!="NO_SILENT_SUBSTITUTION":errors.append("substitution")
if p["gas_sponsor"]["arbitrary_transaction_authority"] is not False:errors.append("sponsor authority")
out={"pass":not errors,"errors":errors}
(root/"contracts/config/pay/verification.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2));sys.exit(0 if not errors else 2)

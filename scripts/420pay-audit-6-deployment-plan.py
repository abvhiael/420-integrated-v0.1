#!/usr/bin/env python3
"""Emit/check the canonical PAY-AUDIT-6 deployment and Registry publication plan."""
from __future__ import annotations
import argparse, json, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
PKG=ROOT/"contracts/config/pay/pay-audit-6-deployment-package.json"

def fail(msg): raise ValueError(msg)

def load():
    d=json.loads(PKG.read_text())
    if d.get("schema")!="420pay-audit-6-deployment-package-v1": fail("schema")
    if d.get("address_policy")!="REGISTRY_RESOLVED_NO_FIXED_PAY_ADDRESSES": fail("address policy")
    residents=d.get("residents",[])
    if len(residents)!=9: fail("resident count")
    if any(x.get("deployment_address") is not None for x in residents): fail("fixed Pay address invented")
    order=d.get("deployment_order",[])
    if len(order)<10: fail("deployment order incomplete")
    return d

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--check",action="store_true")
    p.add_argument("--print",action="store_true",dest="show")
    p.add_argument("--live",action="store_true",help="refuse unless explicit deployed addresses are supplied in a PAY-AUDIT-7 evidence file")
    args=p.parse_args()
    try:
        d=load()
        if args.live:
            live=d.get("live_testnet_evidence",{})
            if not live.get("chain_id") or not live.get("addresses"):
                fail("live transaction planning belongs to PAY-AUDIT-7 and requires approved candidate evidence")
        if args.check:
            expected=[
                "PaymentRouter420.settlementAdapter == CanonicalSettlementAdapter420",
                "PaymentRouter420.settlementRouter == SettlementRouter420",
                "CanonicalSettlementAdapter420.paymentRouter == PaymentRouter420",
                "CanonicalSettlementAdapter420.settlementRouter == SettlementRouter420",
                "CanonicalSettlementAdapter420.swapExecutor == CanonicalSwapExecutor420",
                "SettlementRouter420.paymentRouter == PaymentRouter420",
                "SettlementRouter420.settlementAdapter == CanonicalSettlementAdapter420",
                "RefundManager420.paymentRegistry == PaymentRegistry420",
                "CanonicalSwapExecutor420.trustedCaller(CanonicalSettlementAdapter420) == true",
                "ReplayProtectionConsumer420.domainConsumer(PAY_SETTLEMENT) == PaymentRouter420",
            ]
            vals=list(d.get("required_bindings",{}).values())
            for x in expected:
                if x not in vals: fail("missing binding "+x)
            rp=d.get("registry_publication",{})
            if rp.get("api")!="registerComponent" or rp.get("version")!={"major":1,"minor":0,"patch":0}:
                fail("Registry publication drift")
            if rp.get("staging_lifecycle")!="SUSPENDED" or rp.get("activation_lifecycle")!="ACTIVE":
                fail("Registry lifecycle staging drift")
        if args.show:
            print("PAY-AUDIT-6 deterministic plan")
            print("timelock="+d["governance_timelock"])
            print("registry="+d["protocol_registry"])
            print("genesisConfigHash="+d["genesis_config_hash"])
            for i,step in enumerate(d["deployment_order"],1): print(f"{i}. {step}")
        print("PAY_AUDIT_6_DEPLOYMENT_PLAN=PASS")
        return 0
    except (OSError,ValueError,KeyError,json.JSONDecodeError) as exc:
        print("PAY-AUDIT-6 deployment plan failed: "+str(exc),file=sys.stderr); return 2
if __name__=="__main__": raise SystemExit(main())

#!/usr/bin/env python3
"""Offline PAY-AUDIT-6 smoke. Live chain smoke belongs to PAY-AUDIT-7."""
from __future__ import annotations
import json, pathlib, subprocess, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
PKG=ROOT/"contracts/config/pay/pay-audit-6-deployment-package.json"
def main():
    d=json.loads(PKG.read_text())
    if d.get("live_qualified") is not False: raise SystemExit("package overclaims live qualification")
    subprocess.check_call([sys.executable,str(ROOT/"scripts/generate-420pay-audit-6-deployment.py"),"--check"],cwd=ROOT)
    subprocess.check_call([sys.executable,str(ROOT/"scripts/420pay-audit-6-deployment-plan.py"),"--check"],cwd=ROOT)
    if len(d.get("residents",[]))!=9: raise SystemExit("resident inventory drift")
    print("PAY_AUDIT_6_OFFLINE_SMOKE=PASS")
    print("live_chain_smoke_owner=PAY-AUDIT-7")
    return 0
if __name__=="__main__": raise SystemExit(main())

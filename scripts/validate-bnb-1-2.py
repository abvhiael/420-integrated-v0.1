#!/usr/bin/env python3
"""BNB-1.2 product contract and stage-boundary verifier."""
from pathlib import Path
import json, re, subprocess
ROOT=Path(__file__).resolve().parents[1]
DOC=ROOT/"docs/bnb/BNB-1.2-PRODUCT-SCOPE-AND-USER-JOURNEYS.md"
def need(ok,message):
    if not ok: raise SystemExit("BNB-1.2 FAIL: "+message)
def main():
    text=DOC.read_text()
    for section in ["Purpose and positioning","Actors, authority and separation","Complete intended product scope","Canonical user journeys","Booking policies requiring explicit decisions","Cannabis-aware accommodation rules","Release-stage matrix","Requirement traceability and downstream owners","Explicit deferred and non-goals","BNB-1.2 exit criteria"]:
        need(section in text,"missing section "+section)
    for n in range(1,17):
        need(len(re.findall(r"BNB-J%02d\b"%n,text)) >= 1,"missing mapped journey %02d"%n)
        need("BNB-P%02d"%n in text,"missing product requirement %02d"%n)
    for actor in ["Anonymous visitor","Guest","Host","Property manager","Moderator","Customer support","Administrator/operator","Protocol service adapter"]:
        need(actor in text,"missing actor "+actor)
    for word in ["DISABLED","420Pay","420Travel","420Reputation","Identity","cannabis","private"]:
        need(word.lower() in text.lower(),"missing boundary "+word)
    cfg=json.loads((ROOT/"config/420travel-genesis.json").read_text())
    need(cfg["bnb_compatibility"]["enabled_at_genesis"] is False,"BnB Genesis transactions enabled")
    for key in ["420BNB_BOOKING","DYNAMIC_PRICING","HOST_ESCROW","CANCELLATION_SETTLEMENT","INSURANCE_OR_DAMAGE_DEPOSITS"]:
        need(key in cfg["deferred_scope"],"missing defer "+key)
    flags=json.loads((ROOT/"config/genesis-consumer-services.json").read_text())["feature_flags"]
    need(any(x["key"]=="travel.bnb_booking" and x["genesis_default"] is False for x in flags),"Genesis feature flag enabled")
    sha=subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip()
    need(re.fullmatch(r"[0-9a-f]{40}",sha) is not None,"unbound SHA")
    print("BNB-1.2 product-contract qualification PASS; implementation SHA "+sha)
if __name__=="__main__": main()

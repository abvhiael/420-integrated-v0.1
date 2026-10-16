#!/usr/bin/env python3
"""Integer-exact Reference Slot candidate screening model; no production approval.

Amounts are integer *smallest units*. A published paytable must be passed
explicitly; no binary floats or fractional token payouts enter the evaluator.
Random draws are independent uniformly sampled stops; this is a statistical
model, not a claim of exact analytical RTP or keccak replay equivalence.
"""
import argparse
import hashlib
import json
import math
import random
from pathlib import Path

STRIP=32
SEED=4204401
REELS=5
ROWS=4
STAKE=100_000_000
CAP=5_000_000_000
BASE_PAYS=(10,15,20,30,50)
BASE_SCATTER=(0,0,0,100,250,500)

def fixture(divisor=80):
    if divisor < 1: raise ValueError("invalid divisor")
    # Fixture has 6 decimal units; all amounts, multiplications and caps
    # are integers. Truncation occurs here ONCE per approved table entry.
    unit=1_000_000
    return {
        "baseReels":[[(i+r)%7 for i in range(STRIP)] for r in range(REELS)],
        "featureReels":[[(i+r+2)%7 for i in range(STRIP)] for r in range(REELS)],
        "payoutPerWay":[(p*unit)//divisor for p in BASE_PAYS]+[0,0],
        "scatterPays":[(p*unit)//divisor for p in BASE_SCATTER],
        "stake":STAKE,"maxGross":CAP,"maxRetriggers":2,
        "initialFreeSpins":6,"retriggerSpins":3,"featureMultiplier":2
    }

def evaluate(reels, stops, p):
    grid=[[reels[r][(stops[r]+i)%STRIP] for i in range(ROWS)] for r in range(REELS)]
    scatters=sum(s==6 for reel in grid for s in reel)
    scatter_reels=sum(6 in reel for reel in grid)
    payout=p["scatterPays"][scatter_reels]
    for symbol in range(5):
        ways=1
        matched=0
        for reel in grid:
            count=sum(v==symbol or v==5 for v in reel)
            if count==0: break
            ways*=count
            matched+=1
        if matched>=3:
            payout+=ways*p["payoutPerWay"][symbol]
    return payout,scatters

def sample(rng,p):
    def roll(reels):
        return evaluate(reels,[rng.randrange(STRIP) for _ in range(REELS)],p)
    base,trigger=roll(p["baseReels"])
    feature=0
    retriggers=0
    remaining=p["initialFreeSpins"] if trigger>=3 else 0
    spins=0
    while remaining:
        award,scatter=roll(p["featureReels"])
        feature+=award*p["featureMultiplier"]
        remaining-=1
        spins+=1
        if scatter>=3 and retriggers<p["maxRetriggers"]:
            retriggers+=1
            remaining+=p["retriggerSpins"]
    assert spins<=12
    uncapped=base+feature
    return min(uncapped,p["maxGross"]),uncapped>p["maxGross"]

def report(p,samples,seed):
    if samples<1000: raise ValueError("minimum samples: 1000")
    rng=random.Random(seed)
    payout_sum=0
    cap_hits=0
    for _ in range(samples):
        gross,capped=sample(rng,p)
        payout_sum+=gross
        cap_hits+=capped
    mean=payout_sum/samples
    rtp_bps=payout_sum*10_000//(samples*p["stake"])
    width=p["maxGross"]*math.sqrt(math.log(200)/(2*samples))
    digest=hashlib.sha256(json.dumps(p,sort_keys=True,separators=(",",":")).encode()).hexdigest()
    return {"status":"NOT_APPROVED","model":"integer-denominated Monte Carlo independent uniform stops",
      "seed":seed,"samples":samples,"fixtureSha256":digest,
      "stakeSmallestUnits":p["stake"],"grossCapSmallestUnits":p["maxGross"],
      "maxNetBankrollLiabilitySmallestUnits":p["maxGross"]-p["stake"],
      "observedCapHits":cap_hits,"meanReturnSmallestUnits":mean,
      "estimatedRtpBpsFloor":rtp_bps,
      "estimatedRtpPercent":round(100*mean/p["stake"],6),
      "statistical99PercentIntervalRtpPercent":[round(max(0,100*(mean-width)/p["stake"]),6),
                                               round(100*(mean+width)/p["stake"],6)],
      "approvalRequired":True,"limitations":"Not exact theoretical RTP; no independently approved target or reviewer signatures"}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--samples",type=int,default=25000)
    ap.add_argument("--divisor",type=int,default=80)
    ap.add_argument("--seed",type=int,default=SEED)
    args=ap.parse_args()
    print(json.dumps(report(fixture(args.divisor),args.samples,args.seed),indent=2,sort_keys=True))

if __name__=="__main__": main()

#!/usr/bin/env python3
"""Independent candidate RTP/liability *calculation* for the Reference Slots fixture.

Not an external approval. Exact reproduction for seeded Monte Carlo, not exact
analytical expectation. This script deliberately refuses to issue approval.
"""
import argparse
import importlib.util
import json
import math
from pathlib import Path

modpath=Path(__file__).with_name("audit-420bet-reference-slot-rtp.py")
spec=importlib.util.spec_from_file_location("slot_fixture",modpath)
model=importlib.util.module_from_spec(spec)
spec.loader.exec_module(model)

def calibrate(samples, divisor, seed):
    import random
    rng=random.Random(seed)
    base, feature = model.reels(), model.reels(True)
    # Compute at full precision in 1/32 base units, then floor individual
    # slot awards as would a Solidity absolute-unit paytable.
    pays=tuple(p/divisor for p in model.PAYS)
    scatters=tuple(s/divisor for s in model.SCATTER)
    def spin(strips):
        stops=[rng.randrange(model.STRIP) for _ in range(model.NREELS)]
        grid=[[strips[r][(stop+i)%model.STRIP] for i in range(model.ROWS)]
              for r,stop in enumerate(stops)]
        count=sum(s==6 for reel in grid for s in reel)
        scatter_reels=sum(6 in reel for reel in grid)
        gross=scatters[scatter_reels]
        for sym in range(5):
            ways=1; matched=0
            for reel in grid:
                n=sum(s==sym or s==5 for s in reel)
                if not n: break
                ways*=n; matched+=1
            if matched>=3: gross+=ways*pays[sym]
        return gross,count
    payouts=[]; cap_count=0
    for _ in range(samples):
        base_pay,trigger=spin(base)
        feature_pay=0; spins=0; retriggers=0
        if trigger>=3:
            rem=6
            while rem:
                pay,scat=spin(feature)
                feature_pay+=2*pay
                rem-=1; spins+=1
                if scat>=3 and retriggers<2:
                    retriggers+=1;rem+=3
        uncapped=base_pay+feature_pay
        cap_count+=uncapped>model.CAP
        payouts.append(min(uncapped,model.CAP))
    estimated=sum(payouts)/samples/model.STAKE*100
    width=model.CAP*math.sqrt(math.log(200)/(2*samples))/model.STAKE*100
    return {'status':'CANDIDATE_ONLY_NOT_APPROVED','samples':samples,'seed':seed,
      'paytableScaleDenominator':divisor,'originalFixtureEstimatedRtpPercent':3086.7666,
      'candidateEstimatedRtpPercent':round(estimated,6),
      'candidate99HoeffdingIntervalPercent':[round(max(0,estimated-width),6),round(min(5000,estimated+width),6)],
      'candidateCappedWagers':cap_count,'enforcedGrossCap':5000,
      'maxReservedLiability':4900,'maxMultiplierBps':500000,
      'approvalStatus':'MISSING_INDEPENDENT_ECONOMIC_AND_LIABILITY_APPROVAL',
      'limitations':'Fixture-based stochastic estimate; precise contract integer rounding, keccak-derived reel stops and exact feature-chain expectation require further verification.'}

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('--samples',type=int,default=25000)
    ap.add_argument('--divisor',type=int,default=32)
    a=ap.parse_args()
    if a.samples<1000 or a.divisor<1: ap.error('invalid sampling parameters')
    print(json.dumps(calibrate(a.samples,a.divisor,4204401),indent=2,sort_keys=True))

#!/usr/bin/env python3
"""Deterministic independent model of ReferenceSlotV1420 test fixtures.

Statistical RTP estimate, NOT an exact production RTP proof or authorization.
Uses independent uniform reel-stop samples, not Ethereum keccak replay.
"""
import argparse
import hashlib
import json
import math
import random
from pathlib import Path

NREELS, ROWS, STRIP = 5, 4, 32
STAKE = 100
CAP = 5000
PAYS = (10,15,20,30,50)
SCATTER = (0,0,0,100,250,500)
SEED = 4204401
BASE_SPINS, RETRIGGER_SPINS, MAX_RETRIGGERS, MULTIPLIER = 6,3,2,2

def reels(feature=False):
    return tuple(tuple((pos+reel+(2 if feature else 0)) % 7 for pos in range(STRIP)) for reel in range(NREELS))

def evaluate(strips, stops):
    grid = [[strips[reel][(stop + row) % STRIP] for row in range(ROWS)]
            for reel, stop in enumerate(stops)]
    scatter_count = sum(symbol == 6 for reel in grid for symbol in reel)
    scatter_reels = sum(6 in reel for reel in grid)
    gross = SCATTER[scatter_reels]
    for symbol in range(5):
        ways = 1
        matched = 0
        for reel in grid:
            count = sum(s == symbol or s == 5 for s in reel)
            if count == 0:
                break
            ways *= count
            matched += 1
        if matched >= 3:
            gross += ways * PAYS[symbol]
    return gross, scatter_count

def sample(rng, base, feature):
    stops = [rng.randrange(STRIP) for _ in range(NREELS)]
    base_gross, scatters = evaluate(base, stops)
    feature_gross = 0
    spins = 0
    retriggers = 0
    if scatters >= 3:
        remaining = BASE_SPINS
        while remaining:
            spins += 1
            remaining -= 1
            stops = [rng.randrange(STRIP) for _ in range(NREELS)]
            pay, count = evaluate(feature, stops)
            feature_gross += MULTIPLIER * pay
            if count >= 3 and retriggers < MAX_RETRIGGERS:
                retriggers += 1
                remaining += RETRIGGER_SPINS
    assert spins <= 12 and retriggers <= 2
    gross = min(CAP, base_gross + feature_gross)
    return gross, base_gross, feature_gross, spins, retriggers

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--samples', type=int, default=25000)
    ap.add_argument('--output', type=Path)
    args = ap.parse_args()
    if args.samples < 1000:
        ap.error('at least 1000 samples required')
    base, feature = reels(), reels(True)
    rng = random.Random(SEED)
    total = total_sq = cap_hits = feature_hits = max_seen = 0
    for _ in range(args.samples):
        gross, raw_base, raw_feature, spins, retriggers = sample(rng, base, feature)
        total += gross
        total_sq += gross*gross
        cap_hits += (raw_base + raw_feature > CAP)
        feature_hits += (spins > 0)
        max_seen = max(max_seen, gross)
    mean = total / args.samples
    # Distribution-free, finite-sample 99% Hoeffding confidence bounds on
    # the expected gross payout, normalized to stake (sampling only).
    radius = CAP * math.sqrt(math.log(200) / (2*args.samples))
    # Conservative structural bound: all five regular symbols can have up to
    # 4^5 ways; up to 12 paid feature spins at 2x. Includes scatter payout.
    max_spin = (4**5)*sum(PAYS) + SCATTER[5]
    uncapped_upper = max_spin * (1 + MULTIPLIER*12)
    assert max_spin == 128500
    assert uncapped_upper == 3212500
    assert max_seen <= CAP
    fixture = {
        'baseReels': base, 'featureReels': feature, 'payoutPerWay': PAYS,
        'scatterReelsPays': SCATTER, 'stake': STAKE, 'maxGrossPayout': CAP,
        'featureSpins': BASE_SPINS, 'retriggerSpins': RETRIGGER_SPINS,
        'maxRetriggers': MAX_RETRIGGERS, 'featureMultiplier': MULTIPLIER
    }
    fixture_digest = hashlib.sha256(json.dumps(fixture, sort_keys=True, separators=(',',':')).encode()).hexdigest()
    result = {
        'kind': 'statistical-fixture-audit-not-production-approval',
        'fixtureSha256': fixture_digest,
        'samples':args.samples,'seed':SEED,'assumedStopModel':'independent uniform 0..31 for each spin/reel',
        'estimatedRtpPercent': round(100*mean/STAKE,6),
        'rtp99HoeffdingLowerPercent':round(100*max(0, mean-radius)/STAKE,6),
        'rtp99HoeffdingUpperPercent':round(100*min(CAP, mean+radius)/STAKE,6),
        'observedCappedWagers':cap_hits,
        'observedFeatureTriggers':feature_hits,
        'observedMaximumGross':max_seen,
        'uncappedStructuralUpperGross':uncapped_upper,
        'enforcedMaximumGross':CAP,
        'maxReservedLiability':CAP-STAKE,
        'limitation':'Monte Carlo gives an estimate, not an exact RTP, source-of-randomness equivalence proof, certified production reel set, or independent financial approval.'
    }
    rendered=json.dumps(result,sort_keys=True,indent=2)+'\n'
    if args.output:
        args.output.write_text(rendered)
    print(rendered,end='')

if __name__ == '__main__':
    main()

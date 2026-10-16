#!/usr/bin/env python3
"""Exact-arithmetic review of the proposed Keno V1 multiplier schedule.

This validates a candidate, NOT an approved or on-chain enforced paytable.
"""
import json
from fractions import Fraction
from math import comb
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
p=json.loads((ROOT/"contracts/config/420bet-keno-v1-paytable-candidate.json").read_text())
assert p["schema"]=="420bet-keno-v1-paytable-candidate"
assert (p["numbers"],p["draw"],p["minPicks"],p["maxPicks"])==(80,20,1,10)
assert p["releaseGate"]=="DENY_UNTIL_APPROVED_HASH_ENFORCED_BEFORE_WAGER_ACCEPTANCE"
assert p["approval"]["independentReviewer"] is None
assert p["approval"]["approvedRulesetHash"] is None
assert set(p["paytable"])==set(map(str,range(1,11)))
denominator=comb(80,20)
for count in range(1,11):
    row=p["paytable"][str(count)]
    assert all(str(x).isdigit() and 1<=int(x)<=count for x in row)
    assert row and all(Fraction(v)>0 and Fraction(v)>=1 for v in row.values())
    assert sum(comb(count,h)*comb(80-count,20-h) for h in range(count+1))==denominator
    expectation=sum((Fraction(comb(count,h)*comb(80-count,20-h),denominator)*Fraction(row.get(str(h),"0"))) for h in range(count+1))
    assert Fraction(88,100)<=expectation<=Fraction(92,100), (count, expectation)
    print(f"{count} picks: RTP={float(expectation)*100:.5f}%, house edge={float(1-expectation)*100:.5f}%, largest gross multiplier={max(map(Fraction,row.values()))}")
print("PASS: exact Keno odds, row coverage and bounded proposed player return; independent approval and enforcement still pending")

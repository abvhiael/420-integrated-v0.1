#!/usr/bin/env python3
"""Exact nonstrategic *stand-pat* 5-card Jacks-or-Better distribution.

This is a deterministic regression baseline, NOT an independently approved
optimal-play RTP for the player-selectable hold/draw lifecycle.  A complete
strategy-dependent RTP calculation and independent risk sign-off remain gates.
"""
from fractions import Fraction
from math import comb

TOTAL = comb(52, 5)
# Analytically exact 5-card initial deal counts, all suit combinations.
CATEGORIES = {
    "royal_flush": 4,
    "straight_flush": 36,
    "four_of_a_kind": 13 * 48,
    "full_house": 13 * comb(4, 3) * 12 * comb(4, 2),
    "flush": 4 * comb(13, 5) - 40,
    "straight": 10 * 4**5 - 40,
    "three_of_a_kind": 13 * comb(4, 3) * comb(12, 2) * 4**2,
    "two_pair": comb(13, 2) * comb(4, 2)**2 * 11 * 4,
    "jacks_or_better": 4 * comb(4, 2) * comb(12, 3) * 4**3,
}
CATEGORIES["nothing"] = TOTAL - sum(CATEGORIES.values())
assert TOTAL == 2598960
assert CATEGORIES == {
    "royal_flush": 4, "straight_flush": 36, "four_of_a_kind": 624,
    "full_house": 3744, "flush": 5108, "straight": 10200,
    "three_of_a_kind": 54912, "two_pair": 123552,
    "jacks_or_better": 337920, "nothing": 2062860
}
MULTIPLIERS = {
    "royal_flush": 250, "straight_flush": 50, "four_of_a_kind": 25,
    "full_house": 9, "flush": 6, "straight": 4, "three_of_a_kind": 3,
    "two_pair": 2, "jacks_or_better": 1, "nothing": 0
}
for credits in range(1, 6):
    m = dict(MULTIPLIERS)
    if credits == 5:
        m["royal_flush"] = 800
    ratio = Fraction(sum(CATEGORIES[k] * m[k] for k in CATEGORIES), TOTAL)
    expected = Fraction(7817, 23205) if credits == 5 else Fraction(109163, 324870)
    assert ratio == expected, f"unexpected RTP credit={credits}: {ratio}"
    print(f"stand-pat credits={credits} gross_RTP_exact={ratio} "
          f"RTP_percent={100*float(ratio):.9f} "
          f"house_edge_percent={100*(1-float(ratio)):.9f}")
print("PASS: all 2,598,960 initial-hand outcomes accounted for analytically.")
print("NOT QUALIFIED: hold/draw optimal-strategy RTP, provider fairness and external economics approval.")

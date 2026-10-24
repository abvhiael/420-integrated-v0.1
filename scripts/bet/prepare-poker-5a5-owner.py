#!/usr/bin/env python3
"""Prepare the actual 5A.5 and affected inherited native owners, without mocks."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[2] / 'contracts/test'
out = root / 'poker-5a5-focused'
out.mkdir(exist_ok=True)
seen = set()

def copy(name):
    if name in seen:
        return
    source = root / name
    if not source.is_file():
        raise SystemExit('missing native test dependency ' + name)
    seen.add(name)
    body = source.read_text(encoding='utf-8')
    for dep in re.findall(r'import\s+["\x27](\./[^"\x27]+)["\x27]\s*;', body):
        copy(Path(dep).name)
    (out / name).write_text(body.replace('../src/', '../../src/'), encoding='utf-8')

for name in ('BetPokerShowdown57.t.sol', 'BetPokerEvaluation56.t.sol', 'BetPokerBettingRounds55.t.sol', 'BetPokerWS8FrozenHandContext54.t.sol',
             'BetPokerNLHEBetting54.t.sol', 'BetPokerNativeOutcome54.t.sol',
             'BetPokerActionDisputeClock54.t.sol', 'BetPokerRecovery54.t.sol',
             'BetPokerLedgerReentrancy54.t.sol', 'BetPokerHandRank54.t.sol',
             'BetPokerCanonicalSettlement54.t.sol'):
    copy(name)
print('Prepared actual 5A.5 and inherited native owners:', ', '.join(sorted(seen)))

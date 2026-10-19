#!/usr/bin/env python3
"""Fail-closed reproducible Slither triage limited to the 420Bet poker security graph.

Unrelated Solidity contracts are not reported as poker audit results.
Never mark severity High/Medium as approved without correcting it or creating
an explicit, separately reviewed risk acceptance tied to an exact SHA.
"""
import json
import pathlib
import re
import sys

if len(sys.argv) != 3:
    raise SystemExit("usage: triage_slither_poker.py slither.json output.json")
report = json.loads(pathlib.Path(sys.argv[1]).read_text())
if report.get("success") is not True:
    raise SystemExit("slither analyzer reported unsuccessful execution")
focus = re.compile(
    r"(?:^|/)src/bet/(?:PokerNLHEBetting420|PokerNativeOutcome420|"
    r"PokerLiveCardReveals420|PokerCanonicalSettlement420|PokerSeatLedger420|"
    r"PokerGnarkElGamalAdapters420|PokerGnarkCardRevealAdapters420|"
    r"PokerPrivateShuffleGate420|PokerInitialEncryptedDeck420|"
    r"PokerVerifierVersions420)\.sol$"
)
records = []
for item in report.get("results", {}).get("detectors", []):
    sources = []
    for el in item.get("elements", []):
        loc = el.get("source_mapping", {})
        relative = str(loc.get("filename_relative", "")).replace("\\", "/")
        if relative and focus.search(relative):
            sources.append(relative)
    if not sources:
        continue
    records.append({
        "severity": item.get("impact", "Unknown"),
        "confidence": item.get("confidence", "Unknown"),
        "check": item.get("check", ""),
        "description": item.get("description", ""),
        "files": sorted(set(sources)),
    })
records.sort(key=lambda r: (r["severity"], r["check"], r["files"]))
pathlib.Path(sys.argv[2]).write_text(json.dumps({
    "tool": "Slither 0.11.6",
    "scope": "420Bet poker canonical execution and proof contracts",
    "total": len(records),
    "findings": records,
}, indent=2) + "\n")
severe = [r for r in records if r["severity"].lower() in {"high", "medium"}]
print(f"Poker Slither findings: {len(records)}; high/medium: {len(severe)}")
for finding in severe:
    print(f"{finding['severity']} {finding['check']}: {', '.join(finding['files'])}")
if severe:
    raise SystemExit("unresolved high/medium severity poker findings block Level 1")

#!/usr/bin/env python3
"""BET-AUDIT game/platform invariant verifier. Local model, NOT live settlement proof."""
import argparse
import json
from dataclasses import dataclass
from pathlib import Path

class QualificationError(ValueError):
    pass

def integer(value, name):
    if type(value) is not int or value < 0:
        raise QualificationError(f"{name} must be a nonnegative integer")
    return value

@dataclass
class Book:
    bankroll: int
    reserved: int = 0
    stakes_held: int = 0
    settled: int = 0
    refunded: int = 0
    operator_fees: int = 0

    def __post_init__(self):
        integer(self.bankroll, "bankroll")

class Ledger:
    """Small independent reference model. Units are smallest indivisible token units."""
    def __init__(self, bankroll):
        self.book = Book(bankroll)
        self.wagers = {}

    def accept(self, wager_id, stake, max_gross):
        if not isinstance(wager_id, str) or not wager_id:
            raise QualificationError("invalid wager id")
        stake = integer(stake, "stake")
        gross = integer(max_gross, "max_gross")
        if stake == 0 or gross < stake or wager_id in self.wagers:
            raise QualificationError("zero stake, undercollateralized quote or replay")
        # The stake is separately escrowed; bankroll collateral covers maximum net loss.
        net = gross - stake
        if net > self.book.bankroll - self.book.reserved:
            raise QualificationError("insufficient available bankroll")
        self.wagers[wager_id] = {"stake": stake, "gross": gross, "state": "open"}
        self.book.reserved += net
        self.book.stakes_held += stake
        self.check()

    def close(self, wager_id, outcome, gross=0, fee=0):
        wager = self.wagers.get(wager_id)
        if not wager or wager["state"] != "open":
            raise QualificationError("unknown or already terminal wager")
        integer(gross, "gross")
        integer(fee, "fee")
        if outcome not in ("settle", "refund"):
            raise QualificationError("invalid outcome")
        if outcome == "refund":
            if gross != 0 or fee != 0:
                raise QualificationError("refund cannot carry payout or fee")
        elif gross > wager["gross"] or fee > wager["stake"]:
            raise QualificationError("payout above authorized cap or fee above stake")
        stake = wager["stake"]
        self.book.reserved -= wager["gross"] - stake
        self.book.stakes_held -= stake
        if outcome == "refund":
            self.book.refunded += stake
        else:
            # The payout is paid from escrowed stake + bankroll.
            # An operator fee remains inside the bankroll; it cannot leave twice.
            self.book.bankroll += stake - gross
            self.book.operator_fees += fee
            self.book.settled += gross
        wager["state"] = outcome
        self.check()

    def check(self):
        b = self.book
        if min(b.bankroll, b.reserved, b.stakes_held) < 0 or b.reserved > b.bankroll:
            raise QualificationError("negative escrow or overcommitted collateral")
        open_wagers = [w for w in self.wagers.values() if w["state"] == "open"]
        if b.reserved != sum(w["gross"] - w["stake"] for w in open_wagers):
            raise QualificationError("reserved-liability conservation failed")
        if b.stakes_held != sum(w["stake"] for w in open_wagers):
            raise QualificationError("stake escrow conservation failed")

def replay(case):
    if not isinstance(case, dict) or set(case) != {"bankroll", "events"}:
        raise QualificationError("case requires bankroll and events")
    ledger = Ledger(integer(case["bankroll"], "bankroll"))
    if not isinstance(case["events"], list):
        raise QualificationError("events must be list")
    for event in case["events"]:
        if not isinstance(event, dict):
            raise QualificationError("event must be object")
        kind = event.get("type")
        if kind == "accept" and set(event) == {"type", "id", "stake", "maxGross"}:
            ledger.accept(event["id"], event["stake"], event["maxGross"])
        elif kind in ("settle", "refund"):
            expected = {"type", "id", "gross", "fee"} if kind == "settle" else {"type", "id"}
            if set(event) != expected:
                raise QualificationError("unexpected terminal fields")
            ledger.close(event["id"], kind, event.get("gross", 0), event.get("fee", 0))
        else:
            raise QualificationError("unknown event or unexpected fields")
    ledger.check()
    return ledger

# External approvals cannot be inferred from a passing model test.
EXTERNAL_GATES = (
    "economicPolicy", "independentMath", "independentRisk", "operatorAuthority",
    "canonicalDeployment", "testnetReceipts", "jurisdictionEligibility",
    "independentRelease",
)
VERTICALS = ("dice", "keno", "plinko", "slots", "roulette", "blackjack",
             "mines", "crash", "videoPoker", "poker", "tournaments",
             "fantasy", "sportsbook")

def check_release_manifest(manifest):
    if not isinstance(manifest, dict) or set(manifest) != {"schema", "verticals"}:
        raise QualificationError("invalid release manifest schema")
    if manifest["schema"] != "420bet-qualification-v1":
        raise QualificationError("wrong manifest version")
    verticals = manifest["verticals"]
    if not isinstance(verticals, dict) or set(verticals) != set(VERTICALS):
        raise QualificationError("missing or foreign vertical")
    outstanding = []
    for name in VERTICALS:
        row = verticals[name]
        if not isinstance(row, dict) or set(row) != {"implementation", "externalGates"}:
            raise QualificationError(f"{name}: missing evidence fields")
        if row["implementation"] not in ("open", "local-candidate", "exact-sha-passed"):
            raise QualificationError(f"{name}: invalid implementation state")
        gates = row["externalGates"]
        if not isinstance(gates, dict) or set(gates) != set(EXTERNAL_GATES):
            raise QualificationError(f"{name}: missing external gate")
        for gate, record in gates.items():
            if not isinstance(record, dict) or set(record) != {"status", "evidence"}:
                raise QualificationError(f"{name}/{gate}: malformed evidence")
            if record["status"] not in ("open", "pass"):
                raise QualificationError(f"{name}/{gate}: invalid status")
            evidence = record["evidence"]
            if record["status"] == "pass":
                if not isinstance(evidence, dict) or set(evidence) != {
                    "sha256", "reviewer", "date", "reference"
                }:
                    raise QualificationError(f"{name}/{gate}: unbound PASS")
                if (not isinstance(evidence["sha256"], str)
                    or len(evidence["sha256"]) != 64
                    or any(c not in "0123456789abcdef" for c in evidence["sha256"])
                    or any(not isinstance(evidence[k], str) or not evidence[k].strip()
                           for k in ("reviewer", "date", "reference"))):
                    raise QualificationError(f"{name}/{gate}: invalid reference")
                # Presence alone is NOT verification of signature, review or receipts.
                outstanding.append(f"{name}/{gate}: evidence authenticity not verified")
            else:
                if evidence is not None:
                    raise QualificationError(f"{name}/{gate}: OPEN cannot assert evidence")
                outstanding.append(f"{name}/{gate}: OPEN")
        if row["implementation"] != "exact-sha-passed":
            outstanding.append(f"{name}: no exact-SHA local qualification")
    return outstanding

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path, help="JSON local ledger trace or release evidence inventory")
    parser.add_argument("--release-inventory", action="store_true")
    args = parser.parse_args()
    payload = json.loads(args.path.read_text())
    try:
        if args.release_inventory:
            gaps = check_release_manifest(payload)
            print(f"Inventory parsed; {len(gaps)} outstanding/unverified gates. NO RELEASE APPROVAL")
            for gap in gaps:
                print(f"OPEN: {gap}")
            return 2
        ledger = replay(payload)
        print(f"PASS local reference ledger: {len(ledger.wagers)} wagers; "
              f"bankroll={ledger.book.bankroll}; reserved={ledger.book.reserved}")
        return 0
    except QualificationError as exc:
        print(f"FAIL: {exc}")
        return 1

if __name__ == "__main__":
    raise SystemExit(main())

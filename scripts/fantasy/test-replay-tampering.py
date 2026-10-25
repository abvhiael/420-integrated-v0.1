#!/usr/bin/env python3
"""Require rejection of modified execution evidence, including conserved payout substitution."""
import importlib.util
import json
from pathlib import Path
import re
import sys

module_path = Path(__file__).with_name("replay-contest.py")
spec = importlib.util.spec_from_file_location("fantasy_replay", module_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def flip_hex(value):
    return value[:-1] + format(int(value[-1], 16) ^ 1, "x")


def run(trace):
    module.replay(trace)  # Mandatory positive control before every negative suite.
    scenarios = {}
    scenarios["conserved_payout_substitution"] = trace.replace("amount: 175)", "amount: 174)", 1).replace("amount: 58)", "amount: 59)", 1)
    scenarios["altered_score"] = trace.replace("entry: 1, score: 100)", "entry: 1, score: 101)", 1)
    lines = trace.splitlines(keepends=True)
    for name, token in (("stat_witness", "FantasyNHLScoring420::calculate("),
                        ("receipt_signature", "FantasyAdmission420::verifyReceipt("),
                        ("encrypted_lineup", "emit EntryAccepted("),
                        ("candidate_root", "rankingRoot:"),
                        ("settlement_digest", "emit PoolSettled(")):
        altered = list(lines)
        index = next(i for i, line in enumerate(lines) if token in line)
        line = altered[index]
        if name == "receipt_signature":
            matches = list(re.finditer(r"0x[0-9a-fA-F]+", line))
            match = matches[2]
        elif name == "encrypted_lineup":
            match = re.search(r"envelope: (0x[0-9a-fA-F]+)", line)
            start, end = match.span(1)
            altered[index] = line[:start] + flip_hex(match[1]) + line[end:]
            scenarios[name] = "".join(altered)
            continue
        elif name == "candidate_root":
            match = re.search(r"rankingRoot: (0x[0-9a-fA-F]+)", line)
            start, end = match.span(1)
            altered[index] = line[:start] + flip_hex(match[1]) + line[end:]
            scenarios[name] = "".join(altered)
            continue
        elif name == "settlement_digest":
            match = re.search(r"candidate: (0x[0-9a-fA-F]+)", line)
            start, end = match.span(1)
            altered[index] = line[:start] + flip_hex(match[1]) + line[end:]
            scenarios[name] = "".join(altered)
            continue
        else:
            match = list(re.finditer(r"0x[0-9a-fA-F]+", line))[-1]
        value = match[0]
        # Alter a byte in r, not the recovery-ID byte; proof tests alter a proof word.
        replacement = (value[:4] + format(int(value[4], 16) ^ 1, "x") + value[5:]) if name == "receipt_signature" else flip_hex(value)
        altered[index] = line[:match.start()] + replacement + line[match.end():]
        scenarios[name] = "".join(altered)
    scenarios["wrong_chain_context"] = re.sub(r"chainId: 31337", "chainId: 420", trace, count=1)
    scenarios["wrong_entry_fee"] = trace.replace("paid: true, fee: 100,", "paid: true, fee: 101,", 1)
    scenarios["missing_admission_evidence"] = "\n".join(line for line in trace.splitlines() if "emit EntryAccepted(" not in line)
    scenarios["wrong_development_amount"]=trace.replace("amount: 9)","amount: 8)",1)
    scenarios["missing_development_transfer"]="\n".join(line for line in trace.splitlines() if "emit Withdrawn(" not in line)
    rejected = []
    for name, altered in scenarios.items():
        if altered == trace:
            raise AssertionError("tampering scenario did not mutate evidence: " + name)
        try:
            module.replay(altered)
        except Exception:
            rejected.append(name)
        else:
            raise AssertionError("tampered execution evidence accepted: " + name)
    return {"positiveControls": 1, "rejectedCount": len(rejected), "rejected": rejected}


if __name__ == "__main__":
    report = run(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
    Path(sys.argv[2]).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))

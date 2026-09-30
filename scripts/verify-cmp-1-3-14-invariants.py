#!/usr/bin/env python3
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
MATRIX = ROOT / "docs/compute-market/cmp-1.3.14-invariant-evidence.json"
ARCH = ROOT / "docs/420-COMPUTE-MARKET-V1-ARCHITECTURE.md"

ALLOWED = {"direct", "transitive_retained", "non_applicable_worker_registry_authority"}
EXPECTED = [f"CMP-INV-{i:03d}" for i in range(1, 31)]

def fail(message: str) -> None:
    print(f"CMP-1.3.14 invariant verification failed: {message}", file=sys.stderr)
    raise SystemExit(1)

data = json.loads(MATRIX.read_text(encoding="utf-8"))
items = data.get("invariants")
if not isinstance(items, list):
    fail("invariants must be a list")

ids = [item.get("id") for item in items]
if ids != EXPECTED:
    fail(f"invariant IDs must be exactly {EXPECTED}; got {ids}")
if len(set(ids)) != 30:
    fail("duplicate invariant IDs detected")

architecture = ARCH.read_text(encoding="utf-8")
for invariant_id in EXPECTED:
    if invariant_id not in architecture:
        fail(f"{invariant_id} missing from canonical architecture")

for item in items:
    invariant_id = item["id"]
    disposition = item.get("disposition")
    if disposition not in ALLOWED:
        fail(f"{invariant_id} has invalid disposition {disposition!r}")
    evidence = item.get("evidence")
    if not isinstance(evidence, list) or not evidence:
        fail(f"{invariant_id} has no evidence")
    note = item.get("note")
    if not isinstance(note, str) or not note.strip():
        fail(f"{invariant_id} has no explanatory note")

    for ref in evidence:
        if not isinstance(ref, str) or not ref:
            fail(f"{invariant_id} contains invalid evidence reference")
        if "::" in ref:
            path_text, symbol = ref.split("::", 1)
        else:
            path_text, symbol = ref, None
        path = ROOT / path_text
        if not path.is_file():
            fail(f"{invariant_id} references missing file {path_text}")
        if symbol:
            source = path.read_text(encoding="utf-8")
            function_pattern = re.compile(r"\bfunction\s+" + re.escape(symbol) + r"\b")
            if not function_pattern.search(source) and symbol not in source:
                fail(f"{invariant_id} references missing function/test label {symbol} in {path_text}")

direct = sum(1 for item in items if item["disposition"] == "direct")
transitive = sum(1 for item in items if item["disposition"] == "transitive_retained")
na = sum(1 for item in items if item["disposition"] == "non_applicable_worker_registry_authority")
print(f"CMP-1.3.14 invariant matrix verified: 30/30 ({direct} direct, {transitive} transitive, {na} non-applicable).")

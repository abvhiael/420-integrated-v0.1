#!/usr/bin/env python3
"""Verify C08.5 frozen inputs; passing this is not a phase or legal certificate."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
record = json.loads((root / "docs/compliance/qualification/C08.5-candidate-inputs.json").read_text())
assert record["step"] == "C08.5" and record["qualification_level"] == 3
assert record["release_enabled"] is False
assert record["production_policy_approval"] == "NOT_GRANTED_PROVISIONAL_FIXTURES_ONLY"
assert record["historical_standalone_evidence"] == "NOT_VERIFIED"
assert set(record["external_workstreams"]) == {"LEGAL", "IDENTITY", "CONSUMERS", "RECOVERY", "HISTORY"}
for path, digest in record["source_sha256"].items():
    assert not path.startswith("/") and ".." not in Path(path).parts
    assert hashlib.sha256((root / path).read_bytes()).hexdigest() == digest, path
print(f'C08.5 frozen inputs PASS: {len(record["source_sha256"])} SHA-256 pins; external release remains disabled')

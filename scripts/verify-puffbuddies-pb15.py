#!/usr/bin/env python3
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
ROAD=(ROOT/"docs/puffbuddies/PUFFBUDDIES-ROADMAP.md").read_text()
DOC=(ROOT/"docs/puffbuddies/PB-15-QUALIFICATION-PHASE.md").read_text()

def need(ok,msg):
    if not ok:
        raise SystemExit("FAIL: "+msg)

for n in range(3,15):
    need(re.search(rf"^### PB-{n} — .* — COMPLETE$", ROAD, re.M) is not None,
         f"PB-{n} is not durably marked COMPLETE")

required=[
    "docs/puffbuddies/PB-0.20-QUALIFICATION.md",
    "docs/puffbuddies/PB-1.13-QUALIFICATION.md",
    "docs/puffbuddies/PB-1.14-PHASE-CLOSEOUT.md",
    "docs/puffbuddies/PB-2.14-QUALIFICATION.md",
]
required += [f"docs/puffbuddies/PB-{n}-QUALIFICATION.md" for n in range(3,15)]
for rel in required:
    need((ROOT/rel).is_file(),f"missing retained qualification record: {rel}")

for path in [
    "puffbuddies/tests/test_pb_1_7_migrations.py",
    "puffbuddies/tests/test_pb_1_11_adversarial_state_machine.py",
    "puffbuddies/tests/test_pb_1_12_persistence_recovery.py",
    "puffbuddies/tests/test_pb_2_11_adversarial_identity_eligibility.py",
    "puffbuddies/tests/test_pb_8_safety_moderation.py",
    "puffbuddies/tests/test_pb_14_backend_api_hardening.py",
    "puffbuddies/web/test/web.test.js",
    "puffbuddies/mobile/test/mobile.test.js",
]:
    need((ROOT/path).is_file(),f"missing retained qualification surface: {path}")

for script in [
    "scripts/verify-puffbuddies-pb0.py",
    "scripts/verify-puffbuddies-pb13.py",
    "scripts/verify-puffbuddies-pb14.py",
    "scripts/verify-genesis-dapps.py",
    "scripts/verify-reg-audit-7-integration.py",
    "scripts/verify-420pay-audit.py",
    "scripts/verify-420messenger-audit.py",
]:
    need((ROOT/script).is_file(),f"missing retained dependency verifier: {script}")

need("Level 2 milestone E" in DOC,"PB-15 milestone classification missing")
need("PB-16" in DOC and "Security/privacy audit" in DOC,"next canonical phase missing")
need("Intentionally deferred Level 3" in DOC,"Level-3 boundary missing")
need("does not perform the final monolithic reconciliation" in DOC,"current-main policy missing")
need(not (ROOT/"contracts/src/puffbuddies").exists(),"unexpected PuffBuddies contract surface")

print("PASS: PuffBuddies PB-15 accumulated qualification reconciliation")

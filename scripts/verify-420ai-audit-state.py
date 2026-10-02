#!/usr/bin/env python3
"""Qualify the durable repository-state claims in the 2026-10-02 420AI audit.

This verifier intentionally validates the audit snapshot, not 420AI release readiness.
When AI-AUDIT-3 implements a currently-missing module, update the audit/evidence and
this verifier in the same exact-head change.
"""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AI = ROOT / "contracts" / "src" / "ai"
MAP = ROOT / "contracts" / "config" / "genesis-dapp-contract-map.json"
REPORT = ROOT / "docs" / "audit" / "420AI-COMPLETE-AUDIT-20261002.md"
ROADMAP = ROOT / "docs" / "audit" / "420AI-AUDIT-REMEDIATION-ROADMAP.md"

present = {
    "AIProviderRegistry.sol",
    "AIModelRegistry.sol",
    "AIJobManager.sol",
    "AIJobEscrow.sol",
    "AIReputationRegistry.sol",
    "AIIds420.sol",
}
missing = {
    "AIAuthorization420.sol",
    "AIPolicyRegistry420.sol",
    "AIModelDeploymentRegistry420.sol",
    "AIRequestRegistry420.sol",
    "AIResultRegistry420.sol",
    "AIComputeAdapter420.sol",
    "AIRouter420.sol",
    "IAI420.sol",
}
stale_standalone = "AIModelVersionRegistry420.sol"

errors: list[str] = []

for name in sorted(present):
    if not (AI / name).is_file():
        errors.append(f"expected present AI source missing: {name}")

for name in sorted(missing):
    if (AI / name).exists():
        errors.append(
            f"audit snapshot drift: {name} now exists; update audit status/evidence and verifier"
        )

if (AI / stale_standalone).exists():
    errors.append(
        "audit snapshot drift: standalone AIModelVersionRegistry420.sol now exists; "
        "reconcile single-authority model-version architecture"
    )

doc = json.loads(MAP.read_text())
ai_entries = [x for x in doc.get("apps", []) if x.get("dapp") == "420 AI"]
if len(ai_entries) != 1:
    errors.append(f"expected exactly one 420 AI dApp map entry, found {len(ai_entries)}")
else:
    listed = set(ai_entries[0].get("contracts", []))
    for name in sorted(present | missing | {stale_standalone}):
        if name not in listed and name not in {"AIIds420.sol", "IAI420.sol"}:
            errors.append(f"canonical 420 AI dApp map no longer lists expected audit component: {name}")

report = REPORT.read_text()
roadmap = ROADMAP.read_text()
required_report_tokens = [
    "CODE COMPLETE: NO",
    "CONTRACT COMPLETE: NO",
    "TESTNET READY: NO",
    "GENESIS READY: NO",
    "PRODUCTION READY: NO",
    "AI-INV-027",
    "3969 behind",
]
for token in required_report_tokens:
    if token not in report:
        errors.append(f"audit report missing durable finding: {token}")

for step in range(1, 13):
    token = f"AI-AUDIT-{step}"
    if token not in roadmap:
        errors.append(f"roadmap missing {token}")

if errors:
    print("420AI audit-state qualification FAILED")
    for error in errors:
        print(f"- {error}")
    raise SystemExit(1)

print("420AI audit-state qualification PASSED")
print(f"verified present compatibility/source set: {len(present)}")
print(f"verified canonical missing module set: {len(missing)}")
print("verified standalone model-version registry remains absent/stale")
print("verified durable audit report and AI-AUDIT-1..12 roadmap")

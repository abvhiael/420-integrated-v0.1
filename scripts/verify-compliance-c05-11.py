#!/usr/bin/env python3
"""C05.11 narrow decision and authority-separation qualification."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
def read(path):
    return (root / path).read_text(encoding="utf-8")
def require(condition, description):
    if not condition:
        raise SystemExit("C05.11 FAIL: " + description)

roadmap = read("docs/compliance/420COMPLIANCE-ROADMAP.md")
decision = read("docs/compliance/C05.11-ONCHAIN-ATTESTATION-SUITABILITY.md")
registry = read("docs/apps/registry/index.md")
verify = read("docs/apps/verify/index.md")
governance = read("docs/apps/governance/index.md")
oracle_review = read("docs/compliance/C05.8-ORACLE-SUITABILITY.md")
require("C05.11 | Optional on-chain publication/attestation adapter only after demonstrated need" in roadmap, "canonical roadmap step missing")
for phrase in ("NO NEW ON-CHAIN ADAPTER OR CONTRACT JUSTIFIED", "420Registry", "420Verify",
               "420Governance", "420Notifications", "420Oracle",
               "no Solidity contract", "C09.2", "C09.5", "C08.5",
               "DENY/REVIEW_REQUIRED", "C05.12"):
    require(phrase in decision, "decision missing: " + phrase)
require("ProtocolRegistry" in registry and "does not grant custody" in registry,
        "Registry non-authority contract drift")
require("does **not** certify" in verify and "deployed" in verify, "Verify non-authority drift")
require("Timelock" in governance and "cannot alter Governance outcomes" in governance,
        "governance separation drift")
require("NO ORACLE ADAPTER REQUIRED" in oracle_review, "contradictory Oracle suitability")
print("C05.11 no-chain-adapter / Registry Verify Governance authority suitability: PASS")

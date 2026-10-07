#!/usr/bin/env python3
import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parents[1]
errors = []

def require(path):
    p = root / path
    if not p.exists():
        errors.append("missing " + path)
        return None
    return p

def load(path):
    p = require(path)
    if not p:
        return {}
    try:
        return json.loads(p.read_text())
    except Exception as exc:
        errors.append(f"{path}: invalid JSON: {exc}")
        return {}

genesis = load("contracts/config/420attention-genesis.json")
if genesis.get("schema") != "420-attention-genesis-v1":
    errors.append("Attention Genesis schema drifted")
invariants = genesis.get("invariants", [])
for i in range(1, 15):
    token = f"ATTN-INV-{i:03d}"
    if not any(str(x).startswith(token + ":") for x in invariants):
        errors.append("missing " + token)

contract_map = load("contracts/config/genesis-dapp-contract-map.json")
apps = {x.get("dapp"): x for x in contract_map.get("apps", [])}
expected = {
    "AttentionTreasury.sol",
    "CannaseurCampaignRegistry.sol",
    "AttentionIds420.sol",
    "AttentionAuthorization420.sol",
    "AttentionConsentRegistry420.sol",
    "AttentionProofRegistry420.sol",
    "AttentionRewardRegistry420.sol",
    "AttentionRouter420.sol",
}
actual = set(apps.get("420 Attention", {}).get("contracts", []))
if actual != expected:
    errors.append("420 Attention Genesis contract inventory drifted")
if apps.get("420 Attention", {}).get("products") != ["420 Cannaseur"]:
    errors.append("Cannaseur product binding drifted")

namespace = load("contracts/config/genesis-address-namespace.json")
fixed = {x.get("name"): x.get("address") for x in namespace.get("fixedAssignments", [])}
if fixed.get("AttentionTreasury") != "0x0000000000000000000000000000000000000421":
    errors.append("AttentionTreasury frozen address drifted")
if fixed.get("CannaseurCampaignRegistry") != "0x000000000000000000000000000000000000043b":
    errors.append("CannaseurCampaignRegistry frozen address drifted")
resolved = {x.get("id"): x for x in namespace.get("registryResolved", [])}
if resolved.get("attention-router", {}).get("contract") != "AttentionRouter420.sol":
    errors.append("attention-router registry resolution missing")

service_ids = require("contracts/src/libraries/ServiceIds420.sol")
if service_ids:
    text = service_ids.read_text()
    for token in [
        'ATTENTION = keccak256("420/service/attention/v1")',
        'CANNASEUR = keccak256("420/service/cannaseur/v1")',
    ]:
        if token not in text:
            errors.append("missing ServiceIds420 entry: " + token)

for path in [
    "contracts/src/system/AttentionTreasury.sol",
    "contracts/src/system/CannaseurCampaignRegistry.sol",
    "contracts/src/attention/AttentionIds420.sol",
    "contracts/src/attention/AttentionAuthorization420.sol",
    "contracts/src/attention/AttentionConsentRegistry420.sol",
    "contracts/src/attention/AttentionProofRegistry420.sol",
    "contracts/src/attention/AttentionRewardRegistry420.sol",
    "contracts/src/attention/AttentionRouter420.sol",
    "contracts/test/AttentionGenesis420.t.sol",
    "contracts/test/AttentionAudit420.t.sol",
    "docs/architecture/protocols/messenger-notifications-attention.md",
    "docs/apps/attention/index.md",
    "docs/apps/attention/getting-started.md",
    "docs/apps/attention/user-guide.md",
    "docs/apps/attention/concepts.md",
    "docs/apps/attention/architecture.md",
    "docs/apps/attention/permissions.md",
    "docs/apps/attention/fees.md",
    "docs/apps/attention/security.md",
    "docs/apps/attention/troubleshooting.md",
    "docs/apps/attention/faq.md",
    "docs/audit/420ATTENTION-COMPLETE-AUDIT-20261006.md",
    "docs/audit/420ATTENTION-AUDIT-REMEDIATION-ROADMAP.md",
]:
    require(path)

source_checks = {
    "contracts/src/attention/AttentionProofRegistry420.sol": [
        "nullifierUsed[nullifier]",
        "UnauthorizedVerifier",
        "ConsentRequired",
        "CampaignNotAcceptingProofs",
    ],
    "contracts/src/attention/AttentionRewardRegistry420.sol": [
        "proofConsumed[proofId]",
        "CapExceeded",
        "treasury.reserveReward",
        "treasury.releaseReward",
    ],
    "contracts/src/system/AttentionTreasury.sol": [
        "totalCampaignLiability",
        "rewardReserved",
        "rewardReleased",
        "amount <= address(this).balance - totalCampaignLiability",
    ],
}
for path, needles in source_checks.items():
    p = require(path)
    if p:
        text = p.read_text()
        for needle in needles:
            if needle not in text:
                errors.append(f"{path}: missing invariant marker {needle}")

danger_roots = [
    root / "contracts/src/attention",
    root / "contracts/src/system/AttentionTreasury.sol",
    root / "contracts/src/system/CannaseurCampaignRegistry.sol",
]
for target in danger_roots:
    files = [target] if target.is_file() else list(target.glob("*.sol"))
    for p in files:
        text = p.read_text()
        for forbidden in ("tx.origin", "selfdestruct(", ".delegatecall("):
            if forbidden in text:
                errors.append(f"{p.relative_to(root)}: forbidden primitive {forbidden}")

out = {
    "pass": not errors,
    "errors": errors,
    "canonical_invariants": 14,
    "genesis_contracts": sorted(expected),
    "fixed_predeploys": {
        "AttentionTreasury": fixed.get("AttentionTreasury"),
        "CannaseurCampaignRegistry": fixed.get("CannaseurCampaignRegistry"),
    },
    "deployment_gate": "TESTNET_AND_LIVE_SERVICE_EVIDENCE_REQUIRED",
}
print(json.dumps(out, indent=2))
sys.exit(0 if not errors else 2)

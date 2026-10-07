#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "contracts/config/creative/420hz-deployment-package.json"
GRAPH = ROOT / "contracts/src/creative/deployment/HzDeploymentGraph420.sol"
SCRIPT = ROOT / "contracts/script/HzConsolidatedDeploy420.s.sol"

EXPECTED_ORDER = [
    "CreativeProtocolRegistry420",
    "CreatorProfileRegistry420",
    "WorkRegistry420",
    "RecordingRegistry420",
    "ContributorRegistry420",
    "RightsRegistry420",
    "AuthorizationRegistry420",
    "LicenseRegistry420",
    "RoyaltyScheduleRegistry420",
    "RoyaltyVault420",
    "RoyaltyRouter420",
    "CatalogRegistry420",
    "CatalogMetadataRegistry420",
    "MediaManifestRegistry420",
    "StorageSourceRegistry420",
    "PlaybackResolver420",
    "PlaybackAccounting420",
    "StreamingSettlementEpoch420",
    "StreamingRevenueAllocator420",
    "StreamingRoyaltySettlement420",
]

EXPECTED_WIRING = [
    "WorkRegistry420.setRightsRegistry(RightsRegistry420)",
    "RecordingRegistry420.configureDependencies(RightsRegistry420,AuthorizationRegistry420)",
    "RightsRegistry420.setRoyaltyAccounting(RoyaltyVault420)",
    "AuthorizationRegistry420.setLicenseRegistry(LicenseRegistry420)",
    "LicenseRegistry420.setRoyaltyRouter(RoyaltyRouter420)",
    "RoyaltyVault420.setRoyaltyRouter(RoyaltyRouter420)",
    "RoyaltyRouter420.setSettlementSource(LicenseRegistry420,true)",
    "RoyaltyRouter420.setSettlementSource(StreamingRoyaltySettlement420,true)",
]

def need(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(f"HZ-AUDIT-2 verification failed: {message}")

data = json.loads(PACKAGE.read_text())
graph = GRAPH.read_text()
script = SCRIPT.read_text()

need(data.get("schema") == "420.hz.deployment.package.v1", "package schema drift")
need(data.get("roadmap_step") == "HZ-AUDIT-2", "roadmap step drift")
need(data.get("genesis_classification") == "FIRST_YEAR_FLAGSHIP_NOT_FROZEN_GENESIS_APP", "Genesis classification drift")
need(data.get("address_model") == "REGISTRY_RESOLVED_NO_FIXED_HZ_ADDRESSES", "address model drift")
need(data.get("deployment_order") == EXPECTED_ORDER, "deployment order drift")
need(data.get("governance_initialization") == EXPECTED_WIRING, "governance initialization drift")

for name in EXPECTED_ORDER:
    need(f"new {name}(" in graph, f"missing constructor deployment for {name}")

need("HZ_GOVERNANCE_TIMELOCK" in script, "deployment script missing governance runtime input")
need("HZ_PROTOCOL_TREASURY" in script, "deployment script missing treasury runtime input")
need("420.hz.deployment.v1" in script, "generated manifest schema missing")
need("streamingRoyaltySettlement" in script, "generated manifest does not reach HZ-4")

live = data.get("live_evidence", {})
need(live.get("network") is None, "fabricated live network")
need(live.get("chain_id") is None, "fabricated live chain id")
for key in ("deployment_transactions", "governance_transactions", "registry_transactions"):
    need(live.get(key) == [], f"fabricated live transaction list: {key}")
for key in ("deployed_addresses", "runtime_code_hashes"):
    need(live.get(key) == {}, f"fabricated live deployment map: {key}")

a3 = data.get("authority_actions_owned_by_hz_audit_3", [])
need(any("PlaybackAccounting420.setSubmitter" in x for x in a3), "HZ-AUDIT-3 playback authority handoff missing")
need(any("StreamingSettlementEpoch420.setSubmitter" in x for x in a3), "HZ-AUDIT-3 settlement authority handoff missing")
need(any("ProtocolRegistry" in x for x in a3), "HZ-AUDIT-3 Registry handoff missing")

a4 = data.get("economics_actions_owned_by_hz_audit_4", [])
need(any("RevenueType.STREAM" in x for x in a4), "HZ-AUDIT-4 STREAM schedule handoff missing")

print("HZ-AUDIT-2 deployment architecture verification: PASS")

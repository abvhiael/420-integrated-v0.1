#!/usr/bin/env python3
"""STAKE-AUDIT-6 repository verifier: pinned ABI provenance + Indexer/Explorer/SDK integration."""

from __future__ import annotations
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

EXPECTED_EVENTS = {
    "CommunityValidatorReserveBound(address)",
    "ProtocolCreditReceived(bytes32,address,uint256)",
    "PendingProtocolCreditReturned(bytes32,uint256)",
    "ValidatorRegistered(bytes32,address,address,uint256,uint256)",
    "OwnedBondToppedUp(bytes32,uint256,uint256)",
    "ProtocolCreditReplaced(bytes32,uint256,uint256,uint256)",
    "ValidatorBondWithdrawn(bytes32,address,uint256,uint256)",
    "ConsensusStateApplied(bytes32,uint8,uint8,uint64,uint64,uint64,uint64)",
    "ExitNoticeApplied(bytes32,uint64,uint64)",
    "SlashApplied(bytes32,uint8,uint8,uint256,uint256,bytes32,uint8)",
    "RotationSnapshotApplied(uint64,uint256,uint16,uint16)",
    "ActiveTargetChanged(uint16,uint16,uint64,bool)",
    "RewardApplied(uint64,address,uint256,uint256,uint256,uint256)",
}

EXPECTED = {
    "ValidatorRegistry": {
        "address": "0x0000000000000000000000000000000000000423",
        "artifact": "contracts/artifacts/ValidatorRegistry.abi.json",
        "artifact_blob": "0c2e65d38a5eb322bf3baba9c6ee9cd8ee771391",
        "source": "contracts/src/system/ValidatorRegistry.sol",
        "source_blob": "e534624f007024d65fcbb9e0f730bafbb8077767",
        "protocol_version": 3,
    },
    "RewardController": {
        "address": "0x0000000000000000000000000000000000000420",
        "artifact": "contracts/artifacts/RewardController.abi.json",
        "artifact_blob": "9423d01d4277764837a1cb60edca3ae906260f4c",
        "source": "contracts/src/system/RewardController.sol",
        "source_blob": "012c9e24b4e7a37ca89aad1c887529a19c70bb16",
        "protocol_version": 2,
    },
}

def fail(msg: str) -> None:
    print(f"STAKE-AUDIT-6 verifier FAILED: {msg}", file=sys.stderr)
    raise SystemExit(1)

def git_blob_sha(path: Path) -> str:
    raw = path.read_bytes()
    return hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()

def require(path: str, tokens: list[str]) -> str:
    p = ROOT / path
    if not p.is_file():
        fail(f"missing {path}")
    text = p.read_text(encoding="utf-8")
    for token in tokens:
        if token not in text:
            fail(f"{path} missing required token: {token}")
    return text

def event_signature(item: dict) -> str:
    if item.get("type") != "event":
        fail("retained Stake ABI contains non-event entry")
    inputs = ",".join(str(x.get("type")) for x in item.get("inputs", []))
    return f"{item.get('name')}({inputs})"

def main() -> int:
    descriptor_path = ROOT / "420-indexer/descriptors/stake420-v3.json"
    descriptor = json.loads(descriptor_path.read_text(encoding="utf-8"))
    if descriptor.get("schema") != "420-stake-release-descriptor-v1":
        fail("Stake descriptor schema mismatch")
    if descriptor.get("protocol") != "420Stake" or descriptor.get("descriptorVersion") != 1:
        fail("Stake descriptor identity mismatch")
    if descriptor.get("authority") != "repository_descriptor_only_not_live_stake_authority":
        fail("Stake descriptor authority boundary mismatch")
    if set(descriptor.get("requiredEvents", [])) != EXPECTED_EVENTS:
        fail("Stake descriptor required event set mismatch")

    contracts = {x.get("contractName"): x for x in descriptor.get("contracts", [])}
    if set(contracts) != set(EXPECTED):
        fail("Stake descriptor contract set mismatch")

    artifact_events: set[str] = set()
    for name, expected in EXPECTED.items():
        entry = contracts[name]
        if entry.get("canonicalAddress") != expected["address"]:
            fail(f"{name} canonical address mismatch")
        if entry.get("protocolVersion") != expected["protocol_version"]:
            fail(f"{name} protocol version mismatch")
        if entry.get("artifact", {}).get("path") != expected["artifact"]:
            fail(f"{name} artifact path mismatch")
        if entry.get("artifact", {}).get("gitBlobSha") != expected["artifact_blob"]:
            fail(f"{name} descriptor artifact blob mismatch")

        artifact_path = ROOT / expected["artifact"]
        source_path = ROOT / expected["source"]
        if git_blob_sha(artifact_path) != expected["artifact_blob"]:
            fail(f"{name} retained ABI file blob drift")
        if git_blob_sha(source_path) != expected["source_blob"]:
            fail(f"{name} canonical source blob drift")

        artifact = json.loads(artifact_path.read_text(encoding="utf-8"))
        if artifact.get("schema") != "420-retained-abi-artifact-v1":
            fail(f"{name} retained artifact schema mismatch")
        if artifact.get("contractName") != name or artifact.get("protocol") != "420Stake":
            fail(f"{name} retained artifact identity mismatch")
        if artifact.get("protocolVersion") != expected["protocol_version"]:
            fail(f"{name} retained artifact protocol version mismatch")
        if artifact.get("source", {}).get("path") != expected["source"] or artifact.get("source", {}).get("gitBlobSha") != expected["source_blob"]:
            fail(f"{name} retained artifact source provenance mismatch")
        if artifact.get("authority") != "abi_only_no_bytecode_or_live_deployment_claim":
            fail(f"{name} retained artifact authority boundary mismatch")
        serialized = json.dumps(artifact).lower()
        for forbidden in ("deployedbytecode", "runtimecode", "storage_layout", "storageroot", "runtimehash"):
            if forbidden in serialized:
                fail(f"{name} Audit6 artifact improperly claims Audit7 material: {forbidden}")
        artifact_events.update(event_signature(x) for x in artifact.get("abi", []))

    if artifact_events != EXPECTED_EVENTS:
        fail("retained ABI artifact event set mismatch")

    require("420-indexer/src/abi-manifest.ts", [
        "RewardController: '420Stake'",
        "descriptorsFromStakeRelease420",
        "STAKE_RELEASE_DESCRIPTOR_ARTIFACTS_420",
        "abi_only_no_bytecode_or_live_deployment_claim",
    ])
    require("420-indexer/test/stake420-release-descriptor.test.ts", [
        "retains canonical lifecycle/reward event set",
        "retracts orphan lifecycle/reward observations on reorg",
        "Go Stake activity classifier is pinned to the same descriptor topics",
    ])
    require("indexer/api/stake.go", [
        "StakeActivity",
        "StakeValidatorRegistryAddress",
        "StakeRewardControllerAddress",
        "Finality",
        "CanonicalAuthority:false",
        "malformed Stake validator topic",
    ])
    require("indexer/store/file.go", [
        "LogsByAddresses",
        "DeleteBlocksAbove",
        "delete(s.data.Logs",
    ])
    require("indexer/api/stake_test.go", [
        "FinalityAwareFilteredAndReorgRebuildable",
        "orphaned reward survived rollback",
        "malformed topic rejection",
    ])
    require("indexer/api/server.go", ['GET /v1/stake/activity'])

    require("explorer/indexerclient/stake.go", [
        "/v1/stake/activity",
        "ErrIndexerAuthorityViolation",
    ])
    require("explorer/service/stakeviews.go", [
        "StakeActivity",
        "expectedStakeFinality",
        "overpromoted canonical authority",
        "wrong canonical contract",
        "inconsistent finality",
    ])
    require("explorer/api/server.go", [
        "/v1/stake/activity",
        "handleStakeActivity",
    ])
    require("explorer/web/static/index.html", [
        'href="#/stake"',
        "Stake & Rewards",
    ])
    browser = require("explorer/web/static/app.js", [
        "stakeActivityTable",
        "/v1/stake/activity",
        "rebuildable Indexer projection",
        "ValidatorRegistry / RewardController",
    ])
    if "eth_get" in browser or "INDEXER_RPC_URL" in browser:
        fail("Explorer Stake browser introduced direct RPC authority")

    require("packages/420-sdk/src/stake.ts", [
        "createStakeExplorerClient420",
        "Stake activity response overpromoted canonical authority",
        "Stake activity finality inconsistent",
        "STAKE_VALIDATOR_REGISTRY_420",
        "STAKE_REWARD_CONTROLLER_420",
    ])
    require("packages/420-sdk/test/stake-sdk.test.mjs", [
        "validates exact finality/canonical contracts",
        "fails closed on authority, chain, contract, event and finality drift",
    ])

    print("STAKE-AUDIT-6 verifier PASS: pinned ABI provenance, canonical Stake events, reorg/finality projection, Explorer workflow and SDK client anchors are present")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

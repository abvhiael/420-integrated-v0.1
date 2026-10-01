#!/usr/bin/env python3
"""Mechanical ID-AUDIT-6 Identity derived-service compatibility verifier."""
from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "contracts/artifacts/Identity420.json"
SQL = ROOT / "420-indexer/sql/005-genesis-state-views.sql"
REDUCER = ROOT / "420-indexer/src/lifecycle-reducer.ts"
INDEXER_TEST = ROOT / "420-indexer/test/identity420-compatibility.test.ts"
SEARCH = ROOT / "search/discovery/names_identity.go"
SEARCH_TEST = ROOT / "search/discovery/id_audit_6_identity_test.go"
EXPLORER = ROOT / "explorer/service/eventviews.go"
EXPLORER_TEST = ROOT / "explorer/service/id_audit_6_identity_test.go"
SEARCH_PROFILE = ROOT / "contracts/config/420search-genesis.json"
EXPLORER_PROFILE = ROOT / "contracts/config/420explorer-genesis.json"

ADDRESS = "0x0000000000000000000000000000000000000436"
EXPECTED = {
    "ProfileCreated": ["profileId", "controller", "metadataHash"],
    "ProfileUpdated": ["profileId", "metadataHash", "active"],
    "PrimaryNameSet": ["profileId", "labelHash"],
    "ProfileControllerTransferStarted": ["profileId", "currentController", "pendingController"],
    "ProfileControllerTransferred": ["profileId", "previousController", "newController"],
    "IssuerSet": ["issuerId", "controller", "metadataHash", "trustClass", "active"],
    "CredentialIssued": ["credentialId", "issuerId", "subjectProfileId", "credentialType", "claimHash", "expiresAt"],
    "CredentialRevoked": ["credentialId", "issuerId"],
    "CredentialRejected": ["credentialId", "subjectProfileId"],
}

errors: list[str] = []

def fail(message: str) -> None:
    errors.append(message)

def read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except Exception as exc:
        fail(f"{path.relative_to(ROOT)} unreadable: {exc}")
        return ""

try:
    artifact = json.loads(read(ART))
except Exception as exc:
    artifact = {}
    fail(f"Identity artifact JSON invalid: {exc}")

if artifact.get("contractName") != "Identity420":
    fail("Identity artifact contractName drift")
if artifact.get("canonicalAddress", "").lower() != ADDRESS:
    fail("Identity artifact address drift")

events = {}
for item in artifact.get("abi", []):
    if isinstance(item, dict) and item.get("type") == "event":
        events[item.get("name")] = item

if set(events) != set(EXPECTED):
    fail(f"Identity event set mismatch: {sorted(events)}")

for name, fields in EXPECTED.items():
    event = events.get(name, {})
    actual = [x.get("name") for x in event.get("inputs", []) if isinstance(x, dict)]
    if actual != fields:
        fail(f"{name} field order mismatch: expected {fields}, got {actual}")

sql = read(SQL)
for token in ("e.fields->>'profileId'", "e.fields->>'credentialId'", "e.fields->>'issuerId'"):
    if token not in sql:
        fail("Indexer SQL missing object-key field: " + token)
if sql.find("e.fields->>'credentialId'") > sql.find("e.fields->>'issuerId'"):
    fail("Indexer SQL must prioritize credentialId before issuerId")
for event, state in {
    "ProfileCreated": "ACTIVE",
    "ProfileControllerTransferStarted": "PENDING_CONTROLLER_TRANSFER",
    "ProfileControllerTransferred": "CONTROLLER_TRANSFERRED",
    "CredentialIssued": "ACTIVE",
    "CredentialRevoked": "REVOKED",
    "CredentialRejected": "REJECTED",
}.items():
    if f"when '{event}' then '{state}'" not in sql:
        fail(f"Indexer SQL missing Identity lifecycle mapping {event}->{state}")

reducer = read(REDUCER)
for key in ("'profileId'", "'credentialId'", "'issuerId'"):
    if key not in reducer:
        fail("TypeScript object-key helper missing " + key)
if reducer.find("'credentialId'") > reducer.find("'issuerId'"):
    fail("TypeScript object-key helper must prioritize credentialId before issuerId")

indexer_test = read(INDEXER_TEST)
for token in EXPECTED:
    if token not in indexer_test:
        fail("Indexer Identity qualification missing event " + token)
for token in ("IndexerEventCanonicality420", "canonical fork replacement", "metadataPayload", "claimPayload"):
    if token not in indexer_test:
        fail("Indexer Identity qualification missing " + token)

search = read(SEARCH)
for token in (
    "Inactive profiles are not",
    'case "ProfileCreated"',
    'case "ProfileUpdated"',
    'case "PrimaryNameSet"',
    'case "ProfileControllerTransferred"',
    "metadata commitment ",
):
    if token not in search:
        fail("Search Identity reducer/privacy boundary missing: " + token)
if "metadataPayload" in search or "claimPayload" in search:
    fail("Search production code must not consume Identity private payload fields")

search_test = read(SEARCH_TEST)
for token in (
    "SuppressesInactiveAndRestoresAfterReactivation",
    "MetadataCommitmentsNeverBecomePayloads",
    "ProfileRebuildIsDeterministic",
    "RejectsCrossObjectReplay",
):
    if token not in search_test:
        fail("Search Identity qualification missing " + token)

explorer = read(EXPLORER)
for token in ("canonical log provenance", "complete raw topics/data", "never be treated as canonical"):
    if token not in explorer:
        fail("Explorer raw-event authority boundary missing: " + token)
explorer_test = read(EXPLORER_TEST)
for token in ("PreservesIdentityRawEventProvenance", "RejectsMalformedIdentityCommitmentEncoding", ADDRESS):
    if token not in explorer_test:
        fail("Explorer Identity qualification missing " + token)

try:
    search_profile = json.loads(read(SEARCH_PROFILE))
    privacy = search_profile.get("privacy", {})
    if privacy.get("privateIdentityDataIndexed") is not False:
        fail("Search profile must exclude private Identity data")
    if privacy.get("commitmentVisibilityDoesNotAuthorizePayloadRecovery") is not True:
        fail("Search commitment privacy boundary drift")
except Exception as exc:
    fail(f"Search profile invalid: {exc}")

try:
    explorer_profile = json.loads(read(EXPLORER_PROFILE))
    if explorer_profile.get("canonicalStateAuthority") is not False:
        fail("Explorer must remain non-canonical")
    if explorer_profile.get("sources", {}).get("optionalIdentity") != "420 Identity public display enrichment":
        fail("Explorer Identity enrichment boundary drift")
except Exception as exc:
    fail(f"Explorer profile invalid: {exc}")

if errors:
    print("ID-AUDIT-6 qualification FAILED", file=sys.stderr)
    for error in errors:
        print(" - " + error, file=sys.stderr)
    raise SystemExit(1)

print("ID-AUDIT-6 compatibility verifier PASS")
print("Identity events:", len(EXPECTED))
print("Identity address:", ADDRESS)
print("Indexer object keys: profileId, credentialId, issuerId")
print("Search inactive suppression/private payload boundary: PASS")
print("Explorer non-authoritative raw-event boundary: PASS")

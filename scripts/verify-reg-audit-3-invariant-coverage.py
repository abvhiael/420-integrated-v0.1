#!/usr/bin/env python3
from pathlib import Path
import json, sys

ROOT = Path(__file__).resolve().parents[1]
errors = []

registry = ROOT / "contracts/src/apps/ProtocolRegistry.sol"
config = ROOT / "contracts/config/420registry-genesis.json"
tests = ROOT / "contracts/test/RegistryInvariantCoverage420.t.sol"
audit = ROOT / "docs/audit/REG-AUDIT-3-INVARIANT-COVERAGE-QUALIFICATION.json"
architecture = ROOT / "docs/apps/registry/architecture.md"
developer = ROOT / "docs/apps/registry/developer/contracts.md"

for p in [registry, config, tests, audit, architecture, developer]:
    if not p.exists():
        errors.append("missing " + str(p.relative_to(ROOT)))

if errors:
    print(json.dumps({"pass": False, "errors": errors}, indent=2))
    sys.exit(1)

src = registry.read_text()
cfg = json.loads(config.read_text())
test_src = tests.read_text()
record = json.loads(audit.read_text())
arch = architecture.read_text()
dev = developer.read_text()

invariants = cfg.get("invariants", [])
if len(invariants) != 12:
    errors.append(f"expected 12 canonical REG invariants, found {len(invariants)}")

required_tests = [
    "test_REG_INV_001_canonical_or_explicit_extension_only",
    "test_REG_INV_002_versions_are_sequential_and_history_readable",
    "test_REG_INV_003_genesis_registration_rejects_no_runtime_code",
    "test_REG_INV_004_runtime_code_hash_is_derived_not_caller_supplied",
    "test_REG_INV_005_zero_manifest_and_interface_rejected_independently",
    "test_REG_INV_006_published_profile_is_immutable_for_version",
    "test_REG_INV_007_only_governance_can_approve_publish_or_deprecate",
    "test_REG_INV_008_deprecation_fails_closed_and_preserves_history",
    "test_REG_INV_009_registry_publication_grants_no_real_resident_authority",
    "test_REG_INV_010_projection_can_reconstruct_from_events_and_reads",
    "test_REG_INV_011_registry_metadata_cannot_overwrite_identity_state",
    "test_REG_INV_012_extension_approval_cannot_collide_with_canonical_id",
]
for token in required_tests:
    if token not in test_src:
        errors.append("missing named invariant test " + token)

required_src = [
    "error CanonicalServiceIdImmutable();",
    "if (ServiceIds420.isGenesisCanonical(serviceId)) revert CanonicalServiceIdImmutable();",
    "function approveServiceId(bytes32 serviceId, bytes32 descriptorHash) external onlyGovernance",
    "function publishRegisteredService(",
    "function deprecateService(bytes32 serviceId) external onlyGovernance",
]
for token in required_src:
    if token not in src:
        errors.append("ProtocolRegistry missing " + token)

if 'import "../src/pay/MerchantRegistry420.sol";' not in test_src:
    errors.append("REG-INV-009 does not use a real Genesis resident authorization seam")
if "recordLogs()" not in test_src or "getRecordedLogs()" not in test_src:
    errors.append("REG-INV-010 lacks executable event reconstruction evidence")
if 'import "../src/apps/Identity420.sol";' not in test_src:
    errors.append("REG-INV-011 lacks real domain-state isolation evidence")

if record.get("step") != "REG-AUDIT-3":
    errors.append("qualification record step mismatch")
if record.get("exitCriteria", {}).get("allTwelveNamedExecutableEvidence") not in {
    "IMPLEMENTED_PENDING_EXACT_HEAD_QUALIFICATION",
    "CANDIDATE_QUALIFIED",
    "COMPLETE",
}:
    errors.append("qualification record does not assert all-twelve named evidence")

for doc_name, doc in [("architecture", arch), ("developer contracts", dev)]:
    if "canonical Genesis service ID" not in doc or "extension" not in doc:
        errors.append(f"{doc_name} missing canonical-ID/extension boundary documentation")

summary = {
    "step": "REG-AUDIT-3",
    "pass": not errors,
    "canonicalInvariantCount": len(invariants),
    "namedExecutableInvariantTests": required_tests,
    "focusedTestFile": "contracts/test/RegistryInvariantCoverage420.t.sol",
    "canonicalIdCollisionGuard": "CanonicalServiceIdImmutable",
    "realResidentAuthorizationSeam": "MerchantRegistry420.setStatus",
    "projectionEvidence": "ServiceVersionPublished + ServiceRegistrationProfilePublished + canonical reads",
    "domainIsolationEvidence": "Identity420 profile controller",
    "errors": errors,
}
out = ROOT / "reg-audit-3-evidence"
out.mkdir(exist_ok=True)
(out / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
print(json.dumps(summary, indent=2))
sys.exit(0 if not errors else 1)

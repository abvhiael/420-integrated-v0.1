# REG-AUDIT-3 — complete REG invariant coverage

**Canonical roadmap source:** `docs/audit/420REGISTRY-COMPLETE-AUDIT-20260928.md`  
**Status:** CANDIDATE QUALIFIED — evidence recorded; reconciliation and final evidence-head qualification pending

## Original definition

Add focused negative/integration tests for the currently partial guarantees:

- zero manifest/interface rejection independently;
- profile immutability;
- unauthorized extension approval;
- unauthorized deprecation;
- canonical-ID descriptor collision attempts;
- registration non-authority across at least one real resident authorization seam.

**Exit:** every REG-INV-001..012 has named executable evidence.

## Gap analysis and implementation

The pre-step audit marked REG-INV-005/006/007/009/010/011/012 PARTIAL. Existing tests covered useful behavior but did not give each invariant explicit named executable evidence.

REG-INV-012 also exposed a contract-level gap: `approveServiceId` accepted canonical Genesis IDs. REG-AUDIT-3 adds `CanonicalServiceIdImmutable()` and rejects extension approval when `ServiceIds420.isGenesisCanonical(serviceId)` is true.

The focused suite `contracts/test/RegistryInvariantCoverage420.t.sol` now provides one explicitly named test for every REG invariant:

| Invariant | Named executable evidence |
| --- | --- |
| REG-INV-001 | `test_REG_INV_001_canonical_or_explicit_extension_only` |
| REG-INV-002 | `test_REG_INV_002_versions_are_sequential_and_history_readable` |
| REG-INV-003 | `test_REG_INV_003_genesis_registration_rejects_no_runtime_code` |
| REG-INV-004 | `test_REG_INV_004_runtime_code_hash_is_derived_not_caller_supplied` |
| REG-INV-005 | `test_REG_INV_005_zero_manifest_and_interface_rejected_independently` |
| REG-INV-006 | `test_REG_INV_006_published_profile_is_immutable_for_version` |
| REG-INV-007 | `test_REG_INV_007_only_governance_can_approve_publish_or_deprecate` |
| REG-INV-008 | `test_REG_INV_008_deprecation_fails_closed_and_preserves_history` |
| REG-INV-009 | `test_REG_INV_009_registry_publication_grants_no_real_resident_authority` |
| REG-INV-010 | `test_REG_INV_010_projection_can_reconstruct_from_events_and_reads` |
| REG-INV-011 | `test_REG_INV_011_registry_metadata_cannot_overwrite_identity_state` |
| REG-INV-012 | `test_REG_INV_012_extension_approval_cannot_collide_with_canonical_id` |

### Security and integration evidence

- REG-INV-005 proves manifest and interface zero-value rejection independently and verifies rejected calls do not advance state.
- REG-INV-006 proves an already-published profile cannot be replaced at the same sequential version.
- REG-INV-007 independently negative-tests unauthorized extension approval, publication, and deprecation.
- REG-INV-009 uses the real `MerchantRegistry420.setStatus` Genesis-resident governance seam and proves publishing an implementation in Registry does not grant it resident authority.
- REG-INV-010 reconstructs service/profile projection data from Registry events and cross-checks canonical reads.
- REG-INV-011 collides Registry metadata/commitment values with a real `Identity420` profile identifier and proves Identity controller state remains unchanged.
- REG-INV-012 rejects canonical Genesis IDs at the extension-approval boundary.

Registry has no custody/accounting transfer path, replay nonce, expiry, or refund state in this step; those classes are therefore not applicable to Registry invariant mutation. Applicable authorization, failure-path, state-invariant, integration, static-analysis, build, formatting, and retained regression coverage are included in the REG-AUDIT-3 workflow.

## Qualification

Dedicated verifier:

- `scripts/verify-reg-audit-3-invariant-coverage.py`

Dedicated workflow:

- `.github/workflows/registry-reg-audit-3.yml`

Retained gates required on the exact final head:

- 420Registry REG-AUDIT-1
- 420Registry REG-AUDIT-2
- 420Registry REG-AUDIT-3
- Solidity Contracts
- 420 Integrated Qualification
- 420Docs Qualification
- 420Indexer

## Exact-head evidence

- Candidate qualified SHA: `4773f9d7cf3a60373f6b93116a6b126deaf5524b`
- Candidate main/base SHA: `6c0a70ae020bfa911c57f6148fd585c9036c5f78`
- 420Registry REG-AUDIT-1: **PASS** — run `36525288252`
- 420Registry REG-AUDIT-2: **PASS** — run `36525288318`
- 420Registry REG-AUDIT-3: **PASS** — run `36525288262`
- Solidity Contracts: **PASS** — run `36525288319` (all 16 PR shards 0–15 successful)
- 420 Integrated Qualification: **PASS** — run `36525288284`
- 420Docs Qualification: **PASS** — run `36525288298`
- 420Indexer: **PASS** — run `36525288205`

Current `main` advanced after candidate qualification to `3758148416e394ad3da0572ef3b39861764a9141`. The evidence-bearing branch must therefore be reconciled to current `main` and the retained qualification suite rerun on the exact reconciled evidence head before REG-AUDIT-3 can be marked COMPLETE.

If recording final evidence creates a new commit, the retained suite must be rerun on that evidence-recording SHA.

## Remaining blockers outside REG-AUDIT-3

Overall Registry remains NO-GO pending REG-AUDIT-4 through REG-AUDIT-10. REG-AUDIT-3 does not perform the global Genesis address rebase, final predeploy artifact generation, generated address/catalogue cleanup, broader derived-consumer/reorg qualification, testnet deployment, final closeout, or Genesis acceptance.

## Next canonical roadmap step

**REG-AUDIT-4 — reconcile the Genesis address namespace**

Use the existing global address-reconciliation work; do not solve Registry in isolation.

- approve one collision-free namespace-wide map;
- update mirrors, predeploy plan, deployment manifest, resident configuration and examples atomically;
- preserve explicit supersession history;
- run collision and frozen-range checks.

**Exit:** one canonical Registry address, with no contradictory authoritative assignment.

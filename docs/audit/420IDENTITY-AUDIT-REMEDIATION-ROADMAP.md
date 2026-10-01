# 420Identity audit remediation roadmap

Authority: complete audit at `docs/audit/420IDENTITY-COMPLETE-AUDIT-20260930.md`.

Do not renumber, collapse or silently redefine these steps. Repository truth and frozen Genesis authority control every closeout.

## ID-AUDIT-1 — authoritative Identity API/state-model decision

Resolve the contradiction between `Identity420.sol` and frozen `IIdentityCredential420.sol`.

Required:
- decide whether Identity420 will directly implement the frozen interface, a canonical adapter will be introduced, or a versioned interface migration will occur;
- define subject/type lookup semantics when multiple credentials/issuers exist;
- define TrustClass ↔ IdentityAssurance mapping if any;
- preserve credential lifecycle and historical identity;
- do not mutate a frozen major interface without the required migration/review;
- add executable compatibility tests.

Exit: one committed authoritative decision with no ambiguous runtime consumer behavior.

## ID-AUDIT-2 — contract invariant and adversarial qualification

Add a dedicated Identity test suite covering profile, controller, issuer, credential, trust-class, expiry and Names-binding boundaries.

Exit: all named Identity invariants are mapped to tests and exact-head CI evidence.

## ID-AUDIT-3 — dependency/interface reconciliation

Reconcile `contracts/config/interfaces/dependency-matrix.json` against the adopted Identity architecture.

For each claimed dependency classify REQUIRED / OPTIONAL / NOT APPLICABLE and either:
- implement the dependency;
- bind through a canonical adapter;
- or remove the stale requirement through the correct versioned configuration process.

Pay particular attention to PauseRegistry, CapabilityRegistry, SystemSafety, GenesisInitialization, Migration, SignedEnvelope, ReplayProtection, ChainContext and MetadataCommitment.

Exit: no declared mandatory Identity dependency is absent or fictitious.

## ID-AUDIT-4 — generated ABI, artifact and reference metadata

Generate and retain the exact Identity420 artifact from the pinned Solidity/compiler profile, with ABI, runtime bytecode identity, source identity and generated-reference integration.

Exit: `contracts/artifacts/Identity420.json` and generated references reproduce deterministically and pass verification.

## ID-AUDIT-5 — final Identity predeploy artifact and state

Materialize the frozen `0x0000000000000000000000000000000000000436` predeploy:
- pinned runtime bytecode;
- immutable `governanceTimelock` materialization;
- explicit mutable storage state/root;
- runtime code hash;
- source/compiler provenance;
- collision verification against namespace authority.

Exit: predeploy plan moves from SOURCE_READY to retained artifact-ready state without changing the frozen owner/address.

## ID-AUDIT-6 — Indexer/Search/Explorer compatibility

Prove every Identity event and object key consumed by derived services matches the final contract ABI and lifecycle.

Test:
- profile creation/update/controller transfer;
- primary-name changes;
- issuer mutation;
- issuance/revocation/rejection;
- reorg/replay/rebuild behavior;
- inactive profile suppression in public Search;
- privacy boundary for metadata commitments.

Exit: exact-head derived-service qualification evidence.

## ID-AUDIT-7 — Wallet/user-facing Identity workflow

Implement or locate the canonical user-facing Identity journey.

Required user workflows:
- create profile;
- update metadata/activity;
- nominate/accept controller transfer;
- link/unlink or change primary .420 name with bilateral validation messaging;
- inspect credentials;
- reject credential;
- display validity/trust source without implying legal identity or wallet ownership.

The Wallet may host this workflow if that remains the adopted product architecture; do not invent a separate website merely to satisfy the audit.

Exit: real contract-backed workflow with loading/empty/error/transaction/recovery/accessibility coverage.

## ID-AUDIT-8 — operator/deployment documentation and smoke tooling

Complete operator guidance covering:
- canonical address and network binding;
- governance authority;
- predeploy verification;
- monitoring/events;
- incident response;
- issuer compromise/deactivation;
- derived-service rebuild;
- rollback/recovery boundaries;
- secrets/key management;
- smoke test procedure.

Exit: a new operator can verify and operate Identity without relying on tribal knowledge.

## ID-AUDIT-9 — production-equivalent testnet deployment qualification

On the approved public-testnet release candidate:
- verify chain ID/genesis identity;
- verify runtime code/hash/storage at 0x0436;
- verify GovernanceTimelock immutable value;
- execute representative profile/issuer/credential lifecycle;
- verify Wallet, Indexer, Search and Explorer against the same deployment;
- exercise negative authorization, expiry, revocation, reorg/restart and dependency-failure cases;
- retain receipts/logs/manifests tied to exact release SHA.

Exit: TESTNET READY = YES.

## ID-AUDIT-10 — phase closeout, reconciliation and retained evidence

Reconcile branch with current main and run:
- complete Identity-focused qualification;
- applicable Solidity/Genesis/interface/reference/docs checks;
- cross-app Wallet/Names/Indexer/Search regressions;
- static/security checks;
- final documentation parity;
- exact-head CI evidence.

Produce the final requirement matrix and readiness report.

Exit: code/build/contract/test/docs/integration/security states are explicit; any remaining live Genesis/production gate is carried into the system Genesis reconciliation roadmap.

## Ordering

1. ID-AUDIT-1
2. ID-AUDIT-2
3. ID-AUDIT-3
4. ID-AUDIT-4
5. ID-AUDIT-5
6. ID-AUDIT-6
7. ID-AUDIT-7
8. ID-AUDIT-8
9. ID-AUDIT-9
10. ID-AUDIT-10

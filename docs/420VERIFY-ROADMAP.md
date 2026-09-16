# 420Verify — GEN-10.5 implementation roadmap

**Status: COMPLETE**

420Verify is the contract-free Genesis verification service for reproducibly proving whether submitted Solidity source/build inputs reproduce deployed contract bytecode on the 420 Integrated network.

Verification is evidence, not authority. A verified result does not mean audited, safe, official, immutable, endorsed or non-malicious. Canonical deployed code comes from chain state; registered application identity comes from 420Registry. Verification records are non-canonical and independently reproducible.

## Closeout record

- VERIFY-0 through VERIFY-10: complete
- Latest-main reconciliation PR: `#304`
- Reconciliation commit: `afaf3e9f669590299c4b0898341f8195db30d441`
- Final qualified feature head: `e723037ca7cd09e530035577d7eb41319f387e75`
- 420Docs Qualification `#1418`: passed
- 420 Integrated Qualification `#3678`: passed
- Phase PR `#303`: merged
- Merge commit: `1f937b7ef641980cc118336763ba50ffc8f3cc5a`
- Next Genesis application: `GEN-10.6 / 420AppStore`
- Public endpoint deployment: pending operational deployment; not part of implementation closeout

## VERIFY-0 — architecture and qualification baseline — COMPLETE

- Froze service identity `420/service/verify/v1` and the contract-free trust boundary.
- Encoded VER-INV-001 through VER-INV-013 as machine-testable architecture expectations.
- Defined canonical input sources, result classes, privacy/security exclusions, and exact-head qualification policy.

## VERIFY-1 — service/runtime scaffold — COMPLETE

- Added the `verify/` Go runtime and entrypoint.
- Added chain/RPC/compiler-cache/evidence-store/listener configuration.
- Added fail-closed wrong-chain and canonical-bytecode checks plus health/readiness endpoints.

## VERIFY-2 — canonical deployment evidence acquisition — COMPLETE

- Added canonical runtime bytecode, runtime code hash, block context, first-code-block discovery, creation transaction/receipt recovery, and explicit missing-context reasons.
- Bound evidence to chain ID, address, and runtime code hash.

## VERIFY-3 — source/build submission model — COMPLETE

- Added Standard JSON, multi-file, and flattened compatibility inputs.
- Preserved exact compiler/build configuration and deterministic source-bundle commitments.
- Added traversal/duplicate/tamper validation.

## VERIFY-4 — hermetic compiler and build reproduction — COMPLETE

- Added an allowlisted compiler catalogue with binary checksum verification.
- Added deterministic bounded compiler execution, input/output commitments, network-disabled evidence, and timeout/resource controls.

## VERIFY-5 — bytecode comparison and classification — COMPLETE

- Implemented `FULL_MATCH`, `PARTIAL_MATCH`, `MISMATCH`, and `UNVERIFIABLE`.
- Added exact runtime/creation comparisons and explicit metadata/library/immutable diagnostics without silent masking.

## VERIFY-6 — reproducible evidence store and history — COMPLETE

- Added append-only evidence persistence keyed by exact deployed-code binding.
- Added restart reconstruction, content-hash validation, history, tamper detection, and non-canonical rebuildability.

## VERIFY-7 — proxy and upgrade handling — COMPLETE

- Added EIP-1167 and EIP-1967 handling.
- Kept proxy-shell and implementation verification independent.
- Added upgrade history and invalidation of stale inherited implementation status.

## VERIFY-8 — public API and Genesis integrations — COMPLETE

- Added exact-binding lookup, history, evidence lookup, submission API, and runtime mounting.
- Added Explorer navigation and AppStore security-context framing while preserving Registry and Wallet authority boundaries.

## VERIFY-9 — adversarial hardening and failure recovery — COMPLETE

- Added hostile-input, secret-field, body/source-size, concurrency, compiler abuse, invalid-hex, stale-proxy, tamper/restart, and authority-escalation protections.
- Confirmed fail-closed behavior for untrusted dependencies and evidence.

## VERIFY-10 — qualification, reconciliation and phase closeout — COMPLETE

- Reconciled the latest `main` into the feature branch via PR #304.
- Recorded deployment-readiness state without claiming undeployed public endpoints.
- Qualified the exact final feature head with both 420Docs and 420 Integrated workflows.
- Merged PR #303 into `main`.

## Post-closeout operational work

Genesis implementation is complete. Remaining operational work is deployment-specific: assign real backend/frontend testnet URLs, deploy the configured compiler catalogue/cache and evidence store, run public endpoint smoke tests, and update `testnet/public-services/verify/readiness.json` from `PENDING_DEPLOYMENT` when those endpoints actually exist.

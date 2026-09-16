# 420Verify — GEN-10.5 implementation roadmap

420Verify is the contract-free Genesis verification service for reproducibly proving whether submitted Solidity source/build inputs reproduce deployed contract bytecode on the 420 Integrated network.

Verification is evidence, not authority. A verified result does not mean audited, safe, official, immutable, endorsed or non-malicious. Canonical deployed code comes from chain state; registered application identity comes from 420Registry. Verification records are non-canonical and independently reproducible.

## VERIFY-0 — architecture and qualification baseline

- Freeze the service identity `420/service/verify/v1` and contract-free trust boundary.
- Encode VER-INV-001 through VER-INV-013 as machine-testable architecture expectations.
- Define canonical input sources, result classes and privacy/security exclusions.
- Establish the long-lived `feature/gen10-5-420verify-v1` branch and exact qualification contract.

## VERIFY-1 — service/runtime scaffold

- Add the `verify/` Go service tree and runtime entrypoint.
- Add configuration for chain ID, RPC source, compiler cache, evidence store and public API listener.
- Fail closed on wrong chain, unavailable canonical bytecode or invalid service configuration.
- Add health/readiness surfaces without claiming chain authority.

## VERIFY-2 — canonical deployment evidence acquisition

- Read deployed runtime bytecode, code hash and block context from configured 420 RPC.
- Recover creation transaction/receipt and creation bytecode when available.
- Bind every verification request/result to chain ID, address and deployed runtime code hash.
- Preserve source provenance and explicit missing-context reasons.

## VERIFY-3 — source/build submission model

- Accept Solidity Standard JSON Input and multi-file source bundles.
- Support flattened source only as compatibility input.
- Record exact compiler version, optimizer settings/runs, EVM version, via-IR setting, metadata hash mode, library links and constructor arguments.
- Normalize transport/packaging without changing semantic compiler input.
- Commit source bundles with deterministic content hashes.

## VERIFY-4 — hermetic compiler and build reproduction

- Resolve exact compiler versions from an allowlisted/pinned compiler catalogue.
- Run builds in an isolated deterministic worker.
- Disable network-dependent build behavior during verification.
- Produce runtime/creation bytecode plus compiler/build evidence sufficient for third-party reproduction.
- Enforce resource/time/input limits against malicious submissions.

## VERIFY-5 — bytecode comparison and classification

- Implement `FULL_MATCH`, `PARTIAL_MATCH`, `MISMATCH` and `UNVERIFIABLE`.
- Compare runtime bytecode exactly for full matches.
- Compare creation bytecode when recoverable.
- Handle metadata, immutables and linked-library references explicitly rather than silently discarding differences.
- Emit stable structured mismatch reasons and evidence.

## VERIFY-6 — reproducible evidence store and history

- Persist published verification evidence keyed by network/address/runtime-code-hash.
- Preserve source bundle commitment, compiler configuration, build products, classifications and diagnostics.
- Make the database rebuildable/non-canonical.
- Expose verification history by address and code hash.
- Prove restart/recovery does not lose published evidence.

## VERIFY-7 — proxy and upgrade handling

- Detect common proxy relationships from canonical chain state where possible.
- Verify proxy shell and implementation independently.
- Never imply implementation verification from proxy verification or vice versa.
- Detect implementation changes and require independent verification for new code.
- Preserve historical implementation evidence without carrying old status onto new code.

## VERIFY-8 — public API and Genesis integrations

- Add lookup and submission APIs plus published evidence retrieval.
- Add source/compiler/result views required by the Genesis profile.
- Integrate provenance-preserving verification status with 420Explorer, 420Registry and 420AppStore.
- Provide direct Explorer navigation while retaining verification-vs-audit warnings.
- Ensure service unavailability never blocks ordinary RPC, Wallet or Explorer interaction.

## VERIFY-9 — adversarial hardening and failure recovery

- Reject private keys, signing secrets and wallet authority material.
- Test malformed compiler input, decompression/resource bombs, pathological source graphs, oversized bundles and compiler abuse.
- Test wrong-chain/address/code-hash replay and stale proxy implementation results.
- Test RPC failure, compiler failure, evidence-store corruption/recovery, restart and degraded-mode behavior.
- Verify no path can grant Registry legitimacy, Smart Account authority, asset-transfer authority or governance power.

## VERIFY-10 — testnet qualification, reconciliation and phase closeout

- Exercise all VER-INV-001 through VER-INV-013 against the exact branch head.
- Demonstrate independent reproduction of published `FULL_MATCH` evidence.
- Complete backend/frontend readiness checks and provenance checks.
- Reconcile latest `main`, re-run exact-head qualification and retain evidence.
- Merge GEN-10.5 once all required checks are green, then hand off to GEN-10.6 / 420AppStore.

## Merge policy

VERIFY-0 through VERIFY-10 stack on one long-lived feature branch. Do not merge subphases independently. At phase closeout, reconcile the latest `main`, qualify the exact final head, then merge once.

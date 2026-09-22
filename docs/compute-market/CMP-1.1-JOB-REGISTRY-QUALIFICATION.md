# CMP-1.1 — Original ComputeJobRegistry: implementation and qualification

Authority: the original five-slice `CMP-1-IMPLEMENTATION-ROADMAP.md`, not the superseded experimental CMP-1.1–1.8 labels. This increment touches **only CMP-1.1**. The prior foundation PR #369 is merged as non-production supporting code; it was never CMP-1.1 completion.

## Eight requirements and source mapping

1. Create jobs — `createJob` binds one unique request ID and allocates a chain-/registry-scoped monotonically increasing job nonce and ID; `requestUsed` blocks duplicate creation.
2. Update lifecycle — explicit `recordFunding`, `recordMatch`, `recordAcceptance`, `assignWorker`, `recordResult`, `recordVerification`, `recordSettlement`, each requiring the correct prior state and expected revision; no generic state setter or terminal reopen.
3. Record manifest hash — immutable `manifestHash` written at job creation.
4. Record workload type — immutable `workloadType` written at job creation.
5. Input/output commitments — immutable input and output schema commitments at creation, actual result commitment only on an evidence-gated result transition.
6. Job owner — authenticated creator `msg.sender`, not a caller-supplied beneficiary; request commitment bound at creation.
7. Assigned workers — worker address and assignment reference written only by the immutable worker authority after it attests to assignment; not by an arbitrary scheduler.
8. Verifier decisions — decision evidence, verifier identity and approval/rejection recorded only through immutable verifier authority; worker cannot self-verify; failure does not become verified or settle.

## Qualification scope / honest limitations

Dedicated Foundry tests in `contracts/test/ComputeJobRegistry420.t.sol` use a **test-only permissive fixture** to exercise transitions, actor isolation, rejection of absent evidence, immutable fields, stale revisions, failed verification, expired start and terminal replay. The fixture is explicitly **not** production funding, matching, assignment, correctness or settlement evidence. Passing these tests proves local state-machine behavior only, not real funded execution. The contract is not deployed or published in ProtocolRegistry.

**OPEN; block release / CMP-1.1 complete classification:** Canonical request registry and EIP-712 manifest validation are not integrated at creation, so a caller can currently create a record for an unverified request commitment; real payer-bound `420Vault` reservation and CMP-1.2 `ComputeEscrow` proof are not yet wired; offer/match and qualified resource/attempt authorization adapters, worker receipt and independent verification engines, escrow/dispute/refund/expiry paths and authenticated settlement are not yet implemented as CMP canonical adapters. The contract's constructor requires code-bearing immutable evidence addresses but **code presence alone is not a trust guarantee**: register/admit only separately qualified canonical implementations, never a permissive mock. No evidence adapter should allow funded or payable state solely on a caller-supplied hash/flag. No production authority, worker dispatch, payment entitlement or custody arises from this PR. The exceptional-state enum reserves the frozen names, but transitions to CANCELLED/EXPIRED/DISPUTED/REFUNDED remain disabled until objectively verifiable policy and custody paths exist. Workload and request commitments are immutable locally but cannot yet be proven against canonical request storage. The frozen CMP-0.2/0.7 validation and full CMP-INV proof therefore remain open.

For qualification, require exact-head Solidity Contracts and Foundry test evidence, 420Docs, 420 Integrated, and reconciliation against current `main`; if any fails, fix on the same CMP-1.1 branch and rerun. Record the exact qualified commit before declaring **unit-tested prototype**, never production-ready. Do not skip to CMP-1.2 based merely on passing tests while the original eight responsibilities have unimplemented authoritative integration.

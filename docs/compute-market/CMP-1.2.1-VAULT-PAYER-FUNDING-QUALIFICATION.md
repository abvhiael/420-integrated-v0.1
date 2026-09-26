# CMP-1.2.1 — Signed-payer, Vault-backed funding and isolation

Status: CMP-1.2.1.1 named-suite log evidence is CONFIRMED against implementation head `0d2c01195bd0a8d0b12823cf14c2a40c48f727e2`. CMP-1.2.1.2 is **COMPLETE within repository-level scope** against exact implementation head `0e32c4dee3b86d2432c8d4e890fc69fc8129a963`: the dedicated CMP Vault authorization fence, payer-safety controller boundary, hostile real-capability tests, donor-surplus isolation, lifecycle freeze/wind-down path, and expired-unmatched original-payer refund all passed exact-head Solidity/Integrated/Docs qualification. Actual network deployment, runtime-address/code-hash attestation, live grant inventory, transaction evidence, and testnet publication remain deferred to CMP-1.2.9. No paid-job settlement, accepted-price reservation, dispute payout, slash redistribution, or production activation is authorized by this closeout.

## Implemented contract boundary

`contracts/src/compute/ComputeEscrowFunding420.sol` implements `IComputeJobFundingEvidence420` for a **new** jointly bound job registry whose `requestEvidence` is the merged dual-signed `ComputeJobSignedRequestAuthority420`. `bindJobs` is deployer-only, once, and checks both frozen registry endpoints and current registered ACTIVE Vault identity. Historical native funds in `ComputeJobPayerCustody420` remain in that distinct contract and cannot be treated as new Vault credits or silently migrated.

`fund(jobId)` accepts only a positive native $420 amount **actually supplied by the request's signed payer** against a CREATED and unexpired job. It checks the exact signed owner, payer, request/manifest/workload/input/output commitments, deadline, live authorization and maximum spend, and rejects repeat admission. A successful single EVM transaction forwards that precise `msg.value` to the ACTIVE registered `AssetVault420.depositNative()` and creates a unique, pending, original-payer-beneficiary obligation for the entire amount using the adapter's vault-scoped `ACTION_CREATE_OBLIGATION` grant. The adapter checks pre/post native balance, Vault recorded balance, Vault reserved/claimable amounts and immutable obligation fields. Any failed check or Vault call reverts the **entire transaction**, including deposit. The adapter never holds a successful funded balance, does not receive raw transfers, and has no release, cancel, withdraw, claim or settlement function.

The domain-separated safety ID binds chain, adapter, Vault address and ID, and job. The funding evidence getter verifies the exact owner/job/ref, original payer, pending same-job native obligation, exact amount/beneficiary/type and aggregate actual Vault backing. Distinct payers/jobs cannot reuse one obligation. `totalFunded` is a CMP-1.2.1 snapshot of pending safety liabilities only, **not** a general later-stage settlement ledger: CMP-1.2.2+ must introduce versioned nonoverlapping liability states before the pending obligations are cancelled or split.

**Critical operation-security assumption:** a dedicated CMP Vault and controlled grant issuance must make this adapter the exclusive CMP obligation writer; no direct ordinary user/provider/worker/verifier/admin receives blanket CREATE/RELEASE/CANCEL/WITHDRAW grants or recipient-changing rights. Unsolicited native deposits to `AssetVault420` are possible: they must never be credited to a CMP payer or bypass the per-job safety obligation. A later audit must confirm policy/grant governance for the actual deployment. The generic Vault's registered `assetPolicyId` identifies an approved policy but the current `depositNative`/`createObligation` implementation does not itself enforce an asset allowlist; V1 native-only enforcement currently resides in the adapter.

## Named executable qualification

`contracts/test/ComputeEscrowFunding420.t.sol` uses actual `AssetVault420`, `VaultRegistry420`, `VaultAccounting420`, `VaultAuthorization420`, signed-request authority and job registry, with test-only capability grants. Positive: two independent signed owner/payer pairs transfer funds into the **same** real Vault, obtain distinct pending original-payer obligations, and `recordFunding` accepts only each job's exact live credit; check exact payer, Vault, recorded balance, reserved, claimable and free-balance changes. Negative: wrong payer, zero/over-cap/duplicate deposits; missing adapter CREATE permission rolls back payer transfer and Vault accounting atomically; outsider release/cancel/withdraw, premature claim, wrong owner/job/ref and expired/unbound requests reject without unauthorized monetary effects.

Test-only capability mocks prove contract call paths, **not** deployed governance/grant issuance; no test in this increment proves release, partial payout, refunds, dispute finality or slash redistribution. CI success cannot upgrade these claims. Follow CMP-1.2.2 for accepted quote and beneficiary reservation and CMP-1.2.3–1.2.8 for earned-entitlement/settlement/refund/dispute and hostile liability conservation. Testnet gate: verify registered deployment, code hashes, exact dual-signed payer approvals and real native balance/obligation evidence before any funded execution.

## CMP-1.2.1.1 — exact-run named funding suite evidence (2026-09-24)

**Evidence gate: COMPLETE for the implementation commit below; this is not the full CMP-1.2.1 operational or deployment qualification.** Checked the actual GitHub Actions job log, not just the workflow conclusion.

- Implemented PR head tested: `0d2c01195bd0a8d0b12823cf14c2a40c48f727e2` ([implementation commit](https://github.com/abvhiael/420-integrated-v0.1/commit/0d2c01195bd0a8d0b12823cf14c2a40c48f727e2)); PR #371's CI checkout used synthetic merge commit `32c33e0c082919f9928ed93d00307eb64665e782` into baseline `main` `95a83a961286701b6e8c064de1deccad10f41fd7`.
- Named suite: `contracts/test/ComputeEscrowFunding420.t.sol:ComputeEscrowFunding420Test`, located under `=== TEST test/ComputeEscrowFunding420.t.sol ===` in [Solidity Contracts #3125 — shard 15 job log](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/36039001661/job/107770027346). Explicit Foundry result: `Suite result: ok. 5 passed; 0 failed; 0 skipped`, followed by `=== PASSED test/ComputeEscrowFunding420.t.sol ===`. [Shard 15 diagnostics artifact](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/36039001661/artifacts/10826203742).
- Positive case **PASS**: `testTwoPayersReceiveDistinctRealVaultBackedSafetyObligations`.
- Negative case **PASS**: `testWrongPayerOverCapZeroAndDuplicateFundingRevertWithoutVaultMutation`.
- Negative case **PASS**: `testWithoutScopedVaultCreatePermissionFundingRevertsAtomically`.
- Negative case **PASS**: `testOutsiderCannotReleaseCancelClaimOrWithdrawPayerSafetyDeposit`.
- Negative case **PASS**: `testExpiredUnboundAndWrongFundingReferenceFailClosed`.
- Associated three successful workflow results for the same implementation head: [Solidity Contracts #3125](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/36039001661), [420 Integrated Qualification #5393](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/36039001549), [420Docs Qualification #2777](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/36039001662).

**Scope and remaining gates:** The five passing Foundry cases demonstrate the enumerated local contract paths with actual Vault and accounting instances but test-only grants. They do not prove production grant issuance/exclusivity, runtime deployment/code hashes, settlement, refunds, dispute resolution or paid-job activation. Any new implementation change must receive its own exact-commit suite evidence. The CI results listed above apply to `0d2c011` and its specified PR synthetic merge, not automatically to the documentation commit that records this evidence.

## CMP-1.2.1.2 — exact-head CI reconciliation and operational grant boundary (2026-09-24)

**Exact-head CI evidence COMPLETE for `098c22a0553ddfede49858f5474c92718a6060e5`; operational grant/deployment qualification NOT COMPLETE.** The previous documentation commit did not change any Solidity source or tests. Its exact-branch-head workflows all returned completed/success:

- [Solidity Contracts #3126](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/36043549070) — successful.
- [420 Integrated Qualification #5394](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/36043549053) — successful.
- [420Docs Qualification #2778](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/36043549057) — successful.

**Source-reviewed operational gap:** `VaultAuthorization420.isAuthorized` delegates action-scoped authorization to the configured capability registry using `scopeForVault(vaultId)`; `AssetVault420.createObligation`, `releaseObligation`, and `cancelObligation` trust the corresponding action grant, and `withdraw` additionally allows self-withdraw under a vault-wide withdrawal grant or recipient-specific withdrawal under `scopeForRoute`. Neither contract hardcodes `ComputeEscrowFunding420` as the only CMP Vault writer; the current named Foundry suite initializes `MockCapabilityRegistryVault420` and grants CREATE to the adapter in test setup. A second principal acquiring CREATE could encumber unrelated Vault free balance; one acquiring RELEASE/CANCEL could mutate a payer safety obligation; one acquiring WITHDRAW could consume global free balance. Accordingly, a green mocked suite does not establish exclusive, immutable production grant issuance or governance for the dedicated CMP Vault. No actual deployment address, policy/code-hash inventory, live grant history or controlled governance evidence has been presented for this proposed NEW Vault topology.

**Mandatory acceptance evidence before marking the operational component of 1.2.1.2 qualified:** (1) identify the concrete capability-registry implementation, its grant issuers, revokers, amendment rights, timelock/emergency powers, current privileged principals and any wildcard scope/amount semantics; (2) register a dedicated CMP Vault with audited code hashes, ACTIVE state and native-only CMP adapter ingress, with matching immutable registry/authority/accounting/Vault IDs; (3) prove from the actual grant state and issuance controls that only the intended adapter has the necessary CMP CREATE grant, with no ordinary principal granted CMP RELEASE, CANCEL, generic or route WITHDRAW, CLAIM, or unrelated access to payer obligations; (4) exercise a deployment-realistic hostile grant-change and outsider direct-Vault-spend suite, including detected writer expansion and a fail-closed operational stop if governance can later grant dangerous capabilities; (5) bind a fresh job registry to the new signed-request and funding evidence set, demonstrate that historical direct-custody balances are neither counted nor silently migrated, and record exact deployment transaction, addresses, runtime hashes, grants, Foundry logs and all exact-head CI URLs. A grant audit alone cannot make the generic Vault intrinsically single-writer; if issuance can expand authority, deployment operations must prevent/monitor expansion and suspend admission before payer assets are exposed.

**Disposition:** Do not label this operational milestone qualified or enable real-value funding merely because three workflows are green. Remain on draft PR #371. CMP-1.2.2 price/beneficiary admission and later payout, refund, dispute, stake and production gates remain separate. This documentation change itself requires fresh exact-head CI; the three successful workflow links above qualify the predecessor head `098c22a`, not the new ledger commit.

## CMP-1.2.1.2 — real capability fixture and actionable blocking finding

See [`CMP-1.2.1.2-REAL-CAPABILITY-GRANT-AUDIT.md`](CMP-1.2.1.2-REAL-CAPABILITY-GRANT-AUDIT.md) and `contracts/test/ComputeEscrowRealCapability420.t.sol` for the real-registry two-payer fixture, unauthorized outsider checks, and reproducible authorized grant-expansion risk. The original mock-only proof does **not** establish an enforceable CMP-specific Vault grant boundary. A separately qualified on-chain grant fence **and an authorized refund exit** must be demonstrated before operating a funded CMP Vault. Follow the linked audit's exact-run and deployment evidence gates; this entry is not a claim that the new suite or an actual deployment has passed.


## CMP-1.2.1.2 — repository-level closeout (2026-09-25)

**Status: COMPLETE within repository-level scope.** Exact implementation head: `0e32c4dee3b86d2432c8d4e890fc69fc8129a963` on draft PR #371, based on `main` merge commit `95a83a961286701b6e8c064de1deccad10f41fd7`. This closeout supersedes the earlier OPEN operational disposition above for repository qualification only. It does not claim a live-chain deployment.

### Closed security findings

- The original generic `VaultAuthorization420` grant-expansion finding remains valid as an adversarial baseline, but it is no longer the intended CMP custody topology.
- `CMPVaultAuthorization420` now provides a dedicated, sealed CMP Vault authorization boundary. Shared capability grants are necessary but cannot broaden the protected Vault beyond the CMP policy's own principal/action restrictions.
- The policy binds the exact Vault, its registry, and funding adapter before sealing. Vault-originating asset-moving authorization is limited to the bound funding adapter's CREATE and RELEASE paths; CANCEL, generic/route WITHDRAW, delegated CLAIM, and arbitrary third-party obligation control remain denied.
- Registry-originating lifecycle authorization is separately limited to FREEZE, UNFREEZE, BEGIN_WIND_DOWN, and CLOSE and still requires the matching shared capability. Lifecycle authority does not imply payer-credit release, cancellation, withdrawal, or claim authority.
- `AssetVault420` binds the payer-safety controller at obligation creation. A later generic RELEASE/CANCEL grant to another principal cannot mutate a protected payer-safety obligation.
- Expired unmatched jobs have a tested release-to-claimable path that preserves the immutable original payer as beneficiary, rejects premature and replayed refunds, and preserves the other payer's backing.
- Unsolicited donor/free balance is tested as non-capturable by a hostile withdrawal grant through the dedicated CMP policy.
- ACTIVE→FROZEN blocks new funding; FROZEN→WINDING_DOWN remains capability-gated; WINDING_DOWN preserves the exact expired-unmatched payer exit.

### Exact-head named-suite evidence

Solidity Contracts #3148 completed successfully for exact head `0e32c4dee3b86d2432c8d4e890fc69fc8129a963`; all 16 PR shards completed successfully.

- `contracts/test/ComputeEscrowFencedCapability420.t.sol:ComputeEscrowFencedCapability420Test` — shard 1 job `107936762366`: **6 passed; 0 failed; 0 skipped**.
  - `testDonorSurplusCannotBeCapturedByHostileWithdrawalGrant`
  - `testExpiredUnmatchedRefundIsExactClaimableThenPaidToOriginalPayer`
  - `testLifecycleFreezeStopsAdmissionAndWindingDownPreservesPayerExit`
  - `testMissingSharedGrantStillDeniesFundingAndRefund`
  - `testRegistrarRotationAndOtherVaultScopeCannotOverrideSealedPolicy`
  - `testSealedPolicyRejectsCompetingGrantsAndConservesTwoPayers`
- `contracts/test/ComputeEscrowRealCapability420.t.sol:ComputeEscrowRealCapability420Test` — shard 3 job `107936762465`: **4 passed; 0 failed; 0 skipped**. This remains the real-registry generic-Vault adversarial baseline and confirms why the dedicated fence is necessary.
- `contracts/test/ComputeEscrowVaultAuthorization420.t.sol:ComputeEscrowVaultAuthorization420Test` — shard 4 job `107936762632`: **3 passed; 0 failed; 0 skipped**.
- `contracts/test/ComputeEscrowFunding420.t.sol:ComputeEscrowFunding420Test` — shard 2 job `107936762593`: **5 passed; 0 failed; 0 skipped**; the original CMP-1.2.1.1 funding evidence remains green after the later authorization/refund changes.

Associated exact-head workflows:

- Solidity Contracts #3148 — https://github.com/abvhiael/420-integrated-v0.1/actions/runs/36091354852 — success.
- 420 Integrated Qualification #5428 — https://github.com/abvhiael/420-integrated-v0.1/actions/runs/36091354863 — success.
- 420Docs Qualification #2811 — https://github.com/abvhiael/420-integrated-v0.1/actions/runs/36091354859 — success.

### Qualification boundary

CMP-1.2.1.2 is therefore closed for **repository-level implementation and deployment-realistic qualification**: the real capability semantics have been audited, the generic-grant bypass has a non-bypassable CMP-specific on-chain fence, the dedicated Vault topology is one-way sealed, two-payer conservation and hostile authority expansion are tested, unsolicited surplus cannot be stolen through the CMP policy, and an emergency freeze/wind-down path coexists with a reachable original-payer refund.

The following remain outside CMP-1.2.1.2 and are **not** implied by this closeout: actual chain/network deployment; deployed addresses and transaction hashes; runtime code-hash and immutable-configuration attestation; live grant IDs/limits/expiry/revocation inventory; testnet funding transactions; ProtocolRegistry publication; accepted-price reservation; provider entitlement/payout; post-match cancellation/refunds; disputes; slashing; and production activation. Those are handled by CMP-1.2.2+ and specifically the live deployment/testnet gate in CMP-1.2.9.


## CMP-1.2.1.3 — funding lifecycle integrity and provenance

**Status: COMPLETE within repository-level scope.** Exact qualified implementation/test head: `e88d5f5f8c5724ec84ff3074dd9c8fd72796eb44`. `ComputeEscrowFunding420Test` proves that refunded credits cannot remain valid or replay, owner/job/reference evidence cannot be reused, unsolicited Vault surplus cannot fabricate a payer credit, and historical `ComputeJobPayerCustody420` balance is never imported into the new Vault-backed funding ledger.

Acceptance criteria and exact named tests are recorded in [`CMP-1.2.1.3-FUNDING-LIFECYCLE-INTEGRITY.md`](CMP-1.2.1.3-FUNDING-LIFECYCLE-INTEGRITY.md). Exact-head evidence: Solidity Contracts run `36173406491` succeeded with all 16 PR shards green; funding shard 2 job `108198785353` reports **9 passed / 0 failed / 0 skipped**; fenced-capability shard 1 job `108198785251` reports **6 / 0 / 0**; real-capability shard 3 job `108198785380` reports **4 / 0 / 0**; Vault-authorization shard 4 job `108198785250` reports **3 / 0 / 0**. 420 Integrated Qualification run `36173406567` and 420Docs Qualification run `36173406361` both succeeded.

This step remains inside CMP-1.2.1 canonical payer funding. It does not authorize accepted-price reservation, provider settlement, matched-job refund economics, dispute/slash paths, or live network deployment. CMP-1.2.9 remains the deployment/testnet evidence gate.


## CMP-1.2.2 — accepted-price reservation and spending limits

**Status: COMPLETE within repository-level scope.** Exact qualified implementation/test head: `4933beb6284dfbf93aea8e827719b2960d0226f4`.

The repository-level acceptance-price boundary is now executable. `ComputeOfferRegistry420` publishes immutable fixed native-$420 offer terms bound to the exact provider/resource revisions and provider-derived settlement beneficiary. `ComputeAcceptedPriceMatch420` requires the exact real `ComputeEscrowFunding420` adapter and bound job registry, then refuses acceptance unless the fixed quote fits both the payer's signed `maxSpend` and that job's actual Vault-backed credit. The accepted amount is also passed into the scoped `ACTION_ACCEPT_MATCH` capability check. One unique price reservation is frozen per job before the job reaches `ACCEPTED`; acceptance does not release funds or create provider earnings.

Exact-head evidence:

- Solidity Contracts run `36197680782` — **success**, all 16 PR shards green.
- `ComputeAcceptedPriceMatch420Test` — shard 2 job `108279547002`: **7 passed / 0 failed / 0 skipped**.
- `ComputeEscrowFunding420Test` — shard 5 job `108279546978`: **9 / 0 / 0**.
- `ComputeEscrowFencedCapability420Test` — shard 4 job `108279547063`: **6 / 0 / 0**.
- 420 Integrated Qualification run `36197680589` — **success**.
- 420Docs Qualification run `36197680701` — **success**.

The new suite proves the accepted quote cannot exceed signed payer authority or actual job-specific funded credit; donor/free Vault surplus cannot make an underfunded job acceptable; capability amount limits apply to the quote; cancelled offers and stale resource revisions cannot consume a reservation; later provider changes cannot rewrite an accepted beneficiary or price; wrong offer/resource bindings fail closed; and accepted price/match evidence cannot replay across jobs.

Full qualification record: [`CMP-1.2.2-ACCEPTED-PRICE-RESERVATION-QUALIFICATION.md`](CMP-1.2.2-ACCEPTED-PRICE-RESERVATION-QUALIFICATION.md).

This closeout is repository-level only. Verified provider earnings begin at CMP-1.2.3; provider payout at CMP-1.2.4; later refund/dispute/solvency work remains CMP-1.2.5–1.2.7; live deployment/testnet evidence remains CMP-1.2.9.

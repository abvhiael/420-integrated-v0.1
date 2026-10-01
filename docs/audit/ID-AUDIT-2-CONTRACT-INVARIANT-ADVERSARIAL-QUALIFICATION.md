# ID-AUDIT-2 — contract invariant and adversarial qualification

**Status:** COMPLETE — Level 1 qualified  
**Repository:** `abvhiael/420-integrated-v0.1`  
**Working PR:** #438  
**Canonical roadmap:** `docs/audit/420IDENTITY-AUDIT-REMEDIATION-ROADMAP.md`

## Original step

ID-AUDIT-2 requires a dedicated Identity test suite covering profile, controller, issuer,
credential, trust-class, expiry and Names-binding boundaries.

**Exit criterion:** all named Identity invariants are mapped to tests and exact-head CI evidence.

This is a Level 1 per-roadmap-step qualification. No new shared authority or cross-component
runtime dependency is introduced, so no Level 2 milestone is required by this step. Level 3
whole-app reconciliation remains deferred to ID-AUDIT-10.

## Implementation scope

Primary executable qualification:

- `contracts/test/Identity420Audit.t.sol`
- `contracts/test/Identity420Compatibility.t.sol` retained from ID-AUDIT-1
- `contracts/test/RegistryIdentityNames420.t.sol` retained integration regression

No production contract behavior is changed by ID-AUDIT-2.

## Invariant-to-test map

| Invariant / boundary | Dedicated executable coverage |
| --- | --- |
| zero profile ID rejected | `testCreateProfileRejectsZeroAndDuplicateIds` |
| duplicate profile rejected | `testCreateProfileRejectsZeroAndDuplicateIds` |
| only current profile controller updates profile | `testOnlyControllerMayUpdateOrNominateTransfer` |
| only current controller nominates transfer | `testOnlyControllerMayUpdateOrNominateTransfer` |
| zero/self controller nomination rejected | `testOnlyControllerMayUpdateOrNominateTransfer` |
| only current pending controller accepts | `testOnlyPendingControllerMayAcceptAndPendingStateClears` |
| pending controller clears after acceptance | `testOnlyPendingControllerMayAcceptAndPendingStateClears` |
| replacing a pending controller invalidates old nominee | `testPendingControllerReplacementInvalidatesPriorNominee` |
| only current profile controller sets/clears primary name | `testPrimaryNameRequiresCurrentProfileController` |
| governance-only issuer configuration | `testIssuerConfigurationIsGovernanceOnlyAndValidated` |
| zero issuer ID rejected | `testIssuerConfigurationIsGovernanceOnlyAndValidated` |
| zero issuer controller rejected | `testIssuerConfigurationIsGovernanceOnlyAndValidated` |
| NONE issuer trust class rejected | `testIssuerConfigurationIsGovernanceOnlyAndValidated` |
| zero credential ID rejected | `testCredentialZeroAndUnknownIdsFailClosed` |
| unknown credential fails closed | `testCredentialZeroAndUnknownIdsFailClosed` |
| duplicate credential ID rejected | `testCredentialIdCannotBeReused` |
| unknown issuer rejected | `testCredentialIssuanceRejectsUnknownInactiveUnauthorizedAndExpiredInputs` |
| inactive issuer rejected | `testCredentialIssuanceRejectsUnknownInactiveUnauthorizedAndExpiredInputs` |
| non-issuer controller cannot issue | `testCredentialIssuanceRejectsUnknownInactiveUnauthorizedAndExpiredInputs` |
| unknown subject rejected | `testCredentialIssuanceRejectsUnknownInactiveUnauthorizedAndExpiredInputs` |
| current/past expiry rejected at issuance | `testCredentialIssuanceRejectsUnknownInactiveUnauthorizedAndExpiredInputs` |
| exact expiry boundary invalidates credential | `testCredentialValidityTracksExpiryProfileAndIssuerState` |
| profile deactivate/reactivate dynamically invalidates/restores | `testCredentialValidityTracksExpiryProfileAndIssuerState` |
| issuer deactivate/reactivate dynamically invalidates/restores | `testCredentialValidityTracksExpiryProfileAndIssuerState` |
| only issuer controller or governance revokes | `testOnlyIssuerControllerOrGovernanceMayRevoke` |
| duplicate revocation rejected | `testOnlyIssuerControllerOrGovernanceMayRevoke` |
| issuer controller replacement transfers revocation authority | `testCurrentIssuerControllerOwnsRevocationAuthorityAfterGovernanceReplacement` |
| only current subject controller rejects credential | `testOnlyCurrentSubjectControllerMayRejectCredential` |
| subject rejection is irreversible and distinct from revocation | `testSubjectRejectionIsIrreversibleAndHistoricalRecordPersists` |
| credential historical identifiers/claim remain after rejection | `testSubjectRejectionIsIrreversibleAndHistoricalRecordPersists` |
| trust checks use current issuer class | `testTrustThresholdReadsCurrentIssuerClass` |
| NONE/SYSTEM trust threshold extremes | `testTrustThresholdCoversNoneAndSystemExtremes` |
| Identity-only name pointer is insufficient for strong binding | `testNamesBindingRequiresBilateralAgreementAndRejectsOneSidedPointers` |
| Names-only profile claim is insufficient for strong binding | `testNamesBindingRequiresBilateralAgreementAndRejectsOneSidedPointers` |
| bilateral Names↔Identity agreement succeeds | `testNamesBindingRequiresBilateralAgreementAndRejectsOneSidedPointers` |
| name expiry invalidates Names side while stale Identity pointer remains non-authoritative | `testNamesExpiryAndTransferMakeIdentityPrimaryPointerStale` |
| name transfer clears Names profile link and invalidates prior bilateral relation | `testNamesExpiryAndTransferMakeIdentityPrimaryPointerStale` |
| frozen-interface any-valid / bounded lookup semantics remain covered | `Identity420Compatibility.t.sol` |
| existing Registry/Identity/Names happy-path integration remains covered | `RegistryIdentityNames420.t.sol` |

## Security and failure-path disposition

The current Identity contract has no token/ETH custody, arbitrary external calls, delegatecall,
signature verification, allowance accounting or internal replayable signed messages. Therefore
reentrancy, fund-accounting and signature-replay checks are not applicable to this step.

Relevant authority/failure paths are exercised through:

- GovernanceTimelock-only issuer mutation;
- current profile controller-only profile/name/rejection operations;
- current issuer controller-only issuance and issuer/governance revocation;
- two-step profile-controller transfer;
- exact expiry boundaries;
- current issuer/profile activation state;
- immutable credential-ID uniqueness;
- bounded subject/type compatibility lookup retained from ID-AUDIT-1;
- bilateral Names↔Identity validation rather than one-sided trust.

## Level 1 qualification requirements

ID-AUDIT-2 is complete only when the exact candidate implementation/evidence SHA demonstrates:

1. the dedicated Identity adversarial suite compiles and passes;
2. the retained ID-AUDIT-1 compatibility suite passes;
3. the existing Registry/Identity/Names integration regression passes;
4. affected Solidity compilation succeeds;
5. no directly applicable required CI check is skipped/cancelled/untriggered;
6. every invariant named by the audit/roadmap is mapped above;
7. exact-head evidence is retained below.

## Level 2 / Level 3

Level 2 is **not required** by ID-AUDIT-2 because this step adds qualification coverage only and
introduces no new authority, lifecycle, deployment dependency or shared runtime component.

Level 3 repository-wide reconciliation remains intentionally deferred to
**ID-AUDIT-10 — phase closeout, reconciliation and retained evidence**.

## Exact-head qualification evidence

The retained ID-AUDIT-2 implementation was qualified on the accumulated exact head
`d008d39542019a213ed25f8085c3b94fcfee5a29` by the focused Identity Level 1 workflow.

- **420Identity ID-AUDIT-3** run `36812082634` / run number 3 — **SUCCESS**
  - `Identity420Audit.t.sol` — **18 passed / 0 failed / 0 skipped**;
  - `Identity420Compatibility.t.sol` — **6 passed / 0 failed / 0 skipped**;
  - `RegistryIdentityNames420.t.sol` — **10 passed / 0 failed / 0 skipped**;
  - affected `Identity420.sol` build — success;
  - exact-head checkout/assertion — success.
- **420Docs Qualification** run `36812082637` / run number 3710 — **SUCCESS**.

The ID-AUDIT-3 changes after the ID-AUDIT-2 test implementation changed dependency configuration,
verification workflow and documentation, but did not alter the production Identity contract or the
ID-AUDIT-2 test source. The accumulated exact-head run therefore supplies stronger retained
qualification evidence for the unchanged ID-AUDIT-2 invariant suite.

Every canonical ID-AUDIT-2 invariant is mapped to executable coverage above and all three retained
Identity/Names suites passed without skips or failures.

No Level 2 milestone is required by ID-AUDIT-2. Level 3 remains deferred to ID-AUDIT-10.

This closeout is evidence-only and does not recursively invalidate the qualified implementation SHA.

## Completion state

**ID-AUDIT-2 — COMPLETE.**

Next canonical step after successful closeout:

**ID-AUDIT-3 — dependency/interface reconciliation**

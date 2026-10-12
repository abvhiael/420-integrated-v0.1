# BNB-2.2 — Independent operational approvals and manual WCAG acceptance

**Status: BLOCKED — external authorities and human testing not yet completed.** Repository-side automated CI cannot confer governance, legal, accessibility, or signing authority.

## A. Independent media moderation operational authorization

A qualified authority (not a property host, app developer acting alone, or synthetic fixture) must supply:

1. Governance/organizational authorization identifying the reviewer organization, jurisdiction and scope; independent conflict-of-interest check; decision record and expiry.
2. Signed moderation policy addressing permitted media, rights/ownership/licensing, privacy, illegal content, appeals, reviewer isolation and incident response.
3. Verified reviewer identities and operator roles, training, audit retention and revocation/rotation responsibilities.
4. A managed, auditable, non-exportable signing key (KMS/HSM); signed reviewer assertions with media ID, decision, purpose, subject, issuer, audience, jti, iat, nbf and exp. `BNB_MEDIA_REVIEW_ISSUER`, `BNB_MEDIA_REVIEW_AUDIENCE`, and `BNB_MEDIA_REVIEW_PUBLIC_KEY_PEM` must be provisioned via approved secrets/configuration, **never in Git**.
5. Actual staging exercise of approved/rejected/revoked transitions, malformed/wrong issuer/wrong scope/replayed/expired/compromised-key assertions, outages, appeals and immutable evidence. Demonstrate reviewer is not the host and issuance is permission-scoped. Preserve all signed decisions and source authority proof outside this repository as appropriate.
6. Independent security and operational acceptance with explicit approver, dated signed record, policy version, key fingerprint, deployment SHA and evidence location.

**Do not claim approval or enable media publication without verified external signatures, issuer governance and revocation.** Existing BnB API only verifies externally issued proof, it does not operate a trusted reviewer/issuer.

## B. Manual accessibility acceptance — WCAG 2.2 AA

The assigned independent tester must use a real deployed/staging release and record device/OS, browser/version, assistive technology/version, date, exact app commit, script, outcomes, defects and retest results. Minimum supported matrix:

| Environment | Interaction | Evidence |
| --- | --- | --- |
| Windows + Chrome + NVDA | complete host sign-in, draft, units, policies, media, review, calendar | Screen reader announcement transcript, focus order, errors, labelled controls |
| Windows + Edge + NVDA | same critical journeys | Screen-reader/keyboard retest and issue IDs |
| macOS + Safari + VoiceOver | guest browse and full host flows | Rotor/landmark/headings/status announcements |
| iOS Safari + VoiceOver | 390px/zoom/reflow/touch targets, forms | Demonstrated keyboard/touch and announcements |
| Android Chrome + TalkBack | browse, host failures, navigation | Announcements and focus snapshots |

Manually verify WCAG 2.2 AA applicable success criteria: focus visible and not obscured, predictable order, no keyboard traps, meaningful focus after errors/navigation, 200%/400% zoom, 320px reflow, text contrast, non-text contrast, target size, accessible names, status messages, form instructions, error identification, consistent help, authentication accessibility, timing, and motion preferences. Include signed-in and unauthenticated states, network outage, 401/403/409/422/503, verification pending, calendar conflicts, duplicate review, declined rights and session expiration.

Every failure requires a tracked defect with reproducible steps, severity, owner, fix SHA and retest. A WCAG AA claim requires a dated, independent human acceptance record. Browser automation/axe **does not** constitute that record.

## C. Acceptance evidence contract

Store only non-sensitive evidence metadata in `docs/bnb/qualification/BNB-2.2-EXTERNAL-MANUAL-ACCEPTANCE.json` once supplied by genuinely authorized reviewers. Required values: exact release SHA, reviewer identity/affiliation, independent authorizing organization, approval/review reference, dated human signature/reference, supported browser/AT matrix, critical journey results, defect closure, externally verifiable artifact identifiers, credential issuer/key rotation and revocation exercise outcomes. Do **not** invent reviewer signatures, keys or completed screen-reader trials.

**Release gate:** BOTH separately authorized moderation signoff AND completed manual WCAG accessibility signoff, together with exact-SHA app Level 1 and required integration checks. Missing evidence means `BLOCKED_EXTERNAL_AUTHORITY_AND_MANUAL_TESTING`. This is not the same as failing executable unit tests.

## D. Ownership and next action

An authorized organizational decision-maker must designate the independent moderation operator and reviewer; security/key operations must provision managed signing infrastructure; qualified accessibility testers must run the supported matrix and sign off findings. These are real-world tasks. Their required *testnet/live operational* integration should remain tracked in `BNB-TESTNET-WORK-ROADMAP.md`. No mock keys, self-approval, CI-generated certificates or unperformed human tests may satisfy the gate.

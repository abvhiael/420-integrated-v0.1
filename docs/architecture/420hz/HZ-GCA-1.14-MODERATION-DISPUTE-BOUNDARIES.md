# HZ-GCA-1.14 — Moderation & dispute boundaries

Status: **IMPLEMENTED — Level 1 moderation/dispute policy definition**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Machine-readable policy:

`hz/config/gca-moderation-dispute-v1.json`

This step freezes the application moderation and dispute boundaries for 420Hz Generate, Community and Awards.

## Core rule

420Hz moderation may change **420Hz application visibility, interactivity, participation and review state**.

It may not rewrite:

- Creative Work/Recording/Creator authority;
- 420 Rights claims/licenses;
- Wallet/SmartAccount authority;
- 420Identity credentials;
- Pay/Treasury/Grants/Vault balances;
- Civic/Governance state;
- immutable finalized Awards history.

## Moderation vocabulary

The application vocabulary is:

- REPORT
- HIDE
- LOCK
- SUSPEND
- BLOCK
- MUTE
- MODERATOR_DECISION
- APPEAL
- RESTORE

Dispute classifications additionally include:

- RIGHTS_DISPUTE
- AWARD_CHALLENGE
- VOTE_ABUSE_CHALLENGE
- ARBITRATION_REFERENCE

## Reports

A report binds stable report/actor/target/reason/version state.

A report is an **allegation/intake record**, not a finding.

Submitting a report cannot by itself:

- rewrite Rights;
- revoke Identity;
- move funds;
- change a vote;
- change a winner;
- invoke Arbitration;
- create moderator authority.

Duplicate report replay is idempotent or rejected without duplicate enforcement.

## Evidence

Evidence should remain commitment-based where possible.

Private payloads may remain encrypted and access-controlled off-chain.

An evidence hash does **not** make the underlying payload public and does not authorize disclosure.

Evidence access is case/role scoped.

Evidence retention follows HZ-GCA-1.8 and may extend only under a scoped active appeal/dispute hold.

Raw Identity proofs, Wallet secrets, private generation inputs, raw consent evidence and unrelated private community data must not enter public moderation records.

## HIDE

HIDE removes ordinary 420Hz read/discovery visibility while preserving:

- target identity;
- provenance/history;
- authorized review access.

HIDE does not change Creative/Rights ownership or canonical IDs.

Search/Indexer must stop presenting actively hidden content as public current state.

## LOCK

LOCK preserves allowed read visibility but prevents further 420Hz interaction/mutation against the target.

It does not alter ownership, rights or source identity.

## SUSPEND

SUSPEND disables defined 420Hz mutation/participation authority for the subject inside the explicit app/domain scope.

It does not revoke:

- Wallet control;
- protocol Identity;
- external community membership;
- Creative rights;
- funds.

## BLOCK / MUTE

BLOCK and MUTE are user/application relationship controls.

They do not fabricate:

- unfollow;
- un-favorite;
- membership removal;
- Identity changes.

BLOCK prevents a blocked relationship from becoming an alternate interaction/access path.

MUTE affects only the muting user's presentation unless later policy explicitly defines another scoped behavior.

## RESTORE

RESTORE releases active app enforcement.

It preserves all prior:

- reports;
- decisions;
- appeals;
- evidence commitments;
- actor/reason/timestamp provenance.

Historical moderation state is never rewritten as though it did not occur.

## Moderator authority

A moderation decision requires explicit scoped moderator capability/role.

Reporter, target owner, ordinary Wallet user, provider, chart operator or Awards participant cannot self-promote into moderator authority.

Moderator scope is app/target/domain bounded.

It does not grant authority over Rights, Wallet, Identity, payment or Governance.

## Appeals

Only the affected subject or otherwise explicitly policy-authorized party may appeal.

An appeal:

- links to the prior decision;
- does not overwrite prior history;
- follows a frozen appeal window/limit;
- requires an authorized reviewer path.

A changed enforcement outcome is represented by a new decision/RESTORE action rather than mutation of prior records.

## Comments / replies

Comments/replies remain gated.

They may be enabled only when the relevant surface has qualified:

- REPORT;
- BLOCK;
- MUTE;
- HIDE/LOCK;
- APPEAL;
- stable actor/target references;
- replay protection;
- visibility rules.

Enabling comments without those moderation/reporting/appeal controls is invalid.

## Rights disputes

A rights/provenance complaint may cause a temporary 420Hz application hold such as HIDE/LOCK or publication-review state.

It does not rewrite Creative or 420 Rights state.

420 Rights deliberately allows non-identical competing claims to coexist; 420Hz must not choose a legal winner merely from UI/indexer metadata.

If the applicable policy requires canonical source resolution before publication, 420Hz fails closed until the source state is revalidated.

## 420 Arbitration boundary

420Arbitration integration is **OPTIONAL / EXPLICIT ONLY**.

An ordinary report, appeal, rights complaint or Award challenge does not automatically invoke Arbitration.

If later adopted for a specific dispute surface, the integration must use:

- the canonical service `420/service/arbitration/v1`;
- a registered Arbitration domain;
- exact originating component/object;
- exact parties where relevant;
- a snapshotted Arbitration policy;
- explicit 420Hz ruling-consumption logic.

Opening an Arbitration case records a dispute. It is **not a ruling**.

A finalized Arbitration ruling is a bounded input, not a superuser instruction.

Before consuming a ruling, 420Hz must verify:

- expected domain;
- origin component/object;
- parties where relevant;
- Arbitration finality;
- chain/finality policy where required;
- ruling/remedy commitment;
- replay protection;
- permitted remedy class.

420Arbitration cannot directly:

- transfer/refund funds;
- rewrite Rights;
- mutate Wallet/Identity;
- execute Governance;
- directly mutate finalized AwardResult bytes.

## Arbitration remedy allowlist

HZ-GCA-1.14 freezes an architecture-level allowlist of bounded application dispositions:

- NO_ACTION
- RESTORE_APPLICATION_VISIBILITY
- MAINTAIN_APPLICATION_ENFORCEMENT
- MARK_AWARDS_CHALLENGE_UPHELD
- MARK_AWARDS_CHALLENGE_REJECTED
- REQUEST_EXPLICIT_AWARDS_CORRECTION_PATH

These are **not deployed remedy executors**.

They define what a later consuming 420Hz transition may interpret from a finalized ruling.

Anything outside the explicit allowlist fails closed.

## Awards challenges

Award challenge types include:

- eligibility challenge;
- nomination challenge;
- ballot-integrity challenge;
- vote-abuse challenge;
- result-correction request.

Moderation may pause/hide abusive presentation where policy permits.

It cannot directly hand-edit:

- tally totals;
- vote choices;
- winner IDs;
- finalized result bytes.

Pre-finalization invalidation must use the frozen HZ-GCA-1.13 rules and retain reason/evidence commitments.

Post-finalization correction uses explicit superseding history rather than in-place mutation.

## Vote abuse

Suspected replay/Sybil/manipulation evidence may trigger review/quarantine/challenge.

Moderation cannot:

- create voter eligibility;
- fabricate a nullifier;
- alter a valid vote choice;
- silently delete valid votes.

Vote invalidation requires objective ballot/policy-bound reason/evidence and durable history.

Any corrected tally must be recomputed deterministically from the resulting accepted/invalidated vote state.

Anomaly/rate scores are evidence inputs, not automatic canonical findings unless the frozen policy explicitly defines an objective threshold.

## Search / Notifications

Search may suppress/remove actively hidden or ineligible presentation but cannot mutate source/moderation state.

Notifications may deliver moderation/challenge events only to eligible recipients under privacy rules.

Notification failure does not roll back a moderation decision or Arbitration state.

A deep link cannot bypass Wallet/session/moderator/appeal authorization.

## Failure conditions

The policy fails closed for:

- report target substitution;
- actor mismatch;
- duplicate report creating duplicate enforcement;
- unauthorized moderator action;
- app moderation trying to rewrite external canonical state;
- BLOCK/MUTE fabricating source social/Identity state;
- appeal overwriting history;
- comments enabled without moderation support;
- operator/manual Awards tally or winner editing;
- vote invalidation without objective evidence/policy binding;
- finalized result in-place mutation;
- automatic Arbitration invocation;
- ruling consumption without exact domain/origin/finality/replay checks;
- non-allowlisted Arbitration remedy;
- evidence commitment treated as disclosure authority;
- Search/Notifications overriding source truth.

## Invariants

The machine-readable policy freezes **HZGCA-MOD-001 through HZGCA-MOD-018**.

Core guarantees:

- moderation remains application scoped;
- reports are allegations, not findings;
- moderator decisions are capability scoped and auditable;
- enforcement does not rewrite external canonical state;
- appeals preserve history;
- evidence privacy is maintained;
- rights disputes do not make 420Hz a legal adjudicator;
- Awards corrections remain deterministic/superseding;
- Arbitration is explicit/optional and bounded;
- Arbitration rulings never become ambient authority.

## HZ-GCA-1.14 exit criteria

HZ-GCA-1.14 is complete when:

- moderation vocabulary/enforcement semantics are explicit;
- report/evidence/decision/appeal/restoration lifecycle is explicit;
- block/mute/comment boundaries are explicit;
- Creative/Rights/Identity/Wallet/payment/Governance non-authority is explicit;
- Rights dispute and Awards challenge boundaries are explicit;
- vote-abuse handling is explicit;
- Arbitration adoption/ruling-consumption/remedy boundaries are explicit;
- evidence privacy/retention/Search/Notifications boundaries are explicit;
- targeted exact-head verifier passes;
- no Arbitration domain/address/executor, moderation runtime, ABI, deployment or testnet state is invented;
- parent HZ-GCA-1 remains open.

Next canonical work package:

**HZ-GCA-1.15 — Threat model**

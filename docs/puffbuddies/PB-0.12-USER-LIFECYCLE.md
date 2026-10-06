# PuffBuddies PB-0.12 user lifecycle

## Purpose

PB-0.12 defines the canonical PuffBuddies account/application lifecycle states and transitions.

It specifies:

- canonical user/account states;
- allowed transition classes;
- authority required for transitions;
- participation effects of each state;
- interaction with eligibility, safety, consent, deletion, sessions, and dependencies;
- fail-closed behavior for stale or conflicting lifecycle state;
- reactivation and re-registration boundaries.

PB-0.12 defines policy/state-machine semantics only. It does not implement lifecycle services, databases, queues, APIs, contracts, addresses, service IDs, deployments, or live transition processing.

## Lifecycle principles

1. PuffBuddies lifecycle state is PuffBuddies-owned application state.
2. Lifecycle authority is separate from Wallet, Identity, Names, Messenger, Notifications, Pay, Registry, and AppStore authority.
3. Eligibility is necessary for ordinary participation but is not itself the PuffBuddies lifecycle state.
4. Safety restrictions can override otherwise-valid eligibility and relationship state.
5. Deactivation, suspension, ban, and deletion revoke ordinary participation to different degrees and for different reasons.
6. Stale clients, sessions, queues, notifications, matches, premium state, or downstream dependencies must not preserve permissions revoked by lifecycle state.
7. Re-entry always re-evaluates current policy rather than assuming an old state is still valid.

## Canonical lifecycle states

### PB-LIFE-001 — UNREGISTERED

No active PuffBuddies application account/profile currently exists for the subject.

Wallet/account or 420Integrated identity state may exist independently.

### PB-LIFE-002 — ELIGIBILITY_PENDING

The subject has begun PuffBuddies entry but does not yet have a current authoritative ELIGIBLE conclusion under PB-0.6.

Ordinary discovery, matching, likes, and match-dependent messaging are not authorized.

### PB-LIFE-003 — ELIGIBILITY_FAILED

Current evidence or policy yields INELIGIBLE, or a required eligibility condition has failed.

Ordinary PuffBuddies participation is denied until a later valid transition under current policy.

### PB-LIFE-004 — PROFILE_INCOMPLETE

The subject is currently eligible but has not satisfied the minimum profile requirements for ordinary discovery participation.

The exact profile-completeness requirements remain later roadmap work.

### PB-LIFE-005 — ACTIVE

The PuffBuddies account is eligible, not deactivated, not safety-restricted in a way that disables ordinary participation, not suspended/banned, and not in deletion lifecycle.

ACTIVE is necessary but not sufficient for any particular interpersonal action; consent/block/match rules remain authoritative.

### PB-LIFE-006 — DEACTIVATED

The user has voluntarily paused ordinary PuffBuddies participation without requesting deletion.

Profile/data may remain retained for possible reactivation under PB-0.11, but discovery, new matching, likes, and ordinary match-dependent interaction are revoked.

### PB-LIFE-007 — RESTRICTED

PuffBuddies safety/policy authority has imposed a scoped restriction that does not necessarily amount to full suspension.

The restriction may disable specific capabilities while leaving other allowed account functions available.

### PB-LIFE-008 — SUSPENDED

PuffBuddies safety/lifecycle authority has temporarily disabled ordinary participation.

Suspension overrides eligibility, active match state, premium entitlement, cached authorization, and ordinary messaging permission.

### PB-LIFE-009 — BANNED

PuffBuddies safety/lifecycle authority has disabled ordinary participation under a ban decision.

A ban is not bypassed by reconnecting a wallet, changing a .420 name, paying, restoring a session, reinstalling a client, or reusing stale credentials.

### PB-LIFE-010 — DELETE_REQUESTED

An authenticated PuffBuddies deletion request has been accepted.

Ordinary participation is immediately revoked and must not be restored while deletion is pending.

### PB-LIFE-011 — DELETION_IN_PROGRESS

PuffBuddies-owned active data, caches, processors, backups, and derived copies are being processed according to PB-0.11.

This state remains non-participating.

### PB-LIFE-012 — DELETION_COMPLETE

PuffBuddies deletion completion semantics under PB-0.11 have been satisfied.

No ordinary PuffBuddies account/profile remains active. Narrow retained evidence may still exist under explicit canonical exceptions.

### PB-LIFE-013 — RETAINED_EVIDENCE_ONLY

A protected non-participating condition representing narrow retained safety/legal/security/accounting evidence after ordinary product data is no longer active.

This is not an account state that authorizes discovery, matching, messaging, profile visibility, or premium use.

### PB-LIFE-014 — APPEAL_REVIEW

A suspension/ban/restriction outcome is under an allowed appeal/review process.

Appeal review does not itself restore ordinary participation or interpersonal permissions.

## Canonical transition invariants

### PB-LIFE-015 — Entry starts from UNREGISTERED

A subject enters PuffBuddies from UNREGISTERED through the current eligibility/account-creation flow.

Existing Wallet, Identity, Names, or Messenger state must not silently create an ACTIVE PuffBuddies account.

### PB-LIFE-016 — Eligibility gates ordinary account activation

UNREGISTERED or ELIGIBILITY_PENDING may advance toward PROFILE_INCOMPLETE/ACTIVE only after a current authoritative ELIGIBLE result and any other required entry checks.

UNKNOWN or INELIGIBLE must fail closed.

### PB-LIFE-017 — Profile completion gates ordinary discovery

PROFILE_INCOMPLETE may become ACTIVE only when current canonical profile-completeness requirements are satisfied.

Client-side appearance of completeness is not authoritative.

### PB-LIFE-018 — ACTIVE can voluntarily transition to DEACTIVATED

An eligible ACTIVE user may request deactivation without needing approval from matches or other users.

Deactivation immediately revokes ordinary participation as defined by PB-0.11.

### PB-LIFE-019 — DEACTIVATED reactivation requires current checks

DEACTIVATED may return toward ACTIVE only after current eligibility, safety, policy-version, account-integrity, and profile requirements are re-evaluated.

Prior ACTIVE status is not permanent authorization.

### PB-LIFE-020 — Safety authority may transition into RESTRICTED

PuffBuddies safety/moderation authority may transition an otherwise participating user into RESTRICTED under PB-0.10.

The restriction must be scoped and auditable.

### PB-LIFE-021 — Safety authority may transition into SUSPENDED

PuffBuddies safety/lifecycle authority may transition eligible or active accounts into SUSPENDED.

Suspension revokes ordinary participation regardless of current match/payment/session state.

### PB-LIFE-022 — Safety authority may transition into BANNED

PuffBuddies safety/lifecycle authority may transition an account into BANNED according to canonical moderation policy.

No dependency may independently manufacture or reverse the PuffBuddies ban state.

### PB-LIFE-023 — Appeal transition does not restore access

RESTRICTED, SUSPENDED, or BANNED may enter APPEAL_REVIEW where later policy permits.

APPEAL_REVIEW preserves the applicable deny/restriction unless a canonical review outcome explicitly changes it.

### PB-LIFE-024 — Restriction removal requires explicit canonical transition

A restriction, suspension, or ban does not disappear because time passed, a client refreshed, payment succeeded, a new name/wallet was connected, or a downstream service became available.

Restoration requires the canonical lifecycle authority to transition state.

### PB-LIFE-025 — Eligibility loss can revoke ACTIVE participation

If current PuffBuddies eligibility changes from ELIGIBLE to INELIGIBLE or UNKNOWN where PB-0.6 requires fail-closed behavior, ordinary participation must be revoked.

The exact resulting lifecycle state may be ELIGIBILITY_PENDING, ELIGIBILITY_FAILED, RESTRICTED, or another later-defined non-participating state consistent with policy.

### PB-LIFE-026 — Delete request is user-authorized and terminal for ordinary participation

An authenticated account may enter DELETE_REQUESTED according to PB-0.11.

Once accepted, stale clients, matches, sessions, notifications, payments, or appeals must not restore ordinary participation.

### PB-LIFE-027 — DELETE_REQUESTED advances through deletion processing

DELETE_REQUESTED may advance to DELETION_IN_PROGRESS and then DELETION_COMPLETE when PB-0.11 completion criteria are satisfied.

Later implementation may use more internal substates but must preserve these canonical semantics.

### PB-LIFE-028 — DELETION_COMPLETE does not reactivate

DELETION_COMPLETE cannot transition directly back to ACTIVE.

A returning user must follow a new registration lifecycle under current eligibility, safety, and policy rules.

### PB-LIFE-029 — Retained evidence never becomes ordinary participation

RETAINED_EVIDENCE_ONLY cannot authorize profile display, discovery, likes, matching, ordinary messaging, or premium interpersonal access.

It may only support the explicitly documented retention purpose.

### PB-LIFE-030 — New registration after deletion is not state restoration

A later registration after DELETION_COMPLETE is a new lifecycle decision.

Prior matches, likes, consent, blocks, profile preferences, discovery state, and premium entitlements are not silently resurrected.

### PB-LIFE-031 — Block and match state do not own lifecycle

Blocks, matches, likes, conversations, and Messenger state influence interpersonal authorization but do not independently transition the overall PuffBuddies account into ACTIVE, DEACTIVATED, SUSPENDED, BANNED, or deleted states.

### PB-LIFE-032 — Payment/entitlement state does not own lifecycle

420Pay settlement, subscription, premium entitlement, token ownership, or other economic state cannot activate, reactivate, unsuspend, unban, or cancel deletion.

### PB-LIFE-033 — Wallet and identity state do not own PuffBuddies lifecycle

Wallet connection, account control, Identity profile activity, credentials, and .420 Names may satisfy specific prerequisites but cannot independently change PuffBuddies lifecycle state.

### PB-LIFE-034 — Sessions follow lifecycle authority

Sessions and access tokens are subordinate to current lifecycle state.

A valid-looking token must fail authorization when canonical lifecycle state no longer permits the requested action.

### PB-LIFE-035 — Notifications and queues cannot transition lifecycle

Delivery receipts, notification acknowledgements, queued jobs, retries, or delayed events must not create lifecycle transitions.

They may report or process a transition that the canonical lifecycle authority has already accepted.

### PB-LIFE-036 — Client state cannot transition protected lifecycle by itself

Optimistic UI, local storage, cached profile state, offline state, or mobile/web client flags are not canonical lifecycle authority.

Protected transitions require authenticated server/policy authority.

### PB-LIFE-037 — Conflicting lifecycle state fails closed

If services disagree about whether an account is ACTIVE versus non-participating, protected actions must resolve against current canonical PuffBuddies lifecycle state.

If current state cannot be established, ordinary participation fails closed.

### PB-LIFE-038 — Lifecycle changes invalidate stale derived state

A transition into DEACTIVATED, RESTRICTED, SUSPENDED, BANNED, DELETE_REQUESTED, DELETION_IN_PROGRESS, or DELETION_COMPLETE must invalidate or subordinate stale discovery, recommendation, match-authorization, messaging, entitlement-display, and client cache state as applicable.

### PB-LIFE-039 — Lifecycle state remains private

A user's PuffBuddies lifecycle status must not become a publicly enumerable wallet/Identity/Names/Registry/Search/Explorer/Analytics record unless a later explicit public protocol requirement exists and satisfies PB-0.3/PB-0.4 minimum-disclosure rules.

### PB-LIFE-040 — Lifecycle transitions are protected and auditable

Later implementation must record enough protected evidence to establish who/what authorized a lifecycle transition, the prior/new state, time, policy basis, and relevant safety/deletion/eligibility context without publishing private relationship history.

## Canonical transition matrix

| From | To | Canonical trigger/authority | Ordinary participation after transition |
| --- | --- | --- | --- |
| UNREGISTERED | ELIGIBILITY_PENDING | authenticated entry flow | no |
| ELIGIBILITY_PENDING | PROFILE_INCOMPLETE | current ELIGIBLE + entry checks | limited/non-discovery |
| ELIGIBILITY_PENDING | ELIGIBILITY_FAILED | INELIGIBLE / failed required proof | no |
| PROFILE_INCOMPLETE | ACTIVE | current profile + policy requirements | yes, subject to consent/safety |
| ACTIVE | DEACTIVATED | authenticated user request | no |
| DEACTIVATED | ACTIVE | canonical reactivation after current checks | yes |
| ACTIVE/DEACTIVATED | RESTRICTED | PuffBuddies safety/policy authority | scoped |
| ACTIVE/DEACTIVATED/RESTRICTED | SUSPENDED | PuffBuddies safety/lifecycle authority | no |
| participating/nondeleted | BANNED | PuffBuddies safety/lifecycle authority | no |
| RESTRICTED/SUSPENDED/BANNED | APPEAL_REVIEW | permitted review request | existing deny remains |
| eligible participating/nondeleted | DELETE_REQUESTED | authenticated deletion request | no |
| DELETE_REQUESTED | DELETION_IN_PROGRESS | canonical deletion processor | no |
| DELETION_IN_PROGRESS | DELETION_COMPLETE | PB-0.11 completion criteria | no |
| deleted account | new UNREGISTERED lifecycle | new registration attempt | no until requalified |

The matrix is policy semantics, not a claim that these transitions are already implemented.

## Transition authorization rule

Before later implementation adds a lifecycle transition, it must define:

1. source state(s);
2. destination state;
3. authenticated actor or canonical authority;
4. preconditions;
5. eligibility effect;
6. safety/moderation effect;
7. consent/match/messaging effect;
8. session/token invalidation effect;
9. visibility/discovery effect;
10. retention/deletion effect;
11. dependency notifications or capability revocations;
12. audit evidence;
13. failure/stale-state behavior.

A transition without an explicit authority and fail-closed behavior is not canonical.

## PB-0.12 completion boundary

PB-0.12 is satisfied when the repository:

- records PB-LIFE-001 through PB-LIFE-040 exactly once and in sequence;
- defines canonical states UNREGISTERED, ELIGIBILITY_PENDING, ELIGIBILITY_FAILED, PROFILE_INCOMPLETE, ACTIVE, DEACTIVATED, RESTRICTED, SUSPENDED, BANNED, DELETE_REQUESTED, DELETION_IN_PROGRESS, DELETION_COMPLETE, RETAINED_EVIDENCE_ONLY, and APPEAL_REVIEW;
- defines entry, activation, deactivation/reactivation, restriction/suspension/ban, appeal, eligibility-loss, deletion, and post-deletion re-registration transitions;
- keeps lifecycle authority separate from Wallet, Identity, Names, Messenger, Notifications, Pay, matches/blocks, clients, sessions, queues, and derived state;
- requires lifecycle revocations to invalidate stale participation authority;
- requires conflicting/unknown protected lifecycle state to fail closed;
- keeps lifecycle state private and transitions auditable;
- preserves PB-0.1 through PB-0.11;
- introduces no lifecycle service, database, API, queue, worker, contract, address, service ID, deployment, or false live transition-processing claim.

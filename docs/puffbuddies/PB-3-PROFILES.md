# PB-3 — Profiles

## Canonical status
PB-3 is the current canonical **Profiles** phase/roadmap step in `PUFFBUDDIES-ROADMAP.md`.

The older PB-0.19 planning section predates the current phase-number reservation and described profile work inside its legacy PB-2 grouping while using PB-3 for discovery/matching. For current implementation, the phase-name authority in `PUFFBUDDIES-ROADMAP.md` controls: **PB-3 means Profiles**. The legacy profile requirements are carried forward here; discovery and matching remain later canonical phases and are not silently pulled into PB-3.

## Purpose
Implement the canonical private PuffBuddies profile boundary required by PB-0.2, PB-0.3, PB-0.4, PB-0.9, PB-0.11, PB-0.12 and PB-0.15.

PB-3 lets a currently eligible PuffBuddies participant create, edit, persist, review and lifecycle-manage an ordinary dating/social profile while preserving private/off-chain storage, field-level server authorization, stale-state invalidation, wallet/profile unlinkability and deletion/lifecycle authority.

## Canonical requirements
1. Profile state is PuffBuddies-owned private application state; Wallet, Identity, Names, Messenger, payment, clients and derived services do not own profile authority.
2. Profile creation requires current PuffBuddies ELIGIBLE state and canonical `PROFILE_INCOMPLETE` lifecycle.
3. PB-3 profile presentation supports Dating/Buddy/Both mode, bounded display identity, bio/prompts and opaque profile-media references.
4. Media handling in PB-3 is metadata/reference-only. No upload provider, object store, transformation service, moderation transport or public URL scheme is invented.
5. The canonical minimum profile-completeness rule for ordinary activation is a nonempty bounded display name plus at least one bounded opaque media reference; mode is always required by the profile record.
6. Only the profile owner may edit ordinary profile presentation, mode, media references or field visibility.
7. Profile text uses a closed, bounded field registry. Unknown fields and sensitive identity/private-state injection such as date of birth, wallet linkage, raw identity evidence, precise location, discovery preferences, safety state, match state or payment data are not profile presentation fields.
8. Profile visibility is explicit and field-level. PB-3 permits `PRIVATE_SELF`, in-app `DISCOVERABLE`, and `MATCHED` audiences only.
9. PB-3 creates no public profile surface. `PUBLIC_EXPLICIT`, Search/Explorer/public-wallet enumeration and public-chain profile presentation remain unauthorized.
10. Ordinary display name/bio/prompts/mode/media may default to `DISCOVERABLE`; more sensitive presentation fields such as pronouns/relationship intent default `PRIVATE_SELF` and require explicit owner change before broader in-app visibility.
11. Missing, stale or mismatched field-visibility policy fails closed.
12. Server-side visibility authorization remains authoritative; client hiding is not authorization.
13. Profile presentation cannot override eligibility, lifecycle, block, relationship, safety, deletion or current authorization state.
14. Profile edits invalidate stale discovery/matching/visibility/cache/index/analytics derived material through the canonical generation boundary.
15. Visibility changes advance visibility version and invalidate every derived surface covered by canonical `VISIBILITY` invalidation, including messaging authorization.
16. A complete profile may transition `PROFILE_INCOMPLETE -> ACTIVE` only under `PROFILE_POLICY` authority and current ELIGIBLE state.
17. User deactivation uses the canonical `ACTIVE -> DEACTIVATED` transition and revokes ordinary participation.
18. Reactivation from `DEACTIVATED` rechecks current eligibility and current profile completeness; prior ACTIVE state is not permanent authority.
19. An authenticated owner may initiate canonical deletion where the lifecycle state machine permits; deletion request immediately invalidates all derived authority.
20. Suspended, banned, deletion-pending/completed and other non-editable protected states cannot be bypassed by stale client/profile edits.
21. Canonical profile persistence uses the existing private `profile` table and optimistic concurrency; field visibility uses the existing private `visibility` table.
22. Profile persistence remains storage-neutral and introduces no production database, API, contract, address, service ID or deployment.
23. Profile fields/media/visibility remain deletion targets under PB-0.11; PB-3 does not claim asynchronous erasure completion.
24. Wallet/profile unlinkability and public-chain negative boundaries remain intact.
25. PB-3 does not implement discovery candidate generation/ranking, like/pass, reciprocal matching, Messenger transport, Notifications transport, safety-case workflows, web/mobile UI, or production media/storage infrastructure.

## Affected components
- `puffbuddies/domain/profiles.py`
- existing `puffbuddies/persistence/schema.py` and private repository interfaces
- existing lifecycle, authorization, invalidation and revocation primitives
- `puffbuddies/tests/test_pb_3_profiles.py`
- `.github/workflows/puffbuddies-pb3.yml`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `docs/puffbuddies/PB-0.19-MASTER-IMPLEMENTATION-ROADMAP.md`
- this canonical definition and durable qualification evidence

## Qualification
**Level 1 — ordinary roadmap-step fast qualification.**

PB-3 is app-scoped. It does not itself trigger canonical full Solidity, Genesis/address-authority, 420 Integrated/Geth/fault/soak, unrelated app or repository-wide Docs qualification. Those remain deferred to the applicable documented milestone or app-phase closeout unless a material shared dependency is changed.

## Milestone relationship
No new cross-app authority is introduced by PB-3. The meaningful retained integration boundary is the later accumulation of Profiles with Discovery/Matching; PB-3 alone does not justify ceremonial Level-2 or Level-3 execution.

## Dependencies
PB-0.2, PB-0.3, PB-0.4, PB-0.9, PB-0.11, PB-0.12, PB-0.15; PB-1 domain/persistence/authorization/invalidation foundations; PB-2 eligibility phase COMPLETE.

## Exit criteria
- eligible `PROFILE_INCOMPLETE` user can create a canonical profile;
- bounded display fields/media/mode can be owner-edited and persisted;
- profile completeness canonically gates activation;
- field visibility is explicit, versioned, server-authorized and fail-closed;
- no public-profile/public-chain/wallet-enumeration surface exists;
- profile and visibility changes invalidate stale derived authority;
- deactivate/reactivate/delete-initiation lifecycle behavior is correct and current-authority-gated;
- protected lifecycle states reject edits;
- optimistic concurrency and storage-neutral persistence remain intact;
- retained PuffBuddies regressions and profile privacy negative tests pass on the exact implementation SHA;
- durable Level-1 evidence is committed.

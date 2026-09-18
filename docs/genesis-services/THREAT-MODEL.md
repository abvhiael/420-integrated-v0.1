# GEN-SVC-0 Shared Consumer Services Threat Model

## Scope

This document defines the minimum cross-application abuse and security model for the Genesis consumer-service layer. Individual applications must add domain-specific controls without weakening these shared boundaries.

The consumer-service layer is not consensus authority. Search, feeds, reviews, media, maps, mail, calendar, community, classifieds and publishing are replaceable application services unless an exact state transition is delegated to an existing authoritative protocol/contract.

## Trust boundaries

1. **Wallet/signing boundary** — consumer services never receive or retain wallet private keys. Signed actions are domain-separated and user-authorized.
2. **Protocol boundary** — application state cannot override canonical chain, Registry, Identity, Rights, payment, escrow, governance, bridge, validator or Arbitration state.
3. **Indexer/search boundary** — indexes, rankings and feeds are projections and may be rebuilt. Their output is never canonical ownership or settlement state.
4. **Private-data boundary** — message bodies, private location, private calendars and visibility-gated content stay off-chain and are excluded from public indexes.
5. **Moderation boundary** — moderation changes application visibility/access; financial or protocol remedies require the authoritative owning subsystem.
6. **External-provider boundary** — map, media transport, email gateway, geocoder or delivery-provider output is external data and must be identified as such.

## Mandatory threat domains

### SPAM

Risks: mass posts, messages, listings, reviews, campaign comments, mail or event creation.

Baseline controls:
- per-identity/device/network rate limits;
- progressive throttling;
- block/mute controls;
- duplicate/fingerprint detection;
- reputation-sensitive limits where appropriate;
- abuse reporting and audit events.

### SYBIL

Risks: fake identities used to inflate votes, reviews, campaign backing, community activity or seller reputation.

Baseline controls:
- preserve pseudonymity but distinguish verified interaction from account existence;
- use transaction/booking/contract attestations for verified reviews;
- account-age/activity signals may influence rate limits but never become protocol identity authority;
- high-impact actions may require stronger proof/cost depending on owning application.

### FAKE_REVIEWS

Risks: purchased reviews, self-review, coordinated review bombing, fabricated stays/purchases/contracts.

Baseline controls:
- domain-scoped reputation;
- verified-interaction marker distinct from unverified opinion;
- conflict/relationship checks where evidence exists;
- one canonical review per verified interaction unless explicitly versioned;
- moderation never rewrites historical transaction evidence.

### SELLER_FRAUD

Risks: nonexistent items, payment diversion, counterfeit/stolen/prohibited listings, shipping fraud.

Baseline controls:
- verified seller/profile provenance where available;
- clear transaction mode: local pickup, local delivery, shipping or digital delivery;
- optional escrow for remote transactions;
- report/freeze visibility without unauthorized seizure;
- Arbitration integration for supported escrow disputes;
- jurisdiction/category policy enforcement.

### CROWDFUNDING_ABUSE

Risks: fraudulent campaigns, misleading claims, non-delivery, fund diversion, prohibited investment promises.

Baseline controls:
- creator identity/provenance;
- explicit funding mode and refund rules;
- escrow state owned by audited settlement contracts;
- reward/donation/preorder scope at Genesis;
- `launchpad.securities_or_equity` remains disabled by default;
- immutable campaign funding evidence plus editable, versioned narrative content.

### LOCATION_PRIVACY

Risks: home-address leakage, stalking, precise-location correlation, private travel/calendar inference.

Baseline controls:
- public place coordinates separated from private user location;
- user search may use coarse location or client-side proximity where practical;
- private residential coordinates are never required for public profiles/listings;
- visibility checks occur before geospatial indexing;
- logs avoid storing precise location unless operationally necessary and retention is bounded.

### MESSAGING_ABUSE

Risks: harassment, unsolicited bulk messaging, malicious attachments, impersonation.

Baseline controls:
- identity provenance;
- block/mute;
- sender rate limits;
- attachment scanning/metadata policy at delivery edges;
- signed application-generated mail where applicable;
- no implicit wallet transaction authority from message actions.

### MODERATION_ABUSE

Risks: rogue moderators, censorship outside scope, hidden irreversible actions, privilege escalation.

Baseline controls:
- moderator roles are domain-scoped;
- actions produce auditable provenance;
- appeals preserve prior decision history;
- moderation cannot transfer assets, revoke protocol identity or execute wallet operations;
- privileged APIs require explicit capability checks and fail closed.

### CONTENT_RIGHTS_ABUSE

Risks: unauthorized uploads, copied articles/media, fraudulent ownership claims.

Baseline controls:
- integrate 420Rights for rights assertions where available;
- distinguish uploader claim from verified rights evidence;
- support takedown/hide workflows without silently rewriting ownership records;
- preserve content hash/provenance where lawful and appropriate.

### ESCROW_FAILURE

Risks: double release, refund/release race, stale oracle/application instruction, unauthorized settlement.

Baseline controls:
- idempotent settlement operations;
- authoritative contract state checked before UI confirmation;
- explicit terminal states;
- no moderation/admin shortcut around escrow authorization;
- adversarial tests for timeout, cancellation, dispute and reorg conditions.

### INDEX_POISONING

Risks: forged search documents, stale authority state, duplicate IDs, visibility leakage.

Baseline controls:
- source provenance on indexed records;
- canonical IDs and versioning;
- rebuildable projections;
- visibility filtering before indexing and at query time;
- reorg/update/delete handling;
- consumer UI distinguishes canonical facts from derived ranking/recommendation.

### WEBHOOK_REPLAY

Risks: replayed booking/payment/message/event callbacks causing duplicate writes or settlement actions.

Baseline controls:
- signed webhook envelopes;
- timestamp/expiry;
- nonce/event ID replay cache;
- idempotency keys;
- signature key rotation/versioning;
- settlement consumers re-check authoritative state before action.

## Required application review

Every later GEN-SVC application must document:

- which mandatory threats apply;
- any additional domain threats;
- protected assets/data;
- trust boundaries;
- abuse-rate limits;
- moderation and appeal ownership;
- recovery/fail-closed behavior;
- test cases proving the stated controls.

# PuffBuddies PB-0.8 ecosystem dependencies

## Purpose

PB-0.8 defines the exact narrow roles of 420Integrated ecosystem dependencies that PuffBuddies may rely on later.

The goal is to reuse canonical ecosystem authorities without allowing any dependency to silently acquire PuffBuddies profile, match, consent, safety, privacy, or lifecycle authority that it does not own.

PB-0.8 is documentation and authority-boundary work only. It does not implement integration clients, deploy contracts, assign addresses, create service IDs, or claim any live dependency wiring.

## Governing integration rule

Every dependency is capability-limited to its canonical domain.

A dependency may provide a fact, capability, delivery surface, or derived view only when that role is already consistent with its repository-defined authority. PuffBuddies must not reinterpret a dependency's output as broader authority.

Where a dependency is stale, unavailable, deprecated, revoked, wrong-chain, or otherwise not authoritative for the requested decision, PuffBuddies must follow the fail-closed behavior defined by the owning PuffBuddies invariant.

## Canonical dependency roles

### PB-DEP-001 — 420Wallet owns wallet authentication/signing surfaces

420Wallet is the user-facing wallet/authentication/signing surface.

PuffBuddies may later use Wallet for proving control of the connected account, explicit transaction/signature approval, approved session/capability handoff, and displaying connection/permission requests.

PuffBuddies must not receive private signing keys, passkey secrets, recovery material, or ambient spending authority.

### PB-DEP-002 — 420Wallet is not PuffBuddies profile or relationship authority

A connected wallet proves only the wallet/account authority appropriate to the Wallet interface.

Wallet connection must not itself establish PuffBuddies membership, adult eligibility, profile visibility, likes or matches, messaging consent, block state, moderation state, or premium access to another person.

### PB-DEP-003 — 420Identity owns canonical identity-profile and credential lifecycle

420Identity / Identity420 is the canonical identity-related protocol authority for optional pseudonymous profiles, issuer/trust-class state, credentials, expiry, revocation, rejection, and profile activity.

PuffBuddies adult-eligibility integration should consume a minimum-disclosure policy conclusion derived through the approved Identity/attestation path rather than inventing a second general-purpose identity authority.

### PB-DEP-004 — 420Identity does not automatically prove legal identity or PuffBuddies authorization

An Identity profile or credential does not by itself establish wallet ownership, legal identity, universal trust, PuffBuddies membership, match consent, messaging authorization, or moderation clearance.

PuffBuddies policy must explicitly state which credential type/trust/freshness properties are required for an eligibility or verification decision.

### PB-DEP-005 — 420Names owns .420 presentation-name ownership and resolution

420Names / Names420 may provide an optional human-readable .420 display/resolution surface.

PuffBuddies may later display a currently-valid name when policy permits, but it must recheck current resolution/expiry rather than treating cached name data as permanent.

### PB-DEP-006 — 420Names is not identity proof or dating membership proof

A .420 name does not prove legal identity, PuffBuddies membership, eligibility, reputation, match state, or consent.

A Names-to-Identity relationship is strong only when the canonical bilateral binding rules of Names and Identity are satisfied.

### PB-DEP-007 — 420Messenger owns canonical private-messaging coordination state

420Messenger owns the canonical wallet-to-wallet messaging coordination domain, including endpoint state, Messenger-native block state, conversation state, encrypted-envelope commitments, and delivery/read receipt coordination.

It does not place plaintext message bodies, attachments, media, ciphertext blobs, private keys, or decryption keys on public chain.

### PB-DEP-008 — PuffBuddies owns the dating/social authorization handed to Messenger

PuffBuddies remains authoritative for whether a PuffBuddies relationship is currently allowed to initiate or continue ordinary matched-user communication.

Messenger must consume current PuffBuddies authorization rather than manufacture a match or infer consent from stale conversation state.

A Messenger-native block is an additional deny condition; it never weakens PuffBuddies block supremacy.

### PB-DEP-009 — 420Notifications is a non-canonical delivery/presentation dependency

420Notifications may deliver approved PuffBuddies notification events to supported surfaces.

It receives only the minimum event payload needed for delivery and presentation.

Notification delivery, retries, acknowledgement, or provider state must not become authority for profile state, eligibility, match state, messaging consent, block state, moderation state, or payment entitlement.

### PB-DEP-010 — Notification failure cannot broaden access

If 420Notifications is unavailable, delayed, duplicated, stale, or misconfigured, PuffBuddies authorization state remains unchanged.

A missed or delayed notification must never preserve or create a permission that canonical PuffBuddies state has revoked.

### PB-DEP-011 — 420Pay owns canonical payment/settlement and approved entitlement evidence

420Pay may later provide payment settlement and approved PuffBuddies entitlement evidence.

PuffBuddies must treat Pay as authority only for the payment/entitlement domain explicitly integrated.

### PB-DEP-012 — 420Pay cannot purchase interpersonal authority

420Pay must never establish or override adult eligibility, mutual consent, match creation, block state, messaging authority, precise-location access, private preference access, or report/moderation evidence access.

A successful payment is not consent from another user.

### PB-DEP-013 — 420Registry owns canonical service identity/version discovery

420 Registry / ProtocolRegistry is the canonical service discovery and version registry.

PuffBuddies may later use Registry to resolve the active approved implementation/version for ecosystem dependencies and PuffBuddies service identities.

Consumers must respect active/deprecated state and must not blindly reuse stale cached addresses.

### PB-DEP-014 — Registry publication does not grant application authority

A service being registered does not grant custody, signing, spending, governance, profile, consent, match, safety, or execution authority beyond the service's own canonical protocol rules.

PuffBuddies must validate the expected interface/manifest/dependency commitments required by later integration work.

### PB-DEP-015 — 420AppStore is discovery/presentation, not canonical protocol authority

420AppStore may list and present PuffBuddies using canonical Registry-backed service evidence plus non-canonical catalogue metadata.

AppStore listing, ranking, sponsorship, category, screenshot, or description state must not determine PuffBuddies eligibility, legitimacy, consent, safety, payment, or runtime authority.

### PB-DEP-016 — AppStore cannot mutate Registry truth

PuffBuddies must not treat AppStore catalogue state as a replacement for ProtocolRegistry.

Listing or delisting in AppStore does not itself activate/deprecate a canonical PuffBuddies service.

### PB-DEP-017 — 420Analytics is derived and non-canonical

420Analytics may consume approved privacy-safe PuffBuddies aggregates or public qualified source projections where later architecture allows.

Analytics outputs are rebuildable derived data and must not become canonical PuffBuddies profile, match, eligibility, consent, moderation, payment, or lifecycle state.

### PB-DEP-018 — Analytics must not ingest protected PuffBuddies payloads

PuffBuddies must not feed private message content, precise location, private preferences, match graph, block graph, report evidence, raw identity evidence, or equivalent protected payloads into 420Analytics merely to improve metrics, rankings, cohorts, forecasts, or anomaly models.

Analytics failure or staleness must not block or broaden canonical PuffBuddies authorization.

### PB-DEP-019 — 420Indexer is a rebuildable observation/projection dependency

Where later integrations require chain-derived service, payment, Registry, or other public protocol observations, PuffBuddies may consume qualified 420Indexer projections.

Indexer is not canonical authority. Security-sensitive decisions must preserve the chain/protocol authority of the underlying canonical source and required finality/freshness checks.

### PB-DEP-020 — Explorer and Search are derived public discovery surfaces only

420Explorer and 420Search may expose legitimately public protocol records.

They must not be used as stores or public enumerators for private PuffBuddies profiles, membership, likes, matches, blocks, reports, precise location, messages, or private preferences.

### PB-DEP-021 — 420Verify may verify protocol/deployment evidence, not interpersonal identity by default

Where later deployment or service-authenticity workflows use 420Verify, its role is bounded to the evidence domain it actually verifies.

PuffBuddies must not reinterpret deployment authenticity or protocol evidence as proof of adult eligibility, personal identity, reputation, match consent, or safety status.

### PB-DEP-022 — Dependencies do not inherit each other's authority

Wallet, Identity, Names, Messenger, Notifications, Pay, Registry, AppStore, Analytics, Indexer, Explorer, Search, Verify, and any later approved integration retain separate authority domains.

No dependency output becomes authority in another dependency's domain merely because the systems are integrated.

### PB-DEP-023 — Dependency failure must preserve the owning authority

When a dependency is unavailable, stale, revoked, deprecated, wrong-chain, or inconsistent:

- eligibility decisions follow PB-0.6 fail-closed rules;
- consent/safety decisions follow PB-0.5/PB-0.7 fail-closed rules;
- Registry consumers stop treating inactive/deprecated services as active;
- derived services do not override canonical chain/protocol state;
- delivery/presentation failures do not create authorization.

### PB-DEP-024 — PuffBuddies-specific private state remains PuffBuddies-owned unless explicitly delegated

No ecosystem dependency automatically owns PuffBuddies profile records, discovery preferences, likes, match state, unmatch state, PuffBuddies block state, reports, moderation cases, precise location, or deletion lifecycle merely because it provides a supporting capability.

Exact state ownership is frozen in PB-0.9.

## Dependency matrix

| Dependency | PuffBuddies may rely on it for | PuffBuddies must not treat it as authority for |
| --- | --- | --- |
| 420Wallet | account control, signatures, explicit sessions/capabilities | membership, eligibility, match, consent, safety |
| 420Identity | identity profile/credential lifecycle, approved eligibility evidence | wallet control, universal legal identity, consent, match |
| 420Names | .420 presentation and current resolution | legal identity, eligibility, membership, reputation |
| 420Messenger | private messaging coordination and Messenger-native deny state | creating PuffBuddies matches/consent |
| 420Notifications | minimum-data event delivery/presentation | any canonical PuffBuddies authorization |
| 420Pay | payment settlement and approved entitlement evidence | consent, eligibility, block bypass, private-person access |
| 420Registry | canonical service identity/version/active state | custody, signing, application authorization |
| 420AppStore | catalogue/discovery presentation over Registry evidence | canonical service truth or product authorization |
| 420Analytics | privacy-safe derived aggregate analysis | canonical/user-level dating state |
| 420Indexer | rebuildable public chain/protocol projections | canonical source authority |
| 420Explorer / 420Search | public protocol presentation/discovery | private PuffBuddies enumeration |
| 420Verify | bounded protocol/deployment authenticity evidence | adult/personal identity or interpersonal consent |

## Integration decision rule

Before adding any ecosystem dependency, later implementation must document:

1. the exact canonical authority owned by the dependency;
2. the minimum data PuffBuddies sends;
3. the minimum result PuffBuddies consumes;
4. freshness/finality/revocation requirements;
5. failure and stale-state behavior;
6. privacy classification;
7. whether compromise can broaden PuffBuddies authority;
8. which PuffBuddies invariant owns the final decision;
9. how the dependency is discovered/version-checked;
10. how the integration is disabled or failed closed.

If those answers are not explicit, the dependency must not be granted protected PuffBuddies authority.

## PB-0.8 completion boundary

PB-0.8 is satisfied when the repository:

- records PB-DEP-001 through PB-DEP-024 exactly once and in sequence;
- defines exact narrow roles for 420Wallet, 420Identity, 420Names, 420Messenger, 420Notifications, 420Pay, 420Registry, 420AppStore, and 420Analytics;
- defines derived-service boundaries for 420Indexer, Explorer, Search, and bounded 420Verify use;
- explicitly prevents authority inheritance across dependencies;
- preserves PuffBuddies consent, privacy, eligibility, safety, and private-state ownership;
- defines dependency failure/freshness behavior and an integration decision rule;
- preserves PB-0.1 through PB-0.7;
- introduces no integration implementation, contract, fixed address, service ID, deployment, or false live-wiring claim.

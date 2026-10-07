# DoobTube — canonical identity and architecture

Roadmap step: **DOOBTUBE-0 — Canonical identity and architecture decision**
Status: **ADOPTED**
Date: 2026-10-06

## 1. Canonical identity

The application name is **DoobTube**.

DoobTube is a **replaceable user-facing video application/client layer** in the 420Integrated ecosystem. It is not a protocol, consensus component, bridge, oracle, custodian, Registry authority, identity authority, rights authority, storage authority, payment authority, or compute authority.

The former working label `420Video` is not a canonical service or protocol identifier and must not be introduced as a parallel architecture.

## 2. Relationship to 420Media

DoobTube is a **consumer and composition layer over the existing canonical 420Media service**, not a rename, fork, replacement, or second implementation of 420Media.

The authoritative Media service remains:

- service ID: `420/service/media/v1`;
- name: `420Media`;
- Genesis target: `video_uploads_basic_livestreaming`;
- authority class: `REPLACEABLE_APPLICATION`.

DoobTube must consume qualified 420Media interfaces and behavior where its product requirements overlap Media capabilities. It may add user-facing product composition, presentation, navigation, local preferences, discovery views, moderation presentation, and other replaceable application behavior, but it must not silently duplicate or supersede canonical Media authority.

If a future DoobTube requirement cannot be satisfied by qualified 420Media or another canonical protocol/service, that gap must be assigned to its owning roadmap step and resolved explicitly rather than creating a shadow authority.

## 3. Registry and service identity decision

DoobTube receives **no new protocol/service Registry identity in DOOBTUBE-0**.

For Media authority and service discovery, DoobTube resolves and consumes the existing canonical `420/service/media/v1` service identity.

A future AppStore/catalog/listing identity for the DoobTube brand may be added as replaceable discovery metadata if product/release requirements call for it. Such a listing:

- is not a protocol authority;
- is not a substitute for `420/service/media/v1`;
- must not create a second Media service identity;
- must not imply Genesis status.

Any later request for a distinct canonical DoobTube service ID requires an explicit architecture amendment because it would materially change this decision.

## 4. Genesis disposition

DoobTube is **not added to `config/genesis-applications.json`** by this decision.

DoobTube is **not added to `config/genesis-consumer-services.json`** as a second Media service.

The frozen Genesis application catalog remains unchanged.

DoobTube may eventually be deployable during the broader ecosystem release, but no **GENESIS READY** claim is valid unless a later explicit Genesis/catalog decision requires and qualifies it. Its current architecture is compatible with remaining a replaceable application/client above existing qualified services.

## 5. Contract ownership decision

DOOBTUBE-0 defines **no DoobTube-owned smart contract requirement**.

Canonical authority should remain with existing protocols/services wherever possible. In particular, DoobTube must not create parallel contracts for functionality already owned by 420Media, Wallet/Smart Accounts, Identity, Rights, Storage, Pay, Compute, Registry, Governance, Arbitration, or other adopted dependencies.

DOOBTUBE-4 may implement an app-owned contract only if DOOBTUBE-1 through DOOBTUBE-3 produce a requirement that cannot be satisfied safely through existing canonical interfaces. If that occurs, the contract must have narrowly bounded authority and must not silently alter the architecture defined here.

## 6. Authority model

DoobTube is non-authoritative for canonical protocol state.

### DoobTube may own

Subject to later product/data specifications:

- UI composition and presentation;
- local/session UI state;
- replaceable application preferences;
- cached/rebuildable views;
- non-authoritative feed/ranking composition;
- application moderation presentation such as locally hiding content;
- client-side recovery/retry state;
- branding and navigation.

### DoobTube must not own by implication

- wallet keys, seed phrases or private signing material;
- canonical account ownership or authorization;
- canonical Identity state;
- canonical Rights/provenance state;
- canonical MediaAsset/Stream authority where 420Media owns it;
- raw-media canonical storage authority;
- protocol settlement/custody;
- Compute provider authority;
- Registry legitimacy;
- chain finality;
- governance authority;
- bridge/oracle authority;
- canonical dispute rulings.

Authority-bearing mutations must be performed through the qualified owning protocol/service and the user's authorized Wallet/signing boundary.

## 7. Trust model

DoobTube is treated as a replaceable application that can fail, be unavailable, be upgraded, or be replaced without changing canonical ownership, rights, payments, storage identity, Media authority, or chain state.

Trust rules:

1. browser/client presentation is non-authoritative;
2. API/index/cache/feed responses are non-authoritative unless independently bound to an authoritative source;
3. Wallet/private signing material remains outside DoobTube;
4. optional 420Identity use must preserve wallet-only/pseudonymous operation where the owning protocol permits it;
5. DoobTube must fail closed when required authority/service provenance cannot be resolved;
6. cached or projected state must not override live canonical state for authorization-bearing decisions;
7. service discovery must bind to canonical Registry/service identities rather than hard-coded assumed authority where Registry discovery is required.

## 8. Data boundary

DoobTube is an application surface, not the canonical store of protocol authority.

### On-chain by default

Only authority-bearing commitments that belong to an existing adopted protocol may be on-chain, such as identity references, ownership, rights, payments, escrow, attestations or other explicitly protocol-owned records.

### Off-chain by default

The following remain off-chain unless a later canonical protocol explicitly says otherwise:

- raw video/audio bytes;
- transcodes;
- thumbnails/posters/previews;
- livestream transport payloads;
- stream secrets;
- cached feeds;
- recommendation state;
- UI/session state;
- rebuildable indexes;
- moderation queues/bodies that are not canonical rulings;
- analytics/telemetry;
- application preferences.

Exact MediaAsset, Stream, derivative, deletion and lifecycle ownership is frozen in DOOBTUBE-3 using the qualified 420Media/420Storage architecture rather than invented here.

## 9. Privacy boundary

DoobTube must follow least-authority and data-minimization principles.

- No private keys, seed phrases or mnemonic custody.
- Private/unlisted media metadata must not be exposed through public projections or caches.
- Visibility does not become authorization merely because the UI hides or shows an item.
- Logging/analytics must not become an undeclared identity correlation or authority source.
- Raw media and credentials must not be placed on-chain.
- Private delivery/storage semantics must remain with the qualified owning service.

Detailed retention, deletion, visibility and export requirements belong to DOOBTUBE-1 and DOOBTUBE-3.

## 10. Moderation boundary

DoobTube may perform replaceable application-layer moderation and presentation controls, including suppressing content from its own UI, subject to the later product policy.

DoobTube moderation does **not** by itself:

- revoke canonical ownership;
- rewrite Rights/provenance;
- delete canonical Storage/Media state without authorized owning-service action;
- seize funds;
- slash participants;
- issue governance actions;
- create a canonical Arbitration ruling.

Where stronger remedies are required, DOOBTUBE-2 must bind them to the appropriate canonical owning protocol/service.

## 11. Custody and settlement boundary

DoobTube is **non-custodial by architecture**.

It must not retain native 420, ERC-20 balances, user payment funds, escrow funds, or operator settlement balances as application-owned custody unless a later explicit architecture amendment establishes a narrowly reviewed requirement.

Payments, refunds, settlements, entitlements and compute funding must use the qualified owning services selected in DOOBTUBE-2.

## 12. Failure and replacement model

DoobTube must be replaceable without invalidating canonical ecosystem state.

If DoobTube is offline or compromised:

- users' canonical Wallet ownership remains valid;
- Media/Storage/Rights/Pay/Compute state remains owned by those services/protocols;
- a replacement qualified client can reconstruct authoritative/rebuildable state through canonical interfaces;
- DoobTube caches, feed rankings and presentation state may be discarded and rebuilt;
- no app-local database may become the sole authority for protocol ownership or settlement.

## 13. Security invariants established by DOOBTUBE-0

- **DOOBTUBE-ARCH-001:** DoobTube does not replace or rename `420Media`.
- **DOOBTUBE-ARCH-002:** `420/service/media/v1` remains the canonical Media service identity.
- **DOOBTUBE-ARCH-003:** DoobTube creates no second Media protocol/service authority.
- **DOOBTUBE-ARCH-004:** DoobTube is not a frozen Genesis application by implication.
- **DOOBTUBE-ARCH-005:** DOOBTUBE-0 allocates no frozen/reserved address.
- **DOOBTUBE-ARCH-006:** DOOBTUBE-0 requires no DoobTube-owned smart contract.
- **DOOBTUBE-ARCH-007:** DoobTube is non-custodial by default.
- **DOOBTUBE-ARCH-008:** Wallet/private signing material remains outside DoobTube.
- **DOOBTUBE-ARCH-009:** raw media and high-volume transport data remain off-chain.
- **DOOBTUBE-ARCH-010:** application caches/projections/presentation do not override canonical authority.
- **DOOBTUBE-ARCH-011:** app-level moderation does not silently gain protocol remedy authority.
- **DOOBTUBE-ARCH-012:** architecture gaps are returned to the owning roadmap step rather than filled with shadow authority.

## 14. Component ownership established at this step

| Component | DOOBTUBE-0 owner/decision |
|---|---|
| User-facing DoobTube brand/client | DoobTube |
| Media service authority | 420Media |
| Media service discovery | `420/service/media/v1` |
| Wallet/signing authority | Existing Wallet/Smart Account architecture |
| Identity authority | Existing 420Identity if adopted by DOOBTUBE-2 |
| Rights/provenance authority | Existing 420Rights if adopted/required |
| Raw/canonical storage authority | Existing 420Storage/Media lifecycle surfaces |
| Media processing/compute | Existing 420Media/420Compute surfaces when adopted |
| Payment/settlement | Existing Pay/protocol surfaces when adopted |
| Search/index projections | Existing qualified projection/search services when adopted |
| Frozen Genesis app status | None |
| New frozen/reserved address | None |
| DoobTube-owned contracts | None at DOOBTUBE-0 |
| App-local presentation/cache/preferences | DoobTube, non-authoritative |

## 15. Deferred decisions

The following are intentionally **not** decided in DOOBTUBE-0 because their canonical owners are later roadmap steps:

- detailed user workflows and v1 feature set — DOOBTUBE-1;
- exact dependency graph and adopted interfaces — DOOBTUBE-2;
- data schemas/media lifecycle/idempotency/recovery — DOOBTUBE-3;
- whether a genuinely necessary app-owned contract emerges — DOOBTUBE-4;
- runtime/API/indexing topology — DOOBTUBE-5;
- media processing/delivery implementation — DOOBTUBE-6;
- frontend implementation — DOOBTUBE-7;
- cross-component milestone qualification — DOOBTUBE-8;
- full app-specific threat/abuse qualification — DOOBTUBE-9;
- deployment/operator/release documentation — DOOBTUBE-10;
- Level 3 repository closeout — DOOBTUBE-11;
- public testnet and production release — DOOBTUBE-12/13.

These deferrals do not block DOOBTUBE-0 because the architecture and authority boundary required by this step are now explicit.

## 16. Exit decision

DOOBTUBE-0's exit criterion is satisfied when this architecture is committed and the DoobTube verifier confirms that:

- 420Media remains canonical and unchanged in identity;
- no second Media service is introduced;
- the frozen Genesis application catalog is unchanged by DoobTube;
- no DoobTube contract/runtime is introduced before later roadmap ownership;
- the authority/trust/data/privacy/moderation/custody boundaries above remain present.

**Next canonical roadmap step: DOOBTUBE-1 — Product scope and canonical user workflows.**

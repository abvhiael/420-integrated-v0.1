# DoobTube — dependency and trust-boundary freeze

Roadmap step: **DOOBTUBE-2 — Dependency and trust-boundary freeze**
Status: **ADOPTED**
Date: 2026-10-06

## 1. Purpose

DOOBTUBE-2 maps every dependency required by the frozen V1 product scope to its canonical 420Integrated owner, service identity, authority class, trust boundary, failure semantics and degraded-mode behavior.

This step does **not** implement adapters, APIs, storage schemas, deployment configuration or frontend runtime. Those belong to later roadmap steps.

## 2. Dependency classes

Dependencies are classified as:

- **DIRECT_REQUIRED** — DoobTube V1 must bind to the dependency for a required workflow.
- **DIRECT_OPTIONAL** — DoobTube may use the dependency for an optional V1 presentation path without making it mandatory.
- **TRANSITIVE_MEDIA** — DoobTube must not call the dependency as a new authority path; 420Media owns the qualified integration.
- **NOT_ADOPTED_V1** — no V1 requirement justifies a dependency.

A dependency existing elsewhere in 420Integrated does not make it a DoobTube dependency.

## 3. Canonical dependency graph

```text
User / Browser
  |
  +--> 420 Wallet / SmartAccount420 / CapabilityRegistry420
  |       authority: signing, execution, reusable capability/session authorization
  |
  +--> ProtocolRegistry
  |       authority: service identity/discovery only
  |
  +--> DoobTube client/application
          |
          +--> 420Media                  [DIRECT_REQUIRED]
          |      |
          |      +--> 420Storage/Resource Protocol [qualified Media dependency]
          |      +--> 420Rights                   [qualified Media dependency]
          |      +--> 420Identity                 [qualified optional Media dependency]
          |      +--> 420Pay                      [TRANSITIVE_MEDIA]
          |      +--> 420 Compute Market          [TRANSITIVE_MEDIA]
          |
          +--> 420Identity               [DIRECT_OPTIONAL presentation/ownership revalidation]
          +--> 420Rights                 [DIRECT_REQUIRED public/provenance revalidation]
          +--> 420Storage/Resource       [DIRECT_REQUIRED only where V1 exposes storage readiness/reference semantics]
          +--> 420Search                 [DIRECT_REQUIRED public discovery]
          +--> 420Notifications          [DIRECT_REQUIRED creator-update subscriptions]
```

DoobTube may consume 420Media API responses that summarize dependency state, but a summary does not promote DoobTube into authority over the dependency.

## 4. Required service identities

| Dependency | Class | Canonical identity / authority source |
|---|---|---|
| ProtocolRegistry / 420 Registry | DIRECT_REQUIRED | `420/service/protocol-registry/v1` |
| 420 Wallet / Smart Accounts | DIRECT_REQUIRED | Wallet client plus canonical `SmartAccount420` / `CapabilityRegistry420` authority; Wallet branding is not authority |
| 420Media | DIRECT_REQUIRED | `420/service/media/v1` |
| 420Identity | DIRECT_OPTIONAL | `420/service/identity/v1` |
| 420Rights | DIRECT_REQUIRED | `420/service/rights/v1` |
| 420Storage / Resource Protocol | DIRECT_REQUIRED | `420/service/resource-protocol/v1` |
| 420Search | DIRECT_REQUIRED | `420/service/search/v1` |
| 420Notifications | DIRECT_REQUIRED | `420/service/notifications/v1` |
| 420Pay | TRANSITIVE_MEDIA | `420/service/pay/v1` |
| 420 Compute Market | TRANSITIVE_MEDIA | `420/service/compute-market/v1` |

No fixed implementation address is invented by this document. Registry-resolved services must be bound to the active qualified deployment for the target environment.

## 5. ProtocolRegistry boundary

### DT-DEP-REG-001 — Canonical discovery

DoobTube must resolve canonical service identity through the approved Registry/signed environment binding rather than trusting branding, DNS, hard-coded presentation names or unverified endpoints.

Required service identity for Media:

`420/service/media/v1`

### DT-DEP-REG-002 — Registry authority is narrow

Registry may prove the currently published service implementation/metadata for a service ID.

Registry does **not**:

- sign for a user;
- prove a media item is public;
- prove Rights ownership;
- prove Storage readiness;
- make Search results authoritative;
- make Notifications delivery canonical;
- grant DoobTube protocol authority.

### DT-DEP-REG-003 — Registry failure semantics

If required service discovery cannot be verified:

- public cached presentation may remain visible only when it cannot be mistaken for fresh authoritative state;
- authority-bearing mutations fail closed;
- upload/publication/livestream/delete/moderation mutation controls are disabled;
- DoobTube must not silently fall back to an unverified service endpoint.

Degraded mode: **READ_ONLY_STALE_PRESENTATION_ALLOWED / AUTHORITY_MUTATIONS_BLOCKED**.

## 6. Wallet / Smart Account boundary

### DT-DEP-WALLET-001 — Signing stays outside DoobTube

DoobTube never receives private keys, seed phrases, mnemonics or account recovery secrets.

All signing/execution remains at the qualified Wallet / SmartAccount420 boundary.

### DT-DEP-WALLET-002 — Connection is not authorization

A connected Wallet address does not itself grant:

- Media ownership;
- livestream controller authority;
- moderator authority;
- Rights ownership/license;
- Storage access;
- payment/settlement authority.

The owning service must revalidate the action.

### DT-DEP-WALLET-003 — Reusable authority

If later runtime work uses sessions/capabilities, reusable authority must flow through the canonical Smart Account / Capability Registry model and must be scoped, revocable and revalidated at use time.

DoobTube must not create an app-local capability registry.

### DT-DEP-WALLET-004 — Failure semantics

- no Wallet: public browse/search/playback remains available where otherwise eligible;
- wrong chain/network: authority-bearing actions blocked;
- expired/revoked capability/session: affected action fails closed and requires fresh authorization;
- Wallet unavailable during an in-flight ambiguous mutation: revalidate owning-service state before retry.

Degraded mode: **PUBLIC_READ_ONLY**.

## 7. 420Media boundary

### DT-DEP-MEDIA-001 — Canonical Media service

420Media is the primary DoobTube application dependency.

Canonical service identity:

`420/service/media/v1`

DoobTube must consume qualified Media V1 capability/compatibility/API behavior and must not recreate Media protocol state locally.

### DT-DEP-MEDIA-002 — Owned Media responsibilities

420Media owns or composes the canonical service boundary for:

- MediaAsset lifecycle/presentation;
- upload preparation and canonical readiness observation;
- playback locator presentation;
- livestream create/status/start/stop;
- creator/controller authorization composition;
- Media moderation/report/appeal API behavior;
- Media-side Search/Notifications projection behavior;
- Media Pay/Compute adapter behavior.

### DT-DEP-MEDIA-003 — Media outage semantics

If 420Media is unavailable:

- no upload preparation;
- no authoritative library refresh;
- no authoritative playback locator refresh;
- no livestream mutation/status refresh;
- no authoritative delete/moderation mutation;
- previously loaded public presentation may be shown only as stale/offline presentation;
- DoobTube must not infer success from cached local state.

Degraded mode: **STALE_PUBLIC_PRESENTATION_ONLY**.

### DT-DEP-MEDIA-004 — Compatibility failure

Wrong service ID, unsupported API major version, capability mismatch or unresolved runtime is a fail-closed condition for dependent actions.

## 8. 420Identity boundary

### DT-DEP-ID-001 — Optional dependency

Canonical identity:

`420/service/identity/v1`

Identity remains optional and pseudonymous.

A Wallet-only user remains valid wherever the owning Media workflow permits it.

### DT-DEP-ID-002 — Identity authority

420Identity is authoritative for profile existence, active state and controller binding.

DoobTube may display qualified profile presentation but does not create, mutate, revoke or transfer Identity state.

### DT-DEP-ID-003 — Identity failure semantics

If Identity is unavailable:

- anonymous public viewing continues;
- Wallet-only creator flows continue where 420Media permits zero/no profile;
- profile-enhanced presentation is marked unavailable;
- any action that explicitly depends on a supplied profile fails closed rather than ignoring the profile binding.

Degraded mode: **WALLET_ONLY_PSEUDONYMOUS**.

## 9. 420Rights boundary

### DT-DEP-RIGHTS-001 — Canonical rights authority

Canonical service identity:

`420/service/rights/v1`

420Rights is authoritative for protocol rights/provenance claim/license state.

DoobTube and Search must not infer public publication rights from `visibility=PUBLIC` alone.

### DT-DEP-RIGHTS-002 — Public publication

PUBLIC eligibility requires the qualified Rights/publication guard where Rights-bearing publication requires it.

A Rights record is canonical protocol evidence, not an assertion of external legal truth beyond the protocol semantics.

### DT-DEP-RIGHTS-003 — Rights failure semantics

If Rights state cannot be authoritatively resolved:

- new public publication fails closed;
- public Search/feed inclusion fails closed;
- rights-bearing derivative/reuse action fails closed;
- previously public presentation may be withheld until revalidated when current authorization is required;
- PRIVATE creator library state may remain accessible through owning-service authorization if it does not depend on Rights publication authorization.

Degraded mode: **NON_PUBLIC / RIGHTS_REVALIDATION_REQUIRED**.

## 10. 420Storage / Resource Protocol boundary

### DT-DEP-STORAGE-001 — Canonical storage authority

Canonical service identity:

`420/service/resource-protocol/v1`

Storage/Resource owns canonical object availability, capacity/agreement/placement/proof semantics required by the Media lifecycle.

Raw media remains off-chain.

### DT-DEP-STORAGE-002 — DoobTube storage access

DoobTube must normally consume Storage through qualified 420Media upload/lifecycle flows.

Direct Storage reads are allowed only where later DOOBTUBE-3/5 requirements explicitly need authoritative storage/reference verification and do not bypass Media policy.

### DT-DEP-STORAGE-003 — Storage failure semantics

If Storage/Resource is unavailable or unresolved:

- upload transport/readiness cannot be declared successful;
- canonical READY transition cannot be fabricated;
- delete/retention result cannot be fabricated;
- existing playback may continue only if a previously issued qualified locator remains valid and the owning Media policy allows it;
- no client cache becomes canonical availability evidence.

Degraded mode: **PLAYBACK_IF_ALREADY_AUTHORIZED / NO_NEW_STORAGE_MUTATIONS**.

## 11. 420Search boundary

### DT-DEP-SEARCH-001 — Canonical service identity

`420/service/search/v1`

Search is a replaceable, rebuildable discovery projection.

It is not authority for:

- Media ownership;
- visibility;
- Rights;
- readiness;
- ranking truth;
- payment;
- Identity.

### DT-DEP-SEARCH-002 — Public-only discovery

DoobTube Search/home discovery consumes only public-eligible search/projected records.

PRIVATE and UNLISTED content must not become public because Search returned it.

Where a detail/playback action needs current authority, the owning Media service must revalidate it.

### DT-DEP-SEARCH-003 — Search failure semantics

Search outage/corruption:

- disables search/discovery refresh;
- does not block direct authorized Media detail/playback by canonical reference;
- does not block creator library/upload/livestream management;
- does not change canonical Media state.

Degraded mode: **DIRECT_REFERENCE_AND_CREATOR_WORKFLOWS_ONLY**.

## 12. 420Notifications boundary

### DT-DEP-NOTIFY-001 — Canonical service identity

`420/service/notifications/v1`

Notifications owns subscription delivery preferences, delivery endpoints, retry/deduplication and notification presentation state.

Notifications cannot sign, spend or mutate Media state.

### DT-DEP-NOTIFY-002 — Creator-update subscription

DoobTube V1 "Subscribe" means opt-in creator/content update delivery preference, not paid access, ownership, Rights, entitlement or on-chain following authority.

Promotional consent remains separate.

### DT-DEP-NOTIFY-003 — Notification failure semantics

If Notifications is unavailable:

- subscribe/unsubscribe controls fail closed or show pending/retry state;
- video browsing, playback, upload and livestream operation continue;
- missed delivery does not alter canonical Media state;
- DoobTube must not locally claim durable subscription success unless the owning notification service confirms it.

Degraded mode: **MEDIA_FULL / NOTIFICATION_PREFERENCES_UNAVAILABLE**.

## 13. 420Pay boundary

### DT-DEP-PAY-001 — Transitive only in V1

Canonical service identity:

`420/service/pay/v1`

DoobTube V1 has no paid subscription, pay-per-view, tipping, advertising payout or viewer payment workflow.

Therefore DoobTube has **no direct Pay dependency in V1**.

420Media may internally consume qualified Pay settlement/funding state as part of Media processing. That remains a Media-owned integration.

### DT-DEP-PAY-002 — No custody

DoobTube must not:

- create its own payment escrow;
- hold viewer/creator funds;
- interpret a UI receipt as canonical settlement;
- bypass Media by directly settling Media jobs unless a later product/architecture amendment explicitly adopts such a workflow.

### DT-DEP-PAY-003 — Pay failure semantics

A Media operation whose canonical backend requires Pay may fail/degrade through Media.

DoobTube reports the Media operation state; it does not invent fallback settlement.

## 14. 420 Compute Market boundary

### DT-DEP-COMPUTE-001 — Transitive only in V1

Canonical service identity:

`420/service/compute-market/v1`

DoobTube does not directly schedule transcodes, processors or providers in V1.

420Media owns qualified Compute integration for Media processing.

### DT-DEP-COMPUTE-002 — No provider authority

DoobTube must not select a provider from unverified application data or treat compute completion as canonical Media readiness without Media/Storage validation.

### DT-DEP-COMPUTE-003 — Compute failure semantics

Compute outage is surfaced through Media processing states:

- upload may remain prepared/processing;
- DoobTube must not force READY;
- retry/recovery follows Media semantics.

## 15. Dependencies explicitly not adopted for V1

The following exist in the ecosystem but are **NOT_ADOPTED_V1** unless a later canonical amendment changes scope:

### 420 Names — `420/service/names/v1`

Not required because creator presentation can use qualified Identity or pseudonymous Wallet presentation. A name may later be displayed as optional presentation only.

### 420 Explorer — `420/service/explorer/v1`

Not required for core workflows. Optional provenance/navigation links may be added later without making Explorer authoritative.

### 420 Analytics — `420/service/analytics/v1`

Not required for V1 correctness. Product analytics must not become authority or leak private media/identity state.

### 420 Verify — `420/service/verify/v1`

Not required for ordinary user workflows. It may later support deployment/source provenance presentation.

### 420 Arbitration — `420/service/arbitration/v1`

Not adopted for V1 moderation appeals. V1 appeals are application-scoped Media moderation history, not canonical Arbitration cases/rulings.

If a future stronger remedy requires Arbitration, the integration must be separately scoped and cannot itself execute custody/Rights/governance changes.

### 420 AppStore — `420/service/appstore/v1`

Not required for application runtime. Listing/discovery of DoobTube as an app is deployment/catalog metadata only.

### Governance, Treasury, Bridge, AI, Oracle, Stake, Token, Swap, Attention, Gaming

No DOOBTUBE-1 requirement requires direct integration. These dependencies must not appear merely because they are Genesis applications/protocols.

## 16. Authority matrix

| Concern | Canonical authority | DoobTube role |
|---|---|---|
| Application/service discovery | ProtocolRegistry | resolve + verify; never self-authorize |
| User signing/execution | Wallet / SmartAccount420 | request reviewed action; never hold keys |
| Reusable capability/session | CapabilityRegistry420 / Smart Account policy | consume scoped authority only |
| MediaAsset/Stream lifecycle | 420Media and its owning canonical dependencies | present/request/revalidate |
| Identity profile | 420Identity | optional presentation + controller check |
| Rights/provenance/license | 420Rights | display/revalidate; never adjudicate external legal truth |
| Storage readiness/object availability | 420Storage/Resource via Media | display/revalidate |
| Public discovery/ranking | 420Search projection | non-authoritative browse/search |
| Notification subscription/delivery | 420Notifications | request/display preference state |
| Media payment/settlement | 420Pay via Media | no direct V1 authority |
| Media processing/provider | Compute Market via Media | no direct V1 authority |
| Moderation decision | Media application-scoped moderation | UI/request/history only |
| Canonical Arbitration ruling | 420Arbitration | not adopted in V1 |
| Chain/finality | canonical chain/RPC/indexer authorities | never override |
| App cache/feed/preferences | DoobTube | replaceable/non-authoritative |

## 17. Trust-boundary rules

- **DT-TRUST-001:** browser/client state is hostile/non-authoritative input for canonical decisions.
- **DT-TRUST-002:** Wallet connection is identity context, not blanket authorization.
- **DT-TRUST-003:** every authority-bearing mutation is revalidated by its owning service/protocol.
- **DT-TRUST-004:** Registry discovery proves service binding, not user/content authority.
- **DT-TRUST-005:** Search/Notifications/Analytics/Explorer/AppStore are presentation or derived services and never override canonical state.
- **DT-TRUST-006:** private/unlisted state may not be widened by cache, Search, feed, telemetry or notification behavior.
- **DT-TRUST-007:** direct service failure must not be hidden by stale local success state.
- **DT-TRUST-008:** transitive Media dependencies remain behind Media unless a later roadmap step explicitly establishes a direct interface.
- **DT-TRUST-009:** no fallback endpoint may silently replace a failed canonical Registry binding.
- **DT-TRUST-010:** DoobTube never creates a parallel Rights, Storage, Identity, Pay, Compute, Arbitration or Wallet authority.
- **DT-TRUST-011:** network/chain mismatch blocks authority-bearing actions.
- **DT-TRUST-012:** local app preferences may be lost/rebuilt without invalidating protocol state.

## 18. Threat model for dependency boundaries

### 18.1 Malicious or stale service discovery

Threat:
- DNS/endpoint impersonation;
- stale Registry binding;
- wrong service ID;
- wrong chain/network;
- deprecated service version.

Required control:
- bind the requested canonical service ID;
- verify active compatible version/environment;
- fail closed for mutations;
- never trust branding alone.

### 18.2 Actor substitution

Threat:
- request body claims another Wallet/creator/controller;
- stale Wallet account after account switch;
- optional Identity profile belongs to another controller.

Required control:
- verified Wallet/session actor must match authority-bearing request semantics;
- account/network change invalidates mutation context;
- optional Identity controller is revalidated.

### 18.3 Derived-state poisoning

Threat:
- Search result says PRIVATE media is public;
- feed/index has stale Rights/visibility state;
- notification/action link points to stale/unauthorized object.

Required control:
- derived services never become authorization;
- current Media/Rights/Storage state is revalidated where authority/access matters.

### 18.4 Dependency downgrade/fail-open

Threat:
- Rights/Storage/Identity unavailable and client skips the check;
- Media capability discovery fails but UI enables action;
- Notifications outage causes local false subscription success.

Required control:
- fail closed for the affected action;
- expose explicit degraded state;
- preserve unrelated safe workflows.

### 18.5 Transitive-dependency bypass

Threat:
- DoobTube directly calls Pay/Compute and diverges from Media accounting/processing state.

Required control:
- Pay/Compute remain TRANSITIVE_MEDIA in V1;
- DoobTube consumes Media outcomes only.

### 18.6 Privacy leakage

Threat:
- public Search/feed/notification/analytics receives PRIVATE or UNLISTED data;
- stale cache continues public presentation after revocation.

Required control:
- visibility filters are negative security boundaries;
- public projections are rebuildable and must exclude ineligible state;
- authority-sensitive views revalidate canonical state.

### 18.7 Confused-deputy moderation

Threat:
- DoobTube moderator action gains protocol ownership/fund/Rights power.

Required control:
- moderation stays Media/application scoped;
- Arbitration is not implicitly invoked;
- stronger remedies require explicit owning-protocol flow.

## 19. Failure and degraded-mode matrix

| Dependency failure | Must fail closed | Safe degraded behavior |
|---|---|---|
| Registry unresolved/wrong binding | all authority-bearing service calls | clearly stale public presentation only |
| Wallet missing | all mutations | public browse/search/playback |
| Wallet wrong network | all mutations | public read-only |
| Wallet session/capability expired | affected mutation | reauthorize; public read-only |
| Media unavailable | uploads/library refresh/live/delete/moderation mutations | stale public presentation only |
| Identity unavailable | profile-bound action | Wallet-only flows where permitted |
| Rights unavailable/stale | public publish/discovery/reuse | non-public/private owner access where permitted |
| Storage unavailable | upload readiness/delete/storage mutation | existing authorized playback only if still valid |
| Search unavailable | discovery/search refresh | direct Media reference + creator workflows |
| Notifications unavailable | subscription mutation/delivery | all Media workflows continue |
| Pay unavailable | Media operation requiring Pay | no DoobTube fallback settlement |
| Compute unavailable | processing-dependent Media operation | processing/pending; no forced READY |

## 20. Cross-dependency invariants

- **DT-DEP-INV-001:** `420/service/media/v1` is the sole canonical Media service dependency.
- **DT-DEP-INV-002:** Registry binding failure never falls back to an unverified endpoint for a mutation.
- **DT-DEP-INV-003:** Wallet/private signing authority never enters DoobTube.
- **DT-DEP-INV-004:** optional Identity failure never makes Identity mandatory for unrelated Wallet-only flows.
- **DT-DEP-INV-005:** Rights unavailability cannot widen publication.
- **DT-DEP-INV-006:** Storage transport acceptance cannot replace canonical readiness.
- **DT-DEP-INV-007:** Search cannot authorize access or publication.
- **DT-DEP-INV-008:** Notifications cannot mutate Media or Wallet state.
- **DT-DEP-INV-009:** Pay and Compute remain transitive through Media for V1.
- **DT-DEP-INV-010:** Arbitration is not silently substituted for Media moderation/appeal semantics.
- **DT-DEP-INV-011:** stale derived state never overrides current canonical revocation/visibility.
- **DT-DEP-INV-012:** one dependency outage degrades only the workflows that actually require it.

## 21. Dependency adoption summary

### Adopted directly

- ProtocolRegistry / 420 Registry
- 420 Wallet / SmartAccount420 / CapabilityRegistry420
- 420Media
- 420Identity (optional)
- 420Rights
- 420Storage / Resource Protocol
- 420Search
- 420Notifications

### Adopted transitively through 420Media

- 420Pay
- 420 Compute Market

### Not adopted for V1

- 420 Names
- 420 Explorer
- 420 Analytics
- 420 Verify
- 420 Arbitration
- 420 AppStore
- Governance
- Treasury
- Bridge
- AI
- Oracle Interface Layer
- Stake
- Token
- Swap
- Attention
- Gaming Protocol
- other ecosystem services not proven necessary by DOOBTUBE-1

## 22. Exit decision

DOOBTUBE-2 is satisfied when:

1. every V1 dependency is classified direct, optional, transitive or not-adopted;
2. canonical service identities are recorded where the repository defines them;
3. authority ownership is explicit;
4. trust boundaries are explicit;
5. threat domains are explicit;
6. failure and degraded-mode behavior is explicit;
7. no dependency is adopted merely because it exists;
8. no new service/contract authority is invented;
9. the DoobTube verifier qualifies these requirements on the exact implementation SHA.

**Next canonical roadmap step: DOOBTUBE-3 — Data, storage, media-processing and lifecycle architecture.**

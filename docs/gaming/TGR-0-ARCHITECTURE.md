# TGR-0 — The Green Road game architecture

Status: architecture freeze candidate
Game ID: `420/GAMING/GAME/THE_GREEN_ROAD/V1`
Architecture version: `1`
Save schema version: `1`
Content schema version: `1`

## 1. Product boundary

The Green Road is a story-driven hidden-object adventure. The game must be playable immediately without registration or a wallet. Registration adds account recovery and cloud continuity. Wallet linkage adds optional portable entitlements, rewards, collectibles, secret routes, bonus content, seasonal content and cross-game artifacts.

Wallet linkage MUST NOT improve ordinary hidden-object statistics, clue strength, baseline hints, progression speed or completion odds.

## 2. Runtime layers

The runtime is split into five layers:

1. **Presentation** — scene rendering, UI, input, zoom/pan, accessibility and audiovisual presentation.
2. **Game domain** — chapters, locations, scenes, hidden objects, clues, journal entries, achievements, collectibles and progression rules.
3. **Persistence/sync** — local save, event journal, cloud save reconciliation and migration.
4. **420 Gaming integration** — `@420/gaming-sdk`, Player/Profile Service, Query Layer and wallet-linked game identity/entitlements/claims.
5. **Portable value** — chain-authoritative entitlements/rewards and optional externally portable assets.

Presentation may never write canonical portable value. The chain may never be required to resolve ordinary scene completion.

## 3. Canonical content hierarchy

The content graph is:

`Game -> Chapter -> Location -> Scene -> {HiddenObject, Clue, Interactable, JournalUnlock, CompletionRule}`

Persistent secondary domains are:

- journal entries;
- achievements;
- local collectibles;
- passport/location stamps;
- optional portable entitlements/rewards.

All persistent content objects use immutable globally unique IDs. Published IDs are never recycled for semantically different content.

Recommended namespaces:

- `chapter.<slug>`
- `location.<chapter>.<slug>`
- `scene.<chapter>.<slug>.<ordinal>`
- `object.<chapter>.<slug>.<ordinal>`
- `clue.<chapter>.<slug>.<ordinal>`
- `journal.<domain>.<slug>`
- `achievement.<slug>`

## 4. Player modes

### Guest

- no account required;
- no wallet required;
- core game available;
- save is local-authoritative;
- offline play is supported;
- player may later register without losing monotonic progress.

### Registered

- account required;
- wallet still optional;
- Player/Profile Service is canonical for ordinary synchronized progress;
- local offline events are reconciled after reconnect;
- cloud recovery and cross-device continuity are available.

### Wallet-linked

- registered identity is associated deliberately with GameIdentity420;
- ordinary gameplay remains Player/Profile Service authoritative;
- portable entitlements and rewards are 420 Gaming Protocol authoritative;
- chain state is revalidated before portable benefits are consumed.

## 5. Progress domains and authority

| Domain | Guest | Registered | Wallet-linked |
|---|---|---|---|
| core progression | local client | Player/Profile Service | Player/Profile Service |
| scene progress | local client | Player/Profile Service | Player/Profile Service |
| clues | local client | Player/Profile Service | Player/Profile Service |
| journal | local client | Player/Profile Service | Player/Profile Service |
| hints | local client | Player/Profile Service | Player/Profile Service |
| achievements | local client | Player/Profile Service | Player/Profile Service |
| ordinary/local collectibles | local client | Player/Profile Service | Player/Profile Service |
| portable entitlements | 420 Gaming Protocol | 420 Gaming Protocol | 420 Gaming Protocol |
| portable rewards | 420 Gaming Protocol | 420 Gaming Protocol | 420 Gaming Protocol |

Guest clients cannot manufacture portable value. Any portable feature boundary therefore fails closed until the required registered/wallet state exists.

## 6. Save envelope

Every ordinary save envelope carries:

- canonical Green Road game ID;
- architecture version;
- save schema version;
- player mode;
- optional player ID;
- monotonic revision;
- timestamp;
- progress payload.

Save migrations must be deterministic, version-to-version and non-destructive. A client that does not understand a future schema must fail closed rather than silently rewrite it.

## 7. Offline and reconciliation model

The Green Road is designed to remain useful offline.

Guest policy: local-authoritative until registration.

Registered/wallet-linked policy: gameplay writes append local progress events while offline and reconciles on reconnect.

Conflict policy: **monotonic progress, no destructive rollback**. Completion, discoveries and legitimate permanent unlocks are merged by set/maximum semantics unless a domain explicitly declares a consumable ledger.

Consumables such as renewable hints must use explicit balance/event semantics and must not be merged by naive maximum rules.

Portable state is never inferred from an offline save. It is revalidated against canonical Gaming Protocol/query state before use.

## 8. Progression rules

Scene completion is derived from game-domain completion rules, not wallet state.

A typical progression chain is:

`find object -> satisfy clue prerequisite -> unlock clue/journal fragment -> satisfy scene completion -> unlock location/scene -> persist event`

Optional wallet-only content may add branches to the graph but may not replace the wallet-free main campaign path.

## 9. Hidden-object scene contract

Each production scene eventually supplies:

- immutable scene ID;
- content version;
- image/asset references;
- normalized coordinate space;
- hidden-object definitions;
- clue definitions;
- optional interactables;
- completion rule;
- difficulty metadata;
- accessibility descriptions;
- optional narrative/journal unlocks.

TGR-0 does not prescribe the renderer. TGR-1 implements the reusable scene engine against this contract.

## 10. Coordinate model

Object hit regions are stored in normalized scene coordinates rather than device pixels. Rendering maps normalized coordinates to the current image transform after fit/zoom/pan.

This is mandatory for browser/mobile parity and prevents content from being tied to one resolution.

## 11. Content versioning

A content manifest is game-scoped and versioned. It contains ordered chapters, locations and scenes.

Validation must reject:

- foreign game IDs;
- unsupported schema versions;
- missing required collections;
- duplicate persistent IDs;
- malformed chapter/location/scene relationships.

Changing art without changing semantic object identity may preserve IDs. Changing what an ID means requires a new ID.

## 12. 420 Gaming Protocol boundary

The Green Road consumes the shared `@420/gaming-sdk`; it does not create a game-specific wallet stack.

Canonical responsibilities remain:

- Player/Profile Service — account/cloud-save orchestration;
- Query Layer — scoped reads;
- GameIdentity420 — canonical wallet-linked game profile;
- GameEntitlements420 — optional game entitlements;
- GameClaims420 — migration claims;
- CrossGameRegistry420 — narrow explicit attestations;
- SmartAccount420 / CapabilityRegistry420 — wallet execution/session authority.

All calls are scoped to `420/GAMING/GAME/THE_GREEN_ROAD/V1`.

## 13. Privacy boundary

The Green Road may query only information needed for a known feature. It must not enumerate wallet-wide game history, infer unrelated ownership, or crawl cross-game activity.

Cross-game recognition uses explicit known attestations/entitlements only.

## 14. Blockchain boundary

Keep off-chain by default:

- scene completion;
- hidden-object finds;
- clue state;
- journal state;
- ordinary achievements;
- hint balances unless reward-bearing;
- ordinary collectibles;
- passport stamps;
- settings/accessibility state.

Use Gaming Protocol/on-chain state only when portability, externally verifiable ownership, cross-game recognition, or transferable/reward-bearing value is actually required.

## 15. Security model

The ordinary game client is not trusted to mint portable value.

Before value-bearing rewards are enabled, reward issuance must be server/authorized-service validated from admissible gameplay evidence and protected against replay.

Content manifests intended for reward-bearing events should support signed/versioned publication later without changing the domain model.

## 16. Accessibility architecture

Accessibility is part of the scene contract, not a late UI patch. Scenes must be capable of providing semantic object descriptions and non-colour-only feedback. Runtime architecture must support zoom, reduced motion, scalable UI and alternate hint assistance without changing canonical completion semantics.

## 17. Analytics/privacy separation

Telemetry is non-authoritative. Analytics outages must not block gameplay. Telemetry identifiers must not become canonical player identity and should be separable from wallet identity.

## 18. TGR-0 invariants

- **TGR-INV-0001** Core campaign play never requires a wallet.
- **TGR-INV-0002** Registration is sufficient for cloud-save benefits; wallet linkage is not required.
- **TGR-INV-0003** Wallet linkage cannot improve baseline hidden-object statistics or progression speed.
- **TGR-INV-0004** All Gaming SDK operations are scoped to the canonical Green Road game ID.
- **TGR-INV-0005** Unsupported feature/content/schema classes fail closed.
- **TGR-INV-0006** Persistent content IDs are globally unique and immutable after publication.
- **TGR-INV-0007** Guest ordinary progress is local-authoritative until registration.
- **TGR-INV-0008** Registered ordinary progress is Player/Profile Service authoritative.
- **TGR-INV-0009** Portable entitlements/rewards are Gaming Protocol authoritative in every player mode.
- **TGR-INV-0010** Offline ordinary progress cannot manufacture portable state.
- **TGR-INV-0011** Reconciliation never destructively rolls back legitimate monotonic permanent progress.
- **TGR-INV-0012** Portable state is revalidated before use after offline operation.
- **TGR-INV-0013** The main story path remains wallet-free even when optional wallet branches exist.
- **TGR-INV-0014** Wallet-wide/cross-game activity enumeration is prohibited.
- **TGR-INV-0015** Normalized scene coordinates are resolution-independent.
- **TGR-INV-0016** Telemetry is never authoritative for progression, identity or rewards.

## 19. TGR-0 completion gate

TGR-0 is complete when:

1. architecture constants and authority mapping are executable;
2. save envelopes are game-scoped and versioned;
3. manifest validation fails closed and rejects duplicate persistent IDs;
4. regression tests prove guest/local, registered/cloud and portable/Gaming-Protocol authority boundaries;
5. the architecture freeze is documented;
6. existing 420GP-11 access invariants remain intact.

After this gate passes, TGR-1 may implement the reusable hidden-object scene engine without reopening identity, persistence or blockchain boundaries.

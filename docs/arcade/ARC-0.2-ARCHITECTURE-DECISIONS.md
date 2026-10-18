# ARC-0.2 — 420Arcade architecture decisions and interfaces

Status: implementation architecture proposed for Level 1 qualification. **This document is not a Genesis approval, actual deployment, or claim that eleven games are implemented.**

Baseline: ARC-0.1 qualified implementation `c060503d168d044848e6957862966dcbe983072c`, evidence `0c05db1ab31ac86239a1045682bd6a5051dddd85` (PR #727). ARC-0.1 is currently a **dependent, open draft PR**, not merged into main. This ARC-0.2 branch intentionally descends from its evidence commit. Before final merge, reconcile approved parent and then current main; do not merge child changes without the parent.

## Decision record / scope

**ADR-ARC-001 — Product boundaries (accepted for implementation planning).** The eleven selected titles are **Kush Crush**, **420Colouring Book**, **420Buddy**, **Bong Breaker**, **Baked Invaders**, **Puff-Man**, **Grasshopper**, **Roach Run**, **High Climb**, **Where's Dave?**, and **Mad Bud Delivery**. Bud Match, Weedle and 420 Trivia are excluded from the Genesis candidate. This is a user-approved *candidate* roster; the frozen `GENESIS_APPLICATION_DECISION_1` remains controlling. ARC-0.3 must authorize any amendment; until then, manifests and production registration remain proposed/non-authoritative.

**ADR-ARC-002 — Runtime split.** One responsive React/TypeScript launcher and accessible shell loads *independently bundled* games. Phaser/TypeScript is the preferred 2D runtime for action titles. React with a pure deterministic rules core is suitable for Kush Crush and 420Buddy. 420Colouring Book uses a region-aware vector renderer and raster export boundary. "Where's Dave?" needs a zoom/pan scene domain with exact hit-zone mapping. Avoid creating game-specific UI frameworks unless required; do not assume Phaser is already an installed dependency.

**ADR-ARC-003 — Trust and authority.** The browser is untrusted for premium entitlements, competitive ranks, cross-game writes, signatures, and economic value. Clients own presentation and temporary inputs; the game domain owns deterministic legal moves and ordinary local progress; server verification owns competitive awards; qualified Gaming Protocol contracts exclusively own portable entitlements and scoped on-chain actions. The existing `@420/gaming-sdk` and GP-17 onboarding flow mediate **optional** wallet access. No arcade contract, second identity protocol, signing-key custody, or parallel wallet session authority. Every adapter call is pinned to exact game scope. Undefined adapters, inactive namespaces, uncertain finality and revocation fail closed only for the affected optional feature; guest core play continues.

**ADR-ARC-004 — Guest-first progression.** Guest local saves work without account, wallet or network; optional registered profile adds cloud sync; wallet linking is explicit and independent. Player cannot lose core progression because RPC/indexer is down. No wallet-only or paid stat boost in ordinary competitive modes. Missing identity cannot leak another game's save or scores.

**ADR-ARC-005 — State envelope and migrations.** Each save has `gameId`, `schemaVersion`, `contentVersion`, `revision`, `updatedAt`, `playerMode`, opaque player reference (optional), and game-owned progress. Namespace every local-storage/database key by immutable game ID. Reject unsupported future schemas; apply explicitly versioned pure migrations; preserve old snapshot before promotion. Cloud reconcile only after identity proof and per-game authorization, with optimistic revisions, idempotent writes, monotonic unlocks and deterministic conflict rules. No raw content, health-like care state or sketches on-chain.

**ADR-ARC-006 — Score and event model.** All sessions carry opaque `sessionId`, `gameId`, `rulesetVersion`, seed provenance, `startedAt`, monotonic event sequence and `resultDigest`. Replays/checksums are authoritative only after trusted verifier checks. Client-generated highscores are labeled local/unverified. Reject negative scores, malformed streams, duplicate/non-monotonic sequences, replayed sessions, mismatched rulesets and forged game IDs. Never accept a player-submitted `verified=true`. Deterministic replay where feasible; otherwise server-authored challenges and signed, tightly scoped completion evidence. No economic reward claims based on unverified browser events.

**ADR-ARC-007 — Mad Buds source of truth.** The locked ten-character source roster and silhouettes are documented in `abvhiael/420-integrated/mad-buds/Docs/CHARACTER_BIBLE.md` at `11aad7b9be008c57d70f7f6b1fd1094c48fff03b`: Kush Krusher, Sativa Steve, Terpene Tina, Hash Gordon, Dabby, Purple Haze, Roach, The Edible, Bongwater Bob, Northern Lights. Its Unity/C# physics/runtime is not a Phaser library. Require a separately approved source-art export pipeline with provenance, source commit, license permission, immutable character ID, frame atlas checksum, animation metadata and deterministic validation. The inspected source Art tree contains only a README; no production-ready sprites are demonstrated. Art absence blocks later asset acceptance, not this architecture decision. Cosmetic portability never implies sharing game-specific abilities.

**ADR-ARC-008 — Colouring and companion privacy.** Colouring pages are approved region-closed SVG/vector content with immutable page/version/region identifiers; provide undo/redo snapshots, progressive saves, capped raster export and explicit sharing consent. Sketches remain private by default. 420Buddy uses bounded clock-based simulation, non-punitive absences (no irreversible pet death), resilient autosave and anti-clock-tampering logic for rewards. Neither user drawings nor intimate play history are placed on public-chain registries.

**ADR-ARC-009 — Delivery/performance/accessibility.** Static launcher and content-addressed lazy bundles target Cloudflare Pages if deployed; server functions are separately authenticated. Asset manifests include hashes, budget/limits, license/approval status and accessible labels. Pausing, keyboard/touch controls, reduced motion, color-independent cues, scalable UI, readable focus, constrained caches and orientation recovery are required. Game faults must be confined to their iframe/sandbox/module lifecycle so navigation still works. External asset loading must not grant scripting authority. Offline policy is explicitly per game.

**ADR-ARC-010 — Content and rules versions.** Published rulesets, level IDs, tiles, scenes, character IDs and colouring regions never change semantics under the same version. Game content may grow under new versioned manifests; replay validation pins the content and physics implementation version. For Kush Crush: authored 60 original levels across 6 regions, solver-backed validation, no impossible initial boards. For 420Colouring Book: 60 original approved pages in 6 ten-page collections (Portraits, Adventures, Cannabis Botanica, Psychedelic Patterns, Quarter Eaters, High Art). Other game content targets remain in the approved ARC roadmap, not silently revised here.

**ADR-ARC-011 — Release/qualification ownership.** Each implementation step has scoped Level 1 exact-SHA checks; shared integration milestones use app-level Level 2; final ARC-8 uses one phase Level 3 after frozen inputs and main reconciliation. No unrelated global Foundry, Genesis, Integrated, Docs or Geth runs for this architecture-only change. Evidence-only commits preserve original SHA. Missing actual live deployment/independent approvals are captured as explicit ARC-TN dependencies; locally implementable auth, replay and failure checks cannot be deferred.

## Proposed module and interface contracts (not created as executable packages by ARC-0.2)

```text
apps/arcade-web/                 # React launcher, catalog, settings, game boundaries
packages/arcade-core/           # game manifest types, immutable IDs, runtime lifecycle
packages/arcade-phaser/         # optional Phaser adapter only
packages/arcade-character-sdk/  # approved Mad Bud assets and animation binding
packages/arcade-saves/          # guest saves and versioned migration
packages/arcade-score/          # session envelope and score-verifier adapter
packages/arcade-art/            # SVG region rules, color/export pipeline
packages/arcade-testing/        # scoped deterministic fixtures, contract checks
docs/arcade/                    # ADRs, approvals, scope and qualification
```

`ArcadeGameManifest`: `{gameId, slug, displayName, manifestVersion, rulesetVersion, contentVersion, runtime, entrypoint, minCapabilities, assetManifestHash, saveSchemaVersion}`. Reject unrecognized/duplicate IDs, path escapes, unsafe entrypoints and unsigned optional premium metadata. Catalog publication is **not** Registry authority.

`ArcadeGameAdapter`: `mount(container, context)`, `pause()`, `resume()`, `unmount()`, `serialize()`, `restore(validatedSave)`. Caller enforces lifecycle state machine `created -> loading -> ready -> running <-> paused -> disposed`; no calls after dispose, no stale session access, abort pending assets upon unmount.

`ArcadeGameContext`: scoped `gameId`, input/audio adapters, read-only approved asset index, save adapter, `submitUnverifiedResult`, optional Gaming SDK client. Explicitly **no signing keys**, general blockchain RPC, global user index or cross-game save mutation.

`ArcadeProgressStore`: `read(gameId,playerRef?)`, `writeIfRevision(gameId,expectedRevision,save)`, `migrate(gameId,fromVersion,toVersion)`. Reject schema downgrade, unknown player owner, stale revision, foreign game and corrupt checksums.

`ArcadeScoreVerifier`: `verify({gameId,rulesetVersion,contentVersion,sessionId,seed,inputs,result})` yields `accepted|rejected` plus reason and digest. No self-declared verification; strict duplicate prevention; server controls leaderboard publishing.

`MadBudAssetManifest`: `{characterId,sourceRepository,sourceCommit,sourcePath,approvalRef,licenseRef,variant,atlasHash,frames:[{id,rect,pivot,hitbox,durationMs}],animations}`. Validate character identity and atlas dimensions before publishing. Missing source asset fails closed for that variant.

## Explicit game-to-runtime matrix

| Title | Runtime ownership | Additional contract |
|---|---|---|
| Kush Crush | React UI + deterministic puzzle domain | board solvability, move/cascade/version proof |
| 420Colouring Book | vector/canvas authoring runtime | validated closed regions, undo/redo, bounded export, consent |
| 420Buddy | React UI + bounded simulation domain | private companion saves, time abuse resistance |
| Bong Breaker | Phaser | fixed-timestep paddle/ball collisions |
| Baked Invaders | Phaser | waves/projectiles/enemy state |
| Puff-Man | Phaser | canonical maze graph/pathing rules |
| Grasshopper | Phaser | fair moving hazard/crossing simulation |
| Roach Run | Phaser | reachable procedural obstacles, seeded challenges |
| High Climb | Phaser | level physics and checkpoint versioning |
| Where's Dave? | zoom/pan scene renderer | immutable targets and exact hitboxes |
| Mad Bud Delivery | Phaser | scrolling maps, mission and routing authority |

## Failure and abuse test matrix for subsequent executable steps

- Fault isolation: one game crashes during asset load; launcher and other saves stay intact.
- Save isolation: foreign game IDs, account swaps, stale revisions, corrupt data, future schema versions.
- Session replay: spoofed score, forged game ID, duplicated sequence, modified ruleset/seed, score overflow.
- Authority: missing wallet, revoked entitlement, RPC outage, malicious indexer, inactive registry entry; guest core play continues.
- Assets: corrupted atlas, duplicate frame IDs, unapproved source or license, SVG external scripts/references, excessive canvas export.
- Gameplay: fixed-timestep divergence, puzzle unsolvability, unreachable runner hazards, blocked maze objectives.
- Privacy: colouring artwork never auto-publishes; opt-in telemetry and export only.
- Resource exhaustion: large sprites, long undo history, adversarial event and save payloads.

## Dependency and deferred acceptance ledger

| Dependency | Owner | Gate |
|---|---|---|
| Genesis application inclusion in frozen decision | Authorized Genesis governance at ARC-0.3 | No registry/launch claim until ratified |
| Game namespace registration and operator binding | GP-17 + actual canonical registry | Live testnet proof in ARC-TN |
| Deployed Gaming Protocol addresses/finality | GP-15 / network authority | Live evidence, not mock PASS |
| Approved Mad Bud source artwork and rights | Mad Buds content owner / ARC-2 | No fabricated production assets |
| Leaderboard service and persistence | ARC-1/ARC-6 | Auth, replay and load evidence prior to public rankings |
| Optional token rewards/economic review | ARC-TN with independent authorization | Disabled until approved |

## ARC-0.2 Level 1 exit criteria

1. All eleven games assigned explicit runtime, persistence and asset contracts.
2. Shared launcher, SDK/protocol authority, offline, identity and security boundaries documented.
3. Frozen Genesis policy preserved; governance approval and live acceptance clearly deferred.
4. Mad Buds provenance and source limitations disclosed.
5. Replay/authorization/privacy/adversarial boundary cases enumerated.
6. Exact-SHA scoped architecture verifier passes; record its run/job evidence only after actual GitHub success.
7. ARC-0.1 certificate retained and no unrelated qualified inputs modified.

**Next:** ARC-0.3 — authorized Genesis inclusion reconciliation. No claims of executable arcade/game implementations are made by this architecture step.

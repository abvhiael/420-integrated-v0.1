# ARC-0.6 — Project structure, module boundaries, dependencies and versioning rules

**Status:** structure contract defined; software packages and game implementations are not falsely claimed present.

## Authoritative sources and gap analysis

The owner-supplied canonical step is **ARC-0.6 — Define project structure, module boundaries, dependencies and versioning rules**. There is no independent ARC step-by-step roadmap file in the inspected `docs/arcade` inventory. The ARC-0.2 eleven-decision architecture and explicit proposed module contracts, frozen ARC-0.4 identities and ARC-0.5 platform requirements are the controlling repository decisions. Before this step, none of `apps/arcade-web` or `packages/arcade-*` exists; creating empty pretend implementation packages is not evidence of runtime construction. No launcher, Phaser build, saves implementation or eleven playable games is claimed.

**Machine-readable architecture definition:** `config/arcade-module-architecture.json`. **Scoped qualification:** `scripts/arcade/verify-arc-0-6.mjs` and `.github/workflows/arcade-0-6-level1.yml`.

## Project layout and ownership

| Module | Intended path | Ownership and boundaries |
|---|---|---|
| Arcade web | `apps/arcade-web/` | React/TypeScript responsive shell, accessibility, lazy game mounting, routing; no authority or cross-game direct writes |
| Core | `packages/arcade-core/` | framework-independent manifests, identity, lifecycle, bounded context; no browser or external network access in pure domain |
| Phaser | `packages/arcade-phaser/` | optional action-game adapter with fixed-step control; only action titles import Phaser |
| Character SDK | `packages/arcade-character-sdk/` | approved Mad Buds source asset/checksum/frame metadata; no fabricated art |
| Saves | `packages/arcade-saves/` | isolated per-game local persistence, schema migrations, revision checks and owner-bound cloud sync boundary |
| Score | `packages/arcade-score/` | local/unverified session events, trusted verifier handoff only; no browser-authorized ranks/rewards |
| Art | `packages/arcade-art/` | private colouring vectors, bounded exports, consent-gated publishing |
| Testing | `packages/arcade-testing/` | fixtures, adversarial replay, accessibility/offline contract tests; never a runtime authority dependency |

All eleven bundles live independently under `apps/arcade-web/src/games/<slug>` matching canonical ARC-0.4 slugs. Each bundle depends on pure `arcade-core` and may use relevant specialized packages through the launcher. No gameplay bundle may import another game's internal content/state directly. Dedicated game-level adapters are required for optional SDK access.

## Dependency DAG and authorization

The dependency graph must remain acyclic. Shared modules depend only on `arcade-core` where required; launcher composes modules without reversing those edges. No runtime module depends on `arcade-testing`; no duplicate 420 Gaming Protocol Registry/Identity/Claims implementation is authorized. `@420/gaming-sdk` is the optional existing protocol adapter and must carry the exact canonical game identity, never private keys or general-purpose transaction custody.

React, TypeScript and Phaser are **not installed or version-pinned by this requirements step**. Their eventual package versions and lockfile must be mutually compatible and security-reviewed at runtime implementation; no fabricated installed dependency claims. Phaser must not be an unconditional launcher, core, colouring or companion dependency. No new blockchain contracts, privileged wildcard capabilities or global grant interface is permitted.

## Versioning and migrations

- Game IDs and namespace V1 are immutable. Display metadata and slugs never replace game IDs in persistence, scores or Registry bindings.
- Shared public package/API contracts use semantic versioning; API-breaking changes require a major bump, consumer review and migration.
- Individual game `manifestVersion`, `rulesetVersion` and `contentVersion` use pinned semantic versions. No semantic rewrites of published rules, scoring, target regions, maps or physics under the same version.
- Per-game save schema is a positive integer; an upgrade uses explicit version-by-version pure migration, snapshot-before-write, optimistic revision and fail-closed future schema. State cannot bleed between games.
- Assets are immutable content-hash addressed, contain approval and license provenance, and have versioned animation/region metadata. Missing approved artwork remains blocked at game asset acceptance.
- Dependencies must be declared explicitly with frozen lockfiles before installation. No wildcard/unbounded dependency upgrades, executable remote code or dynamic imports from untrusted external sources.
- Version rollback must never silently reinterpret saves or previously issued competitive scores. A score must pin game/ruleset/content/runtime versions and be independently verified where relevant.

## Platform/release boundaries

ARC-0.5 WCAG 2.2 AA, desktop/mobile browsers, touch/keyboard support, offline guest gameplay and asset integrity requirements apply to all eleven bundles. Launcher isolation, lazy loading, constrained caches, graceful network failure and wallet-free core play remain mandatory. Only real later builds and browser/device tests can qualify those behaviors. Active chain registration/operator bindings are GP-17.9/ARC-TN requirements, not demonstrated here.

## ARC-0.6 Level 1 exit criteria

1. Complete module/path/ownership definitions aligned with ADR-ARC-002 and the proposed eight modules.
2. Eleven independently versioned/lazy candidate bundles mapped exactly to ARC-0.4 identities without adding or renaming games.
3. Explicit acyclic dependency graph and no illegal cross-boundary/privileged runtime access.
4. Existing scoped Gaming SDK and authority boundaries; no invented Registry or signing key powers.
5. Complete versioning rules for game, API, ruleset, content, saves, migrations, assets and lockfiles.
6. ARC-0.5 platform/offline constraints inherited, and unimplemented runtime/deployment status truthful.
7. Deterministic adversarial fixtures for missing/duplicate modules, cycles, wrong path, forbidden dependencies and version/authority changes.
8. Successful exact-SHA app-owned Level 1 CI, preserving ARC-0.1–0.5 evidence with no global rerun.

**Later implementation:** actual scaffold, package manifests/lockfiles, build/type/lint, game runtimes, save/migration/score services, accessibility/device qualification and approved sprites are assigned to their relevant implementation steps, not represented as completed by ARC-0.6. No testnet-only deferral of local work is made.

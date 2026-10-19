# ARC-0.7 — Game scope, acceptance criteria, qualification policy and dependency freeze

**Status:** requirements and ownership freeze, NOT functional games, runtime deployment or final phase closeout.

## Original step and sources

Owner's canonical ARC-0.7 title: **Freeze game scope, acceptance criteria, qualification policy and implementation dependencies**. Repository has no separate per-step ARC roadmap file found in inspected Arcade inventory. The controlling decisions are ARC-0.2 ADRs, ARC-0.4 identities, ARC-0.5 platform policy and ARC-0.6 module architecture. Machine-readable frozen contract: `config/arcade-0-7-scope-freeze.json`.

The sourceBlobs table records Git **blob SHA-1** (not SHA-256) over the exact committed bytes of five authoritative files. The scoped verifier independently recomputes every entry, validates the complete count/path inventory, and rejects stale or missing sources **without modifying** those earlier qualified files. This is an ARC step freeze, not the later phase-wide Level 3 freeze manifest.

## Frozen scope

Exactly eleven Genesis Arcade candidates, in canonical ARC-0.4 order: Kush Crush, 420Colouring Book, 420Buddy, Bong Breaker, Baked Invaders, Puff-Man, Grasshopper, Roach Run, High Climb, Where's Dave? and Mad Bud Delivery. Bud Match, Weedle and 420 Trivia are excluded. IDs/slugs cannot be silently renamed; any scope revision needs explicit approval, new freeze and affected qualification.

## Acceptance criteria

Every game must ultimately demonstrate its actual desktop/mobile UI, 320 CSS-pixel minimum width, keyboard/touch/pause, WCAG 2.2 AA accessibility target, wallet-free guest core, offline play after downloading approved assets, isolated versioned saves, approved asset rights/integrity, and fault/adversarial testing. Each runtime/game requires actual build/lint/type/unit/integration checks, plus negative authorization, replay, corruption, storage, unsupported-browser, connectivity and security tests when implemented. Declaring a policy requirement is not proof of game implementation.

Competitive awards/rewards require server-side verification; player-provided verified scores or direct Registry writes never suffice. No premium economic mechanism without independent approvals. Unapproved Mad Buds production sprite exports remain blocked by rights/source provenance rather than fabricated assets.

## Qualification ownership and boundaries

ARC-0.1–ARC-0.6 evidence remains valid at its original exact SHAs. Each ordinary ARC step owns scoped Level 1. Actual shared integration milestones require Arcade-owned Level 2 where specified. A single app-phase Level 3 occurs only at the **original canonical ARC-8 complete phase boundary** after full implementation, reconciliation and frozen-input preflight. Solidity owns Foundry, Genesis owns address authority, Integrated owns infrastructure and dependencies, Docs owns global docs, and the retained Arcade suite owns app-specific evidence. Do not rerun those globally to qualify this freeze definition.

## Dependencies and release blockers

ARC-0.6 module graph and versioning remain mandatory. Runtime React/TypeScript/Phaser versions must be pinned with a lockfile before installation; existing optional Gaming SDK alone owns shared protocol adapter semantics. Save migrations, trust-isolated scoring, approved Mad Bud art and rights, accessibility/browser automation, platform builds and real-game acceptance are later locally executable work—not testnet deferrals.

Live canonical Registry registration, operator/capability grants, chosen chain/finality checks, GP-17.9 onboarding, independent security/economic/legal decisions and production release authority remain disabled until actual external proof.

## Level 1 exit criteria

All eleven approved identities and exclusions frozen; all source blob digests checked; acceptance matrix complete, platform and module matrices cross-checked; Level 1/2/3 ownership and exact-SHA preservation frozen; implementation/testnet dependencies tracked without false PASS; negative tests reject tampering, unauthorized scope expansion, disabling core requirements, stale source digests, global test dispatch or fabricated live acceptance; successful Arcade-only Level 1 evidence recorded against exact qualified SHA.

No app-phase closeout or ARC-0.8 implementation is authorized by this record alone.

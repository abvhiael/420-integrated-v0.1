# BC-2.2 — Labyrinth Cribbage authoritative rules engine

**Scope:** Repository-only Go RuleModule implementation for the locked BC-2.1 ruleset. This stage adds deterministic server-side setup, actions, scoring, variant pinning and replay. It does **not** activate production live Play, computer-opponent policies, or claim deployed two-account acceptance.

**Game:** `labyrinth-cribbage` (kept separate from frozen standard `cribbage`).  
**Ruleset:** `bc-labyrinth-cribbage-241@1.0.0` with manifest SHA-256 `5c2f863b99dfc6430c4a75715d07fcdcff9e2ccebbd3bd2ac4be6c3beb466aa0`.  
**Engine:** `services/bong-goggles-account-social/classic_labyrinth.go`.  
**Rules adapter:** `RuleVariantModule` is opt-in; existing BC-1.2 adapter and JSON frames remain unchanged when no variant is configured.  
**Immutable variant:** Chosen at authenticated room creation (default four-player opposite-seat partnerships; optional individual) and persisted as immutable per-seat team assignments. The selected immutable ID is independently pinned in the authoritative session's `RuleFrame.Variant` and sealed genesis, and is mandatory for cold replay.
**Privacy:** server shuffle, private card projections, immutable action journal, authenticated room admission, anti-replay and per-seat legal-move authority reused from qualified framework. No browser is authoritative.
**Release gate:** NOT ENABLED. No Labyrinth bot policy is registered, and the production Cribbage resolver is left unchanged.

## Acceptance

- 2/3/4-seat six-card retained hands and six-card crib; 2-seat triple discards C(9,3)=84; 3-seat double discards C(8,2)=28; 4-seat one-card discards C(7,1)=7 and two direct crib cards.
- All valid seven-card fifteen subsets, longest-run multiplicity, pairs, the accepted 6/7 flush distinction, heels, Go/last-card, standard 31, cumulative scores and immediate 241 terminal transition.
- 2, 3 and both 4-player formats: deterministic complete matches, private views, replay from immutable genesis and a deliberately corrupt journal rejected. No 121-point Cribbage regression.
- Room creation persists teams via PostgreSQL 16 and returns `variantId`; old `russian-cribbage` rooms remain readable but cannot be newly created.
- Required exact-head CI: `.github/workflows/bc-2-2-labyrinth-engine.yml` (Go 1.23 with race + Node 22 + PostgreSQL 16). The canonical roadmap must remain unqualified until exact-head checks pass.

**Results:** Pending exact-head workflow evidence.

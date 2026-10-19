# ARC-0.4 — Canonical game identities and namespaces

**Implementation status:** candidate identities implemented locally; live canonical registration is NOT claimed.

**Baseline:** ARC-0.1 through ARC-0.3 merged, with existing exact-SHA certificates retained. ARC-0.2 ADR-ARC-003/005/010 and GP-17.1 establish the authority/identity contract. No standalone ARC-0.4 roadmap exit-criteria document was found among the inspected committed docs; this implementation covers the handoff's identity scope and remains subject to any additional canonical requirements surfaced later.

Source of application inclusion: `config/genesis-applications.json` on the active base, not the unmerged 51-entry Decision #2 draft. Source of game candidate identities: `config/arcade-game-identities.json`; no new Genesis application entries and no live Registry writes.

- Eleven frozen titles and immutable canonical GP-17 `420/GAMING/GAME/<NAME>/V1` namespace preimages; all use distinct `ARCADE_` prefixes to distinguish existing Gaming Protocol titles. On-chain `bytes32` registration keys require the GP registration owner to derive/check and approve actual IDs on the selected chain; namespace preimages here are not receipts.
- Stable public slugs, display names, runtime ownership, per-game versioned manifest/ruleset/content/save identity and optional-wallet scope. Future version upgrades must not mutate V1 identity.
- Guest gameplay never depends on optional wallet, active Registry status, or network connectivity.
- Local namespace declaration is non-authoritative. No operator, deployed address, capability grant, signature, verified score, or economic reward is created.
- Deterministic negative checks reject missing, duplicate, reordered, renamed, forged or protocol-incompatible identities, unauthorized registration claims, mandatory wallets, malformed slugs and incompatible version/schema data.
- Game-specific storage should use immutable `gameId` in every key and envelope at later saves implementation milestones, not slugs or display names.
- Cross-repository/live collision certification is pending canonical registration inventory and external testnet acceptance; local uniqueness and the existing canonical GP-17 namespace regex are checked.

**Scoped owner:** `.github/workflows/arcade-0-4-level1.yml` executes only `scripts/arcade/verify-arc-0-4.mjs`. Prior ARC and global suites are not replayed. Record exact workflow/job results before claiming Level 1 PASS. Level 2/3 are not triggered.

**Testnet ledger requirement:** real selected-network collision and hash proof; Registry game registration; operator bindings; chain/finality; exact capability authorization; GP-17.9 live onboarding evidence and separate release decision. None are locally certified here.

## Requirements-to-evidence reconciliation — protocol-owned inventory

- GP-17.1 canonical ID grammar: enforced per frozen ID using `developer-hub/src/gaming-onboarding.mjs` plus negative fixtures.
- Existing namespace collision inventory: `deployments/gaming/testnet.runtime.json`, four reference domains `HIGH_COUNTRY`, `THE_GREEN_ROAD`, `BUDTENDER`, `SMOKE_AND_CHROME`; all are distinct and none overlaps the eleven `ARCADE_*` candidate domains. This committed runtime file is explicitly `UNRESOLVED_UNTIL_DEPLOYMENT`, **not** live-network proof.
- Exact slug, display name, runtime, game ID and roster/order freeze: verifier compares each title against the approved eleven-title matrix, and rejects substituted valid slugs or plausible runtime swaps.
- Genesis decision separation: owner-approved Arcade entry on main; unmerged Genesis Decision #2 PR #734 is not imported or reconstructed.
- Protocol authority: `contracts/src/gaming/GameRegistry420.sol` requires scoped registrar authority and rejects duplicate IDs; Arcade candidates are `UNREGISTERED` and cannot claim grant/registration/verification.
- Per-game save isolation: manifest exposes unique immutable identifiers/schema versions; executable progress persistence and migration enforcement remains later ARC implementation, not falsely claimed in ARC-0.4.
- Metadata/hash collision on an actual selected chain, operator binding, finality and live game registration: external ARC-TN/GP-17.9 evidence only; testnet acceptance is blocked, not a local Level 1 failure.
- No independent step-specific ARC roadmap file was found in the committed `docs/arcade` directory; the authoritative ARC-0.2 architectural ADR, owner-selected roster and GP-17 controls form the verified scope, without renumbering.
- Security adversarial suite: replaced canonical game ID, altered slug/runtime, duplicate slug/ID, unauthorized registration state, wallet requirement and schema/version failures must be rejected. No global workflow is owned by ARC-0.4.

**Qualification history:** implementation `e4e5b96cec8a43ea66519d5c35116d4ea904aa85` passed job `117849418924`; strengthened verifier at `0959a38592520f773b6bbebb51c9edd66e4adf57` changes qualified inputs and therefore requires one new Arcade-owned Level 1 run. The earlier PASS remains historically valid only for its exact original SHA.

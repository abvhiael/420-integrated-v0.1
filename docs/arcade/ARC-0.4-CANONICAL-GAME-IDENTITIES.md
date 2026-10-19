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

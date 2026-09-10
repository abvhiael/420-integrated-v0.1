# High Country — HC-PA Progressive Access & Wallet Integration

## Architectural rule
High Country is a complete, enjoyable game without a 420 Wallet. Wallet connection adds breadth, ownership, provenance, interoperability, prestige, optional ecosystem participation and special content. It must not grant raw gameplay-stat, yield or pay-to-win advantage.

HC-PA sits after HC-6 and before HC-7+ player/economic/client systems.

## Access states
- GUEST — immediate core play, local/device save, no account or wallet required.
- REGISTERED — conventional account, cloud saves, cross-device recovery, standard persistent leaderboards/events.
- WALLET_CONNECTED — voluntary GrowerProfile/420 account association, ecosystem rewards, wallet-exclusive content, verified ownership and cross-game interoperability.
- ECOSYSTEM_PARTICIPANT — marketplace, genetics licensing/trading, major tournaments, transferable and cross-game assets.

## HC-PA.1 — Player Access Model — implemented
Shared `ProgressiveGamingTypes` defines access state, authority domain and capability vocabulary. `HighCountryAccessPolicy` maps High Country features onto those states. Core gameplay is always available to GUEST and wallet connection never grants direct stat advantage.

## HC-PA.2 — Guest Game-State Authority — implemented
Ordinary state remains local/game-service authority: routine equipment, farm progression, common inventory, irrigation upgrades and ordinary mission progress. Registered account saves/cloud progression are service state. Canonical ecosystem state is reserved for provenance-sensitive objects such as registered cultivars, important genetic lineage, championship results, marketplace assets, transferable genetics, cross-game assets, ecosystem rewards, significant achievements and licensing rights.

Existing chain-authoritative High Country registries remain canonical. HC-PA neither demotes canonical objects nor automatically promotes ordinary save-state on-chain.

## HC-PA.3 — Guest/Profile Claim & Migration — implemented foundation
`GuestProfileMigration` provides the canonical claim boundary:
1. a source guest/registered `sourceProfileId` binds to one GrowerProfile/account;
2. a GrowerProfile can bind to only one source profile;
3. the claim commits an immutable migration manifest root and policy version;
4. exact claim replay is idempotent;
5. conflicting replay is rejected;
6. only explicit canonicalizable object classes can appear in the on-chain consumption API;
7. each manifested object can be consumed once;
8. objects outside the manifest fail proof verification;
9. the migration registry does not mint or transfer assets itself — downstream canonical registries consume migration provenance.

Canonicalizable classes currently include registered cultivars, significant genetic lineage, championship results, marketplace assets, transferable seeds/clones, cross-game assets, ecosystem rewards, significant achievements and licensing rights.

### HC-PA invariants
- HC-INV-ACCESS-019 — wallet never gates core gameplay and never grants direct stat power.
- HC-INV-ACCESS-020 — one source profile has one canonical GrowerProfile binding.
- HC-INV-ACCESS-021 — each eligible migration object canonicalizes at most once.
- HC-INV-ACCESS-022 — claim manifest and policy binding cannot silently mutate; exact replay is idempotent.
- HC-INV-ACCESS-023 — ordinary game state remains ordinary authority unless explicitly represented in an eligible canonicalization manifest.

## HC-PA.4 — 420 Wallet Session Integration — implemented
High Country reuses the existing `SmartAccount420`, `CapabilityRegistry420`, Wallet Core and canonical session-key execution. It does not create a second wallet, private-key, grant registry or custody path.

The existing `HighCountrySessionAccess420` policy bridge is the HC-PA.4 implementation boundary:
- default deny for unknown target + selector pairs;
- exact target + selector routine-call classification;
- zero native `$420` spend in routine sessions;
- exact `SESSION_EXECUTE` capability checks against the SmartAccount's current authorization epoch;
- fail-closed behavior for stale epochs, revoked/expired grants, wrong selectors, wrong scopes and missing capabilities;
- wallet/passkey escalation for native `$420` spend, marketplace actions, asset transfers, genetics registration/licensing, significant reward claims, permission changes and other sensitive/high-value actions.

### HC-PA.4 invariants
- HC-INV-ACCESS-024 — High Country routine sessions cannot spend native `$420`, unknown selectors fail closed, and session execution cannot exceed canonical 420 capability scope.
- HC-INV-ACCESS-025 — only explicitly reviewed routine zero-value actions may avoid wallet escalation; sensitive actions cannot be silently downgraded into unattended game sessions.

## HC-PA.5 — Shared Content Entitlements — implemented
HC-PA.5 reuses the shared 420 Gaming Protocol rather than introducing a High Country-only entitlement registry.

`GameEntitlements420` is authoritative for entitlement issuance, revocation, profile/game scope and time validity. `HighCountryGamingBridge420` is the High Country reference adapter that binds those shared entitlements to a canonical GrowerProfile and fails closed when the entitlement is inactive, belongs to a different game/profile, has the wrong type, or names the wrong content ID.

The High Country entitlement catalogue now defines stable domain-separated classes for:
- bonus regions;
- cosmetics;
- competitions;
- genetics packs/access;
- cross-game unlocks;
- special grow facilities/buildings;
- seasonal events;
- prestige areas.

The catalogue uses exact content IDs beneath each class, so Breeders' District, rare exhibitions, specific genetics packs, special facilities and other optional content do not need bespoke wallet checks in the client.

Explicit product-policy hooks state that core gameplay does not require an entitlement and entitlement possession alone cannot modify protected balance/yield rules.

### HC-PA.5 invariants
- HC-INV-ACCESS-026 — entitlement ownership cannot alter protected core-game balance/yield rules.
- HC-INV-ACCESS-027 — gated optional content fails closed while ungated core gameplay remains available.
- HC-INV-ACCESS-028 — entitlement class identity is stable, domain-separated and cannot be forged by ordinary local game state.

## UX
Wallet prompts are contextual, optional and dismissible. Every optional prompt exposes a keep-playing / maybe-later path unless the player explicitly initiated an ecosystem-only action.

## Existing systems preserved
HC Genesis/module authority, three-region world genesis, GrowerProfile canonical semantics, land authority, genome architecture, seeds/clones/mothers/phenotypes, provider-neutral randomness, breeding provenance, HC-6 cultivation, BUDS design, smart-account/session-key architecture and chain authority for ecosystem-significant state remain intact.

## Current order
HC-1 through HC-6 are complete/merged. HC-PA.1 through HC-PA.5 are implemented on `feature/high-country-hcpa-progressive-access`. Next: qualify/reconcile and merge HC-PA, then proceed to HC-7 harvest/product resolution.

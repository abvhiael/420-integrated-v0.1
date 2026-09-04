# 420Exchange Foundation V1

## Purpose

420Exchange is the post-genesis on-chain spot exchange and trading application for 420 Integrated. It is deliberately layered above the existing 420Swap and 420Bridge protocols rather than replacing them. 420Swap remains the canonical swap/liquidity execution layer; 420Bridge remains the canonical cross-chain ingress/egress layer. 420Exchange adds curated asset discovery, exchange-market lifecycle, routing, advanced order settlement, fee policy, moderation/delisting, portfolio/trading UX and market-data surfaces.

## V1 foundation scope

This foundation establishes:

- `ExchangeTypes420` shared asset, market and moderation classifications.
- `ExchangeAssetRegistry420` for canonical asset identity, category, provenance/verification commitments, exchange representation and moderation state.
- `ExchangeMarketRegistry420` for exchange-facing pairs mapped to execution venues such as canonical 420Swap markets.
- `ExchangeFeePolicy420` for transparent protocol-fee configuration and five-way allocation.

Execution routing, signed limit orders, order settlement, bridge adapters, oracle guards, circuit breakers, LP incentives and frontend services are intentionally deferred to subsequent batches.

## Market philosophy

$420 is the preferred quote and liquidity-routing asset, not a mandatory intermediate hop. The router may later select a superior direct route when it produces better execution.

Initial public market policy is curated: only verified assets may activate exchange markets. Unverified-market states and categories exist in the type system as future-compatible placeholders but are not enabled by the V1 market registry.

## Asset categories

The registry reserves the following classes from the start:

- Native 420
- Cannabis
- Major assets
- Stablecoins
- Counterculture
- Science / useful compute
- Meme / weird internet
- 420 ecosystem
- Other

This allows future BTC, ETH, DOGE, SOL, stablecoin, privacy/cypherpunk, music, science-compute and other markets to be added without changing the registry schema.

## External-asset naming

The intended user-facing convention for canonical external representations is a single lowercase `e` prefix, for example `eBTC`, `ePOT`, `eARRR` and `eBOB`. The prefix means an external canonical asset represented on 420 Integrated. Whenever technically practical, backing originates directly from the asset's canonical/native chain rather than another wrapped representation.

The on-chain registry stores canonical-chain and canonical-asset identifiers independently from the exchange symbol so migrations and chain provenance can be audited without relying on ticker text.

## Verification and moderation

Asset lifecycle:

`PLACEHOLDER -> PENDING -> VERIFIED -> SUSPENDED/DELISTING -> DELISTED`

`UNVERIFIED` is reserved for future permissionless market architecture.

Moderation reasons include spam, impersonation, malicious transfer behavior, honeypots, abandonment, broken bridges, fake assets, security incidents, liquidity failure and unresolved provenance. Moderation is non-confiscatory: a flag or delisting removes exchange eligibility; it does not seize user assets.

A verified asset requires a non-zero verification commitment. A trade-eligible asset must be VERIFIED and have no active moderation flags.

## Market lifecycle

Exchange markets reference asset IDs rather than trusting symbols. An ACTIVE market requires both assets to remain trade-eligible, except for the configured native $420 asset ID. If a constituent asset is suspended or moderated, `isActive()` fails closed even before explicit market-state governance catches up.

The exchange market records an `executionMarketId` and `executionVenue`, allowing the exchange-facing market to map onto the existing 420Swap canonical market infrastructure or future approved execution engines without duplicating AMM state.

## Exchange fees

`ExchangeFeePolicy420` separates the exchange protocol fee from underlying LP fees, bridge costs, gas and slippage.

The retained 420Exchange fee is allocated among five transparent destinations:

1. Protocol Treasury
2. Development Fund
3. Community Fund
4. Liquidity Incentives
5. Lead Developer Payment via `DevelopmentCompensationVault420`

V1 hard-caps the exchange protocol fee at 100 bps and the lead-developer share at 1,000 bps (10%) of the retained exchange fee. These are safety ceilings, not target economics. The eventual production fee and allocation percentages remain governance-configured and should be set only after volume/liquidity modelling.

The developer recipient is the Development Compensation Vault rather than a hidden privileged transfer path, preserving the existing Application Revenue Policy model.

## Foundation invariants

- EX-INV-ASSET-001: an ACTIVE market may not depend on an unverified external asset.
- EX-INV-ASSET-002: an asset with any active moderation flag is not trade-eligible.
- EX-INV-ASSET-003: verification state requires a non-zero verification commitment.
- EX-INV-MARKET-001: base and quote asset IDs must be non-zero and distinct.
- EX-INV-MARKET-002: an ACTIVE market must point to deployed execution code.
- EX-INV-MARKET-003: an asset suspension/moderation causes exchange market activity checks to fail closed.
- EX-INV-FEE-001: retained fee allocation always sums to exactly 10,000 bps.
- EX-INV-FEE-002: exchange protocol fee may not exceed the V1 safety cap.
- EX-INV-FEE-003: developer compensation may not exceed 10% of retained exchange protocol revenue.
- EX-INV-FEE-004: all five fee destinations are explicit non-zero addresses before production routing is enabled.
- EX-INV-CUSTODY-001: the exchange foundation introduces no omnibus user-custody account.
- EX-INV-BRIDGE-001: a future verified external asset must identify its canonical chain and canonical asset independently of its display ticker.

## Next implementation batches

1. Exchange action IDs, capability boundaries and emergency-state classes.
2. Exchange router and route-quoter adapters over 420Swap.
3. Fee collector/router wired to the five destinations and Development Compensation Vault.
4. Signed limit-order domain, nonce manager, partial-fill accounting and atomic settlement.
5. Oracle guard/reference-price layer that never dictates exchange price discovery.
6. Bridge-asset admission interface and direct canonical-chain bridge qualification.
7. Market-liquidity qualification and activation thresholds.
8. Portfolio/read APIs and 420Wallet smart-account capability integration.
9. Frontend shell with active categories and disabled placeholders for future market classes.
10. Focused hardening, invariant/fuzz tests and CI qualification gate.

# 420Exchange V11 — Canonical Bridge Adapters + External-Asset Qualification

V11 binds 420Exchange external-asset listings to the existing hardened 420Bridge stack. It does not introduce a second bridge or bypass bridge risk controls.

## Purpose

An external asset is Exchange-qualified only when its Exchange representation and canonical bridge provenance agree at the time qualification is checked.

`ExchangeBridgeQualification420` binds:

- Exchange asset ID and local token
- canonical source chain identity
- canonical source asset identity
- Exchange verification/provenance hash
- canonical 420Bridge asset ID
- active canonical bridge representation
- active bridge route
- source/destination asset identifiers
- bridge adapter ID
- live adapter address registered in `GatewayRouter420`
- route verifier configuration
- required inbound/outbound direction state

## Live revalidation

Qualification is deliberately not a permanent governance assertion.

`requireQualified(exchangeAssetId)` reads the current Exchange asset registry, bridge asset registry, bridge route registry, and gateway adapter binding every time. If any dependency changes, qualification fails closed without requiring a separate Exchange governance transaction.

Examples that invalidate qualification automatically:

- Exchange asset is suspended, delisted, unverified, or moderated
- Exchange verification hash no longer equals the approved provenance hash
- bridge asset is not ACTIVE
- bridge representation is no longer canonical
- bridge local token no longer equals the Exchange token
- route is suspended/deprecated/inactive
- required inbound or outbound direction is disabled
- route adapter ID changes
- route verifier configuration disappears
- canonical source/local representation identifiers no longer match
- gateway adapter address is removed or replaced by a contract reporting a different adapter ID

## Canonical identity binding

The Exchange asset stores a `canonicalAsset` identifier. The route must connect that canonical identifier directly to the bytes32-encoded local Exchange token address, in either direction.

This prevents an Exchange listing from claiming provenance through an unrelated bridge route that happens to use the same symbol.

The Exchange `verificationHash` is also bound to the qualification `provenanceHash`, so changing the verified provenance package invalidates the old qualification.

## Adapter model

V11 does not trust an adapter address supplied by the Exchange configuration. The qualification contract reads the adapter address from the authoritative `GatewayRouter420.adapters(adapterId)` mapping and requires the live contract to report the same `adapterId()`.

The adapter remains subject to all existing bridge execution controls, including route activity, direction state, shared safety, replay protection, settlement health, and bridge risk consumption.

## V11 invariants

- EX-BRIDGE-001: A qualified external Exchange asset must be VERIFIED and unmoderated.
- EX-BRIDGE-002: The Exchange token must equal the canonical bridge local representation.
- EX-BRIDGE-003: The bridge asset must be ACTIVE and marked canonical.
- EX-BRIDGE-004: The bridge route must be ACTIVE and bound to the same bridge asset.
- EX-BRIDGE-005: Canonical asset identity must connect directly to the local token representation.
- EX-BRIDGE-006: The route adapter ID must equal the qualification adapter ID.
- EX-BRIDGE-007: The gateway adapter contract must report that same adapter ID.
- EX-BRIDGE-008: Required route directions must remain enabled.
- EX-BRIDGE-009: The Exchange verification hash must equal the approved provenance hash.
- EX-BRIDGE-010: Qualification must fail closed when any live dependency changes.

## Asset onboarding policy

V11 supports the Exchange roadmap policy of beginning with verified cannabis assets and adding other classes only after their canonical-chain provenance and bridge path are qualified.

An `eASSET` representation should not become trade-eligible merely because a token contract exists on $420. It must first have a verified canonical identity and a live qualified bridge relationship.

## Scope

V11 is the Exchange-side qualification boundary. The existing 420Bridge contracts remain authoritative for bridge execution, custody/settlement semantics, replay protection, risk limits, route health, and inbound/outbound processing.

The next Exchange roadmap slice is V12 liquidity/execution hardening, fuzzing, and invariants.

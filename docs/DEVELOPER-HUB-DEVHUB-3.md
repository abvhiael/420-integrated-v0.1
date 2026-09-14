# 420 Developer Hub — DEVHUB-3 Shared TypeScript SDK

## Status
DEVHUB-3 establishes the shared `@420/sdk` TypeScript foundation used by developer tooling and applications.

The SDK is a typed integration layer. It consumes network discovery from DEVHUB-1 and verified contract metadata from DEVHUB-2; it does not become a source of chain authority.

## Initial surface

- explicit network identity
- explicit contract-catalogue chain binding
- canonical RPC endpoint selection from discovered network configuration
- service endpoint lookup
- contract lookup by canonical name or deployed address
- transport-neutral JSON-RPC requests
- generated TypeScript declaration output

## Invariants

- **DEVHUB-INV-016** — SDK network and contract catalogue chain IDs must match exactly.
- **DEVHUB-INV-017** — RPC endpoints used by the SDK must come from the discovered network manifest.
- **DEVHUB-INV-018** — unknown service and contract lookups remain null/non-authoritative.
- **DEVHUB-INV-019** — the SDK must not invent contract addresses, service endpoints, or chain identity.
- **DEVHUB-INV-020** — JSON-RPC transport remains injectable so signing, wallet authority, and protocol authorization stay outside the base SDK core.

## Package

`packages/420-sdk/`

The package builds TypeScript from `src/` into `dist/` and emits declarations. Its first client constructor binds a DEVHUB-1 network discovery object to a DEVHUB-2 catalogue object and refuses mismatched chains.

## Exit criteria

DEVHUB-3 is complete when:

1. `@420/sdk` builds under strict TypeScript;
2. network and catalogue chain identity are bound fail-closed;
3. only declared RPC endpoints may be selected;
4. service and contract lookups expose the canonical discovery/catalogue surfaces;
5. transport is injectable and does not silently introduce signer authority;
6. tests cover chain mismatch, endpoint substitution, RPC forwarding, and null-on-unknown behavior.

## Next

DEVHUB-4 adds the 420 Wallet / smart-account SDK integration layer on top of this shared foundation.

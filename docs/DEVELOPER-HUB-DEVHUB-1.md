# 420 Developer Hub — DEVHUB-1 Network & Environment Discovery

## Status
DEVHUB-1 turns the DEVHUB-0 network-manifest contract into executable discovery code.

The Developer Hub may resolve configuration, but it does not create network truth. Every result comes from a validated manifest whose provenance remains external to the Hub.

## Scope
DEVHUB-1 provides:

- manifest loading from disk/URL-backed file locations
- fail-closed runtime validation for the frozen v1 contract
- explicit chain identity as both decimal string and `bigint`
- RPC endpoint discovery
- service endpoint discovery
- contract address/provenance discovery
- production-environment identification
- testnet/non-production faucet capability discovery
- null results for unknown services/contracts instead of inferred values

## Runtime surface
`developer-hub/src/network-discovery.mjs` exports:

- `NetworkManifestError420`
- `validateNetworkManifest420(input)`
- `loadNetworkManifest420(source)`
- `discoverNetwork420(manifest)`

`discoverNetwork420()` returns a frozen descriptor containing:

- `schemaVersion`
- `name`
- `environment`
- `chainId`
- `chainIdDecimal`
- `nativeCurrency`
- `rpc.http`
- `rpc.websocket`
- `service(name)`
- `contract(name)`
- `canRequestFaucet`
- `isProduction`

## Security / authority rules

### DEVHUB1-INV-001 — fail closed
Unsupported schema versions, extra fields, malformed chain IDs, malformed contract addresses, malformed endpoint URIs, and invalid contract provenance must throw before discovery.

### DEVHUB1-INV-002 — no inferred authority
Unknown service names and contract names resolve to `null`. The Hub must never synthesize an address or endpoint because a consumer expects one.

### DEVHUB1-INV-003 — explicit chain identity
Chain ID remains an exact positive decimal string in the manifest and is exposed as `bigint` for runtime consumers. Floating-point chain IDs are never accepted.

### DEVHUB1-INV-004 — mainnet faucet prohibition
A manifest declaring `environment: mainnet` is invalid if it advertises a faucet endpoint.

### DEVHUB1-INV-005 — indexer remains a service endpoint
Discovery of `services.indexer` does not make indexed projections authoritative. Security-sensitive consumers must still use canonical chain/protocol state where required by DEVHUB-0.

### DEVHUB1-INV-006 — contract provenance is mandatory
Each contract entry must contain both a valid EVM address and one of the frozen provenance values: `genesis`, `registry`, `governance`, or `deployment-manifest`.

## Exit criteria
DEVHUB-1 is complete when:

1. the runtime loader validates the frozen DEVHUB-0 manifest contract;
2. valid local/devnet/testnet/mainnet manifests can produce deterministic network descriptors;
3. malformed and unsupported manifests fail closed;
4. mainnet cannot expose faucet capability;
5. unknown services/contracts are never invented;
6. automated tests cover the discovery and hostile-input paths;
7. repository qualification is green.

## Next
DEVHUB-2 builds the canonical contract catalogue and ABI/interface distribution layer on top of this discovery surface.

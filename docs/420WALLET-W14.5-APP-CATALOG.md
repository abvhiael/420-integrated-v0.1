# 420 Wallet — W14.5 Genesis App Catalogue Reconciliation

## Purpose

W14.5 reconciles the Wallet application gateway with the repository's canonical Genesis service identifiers.

The source of truth is no longer the historical Wallet app list or old navigation metadata. Canonical service identity is taken from:

`contracts/src/libraries/ServiceIds420.sol`

Wallet presentation metadata is defined in:

`wallet/web/core/genesis-app-catalog.js`

A service remains disabled until a verified ecosystem manifest publishes it.

## Reconciled canonical Wallet-visible services

The Wallet catalogue now includes canonical Genesis services for:

- 420 Registry / Protocol Registry;
- 420 Explorer;
- 420 Search;
- 420 Analytics;
- 420 AppStore;
- 420 Verify;
- 420 Notifications;
- 420 Names;
- 420 Identity;
- 420 Arbitration;
- 420 Commons;
- 420 Pulse;
- 420 Messenger;
- 420 Treasury;
- 420 Grants;
- 420 Launchpad;
- 420 Token;
- 420 Resource Protocol;
- 420 Market;
- 420 Rights;
- 420 Swap;
- 420 Pay;
- 420 Bridge;
- 420 Stake;
- 420 Governance;
- 420 AI;
- 420 Compute;
- 420 Attention;
- 420 Cannaseur;
- 420 Status.

All launch URLs still come from verified manifest discovery. The catalogue provides identity, classification and descriptive metadata only.

## Stale aliases removed from the canonical app gateway

The previous Wallet catalogue included service IDs that are not canonical Genesis IDs:

- `420/service/registry/v1`;
- `420/service/town/v1`;
- `420/service/developers/v1`.

They are no longer treated as canonical ecosystem app services.

The Registry entry now uses:

`420/service/protocol-registry/v1`

Developer Hub remains first-class Wallet documentation/navigation, but it is not represented as a canonical protocol service unless the protocol service-ID source later defines one.

Social functionality is represented through the canonical Commons, Pulse and Messenger service IDs instead of the noncanonical Town alias.

## Named products that remain unresolved at the canonical service-ID layer

Repository roadmaps and application work refer to some named Genesis products that do not currently have distinct canonical service IDs in `ServiceIds420.sol`.

W14.5 records these rather than inventing identifiers:

- **420 Exchange** — no distinct canonical service ID; currently overlaps canonical Swap and Bridge services.
- **420 Commerce** — no distinct canonical service ID; currently overlaps canonical Market and Pay services.
- **420 Grow** — no canonical service ID currently exists.

These products should not receive invented Wallet manifest IDs. Their protocol/service identity must be resolved in the canonical Genesis service registry first.

## Qualification

`wallet/web/test/genesis-app-catalog.test.js` reads the Solidity service-ID source directly and verifies:

- every Wallet catalogue service ID is canonical;
- required Wallet-visible Genesis services are present;
- stale aliases are absent;
- named products lacking canonical service IDs remain explicitly recorded;
- app IDs and service IDs are unique.

The ordinary Wallet Web qualification also checks the W14.5 catalogue surface.

## Security and trust boundary

W14.5 does not make the static catalogue authoritative for availability.

The Wallet continues to fail closed:

1. a catalogue entry identifies a known canonical service role;
2. a verified ecosystem manifest must publish the service;
3. `resolveServices` validates the manifest and URL;
4. only then is the launch link enabled.

A canonical service that is absent from the verified manifest remains visible as unavailable rather than being linked to a guessed or hard-coded URL.

## Hand-off to W14.6

W14.6 should integrate 420 Names into the Wallet send flow so human-readable names can be resolved through the canonical Names service/contract, with address confirmation and fail-closed anti-spoofing behavior before transaction construction.

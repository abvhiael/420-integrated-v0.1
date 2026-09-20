# 420Exchange V15.1 — Testnet Deployment Catalogue + Runtime Binding

## Status

Implementation introduced on `feature/420exchange-v15.1-testnet-binding`.

V15.1 begins the live-integration phase without inventing a public testnet deployment that does not yet exist. The repository now has one canonical Exchange testnet runtime manifest:

`deployments/exchange/testnet.runtime.json`

The checked-in manifest is deliberately marked:

`UNRESOLVED_UNTIL_DEPLOYMENT`

No chain ID, RPC URL, Explorer URL, Exchange API endpoint, stream endpoint, contract address or deployment transaction is fabricated.

## Required deployment surface

A resolved V15.1 manifest must bind all of the following to one explicit testnet environment:

- chain ID
- RPC endpoint
- Explorer endpoint
- V13 Exchange API endpoint
- V13 Exchange stream endpoint
- `ExchangeAtomicRouter420`
- `ExchangeLimitOrderSettlement420`
- `ExchangeBridgeQualification420`
- `Wrapped420`
- `ExchangeAssetRegistry420`
- `ExchangeMarketRegistry420`
- `ExchangeRouteRegistry420`
- `ExchangeOracleGuard420`
- `ExchangeEmergencyControl420`
- configured market-subject identifiers

## Runtime authority boundary

`exchange/web/core/deployment.js` validates the deployment catalogue and converts a resolved manifest into the existing V14 runtime configuration.

The binder does not deploy contracts, select a network implicitly, discover arbitrary wallets, or treat documentation as canonical chain state.

A resolved manifest fails closed when:

- the environment is not `testnet`;
- chain ID is missing or malformed;
- RPC/API/Explorer endpoints are not secure HTTPS endpoints;
- the stream endpoint is not HTTPS/WSS;
- a required contract address is absent, malformed or the zero address;
- a market-subject entry is malformed or duplicated.

An unresolved manifest may be inspected so tooling can report blockers, but it cannot be bound into an executable Exchange runtime.

## Qualification

V15.1 repository qualification requires:

1. the checked-in canonical testnet manifest remains explicitly unresolved until real deployment evidence exists;
2. a synthetic resolved fixture proves deterministic runtime binding;
3. zero contract addresses fail closed;
4. insecure service endpoints fail closed;
5. unresolved deployment metadata cannot become an executable runtime;
6. Exchange web tests remain green.

## Exit criteria

V15.1 is repository-complete when the validation/binding implementation and tests pass.

V15.1 becomes **operationally resolved** only when a real 420 Integrated testnet deployment supplies canonical values and those values are backed by deployment/verification evidence.

That operational resolution is the prerequisite for V15.2 transaction construction against concrete deployed Exchange contracts.

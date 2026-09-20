# 420Exchange V15.6 — Live/Testnet Swap Execution Qualification

## Status

V15.6 adds the operational drill required to prove that the V15.2–V15.5 execution path works against a real 420 Integrated testnet deployment.

Repository implementation is complete when the runner and its tests qualify. **Operational V15.6 qualification is complete only after the manually dispatched testnet workflow produces a successful live evidence artifact against a resolved V15.1 deployment.**

## End-to-end path

The live runner composes the actual Exchange path:

1. bind the resolved V15.1 testnet manifest;
2. load an exact V15.6 swap fixture;
3. discover the dedicated testnet account through `eth_accounts`;
4. construct the exact V15.2 AtomicRouter transaction;
5. run V15.3 chain/freshness/allowance/authorization/simulation/gas preflight;
6. submit through the V15.4 EIP-1193 `eth_sendTransaction` path;
7. poll the V15.5 receipt/finality lifecycle;
8. require canonical inclusion-block hash parity;
9. reconcile TRADE/FEE_ROUTING activity against the V13 public Exchange API;
10. emit sanitized machine-readable evidence.

## Manual workflow

Workflow:

`.github/workflows/exchange-testnet-swap.yml`

It is intentionally **workflow_dispatch only** and runs in the protected:

`exchange-testnet`

GitHub environment.

It does not run automatically on pull requests because a real swap moves testnet assets and requires an explicitly provisioned test account.

## Required environment secrets

The protected `exchange-testnet` environment must provide:

- `EXCHANGE_TESTNET_MANIFEST_JSON`
- `EXCHANGE_TESTNET_SWAP_FIXTURE_JSON`

The manifest must be a fully resolved `420-exchange-testnet-runtime-v15.1` document. The runner refuses the repository's unresolved placeholder manifest.

The swap fixture must use schema:

`420-exchange-live-swap-fixture-v15.6`

A non-secret shape example is checked in at:

`exchange/web/fixtures/live-swap-v15.6.example.json`

## Test account boundary

The runner does **not** accept a private key, seed phrase, or mnemonic.

The configured testnet RPC/provider must expose a dedicated disposable testnet account through `eth_accounts` and support `eth_sendTransaction` for that account.

This arrangement is acceptable only for the isolated testnet qualification environment. It is not a production signing model and must never contain production funds or production credentials.

## Fixture requirements

The operational fixture must contain exact canonical values from the live quote/deployment environment:

- reviewed swap intent;
- exact token addresses;
- exact raw integer amounts;
- exact bytes32 market and route IDs;
- exact path hash;
- route data;
- freshness window;
- allowance checks with the actual route allowance target;
- `ExchangeAuthorization420` SWAP capability check;
- V13 market subject.

The example fixture contains placeholders and cannot qualify a live deployment.

## Finality target

The workflow operator selects one of:

- `CONFIRMED`
- `SAFE`
- `FINALIZED`

The default and preferred V15.6 gate is:

`FINALIZED`

A successful receipt is not enough. The runner continues polling until the configured lifecycle target is reached.

## V13 reconciliation

Once the transaction reaches the configured target, the runner queries V13 history with orphaned records retained.

The live drill examines:

- `TRADE`
- `FEE_ROUTING`

A V13/RPC canonicality conflict fails the drill.

If V13 indexing has not appeared yet, the runner remains unqualified for an operational closeout when reconciliation is expected; the operational environment should allow sufficient indexer catch-up before treating the run as final evidence.

## Evidence artifact

The workflow uploads:

`420exchange-v15.6-live-swap-<source-sha>`

The JSON evidence contains:

- source SHA;
- environment;
- chain ID;
- test account;
- transaction hash;
- transaction fingerprint;
- gas estimate;
- finality target;
- final lifecycle state;
- confirmations;
- canonical block number/hash;
- V13 indexed state;
- V13 reconciliation conflicts;
- lifecycle observations.

It deliberately does not contain:

- RPC URL;
- API URL;
- manifest contents;
- credentials;
- private keys;
- signing material.

## Failure conditions

The drill fails if any of the following occur:

- deployment is unresolved or not testnet;
- provider exposes no test account;
- fixture chain ID drifts from deployment;
- swap transaction construction fails;
- V15.3 preflight fails;
- wallet/account/chain state changes;
- wallet submission fails;
- transaction hash is malformed;
- receipt reverts;
- canonical inclusion is reorged;
- target finality is not reached within policy;
- V13 canonicality conflicts with RPC evidence.

## Repository vs operational status

The V15.6 qualification record uses two separate fields:

- repository implementation status;
- operational live-drill status.

A green PR does **not** mean a live testnet swap has occurred.

Operational V15.6 can only be marked qualified after the workflow artifact from a real resolved testnet deployment is reviewed and retained.

## Exit criteria

Repository implementation exit:

1. live orchestration composes V15.2 through V15.5;
2. unresolved deployment fails closed;
3. reverted/reorged transactions fail;
4. V13/RPC conflicts fail;
5. workflow is manual and protected;
6. evidence output is sanitized;
7. ordinary Exchange CI remains green.

Operational exit:

1. resolved testnet manifest supplied;
2. canonical live swap fixture supplied;
3. dedicated testnet account submits the transaction;
4. transaction reaches the selected finality target;
5. V13 reconciliation is conflict-free;
6. evidence artifact is retained with the exact source SHA.

The next phase is **V15.7 — live/testnet limit-order create/fill/cancel qualification**.

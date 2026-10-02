# 420Swap SWAP-AUDIT-8 — production-equivalent testnet qualification

## Status

Repository harness: **READY**

Live qualification: **BLOCKED — OFFICIAL PUBLIC TESTNET NOT YET AUTHORIZED/LIVE**

SWAP-AUDIT-8 is a live evidence gate. Unit tests, local EVM deployments and synthetic fixtures can prove that the qualification machinery fails closed, but they cannot satisfy the roadmap exit criteria.

## Canonical prerequisites

Before any live Swap qualification run:

1. the official testnet manifest must exist at `developer-hub/manifests/testnet.json`;
2. the launch authority must have promoted the production-equivalent network to an approved live phase;
3. public RPC/Explorer/Faucet endpoints must be real HTTPS/WSS endpoints rather than placeholders;
4. the exact deployed release-candidate Git SHA must be pinned;
5. SWAP-AUDIT-7 deployment/Registry bindings must be deployed and independently verified on that same chain;
6. Wallet and Exchange must use the resolved official testnet runtime, not qualification fixtures.

The repository baseline intentionally fails closed while these inputs are absent.

## Required live journeys

Every journey below is mandatory and must be retained against the same release candidate:

- **SUCCESS** — a Wallet/Exchange reviewed Swap reaches required finality and reconciles with canonical Indexer state.
- **SLIPPAGE** — adverse execution is rejected or settles only inside the user-reviewed minimum-output bound.
- **STALE_QUOTE_ORACLE** — stale quote/oracle state cannot proceed to unsafe submission; canonical TWAP/reference health is observed from the deployed stack.
- **WRONG_CHAIN** — the Wallet/Exchange path rejects execution when the provider chain differs from the official manifest.
- **DISABLED_MARKET** — an inactive canonical market cannot execute.
- **REPLAY** — prior review/submission/session/authorization material cannot be reused outside its permitted nonce/session boundaries.
- **REORG_RECOVERY** — inclusion that is reorged/replaced is not reported as final and the canonical RPC/Indexer history reconciles correctly.
- **PAY_COMPOSITION** — the deployed PaymentRouter → CanonicalSettlementAdapter → CanonicalSwapExecutor path settles through the exact trusted-caller graph qualified in SWAP-AUDIT-7.

## Existing live runners

### Wallet

Manual workflow:

`.github/workflows/wallet-live-testnet.yml`

It validates the official manifest/runtime, chain ID, block height, deployed authority code, Explorer reachability and Faucet reachability.

### Exchange live Swap

Manual workflow:

`.github/workflows/exchange-testnet-swap.yml`

It uses the protected testnet environment and calls:

`exchange/web/scripts/live-swap-qualify.mjs`

The live qualifier requires a resolved testnet runtime, submits the reviewed/preflighted transaction, waits for the required lifecycle target, detects reverted/dropped/reorged transactions and reconciles against V13 canonical Indexer state.

## Evidence rules

Live evidence must record, without secrets:

- exact implementation SHA;
- official chain ID;
- sanitized RPC/service identity;
- deployed Registry/Swap/Pay addresses and verified code hashes;
- Registry/binding transactions;
- live workflow run IDs;
- transaction hashes for applicable journeys;
- block number and block hash;
- finality/lifecycle observations;
- Indexer reconciliation/reorg evidence;
- expected failure code/result for negative journeys;
- operator timestamp and evidence source.

Do not commit private keys, seed phrases, authenticated RPC URLs, auth headers or raw sensitive proof payloads.

## Retained evidence

The canonical retained PASS file is:

`docs/audit/SWAP-AUDIT-8-LIVE-TESTNET-EVIDENCE.json`

It must not exist until the official testnet manifest exists and all eight required journeys have passed. Repository CI verifies that missing live infrastructure remains visibly BLOCKED rather than being converted into a synthetic PASS.

## Repository readiness verification

Run:

```bash
python3 scripts/verify-swap-audit-8-testnet-readiness.py
```

Before public testnet launch the expected result is:

```text
SWAP_AUDIT_8_READINESS=BLOCKED_OFFICIAL_TESTNET_NOT_LIVE
liveQualificationComplete=false
```

That is a successful **readiness/harness** result, not successful SWAP-AUDIT-8 live qualification.

## Exit criterion

SWAP-AUDIT-8 becomes COMPLETE only when all required live journeys are PASS on one exact production-equivalent testnet release candidate and durable sanitized evidence is retained. Only then may SWAP-AUDIT-9 begin.

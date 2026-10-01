# 420Exchange PRE-10 — Exchange read API / Indexer adapter and startup composition qualification

**Canonical roadmap:** `docs/420EXCHANGE-PRE-TESTNET-COMPLETION-ROADMAP.md`  
**Step:** PRE-10 — Exchange read API / Indexer adapter and startup composition  
**Completion state:** COMPLETE  
**Qualification level:** Level 1 step-specific + Level 2 API/projection integration milestone  
**Audit branch / PR:** `audit/exchange-pretestnet-phase-20260930` / PR #430  
**Audit base SHA:** `4d0ede3692efe55f04a50c7bf5b749afe579eccb`  
**Qualified implementation SHA:** `46e97d69a51deaad9460f9145735ee1cf96f658a`  
**Current repository `main` observed at implementation closeout:** `df8f639d8f43b763298c8750ef49d3e5849c597c`

## Canonical requirement disposition

| Requirement | Disposition |
| --- | --- |
| Serve GET `/v13/markets/{subjectId}/snapshot` | SATISFIED — repository-owned Exchange read service implements the exact browser route with Exchange API 13.6 headers/envelope. |
| Serve GET `/v13/history` | SATISFIED — versioned bounded history endpoint supports kind, subject, activeOnly, cursor and 1..100 limit semantics. |
| Required version headers/envelopes | SATISFIED — all responses carry `x-420-api-major: 13` and `x-420-api-minor: 6`; snapshot/history use explicit V13.6 schemas. |
| Exact mapping from qualified 420Indexer/public chain projections | SATISFIED — generic 420Indexer V1 protocol-event DTOs are mapped through an explicit event→Exchange history projection and V13 canonical provenance record identity. |
| Preserve provenance/canonicality/finality/freshness/pagination/record IDs/reorg replacement | SATISFIED — records carry Indexer source provenance, non-authoritative marker, canonical/orphaned state, per-record finality/freshness, query-bound cursors, V13 provenance-derived IDs and durable replacement links after rollback. |
| Indexed projections never become settlement authority | SATISFIED — returned DTOs set `authoritative:false`; catalogue and Indexer records are display/reconciliation projections only. |
| Define market/asset/route catalogue source and display-only qualification | SATISFIED — versioned repository catalogue explicitly models all three domains and permits only display-only/unqualified metadata states. |
| Explicit RPC/indexer/storage/API startup composition | SATISFIED — `npm start -- <config>` composes RPC chain verification, Indexer HTTP source, file-backed projection storage, catalogue and HTTP server from one config. |
| Health/readiness and graceful shutdown | SATISFIED — `/health`, `/ready`, dependency readiness, SIGINT/SIGTERM drain/close and storage flush are implemented. |
| Browser/server same contract suite | SATISFIED — read-service integration tests instantiate the actual browser `ExchangeClient` against the server. |
| Fixture-independent integration tests | SATISFIED — tests build in-memory qualified projections and temporary runtime configuration rather than consuming checked-in browser fixtures. |
| Fault injection: duplicate/delayed/reorg/source rollback/fee/beneficiary/stale | SATISFIED — all specified cases are covered and fail closed where conflicting. |

## Repository-owned Exchange read service

PRE-10 adds:

`exchange/read-service/`

with executable package scripts:

- `npm run check`
- `npm test`
- `npm start -- <config>`

The service closes the historical mismatch where the browser consumed Exchange V13 while generic 420Indexer exposed V1.

It does **not** change 420Indexer into an Exchange API and does not point the browser directly at generic V1.

## 420Indexer adapter boundary

`IndexerHttpProjectionSource` consumes only the documented generic V1 public surfaces:

- `GET /ready?chainId=...`
- `GET /v1/status?chainId=...`
- `GET /v1/protocols/events?...protocol=420Exchange`
- `GET /v1/protocols/events?...protocol=420Bridge`

Responses must:

- be JSON;
- carry `apiVersion: v1`;
- satisfy the configured chain;
- remain public read projections.

The Exchange adapter then performs an explicit mapping into V13 DTOs.

### Canonical record identity

History record IDs are derived using the existing V13 provenance model:

`keccak256(abi.encode(chainId, blockHash, transactionHash, logIndex))`

rather than an adapter-specific surrogate hash.

This preserves the on-chain `ExchangeMarketDataTypes420.recordId` identity model.

### Projection mapping

Supported canonical event families include:

- atomic/native path execution -> `TRADE`;
- limit-order fill -> `FILL`;
- limit-order/order nonce cancellation -> `CANCELLATION`;
- outbound bridge initiation -> `BRIDGE_WITHDRAWAL`;
- inbound bridge acceptance -> `BRIDGE_DEPOSIT`;
- Exchange fee settlement/routing -> `FEE_ROUTING`;
- route updates -> `ROUTE_STATE`.

Unknown events do not get invented into a DTO.

## Canonicality and rollback semantics

The projection store retains previously observed record IDs.

On source rollback:

- disappeared canonical records become `active:false`;
- canonicality becomes `orphaned`;
- provenance is retained.

If the same semantic event reappears with a new provenance record ID, the prior record remains queryable and receives:

`replacedBy = <new canonical recordId>`

This keeps reorg/replacement history inspectable rather than deleting or overwriting source evidence.

Duplicate record IDs with conflicting payloads fail closed.

Semantic fee and beneficiary conflicts also fail closed rather than choosing one projection.

## Finality and freshness

Per-record finality is derived against the Indexer safe head when available.

Projection freshness is copied from Indexer runtime stale-state metadata.

Market snapshots are marked `stale` when the Indexer reports stale ingestion.

No freshness/canonicality marker upgrades a projection into execution or settlement authority.

## Market/asset/route catalogue

`config/catalogue.example.json` defines the source schema for:

- markets;
- assets;
- routes.

Allowed qualification states are explicit display-only states:

- `DISPLAY_ONLY_UNQUALIFIED`
- `DISPLAY_ONLY_QUALIFIED_METADATA`
- `DISABLED`

The checked-in example is non-executable repository metadata.

Catalogue health fields cannot manufacture route/settlement authority. Unqualified entries force route/settlement health false in snapshots.

## V13 snapshot behavior

Market snapshots preserve:

- market subject ID;
- source snapshot ID when an indexed `SnapshotApplied` projection exists;
- indexed canonical head;
- canonical/stale state;
- catalogue label/base/quote metadata;
- observed timestamp;
- display-only qualification;
- explicit non-authoritative provenance.

The adapter does not invent prices, bid/ask, liquidity or volume where generic Indexer projections do not supply them. Those fields remain `null`.

## V13 history behavior

History supports:

- bounded page size 1..100;
- query-bound opaque cursors;
- kind filter;
- optional subject filter;
- activeOnly;
- canonical + orphaned records where requested;
- stable record IDs;
- replacement linkage;
- chain/block/transaction/log provenance;
- finality and freshness metadata;
- explicit `authoritative:false`.

## Startup composition

`src/start.mjs` and `src/startup.mjs` compose the process from one config.

The configured components are:

1. 420Indexer V1 HTTP projection source;
2. RPC endpoint used for chain identity/availability verification;
3. file-backed projection/reorg store;
4. versioned market/asset/route catalogue;
5. Exchange V13 HTTP server.

No hidden factory wiring is required after configuration.

The example config is:

`exchange/read-service/config/local.example.json`

## Health/readiness

`GET /health` reports process/API liveness.

`GET /ready` requires:

- Indexer readiness;
- RPC chain health;
- readable/writable projection storage;
- non-empty catalogue.

Stale/non-ready Indexer state produces non-ready service state.

## Graceful shutdown

SIGINT/SIGTERM handling:

- stops accepting HTTP requests by closing the server;
- flushes projection state;
- enforces a bounded shutdown timeout.

A fixture-independent integration test starts the complete local process on an ephemeral port and shuts it down cleanly.

## Principal files

- `exchange/read-service/package.json`
- `exchange/read-service/src/catalogue.mjs`
- `exchange/read-service/src/indexer-source.mjs`
- `exchange/read-service/src/projection-store.mjs`
- `exchange/read-service/src/projection.mjs`
- `exchange/read-service/src/service.mjs`
- `exchange/read-service/src/http.mjs`
- `exchange/read-service/src/startup.mjs`
- `exchange/read-service/src/start.mjs`
- `exchange/read-service/config/catalogue.example.json`
- `exchange/read-service/config/local.example.json`
- `exchange/read-service/test/contract.test.js`
- `exchange/read-service/test/projection.test.js`
- `exchange/read-service/test/startup.test.js`
- `exchange/read-service/test/faults.test.js`
- `exchange/read-service/scripts/check-pre10.mjs`
- `.github/workflows/exchange-web.yml`

No 420Indexer source modification was required.

## Level 1 qualification

Exact implementation SHA:

`46e97d69a51deaad9460f9145735ee1cf96f658a`

**420Exchange Web Verification**

- run `36802037691`
- run number `730`
- event: `pull_request`
- exact head: `46e97d69a51deaad9460f9145735ee1cf96f658a`
- **SUCCESS**

Successful exact-head checks included:

- retained quote-service static/unit/HTTP checks;
- retained quote-service secret scan;
- retained order-service static/unit/HTTP checks;
- PRE-10 read-service static checks;
- PRE-10 read-service browser/server contract and integration tests;
- complete 420Indexer build/test suite as the directly affected shared dependency;
- retained Exchange web static checks;
- retained Exchange web unit/integration suite;
- deployable browser artifact build/verification;
- retained PRE-02 Chromium acceptance;
- retained PRE-03 Chromium acceptance;
- frontend secret scan.

### Earlier development run

Run `36801996581` / #728 failed at the newly added PRE-10 static check because that check searched for a literal route string while the implementation defined the route as a regular expression. The route implementation itself was present. The static verifier was corrected to check the actual source form; no production requirement or test was weakened.

Because downstream steps were skipped, run #728 is not qualification evidence.

## Fault and adversarial qualification

PRE-10 tests cover:

- duplicate identical events;
- duplicate record ID with conflicting payload;
- delayed/stale Indexer state;
- source rollback;
- replacement after rollback;
- query/cursor mismatch;
- orphan filtering;
- fee conflicts;
- beneficiary conflicts;
- unqualified catalogue data;
- missing readiness;
- wrong/missing API composition;
- startup/shutdown behavior.

## Level 2 API/projection integration milestone

**COMPLETE.**

PRE-10 closes a material shared dependency for PRE-07 and PRE-09.

The exact-head workflow validates together:

`420Indexer V1 -> Exchange adapter/store -> Exchange V13 server -> actual browser ExchangeClient`

alongside the accumulated Exchange application suite.

No repository-wide Level 3 closeout was performed.

## Exit criterion

> browser ExchangeClient and the server adapter pass the same versioned contract suite; service can be started locally from configuration without hidden manual wiring.

**SATISFIED.**

The real browser client passes against the executable server in integration tests, while local startup composes RPC, Indexer, storage, catalogue and API from a single config.

## Current-main divergence / Level 3

At implementation closeout current `main` was:

`df8f639d8f43b763298c8750ef49d3e5849c597c`

The audit branch was 229 commits ahead and 80 commits behind `main`, with merge base:

`4d0ede3692efe55f04a50c7bf5b749afe579eccb`

Full reconciliation remains intentionally deferred to PRE-12.

Deferred Level 3 work includes repository-wide Solidity/Genesis, 420 Integrated, applicable Geth, Docs/global reconciliation, final deployment/config reconciliation and the exact accumulated merge-candidate qualification.

PR #430 remains draft and unmerged.

## Next canonical roadmap step

**PRE-11 — CI/security/packaging/operations closure.**

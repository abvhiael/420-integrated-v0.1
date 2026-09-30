# 420Exchange — pre-testnet engineering completion roadmap

**Reconciled:** 2026-09-30. **Scope:** all engineering/integration work that can be completed before an operational 420 public testnet exists. **Repository baseline:** PR #352 is merged; V15.1–V15.11 implementation primitives and qualification scaffolding are on `main`. This roadmap does **not** authorize live trading and deliberately keeps swap/order/cancel/bridge submission hard-off until the separate live-testnet gates are satisfied.

## Completion objective

The pre-testnet phase is complete when 420Exchange has a coherent, offline-testable production architecture in which:

1. Exchange read data is served through an explicit versioned Exchange API adapter rather than by assuming the generic 420Indexer `/v1` surface is compatible with the browser's `/v13` contract.
2. Executable swap quotes come from a real versioned backend contract with cryptographically/verifiably bound producer identity and intent, not caller-supplied trust flags.
3. Browser review/orchestration binds one wallet/session, one authenticated quote, one deployment/router/token set, one canonical raw-unit transaction and one fingerprint, with deterministic invalidation on any relevant change.
4. Limit-order publication/cancellation and bridge lifecycle architecture are fully integrated against mock/offline services and canonical schemas.
5. All services have explicit startup/configuration, hard-off production defaults, reproducible packaging, failure/recovery runbooks and exact-head CI.
6. The repository can be handed to the live-testnet phase without additional greenfield application architecture.

The pre-testnet phase does **not** require real testnet addresses, real contract bytecode at deployed addresses, real wallet transactions, live bridge proofs or real settlement receipts. Those are deliberately deferred to the live qualification phase.

## Current baseline

Already implemented/merged:

- V14 read-only market/order/bridge/portfolio UI and wallet/session foundations;
- V15.1 deployment/runtime binding model;
- V15.2 canonical raw-unit transaction/order/bridge builders;
- V15.3 preflight primitives;
- V15.4 guarded Wallet execution primitives;
- V15.5 transaction lifecycle model;
- V15.6–V15.8 live-testnet qualification harnesses;
- V15.9 Wallet/provider compatibility primitives;
- V15.10 closeout/gate framework;
- V15.11 browser Wallet selection, canonical swap review construction, quote intake, stale-response invalidation and read-only candidate review;
- simulated Chromium acceptance for provider replacement, account/chain invalidation, stale response suppression and V14 execution containment.

Known architecture gaps that remain on `main`:

- browser `ExchangeClient` expects GET `/v13/markets/{subjectId}/snapshot` and `/v13/history`, while the generic 420Indexer HTTP API exposes a different GET `/v1` contract;
- no repository-owned executable quote producer currently satisfies POST `/executable-swap-quote`;
- current quote intake validates shape/freshness but does not establish authenticated producer provenance;
- runtime network/API/quote endpoint values are intentionally unresolved;
- V15 execution primitives exist but are not yet composed into a single trusted browser orchestration path;
- order publication/cancellation and bridge settlement still need complete service/UI integration around their already-built canonical primitives;
- service bootstrap, operational packaging and complete exact-head pre-testnet closeout remain incomplete.

## Roadmap

### PRE-01 — source inventory and trust-boundary reconciliation — COMPLETE

Completed by the existing PRE-01 audit package:

- `docs/420EXCHANGE-PRE-01-CLOSEOUT.md`
- `docs/420EXCHANGE-PRE-01-SOURCE-AND-TRUST-INVENTORY.md`
- `docs/420EXCHANGE-PRE-01-API-INDEXER-INTERFACE-RECONCILIATION.md`

PRE-01 established the authoritative boundary between display projections, review candidates, future authenticated execution quotes, reviewed transactions and canonical chain settlement.

**Exit:** complete.

---

### PRE-02 — Wallet identity, request-generation and invalidation closure — COMPLETE

Finish the V15 Wallet/session controller as the sole future execution identity.

Required work:

- make the selected V15 provider/session the only source of account, chain and session generation for execution-capable flows;
- invalidate quote requests, review candidates, preflight results and proposed confirmations when account, chain, provider, deployment, route, recipient, amount or relevant input changes;
- guarantee superseded async responses cannot restore review/execution state;
- dispose listeners/controllers deterministically across navigation and remount;
- keep V14 display surfaces unable to create or reuse execution authority;
- add deterministic browser/DOM tests for reconnect, route change, input mutation, navigation, slow-response and abort-ignored races.

**Exit:** one documented execution identity model; all stale work is deterministically invalidated; signing/submission still hard-off.

Dependencies: none beyond current V15.11.

---

### PRE-03 — production-quality read-only swap entry and review UX — COMPLETE

Replace the developer-style raw-address entry with a metadata-driven, non-executable review flow.

Required work:

- populate token/market choices only from qualified configured metadata;
- preserve canonical raw units while presenting decimal/display values;
- show chain, token addresses, router/spender, route/path, exact input, minimum net output, fees, recipient, quote ID, expiry and transaction fingerprint;
- expose full untruncated critical identifiers on demand;
- distinguish fixture/display-only data from authenticated execution-quote data;
- implement loading, empty, stale, malformed and dependency-failure states;
- complete keyboard, focus, screen-reader and narrow-screen behavior;
- test decimals/rounding, malformed amounts, duplicate assets, recipient mismatch, wrong chain, oversized routes and stale-review invalidation.

**Exit:** SATISFIED at implementation SHA `0caf93beaad9e97081250b18b7b296f8ec09c913`. The review entry is metadata-driven and fail-closed, decimal display values are converted exactly to canonical raw units, the DOM exposes the canonical chain/assets/router/route/input/minimum/fees/recipient/quote/expiry/fingerprint without truncation, unauthenticated candidate provenance is explicit, stale/malformed/dependency states fail closed, and no signing/submission action exists on this path. Level 1 420Exchange Web Verification run `36782695570` passed all retained unit/static/build/PRE-02 checks plus PRE-03 Chromium acceptance and the frontend secret scan. Durable evidence: `docs/420EXCHANGE-PRE-03-QUALIFICATION.md`.

Dependencies: PRE-02.

---

### PRE-04 — Exchange executable quote backend and schema — TODO / CRITICAL

Build the missing repository-owned executable quote producer.

Required work:

- define versioned POST `/executable-swap-quote` request/response/error schemas;
- bind chain, deployment/manifest identity, account, token metadata, market/route/path, exact raw input/output, fee components, net minimum, recipient, router/spender, calldata/value or builder inputs, quote ID, issue/expiry time and replay domain;
- derive quotes from an explicit route/market source rather than browser display snapshots;
- reject wrong-chain, unsupported route, stale inputs, invalid token metadata, malformed raw units, unavailable dependencies and resource-abuse cases;
- add bounded request/response sizes, rate-limit hooks, redacted logs and deterministic error classes;
- implement provider-neutral route/chain adapters so live sources can be plugged in later;
- define key/signer rotation without embedding production keys;
- provide offline deterministic test vectors and mock-chain fixtures.

**Exit:** a tested backend service can emit a complete, deterministic execution quote under mock/offline dependencies; live chain qualification remains deferred.

Dependencies: PRE-10 data/source contract can be developed in parallel.

---

### PRE-05 — quote authenticity, provenance and replay protection — TODO / CRITICAL

Replace trust flags with verifiable quote provenance.

Required work:

- define the canonical signed/authenticated quote envelope;
- pin producer identity/key/version and allowed key-rotation rules;
- bind quote signature/authentication to every execution-critical field;
- domain-separate chain, Exchange service, deployment/router, account, quote ID and expiry;
- reject unsigned, forged, replayed, cross-chain, cross-router, cross-account and endpoint-substituted quotes;
- bind the browser-reviewed transaction fingerprint to the authenticated quote;
- fail closed if extra or omitted critical fields would change execution meaning;
- define quote revocation/expiry semantics and operator key rollover handling;
- provide deterministic signing/verification test vectors.

**Exit:** browser/client can independently verify quote origin and exact intent offline; no caller-provided `sourceAuthenticated`/equivalent flag can upgrade trust.

Dependencies: PRE-04.

---

### PRE-06 — guarded swap orchestration — PARTIAL / CRITICAL

Compose the existing V15 primitives into one browser execution pipeline while leaving submission disabled.

Required architecture:

`wallet/session -> authenticated quote -> canonical builder -> human review -> explicit confirmation object -> fresh preflight -> guarded wallet call -> lifecycle tracker`

Required work:

- implement one orchestrator/state machine for the complete swap review lifecycle;
- require PRE-05-authenticated quote provenance;
- perform a fresh generation/account/chain/fingerprint check immediately before the disabled submit boundary;
- model approval/permit as a separate reviewed authorization;
- invalidate review after any relevant state change;
- integrate lifecycle states: prepared, awaiting confirmation, submitted, pending, confirmed, reverted, replaced, dropped, reorged, indexer-delayed/conflicting;
- ensure transaction hash alone never becomes success/settlement;
- add mock RPC/provider end-to-end tests for rejection, timeout, replacement, reorg, stale nonce, gas change and indexer delay;
- keep the final Wallet send function behind an independent default-OFF gate.

**Exit:** full swap path is testable end-to-end with mocks and deterministic state transitions; real sends remain impossible by default.

Dependencies: PRE-02, PRE-03, PRE-04, PRE-05.

---

### PRE-07 — limit-order publication lifecycle — PARTIAL

Complete the off-chain order service/integration around the existing EIP-712 primitives.

Required work:

- define versioned order publication/status API;
- validate signer, domain, chain, market, maker, recipient, nonce, expiry, sell/min-buy raw units and partial-fill constraints;
- make publication idempotent by canonical order hash;
- preserve distinct `signed`, `published`, `accepted`, `partially-filled`, `filled`, `cancel-pending`, `cancelled`, `expired` and `rejected` states;
- integrate browser review without enabling real signing by default;
- test duplicate publication, wrong signer/domain, expiry, provider/account switch, stale order state and conflicting fill data.

**Exit:** complete mock service-backed creation/publication/status lifecycle with canonical order identity; live signature/publication deferred.

Dependencies: PRE-02, PRE-10; PRE-05-style provenance principles apply to service responses.

---

### PRE-08 — maker-only cancellation integration — PARTIAL

Complete cancellation semantics across off-chain and on-chain paths.

Required work:

- distinguish off-chain order withdrawal from on-chain nonce/hash cancellation;
- verify current maker identity and remaining amount before preparing cancellation;
- require fresh state immediately before the guarded send boundary;
- bind cancellation review to exact order hash/nonce/account/chain;
- model racing fill, duplicate cancel, rejected/reverted/replaced/reorged outcomes;
- prohibit cross-account cancellation and stale maker state;
- add mock settlement/indexer conflict tests.

**Exit:** cancellation is deterministic and mock-E2E qualified; sends remain hard-off.

Dependencies: PRE-07.

---

### PRE-09 — bridge proof and destination-settlement architecture — PARTIAL

Finish the offline-testable cross-chain lifecycle.

Required work:

- define canonical route/adapter/verifier/manifest identity;
- separate source submission, source finality, proof availability, proof verification, destination claim and destination finality;
- implement provider-neutral proof-provider interface;
- bind beneficiary, source/destination chain, asset representation, amount and replay domain;
- model pause, expiry, proof invalidation, reorg, refund/recovery and retry-safe states;
- persist/reconcile bridge lifecycle through indexed events;
- add two-chain mock/offline E2E fixtures proving correct beneficiary payout state and replay rejection.

**Exit:** complete mockable source-to-destination state machine; real bridge submission/proof/payout deferred.

Dependencies: PRE-10 projection/API contract.

---

### PRE-10 — Exchange read API / Indexer adapter and startup composition — PARTIAL / CRITICAL

Close the current `/v1` versus `/v13` mismatch.

Required work:

- implement a repository-owned Exchange-specific projection/API service or adapter that actually serves:
  - GET `/v13/markets/{subjectId}/snapshot`
  - GET `/v13/history`
  - required version headers/envelopes;
- define exact mapping from qualified 420Indexer/public chain projections into Exchange V13 DTOs;
- preserve provenance, canonicality, finality/freshness, pagination, record IDs and reorg replacement semantics;
- never convert non-authoritative indexed projections into settlement authority;
- define market/asset/route catalogue source and explicit display-only qualification states;
- implement explicit startup/bootstrap for the required RPC/indexer/storage/API composition rather than only exporting factories;
- provide health/readiness semantics and graceful shutdown;
- add browser/server contract tests and fixture-independent integration tests;
- fault-inject duplicate/delayed/reorged events, source rollback, fee/beneficiary conflicts and stale projections.

**Exit:** browser ExchangeClient and the server adapter pass the same versioned contract suite; service can be started locally from configuration without hidden manual wiring.

Dependencies: existing 420Indexer. Can proceed in parallel with PRE-04.

---

### PRE-11 — CI, security, packaging and operations closure — PARTIAL

Turn the pre-testnet architecture into a reproducible release candidate.

Required work:

- dedicated tests for quote backend, Exchange API adapter, browser DOM, order/cancel services, bridge lifecycle and cross-layer integration;
- exact-head Exchange Web + relevant backend/contract + 420Docs + 420 Integrated qualification;
- deterministic builds/artifact metadata for browser and new services;
- secret scan and log-redaction checks;
- CSP/CORS/origin and credential-policy validation;
- hard assertion that swap/order/cancel/bridge live submit gates default OFF;
- threat tests for forged quotes, replay, endpoint substitution, approval confusion, stale provider/session and oversized hostile payloads;
- startup/degradation/restart tests;
- runbooks for quote signer rotation, service outage, indexer backfill, emergency pause, rollback and reconciliation;
- machine-readable pre-testnet readiness manifest listing unresolved LIVE GATES.

**Exit:** every pre-testnet component is reproducibly buildable/testable from a clean checkout and fails closed without live deployment data.

Dependencies: PRE-02 through PRE-10.

---

### PRE-12 — pre-testnet release candidate, reconciliation and handoff — TODO

Create the final offline-qualified Exchange candidate.

Required work:

1. reconcile the completed PRE branch with latest `main`;
2. perform a final gap audit against PRE-01 through PRE-11;
3. ensure no required pre-testnet implementation item remains PARTIAL/TODO;
4. verify all real trading actions remain disabled by default;
5. run the complete exact-head retained qualification suite;
6. record exact source SHA, artifacts, schemas and service versions;
7. enumerate each remaining LIVE GATE with owner, required endpoint/account/configuration, expected evidence and rollback procedure;
8. update the main Exchange status roadmap from pre-testnet engineering to live-testnet qualification;
9. merge only after exact-head checks are green.

**Exit:** `PRE_TESTNET_ENGINEERING_COMPLETE` / `LIVE_TESTNET_QUALIFICATION_PENDING`.

At PRE-12 completion there should be **no further application architecture or missing integration service that can reasonably be built without a live network**.

## Recommended execution order

The work should be completed in this dependency order:

1. **PRE-02** Wallet/session invalidation closure.
2. **PRE-03** read-only review UX.
3. **PRE-04 and PRE-10 in parallel** — executable quote backend and Exchange read/API adapter are the two largest missing service layers.
4. **PRE-05** authenticated quote provenance once PRE-04 has a stable schema.
5. **PRE-06** compose the swap orchestration against PRE-02/03/04/05.
6. **PRE-07 + PRE-08** finish order publication/cancellation.
7. **PRE-09** finish bridge lifecycle/service architecture.
8. **PRE-11** whole-stack CI/security/packaging/operations.
9. **PRE-12** final reconcile, exact-head qualification and handoff to live testnet.

PRE-04 and PRE-10 are the critical path. Until those two services exist, the browser has neither a compatible production read surface nor a trustworthy execution-quote source.

## Deferred live-testnet qualification

The following are **not** pre-testnet engineering blockers and must remain deferred until the testnet exists:

- real chain ID/genesis/RPC endpoints;
- actual deployed Exchange contract addresses and code hashes;
- live token/route/market/bridge configuration;
- authenticated quotes derived from live chain/route state;
- actual balances, allowances, gas, nonce and simulation against deployed contracts;
- real Wallet extension/mobile/device matrix;
- swap submission and canonical receipt/finality;
- live order sign/publication/fill/cancel;
- real bridge source transaction, proof, destination claim and beneficiary payout;
- live 420Indexer/fee/treasury reconciliation;
- DNS/TLS/public hosting qualification;
- operator/security approval and final Genesis go/no-go.

Those belong to the subsequent testnet qualification roadmap and must not be fabricated with mocks or placeholders.

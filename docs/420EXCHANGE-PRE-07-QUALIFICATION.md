# 420Exchange PRE-07 — limit-order publication lifecycle qualification

**Canonical roadmap:** `docs/420EXCHANGE-PRE-TESTNET-COMPLETION-ROADMAP.md`  
**Step:** PRE-07 — limit-order publication lifecycle  
**Completion state:** COMPLETE  
**Qualification level:** Level 1 step-specific  
**Audit branch / PR:** `audit/exchange-pretestnet-phase-20260930` / PR #430  
**Audit base SHA:** `4d0ede3692efe55f04a50c7bf5b749afe579eccb`  
**Qualified implementation SHA:** `0427c805703ae34c9a1deba4669e3f714a55e874`  
**Current repository `main` observed at implementation closeout:** `df8f639d8f43b763298c8750ef49d3e5849c597c`

## Canonical requirements and disposition

| Requirement | Disposition |
| --- | --- |
| Versioned order publication/status API | SATISFIED — repository-owned `exchange/order-service` serves POST `/v1/orders` and GET `/v1/orders/{orderHash}`, with explicit request/status schemas and version headers. |
| Validate signer/domain/chain/market/maker/recipient/nonce/expiry/raw units/partial-fill policy | SATISFIED — canonical order/domain validation is shared with the browser; server-side configured signature verification must recover the maker; chain/domain/market/addresses/nonce/expiry/uint128 raw amounts and explicit partial-fill policy fail closed. |
| Idempotent publication by canonical order hash | SATISFIED — publication is keyed by the same `hashOrder` ABI semantics used by `ExchangeLimitOrderSettlement420`; duplicate publication returns the existing record without resetting lifecycle state. |
| Preserve required lifecycle states | SATISFIED — `signed`, `published`, `accepted`, `partially-filled`, `filled`, `cancel-pending`, `cancelled`, `expired`, and `rejected` are explicit and retained in state/history. |
| Browser review without live signing by default | SATISFIED — the browser builds the exact EIP-712 review/digest and can attach an externally signed mock artifact, but the PRE-07 publication controller never invokes `eth_signTypedData_v4`. The low-level order signer now has an independent default-OFF capability gate. |
| Required adversarial tests | SATISFIED — duplicate publication, wrong signer, wrong domain/chain, expiry, provider/account switch, stale/regressing projection, forbidden partial fills, conflicting fill economics, endpoint substitution and provenance mismatch are covered. |

## Implementation summary

PRE-07 introduces a repository-owned off-chain limit-order service and browser publication lifecycle around the existing EIP-712 primitives.

### Canonical identity

`exchange/web/core/limit-order-identity.js` implements the exact order struct/domain hashing model corresponding to `ExchangeLimitOrderSettlement420`:

- EIP-712 name: `420Exchange Limit Orders`
- version: `1`
- configured chain ID
- configured settlement contract
- canonical `LimitOrder` fields
- Solidity-compatible `hashOrder`
- EIP-712 order digest

The order service imports that shared identity module rather than maintaining a second hash implementation.

### Publication service

`exchange/order-service` provides:

- POST `/v1/orders`
- GET `/v1/orders/{orderHash}`
- bounded JSON request parsing
- deterministic JSON error classes
- canonical order validation
- server-configured signature-verifier boundary
- canonical-hash idempotency
- monotonic fill-state reconciliation
- explicit service/version/order/revision provenance
- status revision/history preservation

Publication responses are projections and never become chain settlement authority.

### Browser publication lifecycle

`LimitOrderPublicationController` composes:

`wallet/session -> canonical EIP-712 review -> externally signed artifact -> guarded mock publication -> status lifecycle`

The controller binds the review to the PRE-02 wallet/session generation and invalidates it after provider/account/chain/runtime authority changes.

It does not call a wallet signing method.

### Independent default-OFF gates

Checked-in runtime pins:

- `execution.orderSigning = DISABLED_PRETESTNET`
- `execution.orderPublication = DISABLED_PRETESTNET`

Low-level wallet signing additionally requires an explicit named capability:

- default: `DISABLED`
- `PRE07_MOCK` for deterministic qualification
- `LIVE_TESTNET_QUALIFICATION` only for the pre-existing dedicated live-testnet qualification harness

Order publication likewise requires an independent named publication capability; the default is disabled.

## Principal files

- `exchange/order-service/package.json`
- `exchange/order-service/schemas/order-publication-v1.json`
- `exchange/order-service/schemas/order-status-v1.json`
- `exchange/order-service/src/canonical.js`
- `exchange/order-service/src/order-store.js`
- `exchange/order-service/src/http.js`
- `exchange/order-service/src/index.js`
- `exchange/order-service/test/publication.test.js`
- `exchange/order-service/test/http.test.js`
- `exchange/order-service/scripts/check-pre07.mjs`
- `exchange/web/core/limit-order-identity.js`
- `exchange/web/core/order-publication-client.js`
- `exchange/web/core/limit-order-publication-controller.js`
- `exchange/web/core/wallet-execution.js`
- `exchange/web/core/browser-execution-controller.js`
- `exchange/web/core/live-limit-order-qualification.js`
- `exchange/web/test/pre07-limit-order-publication.test.js`
- `exchange/web/test/order-publication-client.test.js`
- `exchange/web/test/wallet-execution.test.js`
- `exchange/web/scripts/check-pre07.mjs`
- `exchange/web/runtime-config.json`
- `.github/workflows/exchange-web.yml`

## Level 1 qualification

Exact implementation SHA:

`0427c805703ae34c9a1deba4669e3f714a55e874`

Required app-specific workflow:

- **420Exchange Web Verification**
- run `36796142524`
- run number `668`
- event: `pull_request`
- exact head: `0427c805703ae34c9a1deba4669e3f714a55e874`
- **SUCCESS**

Successful exact-head checks included:

- PRE-04/PRE-05 quote backend static/unit/HTTP checks
- quote backend secret scan
- PRE-07 order-service static checks
- PRE-07 order-service unit and HTTP integration tests
- Exchange web static checks including PRE-06/PRE-07
- full Exchange web unit/integration suite
- explicit default-OFF order-signing test
- duplicate/wrong-signer/domain/expiry/provider-switch/stale/conflicting-fill PRE-07 coverage
- browser artifact build/verification
- retained PRE-02 Chromium acceptance
- retained PRE-03 Chromium acceptance
- frontend secret scan

## PRE-05-style service provenance

Order-service responses carry an explicit service identity, versioned schema, canonical order hash, monotonic revision and observation time. The browser accepts publication/status data only from the configured same-origin HTTPS endpoint and re-derives canonical order identity before accepting a response.

These off-chain records remain non-authoritative projections; they are not promoted into settlement authority. Live service deployment/authentication remains part of the later live-testnet/operations gates.

## Level 2 milestone status

**Not required for PRE-07 alone.**

PRE-07 introduces the publication service boundary, but the natural broader order-lifecycle integration milestone is PRE-08, where maker-only cancellation and racing fill/cancel semantics converge with this publication/status lifecycle. The retained Exchange suite was run at Level 1; no redundant broader app-phase reconciliation was performed.

## Exit criterion

> complete mock service-backed creation/publication/status lifecycle with canonical order identity; live signature/publication deferred.

**SATISFIED.**

The browser can build an exact canonical order review, attach a deterministic externally signed fixture, publish it through the mock/offline versioned service, preserve canonical identity and idempotency, and reconcile the complete PRE-07 status vocabulary. Real signing and publication remain independently disabled by default.

## Current-main divergence review

At implementation closeout current `main` was:

`df8f639d8f43b763298c8750ef49d3e5849c597c`

The 80 commits between the audit base and current `main` remain confined to Compute Market work and shared non-Exchange qualification workflows. They do not modify `exchange/web/**`, `exchange/order-service/**`, `exchange/quote-service/**` or `.github/workflows/exchange-web.yml`.

Full reconciliation remains intentionally deferred to PRE-12.

## Level 3 app-phase status

**Deferred to PRE-12.**

Repository-wide Solidity/Genesis qualification, 420 Integrated, Geth where applicable, Docs/global reconciliation, final deployment/config reconciliation and final exact-head monolithic merge-candidate qualification remain PRE-12 responsibilities.

## Limitations / deliberately deferred work

- live EIP-712 wallet signing remains disabled;
- live public order-service deployment/publication remains disabled;
- real testnet signature recovery/provider integration remains a live qualification gate;
- PRE-08 owns maker-only cancellation semantics and racing fill/cancel behavior;
- PRE-10 owns the production Exchange read/indexer projection adapter;
- PRE-11 owns complete service startup/packaging/security/operations closure;
- PR #430 remains draft and unmerged.

## Next canonical roadmap step

**PRE-08 — maker-only cancellation integration.**

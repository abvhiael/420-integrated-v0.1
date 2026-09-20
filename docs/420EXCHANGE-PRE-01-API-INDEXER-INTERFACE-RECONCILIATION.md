# 420Exchange PRE-01 — API/indexer interface reconciliation

**Audit date:** 2026-09-19. **Original working branch:** `feature/420exchange-v15.1-testnet-binding`, PR #352. **Basis:** inspected source files, not deployment or live responses. Companion: [PRE-01 inventory](420EXCHANGE-PRE-01-SOURCE-AND-TRUST-INVENTORY.md). **Status: PARTIAL** pending identification and validation of an Exchange-specific HTTP producer and route adapter; this does not establish the absence of a service in another repository.

Source-code references in this page point to the GitHub repository rather than relative paths outside `docs/`, which MkDocs cannot publish as documentation pages. Links identify repository source; they do not certify a deployed service.

## Located components and actual contracts

1. **420-indexer is a distinct package with source, tests and a build script.** [Package manifest](https://github.com/abvhiael/420-integrated-v0.1/blob/main/420-indexer/package.json) has TypeScript build/tests but no `start` or `serve` script. [Chain source](https://github.com/abvhiael/420-integrated-v0.1/blob/main/420-indexer/src/chain-source.ts) defines RPC-backed blocks, receipts, logs, calls and code reads. [Event canonicality](https://github.com/abvhiael/420-integrated-v0.1/blob/main/420-indexer/src/event-canonicality.ts) models observed/finalized/retracted/superseded events. These building blocks alone do not prove an operating process or Exchange read API.
2. **General indexer public API is not Exchange v13.** [Generic indexer adapter](https://github.com/abvhiael/420-integrated-v0.1/blob/main/420-indexer/src/api-surface.ts) supports blocks, receipts, logs, transfers, protocol events, search and status. [API contract](https://github.com/abvhiael/420-integrated-v0.1/blob/main/420-indexer/src/api-contract.ts) defines GET `/health`, `/ready`, `/v1/status`, `/v1/blocks`, `/v1/transactions`, `/v1/protocols/events`, among others. The consumer list does not name Exchange; this adapter alone does not prove a running listener.
3. **Exchange browser requires another API shape.** [Browser read client](https://github.com/abvhiael/420-integrated-v0.1/blob/main/exchange/web/core/exchange-client.js) requests GET `/v13/markets/{subjectId}/snapshot` and GET `/v13/history`. Its snapshot validates `marketSubjectId`, `snapshotId`, positive `canonicalHead`, and `canonicality`; history validates `records`, `recordId`, `subjectId`, `active`, and `nextCursor`. Client schema header is `14.0` while response compatibility requires Exchange API major 13 and minor <=6. General indexer `/v1` has neither these routes nor these DTOs. **Do not connect its base URL directly to the browser and assume compatibility.**
4. **Executable quote producer remains unverified.** [Quote intake](https://github.com/abvhiael/420-integrated-v0.1/blob/main/exchange/web/core/executable-quote-intake.js) POSTs `420-exchange-swap-quote-request-v1` to configured same-origin HTTPS `.../executable-swap-quote`. It validates `420-exchange-executable-swap-quote-v1`, quote ID, bounded timestamps, account/chain, canonical route, integer raw input/net minimum, and token projection inputs. Accepted result is `REVIEW_CANDIDATE_ONLY`; it does not authenticate source identity. Generic indexer has GET-only routes, not this POST producer. Never manufacture a quote from a market snapshot or a `verified:true` field.
5. **Runtime wiring is unresolved.** [Exchange runtime configuration](https://github.com/abvhiael/420-integrated-v0.1/blob/main/exchange/web/runtime-config.json) has null network/RPC/API URLs and no executable quote URL. Neither `features.swap:true` nor HTTPS proves a qualified trading path. Keep browser signing and sending disabled.

## Cross-layer contract matrix

| Consumer/service | Source contract | Finding | Pre-testnet deliverable |
| --- | --- | --- | --- |
| General indexer | Generic chain reads, query and source interfaces; GET `/v1` | Source exists; no Exchange v13 mapping established | Locate HTTP bootstrap, deployment and persistence/replay; build typed Exchange adapter only after searching for an existing one. |
| Exchange browser | GET `/v13/markets/:id/snapshot` and `/v13/history` | No matching route in general indexer contract; not proof of absence elsewhere | Locate Exchange route handler, DTO, pagination, headers and version; otherwise implement a separate versioned read API. |
| Executable quote intake | POST `.../executable-swap-quote`, canonical swap quote v1 | Generic indexer GET API cannot supply it; producer and signer trust boundary unverified | PRE-04: provider-neutral quote service with authenticated origin and independent state/route dependencies; PRE-05: verify browser envelope. |
| Browser runtime | Null API/RPC and no quote endpoint | Real API-to-browser connection not configured | Bind distinct read API, quote API, chain and manifest; prohibit fixtures for execution. |

## Focused remaining PRE-01 checks (not testnet verification)

- **INV-01A:** Trace separately located Exchange HTTP API/quote producer, boot command, routes, deployment reader, controls and response construction. Search other services/repositories before marking absent.
- **INV-02A:** Trace indexer HTTP/SSE/WebSocket transport, persistence, checkpoint, ingestion/reorg replay and ownership; compare any existing Exchange projection to browser validation.
- **INV-02B:** Define source-of-truth boundaries: generic chain indexer reads are not proof of available liquidity, allowance, or executable route state.
- **INV-05:** Add offline tests rejecting `/v1` versus `/v13` substitution, payload/version mismatch and fixture-backed execution. No guessed execution URLs.

**Disposition:** This completes the general indexer versus Exchange browser contract comparison, not the entire PRE-01 phase. Subsequent work must locate and inspect any Exchange-specific HTTP service and actual indexer bootstrap. No real-send control is enabled and no live-gate state changes.
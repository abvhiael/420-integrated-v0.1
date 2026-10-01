# 420Exchange PRE-03 — production-quality read-only swap entry and review UX qualification

**Canonical roadmap:** `docs/420EXCHANGE-PRE-TESTNET-COMPLETION-ROADMAP.md`  
**Step:** PRE-03 — production-quality read-only swap entry and review UX  
**Completion state:** COMPLETE  
**Qualification level:** Level 1 — per-roadmap-step fast qualification  
**Audit branch / PR:** `audit/exchange-pretestnet-phase-20260930` / PR #430  
**Audit base SHA:** `4d0ede3692efe55f04a50c7bf5b749afe579eccb`  
**Qualified implementation SHA:** `0caf93beaad9e97081250b18b7b296f8ec09c913`  
**Current repository `main` observed at closeout:** `152364d9b69b6d5fe159685fb986c9139e0522cb`

## Canonical requirements and disposition

| Requirement | Disposition |
| --- | --- |
| Populate token/market choices only from qualified configured metadata | SATISFIED — `420-exchange-review-catalogue-v1` requires `QUALIFIED_CONFIG`, `METADATA_ONLY`, non-demo/non-fixture metadata on the runtime chain. Checked-in runtime remains explicitly `UNRESOLVED` with no fabricated live assets/markets. |
| Preserve canonical raw units while presenting decimal/display values | SATISFIED — `parseDisplayUnits()` uses integer arithmetic only, rejects exponent notation/overprecision/zero/uint256 overflow, and derives the request raw units from qualified token decimals. |
| Show chain, token addresses, router/spender, route/path, exact input, minimum net output, fees, recipient, quote ID, expiry and transaction fingerprint | SATISFIED — structured DOM review exposes all fields. Fee disclosure is either canonical and explicit or visibly marked unavailable rather than invented. |
| Expose full untruncated critical identifiers on demand | SATISFIED — full token/router/recipient/quote/path/fingerprint values are rendered; route market/route/token IDs are inspectable in an expandable details surface with no truncation logic. |
| Distinguish fixture/display-only data from authenticated execution-quote data | SATISFIED — review entry rejects fixture/demo metadata; result is labelled `REVIEW CANDIDATE ONLY`, states transport/schema checks do not authenticate producer provenance, and grants no execution authority. PRE-05 remains responsible for authenticated quote provenance. |
| Loading, empty, stale, malformed and dependency-failure states | SATISFIED — explicit busy/status states, unresolved/empty catalogue fail-closed behavior, stale candidate rejection, malformed decimal rejection before transport, and dependency-failure messaging are tested. |
| Keyboard, focus, screen-reader and narrow-screen behavior | SATISFIED — native labelled controls, predictable tab order, ARIA live/status/busy semantics, focus transfer to completed review, details/summary route inspection, and responsive one-column review/entry layouts are covered. |
| Test decimals/rounding, malformed amounts, duplicate assets, recipient mismatch, wrong chain, oversized routes and stale-review invalidation | SATISFIED — dedicated model/DOM tests cover exact decimal conversion, malformed/overprecision values, duplicate asset IDs/addresses and markets, invalid recipient, runtime/catalogue chain mismatch, route-hop bound enforcement, candidate asset substitution and stale/input invalidation. |

## Gap analysis resolved

Before PRE-03, the V15 review panel still behaved like a developer tool: users supplied raw token addresses and integer raw units manually. The browser could display a canonical candidate, but there was no qualified metadata catalogue boundary, no exact decimal-entry model, no complete structured canonical review UI, and incomplete accessibility/failure-state acceptance.

PRE-03 resolves that by:

- adding `exchange/web/core/read-only-swap-entry.js` as the fail-closed metadata and decimal-entry boundary;
- requiring unique qualified asset IDs/addresses and directed review-eligible markets;
- introducing exact decimal-to-raw conversion with integer arithmetic;
- replacing free-form token address/raw-unit entry with a configured market selector, decimal input, decimal minimum output and recipient;
- exposing canonical raw units before requesting the quote;
- rendering a structured review containing chain, full token addresses, router/spender, exact input/minimum, fee disclosure, recipient, quote ID, route commitment, transaction fingerprint, expiry and inspectable full hop identifiers;
- preserving explicit `REVIEW_CANDIDATE_ONLY` provenance language;
- carrying optional canonical fee disclosure through quote intake while marking unavailable fees explicitly when the candidate schema cannot prove them;
- enforcing configured route-hop bounds and selected asset-pair parity before display;
- adding responsive/accessibility styles and browser acceptance;
- retaining the PRE-02 central invalidation boundary and all hard-off execution controls.

## Qualified implementation files

PRE-03 executable/config/test changes included:

- `exchange/web/core/read-only-swap-entry.js`
- `exchange/web/read-only-swap-review-ui.js`
- `exchange/web/core/human-readable-review.js`
- `exchange/web/core/executable-quote-intake.js`
- `exchange/web/runtime-config.json`
- `exchange/web/styles.css`
- `exchange/web/scripts/check-pre03.mjs`
- `exchange/web/scripts/pre03-chromium-acceptance.mjs`
- `exchange/web/test/read-only-swap-entry.test.js`
- `exchange/web/test/read-only-swap-review-ui.test.js`
- `exchange/web/test/human-readable-review.test.js`
- `exchange/web/test/executable-quote-intake.test.js`
- `exchange/web/package.json`
- `.github/workflows/exchange-web.yml`

PRE-02 changes accumulated earlier on the monolithic branch were preserved and requalified by the same Exchange workflow.

## Level 1 qualification

Exact implementation SHA: `0caf93beaad9e97081250b18b7b296f8ec09c913`

Required app-specific workflow:

- **420Exchange Web Verification** — run `36782695570` / run number 483 — **SUCCESS**

Successful steps:

- Static Exchange checks
- Exchange web unit tests
- Build and verify PRE-02 deployable browser artifact
- Chromium browser-test runner installation
- retained PRE-02 simulated EIP-1193 Chromium acceptance
- PRE-02 evidence preservation
- **PRE-03 metadata-driven read-only Chromium acceptance**
- PRE-03 evidence preservation
- Frontend secret scan

The preceding exact-head run `36776087487` failed only in two newly introduced browser-harness expectations: it searched collapsed route details before expanding them and attempted to click a deliberately disabled action after malformed precision. Production static/unit/build/PRE-02 checks had already passed. The harness expectations were corrected without weakening product behavior; run `36782695570` then passed the exact corrected implementation SHA.

## Exit-criterion verification

**DOM review exactly mirrors canonical execution inputs:** SATISFIED. Display fields are projected from the same canonical prepared candidate/raw-unit data, selected metadata must match the candidate asset pair, and route count is bounded before rendering.

**No execution action exists on this path:** SATISFIED. The PRE-03 module contains no `eth_sendTransaction`, `eth_signTypedData_v4`, signing call or controller submission call. Browser acceptance confirms no transaction/signing request occurs.

## Security and authority invariants retained

- Qualified metadata is metadata authority only; it does not become execution authority.
- Fixture/demo/display projections cannot populate the PRE-03 execution-review entry.
- HTTPS/schema-checked quote response remains unauthenticated until PRE-05.
- Missing fee data is disclosed as unavailable rather than inferred.
- Invalid precision is rejected before quote transport.
- Candidate asset substitution and excessive route length fail closed before display.
- Input changes invalidate the prior candidate through PRE-02 generation controls.
- Wallet signing and transaction submission remain disabled.

## Current-main divergence review

At documentation closeout, repository `main` was `152364d9b69b6d5fe159685fb986c9139e0522cb`, while PR #430 remained based on `4d0ede3692efe55f04a50c7bf5b749afe579eccb`. The intervening 29 commits changed Compute Market contracts/config/docs/scripts and shared workflow files only; they did not change Exchange web sources, PRE-03 dependencies, or `.github/workflows/exchange-web.yml`.

Under the active phase model, this unrelated divergence does not invalidate PRE-03's exact-head Level 1 evidence. Full reconciliation with latest `main` remains intentionally deferred to PRE-12 before the monolithic merge.

## Level 2 milestone status

**Deferred — not required for PRE-03.** PRE-03 closes the browser entry/review UX boundary but does not yet introduce the executable quote backend, authenticated provenance or Exchange read adapter. A broader app-specific integration milestone is more meaningful after PRE-04/PRE-05/PRE-10 converge with PRE-06 orchestration.

## Level 3 app-phase status

**Deferred to PRE-12.** Comprehensive repository-wide Solidity/Genesis, 420 Integrated, Docs/global reconciliation, Geth, global fault/soak and final accumulated app reconciliation are intentionally not used as PRE-03 completion gates.

An Integrated workflow auto-triggered during implementation and later reported success, and Docs auto-triggered/failure states also occurred due repository policy. Neither is substituted for the required PRE-03 Level 1 Exchange gate.

## Limitations / intentionally deferred work

- No repository-owned executable quote backend yet — PRE-04.
- No cryptographic/authenticated producer provenance — PRE-05.
- No full guarded execution orchestration — PRE-06.
- No live deployment/token catalogue/real wallet/testnet qualification.
- Checked-in asset/market catalogue deliberately remains unresolved until a qualified deployment supplies real metadata.
- Real browser/device matrix and live settlement evidence remain later release/testnet gates.

## Next canonical roadmap step

**PRE-04 — Exchange executable quote backend and schema.**

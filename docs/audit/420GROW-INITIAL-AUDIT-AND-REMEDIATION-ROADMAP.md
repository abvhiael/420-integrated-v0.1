# 420Grow — canonical repository audit and remediation ledger

**Audit baseline (main):** `3cd04f9dd1b283a33865c71a6c17b71c465d3040`  
**Scope:** repository-grounded absence/definition audit only; NOT a security or release qualification.  
**Disposition:** BLOCKED — canonical product scope and service authority absent. No fabricated contract, ID, registry entry, frontend or implementation.

## Evidence inspected

- Full recursive main Git tree: 7,577 entries; no 420Grow-named file or directory (`420grow`, standalone `grow`).
- Default-branch GitHub code search for exact `420Grow`: two results: `docs/genesis-services/GEN-SVC-2-LOCATION-EVENTS.md` and `config/420location-events-genesis.json`.
- `config/genesis-applications.json`: frozen Genesis catalog; 420Grow absent.
- `config/genesis-consumer-services.json`: implementation-baseline consumer catalog; 420Grow absent.
- `docs/genesis-services/GEN-SVC-0-ROADMAP.md`: promotion needs explicit frozen application-catalog decision; no implicit protocol authority.
- `docs/genesis-services/GEN-SVC-2-LOCATION-EVENTS.md` and `config/420location-events-genesis.json`: farm/business place consumer integration only; source visibility/precision and provenance bounds apply.
- `contracts/src/libraries/ServiceIds420.sol`: no canonical GROW service ID.
- `docs/420WALLET-W14.5-APP-CATALOG.md`: expressly records 420 Grow as unresolved named product, lacking canonical service ID. Verified Wallet manifests gate launch URLs.
- GitHub branch search for `grow`: no matching branch.
- GitHub PR search for exact `420Grow`: none; broader `grow` finds Wallet W14.5 catalog reconciliation PR #355 (not a 420Grow implementation).
- `docs/ROADMAP.md`: ecosystem roadmap sampled; no app-specific 420Grow requirement established in the sources above.

## Architecture and trust boundary — established vs undecided

**Established:** 420Grow is named as a prospective consumer of shared 420Location business/farm places. Shared geospatial indexes, map providers and discovery data are replaceable/non-canonical. Public precision may not exceed source visibility. Registry/Verify provenance must not be confused with endorsement, reputation or ownership.

**Not established:** product purpose beyond farm/business place consumption, target users, features, app-specific architecture, app-specific contracts, deployment/Genesis role, payments/custody, client APIs, store/database, app-specific threat model, platform/runtime or acceptance criteria. These require a canonical product decision, not inferred architecture.

## Requirement gap matrix

| ID | Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|---|
| GROW-01 | Canonical product definition, scope, release target | GEN-SVC-0 promotion rule; W14.5 | Bounded read-only implementation baseline documented; Genesis authority deliberately withheld | Targeted verifier committed; CI not yet evidenced | GROW-01 product-definition document | PARTIAL | Obtain passing exact-SHA Level 1 evidence and distinguish provisional baseline from full product expansion approval |
| GROW-02 | Canonical service ID/Registry and Wallet discovery | ServiceIds420; W14.5 | No Grow ID | No Grow tests | Explicit unresolved note | BLOCKED | Decide whether a new service is justified; approve ID before code |
| GROW-03 | Business/farm place integration | GEN-SVC-2 and location-events config | Shared provider contract exists; no Grow consumer | No Grow integration tests | Shared contract only | PARTIAL | Build app consumer using source precision and provenance restrictions |
| GROW-04 | Frontend, routes, UX, wallet flow, assets | Product spec not yet defined | No Grow-named surface | None | None | BLOCKED | Define and implement approved UX |
| GROW-05 | Backend/API/worker/indexer/storage | Product spec not yet defined | No Grow-owned surface | None | None | BLOCKED | Determine required services; reuse shared standards |
| GROW-06 | Contracts/interfaces/permission/funds | Product spec not yet defined | No Grow-owned contracts | None | None | BLOCKED | Determine whether any contract is required; do not invent custody |
| GROW-07 | SDK, events, integrations, authorization | GEN-SVC-0; product decision pending | No Grow client | None | Shared standards only | BLOCKED | Define specific interop matrix and tests |
| GROW-08 | Build, static checks, test and security qualification | App implementation pending | No Grow-specific targets | NOT RUN; no app implementation | None | BLOCKED | Implement suites then qualify exact immutable SHA |
| GROW-09 | Developer/operator/user docs | GEN-SVC-0 conventions | No Grow docs prior to this audit | N/A | This gap ledger only | PARTIAL | Write approved spec, architecture, operations and testing guides |
| GROW-10 | Deploy, testnet, Genesis and production evidence | Frozen catalog; GEN-SVC-0 | No Grow deployment artifacts | NOT RUN | No Grow deployment plan | BLOCKED | Decide release class; later collect real environment evidence |

These rows enumerate *established* and *definition-blocked* domains, not invented hidden requirements. Expand the matrix requirement-by-requirement once the product definition is formally approved; retain these IDs.

## File/component inventory

- Existing 420Grow-owned directories/source/contracts/interfaces/tests/fixtures/CI/SDK/backend/indexer/frontend/migrations/assets/deployment/qualifications: **MISSING as named components**; whether each category is actually REQUIRED remains **BLOCKED on GROW-01**.
- Existing reusable location/events spec and config: **COMPLETE as references**, not qualified as Grow integration.
- Existing Wallet documentation: **COMPLETE as an unresolved-ID declaration**, not a Grow manifest.
- Duplicated, obsolete or orphaned 420Grow code: **none identified by the tree/path and exact-term searches**; repository-wide semantic equivalence not established.

## Security findings

No Grow implementation is available to audit for authorization, reentrancy, custody, replay, oracle, external calls, DoS, network binding, privacy, lifecycle or upgrades. **No conclusion of verified safe behavior is possible.** Risk of publishing precise private farm/home locations is governed by GEN-SVC-2, but a Grow consumer is untested. Missing canonical identity and manifest gating prevent safe Wallet launch-link publication. These are **unresolved design/integration risks**, not proven exploitable contract vulnerabilities.

## Test and qualification evidence

No repository builds or tests were executed for Grow, because no Grow target, requirements, or implementation is established. The audit performed read-only GitHub source/tree/branch/PR inspection. No preceding ecosystem CI run is claimed as Grow qualification; passing unrelated CI is irrelevant. This ledger is evidence documentation only and cannot be counted as code/build/test/security qualification.

## Ordered remediation roadmap (stable IDs)

1. **GROW-01 — Canonical product decision.** Decide exact user workflows, legal/privacy constraints, product authority, whether the app is Genesis-facing/testnet/post-Genesis, and measurable acceptance criteria. Record any conflict with the frozen catalog before editing it.
2. **GROW-02 — Canonical identity decision.** Decide whether Grow is only a non-authoritative consumer or requires a distinct service ID; if necessary obtain explicit authority and update `ServiceIds420.sol`, affected maps and verified-manifest/Wallet contracts consistently.
3. **GROW-03 — Shared location consumer.** Implement farm/business-place integration with provenance, category, precision and private-coordinate regression tests.
4. **GROW-04 — UX.** Implement approved frontend, accessibility, mobile responsiveness, wallet/discovery behavior, loading/error/transaction states and assets.
5. **GROW-05 — Service layer.** Implement only specified backend/API/worker/indexer/data responsibilities; cover schema, authorization, replay/retry/idempotency and reorg where applicable.
6. **GROW-06 — Contracts.** Implement only authority-bearing smart contracts specifically required by the approved spec; qualify accounting/access control/replay/invariants and deployment wiring.
7. **GROW-07 — Cross-app qualification.** Matrix every approved integration, tested positive/negative behavior, Registry and Wallet manifest binding, provenance, privacy, and wrong-network failure.
8. **GROW-08 — Repository qualification.** Run clean checkout installation/build, compiler, type/lint/static checks, app-specific unit/integration/adversarial/fuzz tests and security scans on exact implementation SHA. Preserve immutable CI run IDs.
9. **GROW-09 — Documentation closeout.** Record architecture, contract/interface/event/roles, SDK/API, env, build/test, deploy, operations, troubleshooting, security model, threat model, user guide and known limits.
10. **GROW-10 — Deployment and stage qualification.** Qualify real testnet first if required; record exact deployed binary/chain/addresses/Registry, live integration, secrets/admin handover, monitoring, rollback and production evidence. Maintain independent CODE/BUILD/CONTRACT/TEST/DOCUMENTATION/INTEGRATION/SECURITY/TESTNET/GENESIS/PRODUCTION gates.

## Readiness verdict

CODE NO; BUILD NO; CONTRACT NO (contract requirements undecided); TEST NO; DOCUMENTATION NO; INTEGRATION NO; SECURITY NO; TESTNET NO; GENESIS NO; PRODUCTION NO.

**Final determination: 420Grow is not a qualified application at this baseline.** This audit does not alter the frozen catalog or claim a remediation implementation. Any eventual qualification must cite the exact implementation commit and all required evidence rather than this audit-only commit.

## GROW-01 implementation and qualification addendum (2026-10-08)

- **Level:** Level 1 only; product-definition milestone is not an app integration or Level-3 closeout.
- **Substantive definition:** `docs/audit/420GROW-GROW-01-PRODUCT-DEFINITION.md` bounds the app to public farm/business Place discovery, six privacy/authority invariants, read-only MVP workflows, and staged pre-Genesis implementation. This is a new conservative implementation baseline, not proof that a more ambitious Grow product was historically approved.
- **Changed files:** this ledger, GROW-01 definition, `scripts/verify-grow-01.py` and `.github/workflows/420grow-fast.yml`.
- **Current implementation SHA:** `b927dc8926426790f1c8e7cca923f32c844256cb` (verifier fix; evidence-only ledger amendment follows).
- **Initial reconciliation base:** main `d112b2eb55b50a3a4f52a5e2a5364374595efe71`; audit branch was one behind. Retain main reconciliation for final phase Level 3.
- **Level 1:** source review and targeted GitHub repository inspections performed. Dedicated verifier and workflow committed, but **no passing GitHub Actions run/job** observed for the exact implementation SHA at last check. **No execution PASS may be claimed**. Current completion state is PARTIAL pending exact-head verifier execution/evidence and policy/approval of any broader Grow vision.
- **Level 2:** deferred to product/authority milestone after GROW-02 if needed, or GROW-03–07 integration convergence.
- **Level 3:** deferred to monolithic app phase closeout; do not duplicate Solidity Foundry in Genesis.
- **Security:** only documented fail-closed public visibility, geospatial-precision and canonical-authority invariants; none implementation-tested.
- **Next roadmap identity:** **GROW-02 — Canonical identity decision**, but do not implement/promote it as GROW-01 qualification evidence.

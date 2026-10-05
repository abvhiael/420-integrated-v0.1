# 420Search complete repository audit — 2026-10-04

## Scope and baseline

Repository: `abvhiael/420-integrated-v0.1`  
Audit branch: `audit/420search-complete-20261004`  
Original audit baseline `main`: `bec8fb5b43f48c3df8862eee93d9a33769cec5e7`  
SEARCH-AUDIT-4 inspected `main`: `f6a426fc386b21f871b1805e00a57b1dad2bf902`  
Original complete implementation: PR #201, merged as `a38b5694985fb3804ce9a500058e2c170718b697`; reconciliation PR #279 was merged before closeout.

Repository evidence establishes 420Search as a Genesis user-facing discovery application with **no Search-owned smart contract and no canonical protocol state**. It consumes the qualified 420Indexer public API, preserves provenance/freshness/finality context, exposes resolver and discovery modes, provides an embedded web UI and versioned HTTP API, and excludes protected/private data.

## Architecture discovered

- Go 1.23 repository module; Search is under `search/`.
- `search420` serves the `/v1/*` API and embedded dependency-free web UI.
- Chain and protocol projections come through `search/indexerclient`; direct node420 RPC is outside the Search authority boundary.
- Adapters cover chain primitives, Registry, Names, public Identity, assets, validators, public Market, Rights, Commons and Pulse.
- Search result IDs/ranking/pagination/sponsorship are non-canonical presentation infrastructure.
- `searchsmoke` and `searchlivevalidate` are deployment validators for SEARCH-9.
- Docker deployment is defined at `search/deploy/Dockerfile`.

## File/component inventory

| Component | Status | Notes |
|---|---|---|
| canonical Genesis config / SRCH invariants | COMPLETE | 12 invariants; contract-free/non-authoritative |
| Search architecture/profile | COMPLETE | service ID and domain/privacy taxonomy executable |
| Indexer v1 client | COMPLETE at repository scope | live Indexer binding remains testnet work |
| chain discovery | COMPLETE | block/tx/address/contract |
| Registry discovery | COMPLETE | service/version provenance |
| Names/public Identity | COMPLETE | public-only admission and lifecycle reconstruction |
| assets/validators | COMPLETE | Indexer-derived |
| Market/Rights/Commons/Pulse | COMPLETE | explicit public ecosystem adapters |
| query/ranking/sponsorship/pagination | COMPLETE | deterministic/non-canonical boundaries |
| HTTP API | COMPLETE | versioned search/suggest/resolve/capabilities/operational surfaces |
| web frontend | COMPLETE at repository scope | live public URL absent |
| runtime/container | COMPLETE at repository scope | live deployment absent |
| SEARCH-9 validators | COMPLETE as harness | live evidence absent |
| Search-specific smart contracts | NOT APPLICABLE | canonical architecture forbids them |
| live backend/frontend deployment | BLOCKED | approved testnet/Indexer endpoint not provisioned |
| live restart/rebuild/reorg evidence | BLOCKED | requires deployed testnet |
| production monitoring/rollback evidence | MISSING | SEARCH-AUDIT-6 |

## Smart contracts

No Search-specific contract is required or permitted by the canonical Genesis profile. Canonical state remains with the owning chain/protocol contracts. Search therefore has no contract storage layout, custody, upgrade, allowance, transfer, reentrancy, signature or token-accounting surface of its own. Contract-oriented checks are **NOT APPLICABLE** except for verifying that Search does not acquire such authority.

## Integration assessment

Repository-level integrations are implemented for:
- 420Indexer — sole chain/protocol projection source;
- 420Registry / ProtocolRegistry — service/version provenance through Indexer;
- 420Names and public 420Identity;
- assets/native 420 and validators;
- public 420Market, 420Rights, 420Commons and 420Pulse records.

Wallet, Explorer, Analytics, AppStore, Verify, Notifications and other consumers/integrations may link to or consume Search, but Search does not gain their protocol authority. Bridge, Pay, Treasury, Stake, Governance, AI, Compute, Oracle and other protocol surfaces are not direct Search authority dependencies unless their explicitly public data is projected by Indexer under the frozen discovery model.

## Security assessment

Verified design controls:
- no Search-owned canonical state/custody/execution authority;
- no direct RPC source configuration;
- fail-closed Indexer qualification for wrong chain, not-ready, stale and invalid authority state;
- stable source-backed result identity/provenance;
- ranking/sponsorship cannot become canonical;
- protected Messenger/Commons/Identity/Resource/Attention data is excluded;
- bounded API/query/result contracts and external rate-limit expectation;
- deterministic snapshot pagination.

Accepted design risks:
- ranking quality and sponsored placement remain operator/presentation choices;
- availability depends on the deployed Indexer/Search infrastructure;
- public discovery can expose information that the owning protocol deliberately marks public.

Unresolved release risks:
- no production-equivalent live Search/Indexer endpoint evidence;
- no live restart/rebuild/reorg/fault-injection evidence;
- final operational monitoring/rate-limit/rollback evidence is not retained.

No repository evidence identified a Search-owned fund-loss, arbitrary-call, signature-replay or upgradeability vulnerability because Search owns none of those authorities.

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| non-authoritative, contract-free Search | Genesis config / 420SEARCH | architecture/runtime | verifier + Go tests | complete | COMPLETE | preserve boundary |
| Indexer-only chain projection | roadmap / closeout | indexerclient/runtime | client/discovery tests | deploy docs | COMPLETE | live binding in A5 |
| all frozen public domains | roadmap/config | adapters present | discovery suites | docs/UI | COMPLETE | seeded live probes in A5 |
| source provenance/freshness | SRCH-INV-002/005/011 | result model/adapters | model/discovery/API tests | docs/UI | COMPLETE | live evidence |
| stable IDs/snapshot pagination | SRCH-INV-012 | result/pagination | pagination tests | docs | COMPLETE | live reproducibility |
| non-canonical ranking | SRCH-INV-003 | ranking | ranker tests | docs | COMPLETE | none |
| explicit sponsorship isolation | SRCH-INV-004 | sponsorship lane | sponsorship/ranking tests | docs/UI | COMPLETE | live presentation smoke |
| privacy exclusions | SRCH-INV-007/008 | admission/query/domain allowlist | privacy/live-validator negatives | docs | COMPLETE | live negative probes |
| API/runtime/frontend | SEARCH-5/7/8 | present | HTTP/web/runtime tests | deployment docs | COMPLETE at repository scope | public deployment |
| clean build/container | SEARCH-8 | Dockerfile + Go commands | dedicated audit CI | deployment docs | COMPLETE at repository scope | live deployment remains A5 |
| SEARCH-9 live qualification | roadmap | harness exists | no live run | manifest/example | BLOCKED | approved testnet + endpoints |
| Genesis/production operations | SEARCH-10 + release discipline | repository closeout only | no production run | partial | BLOCKED | A5 then A6 |

## SEARCH-AUDIT-3 durable qualification evidence

- Roadmap step: **SEARCH-AUDIT-3 — integration/readiness reconciliation**
- Qualification level: **Level 1 — app-specific fast qualification**
- Implementation SHA: `e013430252106c533e9bc5c54b3339cbdea98681`
- Current main/base inspected for this step: `f6a426fc386b21f871b1805e00a57b1dad2bf902`
- Branch / PR: `audit/420search-complete-20261004` / PR #515
- CI workflow: **420Search audit qualification**
- CI run: **#14 / 37255553537**
- CI job: **111591724193**
- Exact-head assertion: **PASS**
- Canonical Search verifier: **PASS**
- gofmt gate: **PASS**
- `go test ./search/... -count=1`: **PASS**
- `go vet ./search/...`: **PASS**
- runtime/smoke/live-validator builds: **PASS**
- production Docker build: **PASS**
- direct-RPC / authority-drift guard: **PASS**
- 420Indexer consumer readiness gate: **QUALIFIED_INDEXER_API_CONSUMER_EXACT_HEAD**
- Search repository status: **REPOSITORY_QUALIFIED**
- Live Search/Indexer binding: **NOT CLAIMED; deferred to SEARCH-AUDIT-5**
- Level 2: **not required**; this step did not introduce a new shared authority/lifecycle milestone beyond the retained Search integration suite.
- Level 3: **intentionally deferred** to complete app-phase closeout.

The branch was four commits behind current main when this step was qualified, but the divergence consisted only of unrelated `docs/ROADMAP.md` and 420AI audit documentation changes; no Search, Indexer, shared service interface, deployment, or qualification dependency changed.

## Current readiness determination after SEARCH-AUDIT-3

- CODE COMPLETE: **YES**
- BUILD COMPLETE: **YES at repository scope**
- CONTRACT COMPLETE: **YES / NOT APPLICABLE for Search-owned contracts**
- TEST COMPLETE: **YES at repository scope; NO for live SEARCH-9/testnet qualification**
- DOCUMENTATION COMPLETE: **YES for repository integration/readiness; final live deployment/operations evidence remains A5/A6**
- INTEGRATION COMPLETE: **YES at repository scope; NO for live deployment binding**
- SECURITY QUALIFIED: **YES at repository scope; live operational/failure qualification remains A5/A6**
- TESTNET READY: **YES as a repository-qualified deployment candidate**, but not live-testnet-qualified
- GENESIS READY: **NO**
- PRODUCTION READY: **NO**

Next canonical roadmap step: **SEARCH-AUDIT-4 — durable repository closeout**.

## SEARCH-AUDIT-4 — durable repository closeout

**Status: COMPLETE**  
**Qualification level: Level 1 — repository-scope evidence/closeout for the current audit phase**

### Canonical exit criteria

SEARCH-AUDIT-4 requires the audit to retain exact qualification evidence, complete the requirement matrix, and make a formal repository-readiness determination without falsely promoting live testnet, Genesis, or production readiness.

All exit criteria are satisfied:

1. **Exact implementation qualification retained — COMPLETE.**
   - Qualified implementation SHA: `e013430252106c533e9bc5c54b3339cbdea98681`
   - Workflow: **420Search audit qualification**
   - Run: **#14 / 37255553537**
   - Job: **111591724193**
   - Exact-head assertion, verifier, gofmt, Search tests, vet, all three binaries, production Docker build, and authority-drift guard all passed.
2. **Evidence-head revalidation retained — COMPLETE.**
   - Evidence HEAD before this A4 bookkeeping: `724b7e19acb24d6409401932aea58f8f2b0f1027`
   - Workflow run: **#15 / 37255740969**
   - Job: **111592294331**
   - All Search audit qualification steps passed again.
3. **Requirement matrix complete — COMPLETE.**
   - Every repository-scope Search requirement is classified as COMPLETE, COMPLETE AT REPOSITORY SCOPE, NOT APPLICABLE, or explicitly BLOCKED by live-testnet/operations prerequisites assigned to SEARCH-AUDIT-5/6.
4. **Integration/readiness state durable — COMPLETE.**
   - Search repository status: `REPOSITORY_QUALIFIED`
   - Indexer integration status: `INDEXER_V1_CONSUMER_REPOSITORY_QUALIFIED_LIVE_BINDING_PENDING`
   - 420Indexer consumer gate: `QUALIFIED_INDEXER_API_CONSUMER_EXACT_HEAD`
   - Live Search/Indexer binding is not claimed.
5. **Security/authority boundary retained — COMPLETE.**
   - Search remains contract-free, non-canonical, non-custodial, direct-RPC-free, and fail-closed on unqualified Indexer state.
6. **Current-main impact assessed — COMPLETE.**
   - Current main inspected: `f6a426fc386b21f871b1805e00a57b1dad2bf902`
   - Audit branch was four commits behind at A4 review.
   - Divergence was limited to unrelated `docs/ROADMAP.md` and 420AI audit documentation; no Search, Indexer, shared interface, deployment, test, workflow, or runtime dependency changed.
   - Reconciliation is therefore not required for this Level 1 evidence-only step and remains mandatory at the eventual Level 3 app-phase closeout.
7. **Deferred work correctly bounded — COMPLETE.**
   - SEARCH-AUDIT-5 owns production-equivalent public testnet qualification.
   - SEARCH-AUDIT-6 owns Genesis/production closeout after A5.
   - No Level 2 milestone is introduced by this evidence-only step.
   - Level 3 repository-wide qualification is intentionally deferred to the complete app-phase closeout.

### Formal repository readiness determination

As of SEARCH-AUDIT-4:

- **Repository audit phase (SEARCH-AUDIT-1 through SEARCH-AUDIT-4): COMPLETE**
- **Code complete at repository scope: YES**
- **Build/container complete at repository scope: YES**
- **Unit/integration/static qualification complete at repository scope: YES**
- **420Indexer consumer integration qualified at repository scope: YES**
- **Search security/authority boundary qualified at repository scope: YES**
- **Repository documentation/evidence complete for this phase: YES**
- **Deployment candidate: YES**
- **Live-testnet qualified: NO**
- **Genesis ready: NO**
- **Production ready: NO**

The remaining NO states are not repository defects. They are explicit external/live qualification gates requiring an approved production-equivalent testnet, qualified live 420Indexer and public 420Search endpoints, seeded domain probes, restart/rebuild/reorg/failure drills, retained deployment evidence, and final operations/monitoring/rate-limit/rollback qualification.

### Milestone and next step

SEARCH-AUDIT-4 closes the repository-only portion of the 420Search audit. No Level 2 run is required because the step changes evidence only and introduces no new shared authority, lifecycle, interface, dependency, or executable behavior.

The next canonical roadmap step is **SEARCH-AUDIT-5 — production-equivalent public testnet qualification**, which remains **BLOCKED until an approved live 420Indexer/testnet deployment and Search endpoint exist**.

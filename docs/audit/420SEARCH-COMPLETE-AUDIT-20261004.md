# 420Search complete repository audit — 2026-10-04

## Scope and baseline

Repository: `abvhiael/420-integrated-v0.1`  
Audit branch: `audit/420search-complete-20261004`  
Baseline `main`: `bec8fb5b43f48c3df8862eee93d9a33769cec5e7`  
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
| clean build/container | SEARCH-8 | Dockerfile + Go commands | dedicated audit CI | deployment docs | PARTIAL | exact-head audit CI must pass |
| SEARCH-9 live qualification | roadmap | harness exists | no live run | manifest/example | BLOCKED | approved testnet + endpoints |
| Genesis/production operations | SEARCH-10 + release discipline | repository closeout only | no production run | partial | BLOCKED | A5 then A6 |

## Current readiness determination before exact-head audit CI

- CODE COMPLETE: **YES**
- BUILD COMPLETE: **NO pending exact-head audit CI**
- CONTRACT COMPLETE: **YES / NOT APPLICABLE for Search-owned contracts**
- TEST COMPLETE: **NO** — live SEARCH-9 remains.
- DOCUMENTATION COMPLETE: **NO** — final deployment/operations evidence remains.
- INTEGRATION COMPLETE: **NO** — repository adapters exist; live Indexer/cross-app evidence remains.
- SECURITY QUALIFIED: **NO** — repository security controls exist; live operational/failure qualification remains.
- TESTNET READY: **YES at repository-package/harness scope**, but not testnet-qualified.
- GENESIS READY: **NO**
- PRODUCTION READY: **NO**

Exact-head CI evidence will be appended after the audit branch is qualified.

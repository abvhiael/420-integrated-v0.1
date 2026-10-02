# 420Treasury TREASURY-AUDIT-5 qualification evidence

Status: **COMPLETE**  
Roadmap step: **TREASURY-AUDIT-5 — Indexer/Explorer/Analytics integration**  
Qualification level: **Level 1 — per-roadmap-step fast qualification**  
Implementation SHA: `8f184754c2497dd5add35e9d5f3e97555a1d8883`  
Qualification base/main SHA: `27ae1873edcca8fb05dec9f4e70af9832b5dafe2`  
Audit branch: `audit/420treasury-complete-20261001`  
Pull request: **#474**  
CI workflow: **420Treasury audit qualification**  
Passing workflow run: **37038055729**  
Passing job: **110941058630**

## Scope

TREASURY-AUDIT-5 closes the repository-side integration gap between the modern Treasury contract family and the non-authoritative derived-data stack.

The qualified design preserves the authority boundary:

- canonical Treasury state remains on-chain;
- 420Indexer decodes/reconstructs Treasury state from canonical event history;
- the public Indexer API exposes derived Treasury budget/disbursement read models;
- 420Analytics consumes only qualified 420Indexer projections and rejects authoritative/wrong-chain responses;
- Explorer and other consumers may use the same Indexer boundary without acquiring Treasury authority;
- registry-resolved deployment identities remain deferred to TREASURY-AUDIT-6 and are not fabricated here.

## Material implementation findings

### Event reconstruction gap

The audit found that the pre-existing modern Treasury event schema could not reconstruct full canonical records from event history alone:

- `BudgetCreated` omitted `metadataHash`;
- `DisbursementScheduled` omitted `purposeHash`.

Those fields exist in the canonical contract getters and are part of the persisted Treasury records. Leaving them out would force downstream derived services either to lose state or invent supplemental off-chain assumptions.

The contract event schema was therefore hardened so the emitted creation/scheduling records contain the full reconstruction fields.

## Implementation completed

### Treasury contract event completeness

Updated:

- `contracts/src/treasury/TreasuryBudgetRegistry420.sol`
- `contracts/src/treasury/TreasuryDisbursementRegistry420.sol`

Changes:

- `BudgetCreated` now emits `metadataHash`;
- `DisbursementScheduled` now emits `purposeHash`.

This makes complete budget/disbursement reconstruction possible from canonical indexed event history.

### Modern Treasury Indexer descriptor

Added:

- `420-indexer/descriptors/treasury420-v1.json`
- `420-indexer/src/treasury-descriptors.ts`
- `scripts/verify-treasury-audit-5-descriptor.py`

The descriptor covers the modern event-emitting Treasury contracts:

- `TreasuryPolicyRegistry420`
- `TreasuryBudgetRegistry420`
- `TreasuryDisbursementRegistry420`

The descriptor is deliberately **address-unbound** at this step. It records exact event signatures, field types and indexed flags while deferring runtime deployment-address binding to TREASURY-AUDIT-6.

The retained verifier compares the descriptor directly with compiled Foundry ABI output so event signature/indexing drift fails qualification.

### Treasury Indexer reconstruction

Added:

- `420-indexer/src/treasury-read-model.ts`

The read model reconstructs:

#### Budget state

- budget ID;
- vault ID;
- category;
- asset;
- ceiling;
- committed;
- executed;
- validity window;
- Civic action hash;
- metadata hash;
- latest canonical event provenance.

It fails closed on malformed histories and verifies:

- exactly one creation event;
- `executed <= committed`;
- `committed <= ceiling`.

#### Disbursement state

- disbursement ID;
- parent budget ID;
- recipient;
- asset;
- amount;
- execution window;
- Civic action hash;
- purpose hash;
- terminal state;
- Vault release commitment;
- executor;
- latest canonical event provenance.

It fails closed on terminal replay/corrupt lifecycle history and rejects executed state lacking a nonzero Vault release commitment.

Both read models return `authoritative: false`.

### Stable public Indexer read surface

Updated:

- `420-indexer/src/api-surface.ts`
- `420-indexer/src/http-transport.ts`
- `420-indexer/src/index.ts`

Added stable public routes:

- `GET /v1/treasury/budgets/:id?chainId=...`
- `GET /v1/treasury/disbursements/:id?chainId=...`

These routes expose reconstructed derived state through the existing qualified Indexer public boundary.

No direct node/RPC, custody, governance or Treasury write authority was introduced.

### Rebuild/replay/reorg qualification

Added:

- `420-indexer/test/treasury420-integration.test.ts`

Retained coverage verifies:

- descriptor contract/event inventory;
- address-unbound descriptor semantics;
- deployment binding fails closed without valid addresses;
- ABI/indexing drift rejection;
- complete budget reconstruction;
- complete disbursement reconstruction;
- accounting-corruption rejection;
- terminal replay rejection;
- idempotent protocol event projection;
- block-bounded rollback;
- canonical replay after rollback.

### Public HTTP/API qualification

Updated:

- `420-indexer/test/http-transport.test.ts`
- `420-indexer/test/http-hardening.test.ts`
- `420-indexer/test/testnet-consumer-qualification.test.ts`

The new Treasury routes are qualified for:

- stable successful responses;
- `authoritative: false`;
- stable 404 behavior;
- compatibility with existing public API consumers;
- existing hardening/testnet mocks updated to preserve the now-required Indexer interface rather than weakening it.

### Analytics integration

Updated:

- `analytics/indexerclient/client.go`
- `analytics/indexerclient/client_test.go`

The Analytics Indexer client now consumes the same qualified Treasury public routes and fails closed when:

- the response claims canonical authority;
- chain ID does not match the configured chain;
- required indexed identity/provenance fields are absent.

Existing Treasury economic metrics remain explicitly derived and require qualified 420Indexer provenance.

## CI failures diagnosed during qualification

Two harness/integration failures were diagnosed and fixed rather than blindly rerun.

### Missing npm lockfile cache target

The first TREASURY-AUDIT-5 workflow attempt failed in `actions/setup-node` before any qualification because the workflow referenced nonexistent `420-indexer/package-lock.json`.

Fix:

- removed invalid npm cache dependency configuration;
- used the repository's actual lockfile-less package installation path.

No protocol test result from that failed run was counted as evidence.

### Indexer API test-double drift

The next exact-head run passed all Treasury Solidity tests and descriptor verification, then TypeScript compilation failed because older `IndexerPublicApi420` test doubles did not implement the newly required:

- `treasuryBudget()`;
- `treasuryDisbursement()`.

The mocks were updated to the stronger interface. No production interface was weakened and no assertion was removed.

## Exact-head Level 1 qualification

Workflow run `37038055729`, job `110941058630`, exact implementation SHA `8f184754c2497dd5add35e9d5f3e97555a1d8883`:

- exact-head checkout verification: **PASS**
- Foundry setup: **PASS**
- Node setup: **PASS**
- Go setup: **PASS**
- Treasury Solidity formatting: **PASS**
- Treasury + affected Grants build: **PASS**
- compiled-ABI Treasury descriptor verifier: **PASS**
- Treasury lifecycle regression suite: **PASS — 9 passed, 0 failed, 0 skipped**
- Treasury security/property suite: **PASS — 5 passed, 0 failed, 0 skipped**
  - canonical-ID/replay fuzz: **2,500 runs**
  - reserve/settle/release conservation fuzz: **2,500 runs**
- affected Grants release-evidence suite: **PASS — 4 passed, 0 failed, 0 skipped**
- affected 420Indexer build: **PASS**
- Treasury Indexer descriptor/read/reorg/API qualification: **PASS — 18 tests**
- affected Analytics Treasury boundary qualification: **PASS**
- canonical Treasury authority/config verifier: **PASS**
- Vault release-evidence consumer inventory: **PASS**
- targeted Treasury Slither high-severity gate: **PASS — 0 high-severity findings**
- Treasury forbidden-primitive scan: **PASS**

## Requirement-by-requirement exit verification

### Add/qualify modern Treasury event descriptors

**SATISFIED for repository-side artifact/event identity.**

The modern event-emitting Treasury family has an exact descriptor verified against compiled ABI output.

Runtime deployment-address binding remains intentionally deferred to TREASURY-AUDIT-6 because the modern Treasury family is registry-resolved and not yet materialized into release deployment identities.

### Prove rebuild/reorg/replay behavior

**SATISFIED.**

Retained tests verify deterministic reconstruction, idempotent projection, rollback, canonical replay, accounting corruption rejection and terminal replay rejection.

### Expose budget/disbursement state in a qualified read surface

**SATISFIED.**

The qualified public 420Indexer API now exposes reconstructed Treasury budget and disbursement state through stable v1 routes.

The release architecture does not require a new Treasury-specific authoritative Explorer backend. Explorer and other clients may consume the same non-authoritative Indexer surface.

### Preserve non-authoritative derived-service boundary

**SATISFIED.**

- Indexer Treasury responses are explicitly `authoritative: false`;
- Analytics rejects an Indexer response that claims authority;
- Analytics rejects wrong-chain data;
- no service gained custody, governance, execution or Treasury write authority.

## Security/invariant result

TREASURY-AUDIT-5 introduced no new Treasury authorization or custody path.

The material integration issue discovered in this step — incomplete event reconstruction — was fixed at the canonical event source instead of being masked in derived services.

The resulting stack preserves:

- exact canonical event identities;
- complete replayable reconstruction fields;
- deterministic derived read models;
- explicit non-authoritative API semantics;
- fail-closed corruption/replay checks;
- chain provenance checks;
- the previously adopted Vault release evidence model.

Targeted Slither remained clean of high-severity Treasury findings and the forbidden-primitive gate passed.

## Level 2 status

A separate broad Level 2 milestone was not required for this step.

The directly affected cross-component boundaries — Treasury contracts, 420Indexer public reconstruction/API, and Analytics' Indexer client — were included directly in the exact-head Level 1 qualification.

No new shared custody, consensus or governance authority was introduced.

## Intentionally deferred

The following are owned by later canonical steps and are not blockers for TREASURY-AUDIT-5:

- registry-resolved runtime address binding for the modern Treasury contract family — TREASURY-AUDIT-6;
- deterministic deployment order and constructor bindings — TREASURY-AUDIT-6;
- retained deployment/runtime hashes — TREASURY-AUDIT-6;
- ProtocolRegistry publication — TREASURY-AUDIT-6;
- operator/runbook/documentation closeout — TREASURY-AUDIT-7;
- live production-equivalent Indexer/Analytics/Explorer agreement — TREASURY-AUDIT-8;
- live restart/reorg/replay/rebuild drills — TREASURY-AUDIT-8;
- external security review and final Genesis/production closeout — TREASURY-AUDIT-9;
- repository-wide Level 3 closeout qualification.

## Limitations

TREASURY-AUDIT-5 does not claim live deployed Treasury addresses.

The modern Treasury descriptor is intentionally address-unbound until TREASURY-AUDIT-6 materializes the release deployment identities.

Repository-side replay/reorg qualification does not substitute for production-equivalent live chain restart/reorg/rebuild evidence required by TREASURY-AUDIT-8.

## Blockers

**None for TREASURY-AUDIT-5.**

Deployment-address binding is deferred work, not an AUDIT-5 blocker, because the canonical roadmap assigns deployment/registry publication/release materialization to TREASURY-AUDIT-6.

## Completion determination

Every repository-side TREASURY-AUDIT-5 requirement has been implemented and directly qualified against exact implementation SHA `8f184754c2497dd5add35e9d5f3e97555a1d8883`.

**TREASURY-AUDIT-5 is COMPLETE.**

Next canonical roadmap step: **TREASURY-AUDIT-6 — deployment, registry publication and release materialization**.

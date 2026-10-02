# GRANTS-AUDIT-6 qualification evidence

## Step

**GRANTS-AUDIT-6 — client/indexer/user-flow integration**

## Qualification level

**Level 1 — per-roadmap-step qualification, plus focused Level 2 app-integration milestone**

GRANTS-AUDIT-6 is the first roadmap step where the retained Grants contract work converges with shared client and Indexer surfaces. The step therefore uses:

- Level 1 exact-head contract/security qualification;
- a focused Level 2 `grants-client-integration` job for the accumulated Grants ↔ Indexer ↔ Wallet/client seam;
- no Level 3 repository-wide closeout work.

## Exact implementation SHA

`b82de3494315ef5f5a8e097deb391291ad693132`

## Current main / reconciliation state at closeout

Current `main` observed during closeout:

`b58b09a17e641a42b81d832bad913a83c7caada9`

Audit branch:

`feature/420grants-audit-remediation-v2`

PR:

#484 — `audit(grants): harden lifecycle and establish 420Grants audit track`

At closeout the audit branch was 77 commits ahead of and 400 commits behind current `main`, with mergeability reported false. The merge base remained `14d46231aa4350b2e84dee52f0f664bdd2e785f4`.

That divergence is deliberately **not** reconciled as part of this ordinary roadmap step. Complete accumulated app-phase reconciliation against then-current `main` is owned by GRANTS-AUDIT-8 Level 3. AUDIT-6 qualification remains exact-SHA authoritative for the implementation recorded here.

## Canonical scope

The canonical roadmap requires:

- discoverable Grants service/component metadata;
- Wallet/catalog awareness;
- event/indexer compatibility sufficient for ecosystem clients to reconstruct **non-authoritative** program/application/award/milestone views;
- transaction handoff that preserves Wallet/Smart Account authority;
- no retroactively invented standalone Grants website;
- no inferred dedicated Grants-specific Wallet workflow unless later added as a new explicit requirement.

## Gap analysis

### Already satisfied before AUDIT-6 implementation

Current Wallet catalogue already contained:

- name: `420 Grants`;
- service ID: `420/service/grants/v1`;
- finance category metadata.

Wallet service resolution already preserved canonical Wallet metadata while allowing only verified manifest availability/URL data.

The Grants Genesis config and dApp map already preserved:

- Grants as a non-standalone Genesis implementation protocol;
- canonical seven-contract Grants suite;
- Registry-resolved discovery model.

### Missing before AUDIT-6

The repository did not yet provide a complete Grants client/indexer seam:

- no artifact-derived Grants event descriptor;
- no deployment-address binding helper for Grants event descriptors;
- `420Grants` absent from the shared Indexer protocol catalogue;
- Grants program/application/award/milestone IDs absent from generic lifecycle object-key reduction;
- no typed non-authoritative Grants read models;
- no Grants-specific public Indexer API methods;
- no Grants HTTP read routes;
- no focused integration tests proving reconstruction/replay/terminal behavior;
- no explicit Wallet handoff adapter proving Grants transactions remain SmartAccount420-authorized and non-custodial;
- no exact-head AUDIT-6 verifier tying these surfaces together.

## Implementation completed

### Artifact-derived Grants event descriptor

Added:

`420-indexer/descriptors/grants420-v1.json`

The descriptor covers the four event-emitting Grants registries:

- `GrantProgramRegistry420`;
- `GrantApplicationRegistry420`;
- `GrantAwardRegistry420`;
- `GrantMilestoneRegistry420`.

It records all 12 canonical emitted events, exact Solidity signatures, field names/types and indexed flags.

Added:

`420-indexer/src/grants-descriptors.ts`

It:

- validates descriptor identity;
- requires the exact four-contract set;
- derives event descriptors from compiled ABI artifacts;
- rejects event count/signature/input/indexing drift;
- keeps descriptors address-unbound until real deployment identities are supplied;
- binds deployment addresses only through an explicit fail-closed address map.

### Shared Indexer protocol/lifecycle integration

Updated:

- `420-indexer/src/protocol-decoder.ts`;
- `420-indexer/src/lifecycle-reducer.ts`;
- `420-indexer/src/index.ts`.

`420Grants` is now a recognized protocol.

Generic object-key reduction recognizes:

- `programId`;
- `applicationId`;
- `awardId`;
- `milestoneId`.

The generic lifecycle reducer deliberately uses the existing shared lifecycle vocabulary rather than introducing Grants-specific states into a repository-wide type:

- ProgramCreated → ACTIVE;
- ApplicationSubmitted → ACTIVE;
- AwardCreated → ACTIVE;
- AwardStateChanged 1/2/3 → ACTIVE/CANCELLED/COMPLETED;
- MilestoneCreated → PENDING;
- MilestoneClaimed → ACTIVE;
- MilestoneApproved → ACTIVE;
- MilestonePaid → COMPLETED;
- MilestoneCancelled → CANCELLED.

Exact Grants-specific milestone state remains available in the dedicated Grants read model.

### Non-authoritative Grants read model

Added:

`420-indexer/src/grants-read-model.ts`

It reconstructs:

- programs;
- applications;
- awards;
- milestones.

Every returned view records `authoritative: false`.

The read model rejects or fails closed on:

- invalid IDs;
- duplicate/replayed application submission;
- multiple creation events;
- program awarded values beyond the declared total cap;
- invalid Award terminal transitions;
- terminal Award replay;
- invalid Milestone transition ordering;
- mismatched Treasury disbursement ID on `MilestonePaid`;
- terminal Milestone replay.

It preserves event provenance:

- block number/hash;
- transaction hash/index;
- log index.

### Public Indexer client API

Updated:

- `420-indexer/src/api-surface.ts`;
- `420-indexer/src/http-transport.ts`.

Added typed public methods:

- `grantsProgram`;
- `grantsApplication`;
- `grantsAward`;
- `grantsMilestone`.

Added GET routes:

- `/v1/grants/programs/:programId`;
- `/v1/grants/applications/:applicationId`;
- `/v1/grants/awards/:awardId`;
- `/v1/grants/milestones/:milestoneId`.

These are Indexer projections only and do not replace on-chain Grants authority.

### Wallet / Smart Account transaction handoff

Added:

`wallet/web/core/grants-handoff.js`

The handoff:

- requires canonical service identity `420/service/grants/v1`;
- requires an explicit target and calldata;
- rejects nonzero native value;
- delegates all execution preparation to the existing `prepareSmartAccountExecution` boundary;
- labels authority as `SmartAccount420`;
- contains no private-key handling;
- contains no independent signing path;
- contains no direct `eth_sendTransaction` path;
- does not invent a Grants-owned transaction executor.

This preserves Wallet/Smart Account authority rather than promoting Grants into custody/signing infrastructure.

### Wallet handoff regressions

Added:

`wallet/web/test/grants-handoff.test.js`

It proves:

- Grants handoff preserves SmartAccount420 as execution authority;
- canonical service identity is required;
- native value is rejected;
- empty calldata is rejected;
- simulation/gas-estimation occurs through the existing Wallet execution path.

### Grants Indexer integration regressions

Added:

`420-indexer/test/grants420-integration.test.ts`

Final exact-head focused suite result:

**9 passed / 0 failed**

Coverage includes:

- complete event-emitting Grants registry descriptor inventory;
- deployment-address fail-closed behavior;
- ABI/indexing drift rejection;
- Program reconstruction and non-authoritative status;
- Application replay rejection;
- Award terminal-state reconstruction and terminal replay rejection;
- Milestone claim/Treasury binding/PAID reconstruction;
- generic lifecycle object identity and terminal-state reduction;
- public HTTP Grants read routes.

### Existing shared test harness reconciliation

AUDIT-6 extends `IndexerPublicApi420` with the four Grants read methods. Existing Indexer HTTP/testnet test doubles were updated to implement those methods rather than weakening the interface.

A current-main `pay-accounting-export.ts` compatibility file was also retained on the audit branch because the current-main `src/index.ts` export surface referenced it. This resolved a stale-branch shared Indexer build mismatch without altering Grants semantics.

## Fail-closed AUDIT-6 verifier

Added:

`scripts/verify-grants-audit-6-client-indexer.py`

The verifier checks:

- descriptor schema/protocol/authority identity;
- exact Grants descriptor contract set;
- descriptor event signatures/input/indexing against compiled Grants ABI artifacts;
- canonical Wallet `420/service/grants/v1` catalogue identity;
- SmartAccount-only handoff;
- absence of independent signing/broadcast authority;
- nonzero native-value rejection;
- `420Grants` Indexer protocol registration;
- Grants object-key/lifecycle registration;
- all four read-model functions;
- explicit non-authoritative projection markers;
- all four public API methods and HTTP routes;
- module exports;
- required Indexer and Wallet regression tests;
- Grants non-standalone application status;
- Registry/Wallet integration anchors;
- canonical Genesis dApp-map Grants contract inventory.

Final exact-head verifier result: **PASS**.

## CI failure diagnosis history

### Run #57

Implementation SHA:

`170c3097668df04c93202f2dbe856be40af15837`

Contract-core and security passed.

The focused client integration job failed before compilation because `npm ci` was used in `420-indexer`, which intentionally has no lockfile.

Classification: **CI harness defect**.

Fix:

replace `npm ci` with the repository convention:

`npm install --no-audit --no-fund --no-package-lock`

No implementation semantics changed.

### Run #58

Implementation SHA:

`8c41da9ac0a62459099d709302b369b93f696e11`

Contract-core and security passed.

The focused client integration job reached TypeScript compilation and correctly exposed:

- stale branch export of missing current-main `pay-accounting-export.ts`;
- invalid Grants-specific values in the shared generic `LifecycleState420` type;
- existing HTTP test doubles missing the newly required Grants API methods.

Classification: **shared client/indexer integration compile defects**.

Fixes:

- retain current-main Pay accounting export compatibility;
- map Grants into the existing generic lifecycle vocabulary;
- update existing HTTP API doubles to implement the required Grants methods.

### Run #60

Implementation SHA:

`f0b5261ed494e5149b6605f7c5f68aad9646659e`

Contract-core and security passed.

TypeScript compilation then exposed one remaining test-helper defect:

`test/testnet-consumer-qualification.test.ts` constructed a complete `IndexerPublicApi420` via a partial override object but did not provide defaults for the four new Grants methods.

Classification: **test harness typing defect**.

Fix:

add explicit null-returning Grants method defaults to the helper. No protocol/client behavior was weakened.

### Run #61

Final implementation SHA:

`b82de3494315ef5f5a8e097deb391291ad693132`

All required Grants jobs passed.

## Final exact-head Level 1 qualification

Workflow:

**420Grants Audit Qualification**

Run:

`37078114603` / #61

Conclusion:

**SUCCESS**

### grants-contract-core

Job:

`111072419199`

Result:

**PASS**

Retained coverage includes:

- exact head checkout;
- exact SHA verification;
- Grants audit verifier;
- AUDIT-5 release verifier;
- Solidity formatting;
- Grants contract build;
- compiled artifact identity retention;
- deployment/Registry binding suite;
- lifecycle/adversarial Grants suite.

### grants-security

Job:

`111072419469`

Result:

**PASS**

Retained coverage includes:

- exact head checkout/SHA verification;
- forbidden Grants primitive scan;
- hardening-profile Grants regressions;
- targeted Grants Slither high-severity gate.

## Focused Level 2 app-integration milestone

Job:

`111074493945` — `grants-client-integration`

Result:

**PASS**

Exact-head steps:

- exact checkout — PASS;
- exact SHA verification — PASS;
- Grants compiled ABI materialization — PASS;
- AUDIT-6 client/indexer verifier — PASS;
- 420Indexer dependency installation using repository convention — PASS;
- affected 420Indexer TypeScript build — PASS;
- retained Grants Indexer integration suite — **9/9 PASS**;
- affected Wallet catalogue + Grants handoff regressions — **13/13 PASS**.

This is the appropriate Level 2 milestone because several accumulated Grants steps converge here at the client/indexer boundary. It remains app-focused and does not duplicate Level 3 repository-wide closeout.

## Affected shared Solidity workflow

Workflow:

**Solidity Contracts**

Run:

`37078114618` / #4341

Conclusion:

**SUCCESS**

Same exact implementation SHA:

`b82de3494315ef5f5a8e097deb391291ad693132`

The classifier passed. Full Foundry and PR shard jobs correctly skipped for this client/indexer-focused change. Only the applicable fast affected-path job ran and passed. This is not represented as a Level 3 full repository Solidity inventory.

## Wallet / Indexer shared workflows

Standalone Wallet Web / generic 420Indexer workflow instances on the final SHA resolved as path/classification skips under their current workflow policies.

Those skips are **not** counted as passing evidence.

The directly applicable Wallet and Indexer work is instead owned by the exact-head `grants-client-integration` job above, which explicitly builds the affected Indexer and runs the required Wallet/Grants tests.

## Requirement-by-requirement exit verification

### Discoverable Grants service/component metadata

**SATISFIED.**

Canonical service identity `420/service/grants/v1` remains Wallet-visible and Registry-resolved. AUDIT-5 already qualified the ProtocolRegistry publication model; AUDIT-6 consumes that identity without inventing a standalone Grants application.

### Wallet/catalog awareness

**SATISFIED.**

The canonical Wallet catalogue includes `420 Grants` and `420/service/grants/v1`. Retained Wallet catalogue regressions pass.

### Event/indexer compatibility

**SATISFIED.**

All 12 emitted events across the four event-emitting Grants registries are represented by an artifact-derived descriptor and validated against compiled ABI artifacts.

### Non-authoritative program/application/award/milestone reconstruction

**SATISFIED.**

Typed read models reconstruct all four object families with provenance and explicit `authoritative: false`.

### Client access to reconstructed views

**SATISFIED.**

Typed public API methods and stable HTTP GET routes expose the four Grants object views.

### Transaction handoff preserves Wallet / Smart Account authority

**SATISFIED.**

The Grants handoff has no independent signer or broadcaster, rejects native value, and delegates preparation to the existing SmartAccount420 Wallet execution boundary.

### Separate Grants public website

**NOT REQUIRED by canonical scope.**

No standalone Grants website was invented.

### Dedicated Grants-specific Wallet workflow

**NOT REQUIRED by canonical scope.**

No retroactive requirement was invented. If adopted later it must be a new explicit roadmap requirement.

## Files materially changed for AUDIT-6

- `.github/workflows/grants-audit.yml`
- `420-indexer/descriptors/grants420-v1.json`
- `420-indexer/src/grants-descriptors.ts`
- `420-indexer/src/grants-read-model.ts`
- `420-indexer/src/protocol-decoder.ts`
- `420-indexer/src/lifecycle-reducer.ts`
- `420-indexer/src/api-surface.ts`
- `420-indexer/src/http-transport.ts`
- `420-indexer/src/index.ts`
- `420-indexer/src/pay-accounting-export.ts`
- `420-indexer/test/grants420-integration.test.ts`
- `420-indexer/test/http-hardening.test.ts`
- `420-indexer/test/http-transport.test.ts`
- `420-indexer/test/testnet-consumer-qualification.test.ts`
- `wallet/web/core/grants-handoff.js`
- `wallet/web/test/grants-handoff.test.js`
- `scripts/verify-grants-audit-6-client-indexer.py`

## Security / authority result

**PASS**

The new client surface does not acquire protocol authority.

- Indexer outputs are explicitly non-authoritative;
- Indexer descriptor binding fails closed without complete deployment addresses;
- Wallet handoff retains SmartAccount420 ownership/simulation boundaries;
- no private key or independent Grants signer exists;
- no native-value Grants handoff is permitted;
- existing Grants contract security/hardening qualification remains green.

## Level 2 status

**COMPLETE for the AUDIT-6 integration milestone.**

Focused exact-head Grants/Indexer/Wallet integration passed in job `111074493945`.

## Intentionally deferred Level 3 work

GRANTS-AUDIT-8 owns:

- reconciliation of the accumulated audit branch with then-current `main`;
- establishment of one exact merge-candidate implementation SHA;
- canonical full Solidity inventory once;
- separate Genesis/address-authority qualification;
- 420 Integrated/global qualification where applicable;
- Docs/global reconciliation;
- complete affected Wallet/Indexer/client/service qualification on the reconciled merge candidate;
- final roadmap/evidence reconciliation.

The current branch divergence is therefore explicit, not hidden.

## Intentionally deferred live work

GRANTS-AUDIT-9 owns:

- live chain/genesis identity;
- live deployed Grants addresses/runtime hashes;
- live Registry publication/discovery;
- live CapabilityRegistry delegation;
- complete program-to-PAID Treasury/Vault flow;
- client/indexer reconstruction against actual deployed history;
- restart/reorg/RPC-disagreement behavior.

## Limitations

Repository and CI qualification proves deterministic reconstruction and transaction handoff behavior against retained tests. It does not prove live deployed Indexer history or Wallet transactions on the production-equivalent testnet.

## Blockers

**None for GRANTS-AUDIT-6.**

Current branch/main divergence is a GRANTS-AUDIT-8 Level 3 closeout concern, not an AUDIT-6 completion blocker.

## Completion state

**COMPLETE**

Next canonical roadmap step:

**GRANTS-AUDIT-7 — documentation, threat model and operator guidance**

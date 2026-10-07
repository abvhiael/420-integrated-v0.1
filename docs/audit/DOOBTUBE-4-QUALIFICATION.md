# DoobTube — DOOBTUBE-4 qualification evidence

Roadmap step: **DOOBTUBE-4 — Contracts and protocol adapters**
Qualification level: **Level 1 — app-scoped contract/adapter qualification**
Status: **COMPLETE**
PR: **#553**
Branch: `audit/doobtube-baseline-20261006`

## Implementation summary

DOOBTUBE-4 confirms that DOOBTUBE-0 through DOOBTUBE-3 require **no DoobTube-owned Solidity contract** for V1.

The step therefore implements the required external protocol-binding policy rather than inventing a new on-chain authority.

Implemented repository surfaces:

- `doobtube/integrations/ecosystem.py`
- `doobtube/tests/test_doobtube_adapters.py`
- `docs/DOOBTUBE-CONTRACTS-ADAPTERS.md`
- cumulative verifier updates;
- DoobTube fast-CI syntax and adapter-test ownership.

## Contract-scope result

DoobTube V1 introduces:

- no Solidity contract;
- no DoobTube protocol/service ID;
- no frozen/reserved address;
- no deployment graph;
- no DoobTube ABI;
- no upgrade/admin contract role;
- no app-owned custody;
- no app-owned Pay/Compute settlement;
- no new Registry publication;
- no app-owned on-chain event/error namespace.

This satisfies the canonical roadmap alternative: when no DoobTube-owned contracts are required, document that decision and qualify the external protocol bindings instead.

## External adapter bindings

The executable adapter policy binds:

- 420 Registry — `420/service/protocol-registry/v1`
- 420 Wallet — `420/service/wallet/v1`
- 420 Smart Accounts — `420/service/smart-accounts/v1`
- 420Media — `420/service/media/v1`
- 420Identity — `420/service/identity/v1`
- 420Rights — `420/service/rights/v1`
- 420Storage / Resource Protocol — `420/service/resource-protocol/v1`
- 420Search — `420/service/search/v1`
- 420Notifications — `420/service/notifications/v1`
- 420Pay — `420/service/pay/v1`
- 420 Compute Market — `420/service/compute-market/v1`

420Pay and 420 Compute Market remain `TRANSITIVE_MEDIA` and direct V1 calls fail closed.

## Adapter behaviors implemented

### Registry

Rejects:

- wrong service ID;
- inactive service;
- deprecated service;
- wrong chain;
- future observation;
- stale observation;
- malformed/bounds-violating implementation reference.

### Media compatibility

Requires:

- exact `420/service/media/v1`;
- API version `v1`;
- compatibility major `1`;
- expected chain;
- expected network;
- required `media.uploads` capability;
- required `media.livestreaming` capability.

### Storage readiness

Requires complete canonical object identity plus:

- sealed;
- retrievable;
- live.

Provider/transport success alone is insufficient.

### Search public projection

Requires:

- `READY`;
- `PUBLIC`;
- Rights authorization;
- correct chain;
- no canonical-authority claim by Search.

### Notifications

Rejects:

- unconfirmed local-only subscription state;
- paid-entitlement promotion;
- signing authority;
- spending authority;
- promotional consent folded into the base creator-update subscription.

### Authority/capability boundaries

- dependency capabilities are allowlisted;
- canonical authority owners are frozen;
- DoobTube cannot replace Registry, Wallet, Smart Accounts, Media, Identity, Rights, Storage, Search, Notifications, Pay or Compute authority;
- direct Pay/Compute calls fail closed.

## Original DOOBTUBE-4 requirement disposition

- interfaces — implemented as adapter contracts/policy;
- access control/roles — preserved through canonical authority admission;
- deployment graph — not applicable because there is no DoobTube contract;
- signatures/domain separation/nonces/replay — delegated to qualified Wallet/Smart Account/Media boundaries; no new DoobTube signing domain;
- accounting/settlement/refunds — transitive through Media; no DoobTube custody;
- pausing/emergency controls — no DoobTube contract; adapter failures fail closed/degrade safely;
- Registry integration — implemented and tested;
- events/errors — no on-chain DoobTube events; bounded adapter error surface;
- adversarial/invariant/property coverage — implemented through app-scoped negative/boundary tests.

## Files changed

- `doobtube/__init__.py`
- `doobtube/integrations/__init__.py`
- `doobtube/integrations/ecosystem.py`
- `doobtube/tests/__init__.py`
- `doobtube/tests/test_doobtube_adapters.py`
- `docs/DOOBTUBE-CONTRACTS-ADAPTERS.md`
- `docs/DOOBTUBE-ROADMAP.md`
- `docs/DOOBTUBE-AUDIT.md`
- `scripts/verify-doobtube-baseline.py`
- `.github/workflows/doobtube-baseline.yml`

## Repository base

Current `main` / qualification base:

`ff4440bfd7b69c0712ee3dd7c4b417cb049ae76d`

The branch remained 0 commits behind current main throughout DOOBTUBE-4 implementation and qualification.

## Level 1 qualification

Qualified implementation SHA:

`c9badb041d96c3983fea81ae25bc46168cd2fe3c`

Workflow: **DoobTube baseline audit**
Run: **37560619954**
Job: **baseline / 112596799654**
Result: **PASS**

Exact-head checks passed:

- exact PR-head checkout;
- exact SHA assertion;
- Python adapter compile/static syntax check;
- full DOOBTUBE-4 adapter unit/negative suite;
- cumulative DOOBTUBE-0 architecture verifier;
- cumulative DOOBTUBE-1 product verifier;
- cumulative DOOBTUBE-2 dependency/trust verifier;
- cumulative DOOBTUBE-3 lifecycle verifier;
- DOOBTUBE-4 contract-free scope;
- canonical external service IDs;
- Media service API identity/signing-domain source checks;
- no DoobTube Solidity namespace;
- no DoobTube/420Video service identity;
- exact allowed DoobTube package inventory before DOOBTUBE-5;
- roadmap/audit completion state;
- no false deployment/testnet/Genesis/production readiness claim.

Adapter unit coverage passed for:

- exact dependency modes;
- no DoobTube contract/service identity;
- wrong-ID/chain/stale/inactive/deprecated Registry rejection;
- Media ID/version/chain/network/capability mismatch;
- incomplete/non-live Storage readiness rejection;
- Search READY/PUBLIC/Rights/chain/canonical-authority negatives;
- Notifications entitlement/sign/spend/promotional/unconfirmed negatives;
- Pay/Compute direct-call rejection;
- dependency capability allowlisting;
- canonical authority substitution rejection;
- exact repository V1 service-ID preimages.

No required DOOBTUBE-4 check was skipped, cancelled, missing, stale or silently substituted.

## Diagnosed superseded failure

Earlier implementation SHA:

`888b42b9a9e25feeb881ebf6a63d011f3b8fb075`

Workflow run: **37560570331**
Job: **112596667901**
Result: **FAIL**

Classification: **test-harness defect**.

The exact-SHA assertion, Python compilation and every protocol-adapter unit test passed.

The cumulative verifier failed only because its exact allowed-file inventory counted generated Python `__pycache__/*.pyc` files created by the immediately preceding compile/test steps.

Generated interpreter cache is not repository runtime/source and was never committed. The verifier was repaired to ignore `__pycache__` and `.pyc` artifacts while continuing to reject any unexpected committed DoobTube runtime file before DOOBTUBE-5.

No adapter, authority, protocol, privacy, accounting, replay or service-binding defect was found.

## Security/adversarial/invariant result

Qualified negative invariants include:

- no DoobTube contract/service authority;
- exact service identity required;
- inactive/deprecated/wrong-chain/stale Registry state rejected;
- incompatible Media runtime rejected;
- Storage transport cannot become readiness;
- Search cannot widen visibility or claim canonical authority;
- Notifications cannot become access entitlement/sign/spend authority;
- Pay/Compute cannot be called directly by DoobTube V1;
- capabilities remain allowlisted;
- canonical authority cannot be reassigned to DoobTube;
- no private-key or custody surface exists.

No unresolved DOOBTUBE-4 contract/adapter vulnerability remains.

## Milestone status

DOOBTUBE-4 is an **ordinary Level 1 roadmap step**.

It introduces an adapter policy but does not yet create the backend/API/service control plane or converged live cross-component implementation.

Therefore Level 2 is not triggered.

The documented Level 2 milestone remains:

**DOOBTUBE-8 — Ecosystem integration milestone**

## Intentionally deferred Level 3 qualification

Per the phase policy, the following remain deferred until **DOOBTUBE-11 — Repository Level 3 exact-head closeout**:

- canonical full repository Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- unrelated app audits;
- global fault/soak qualification;
- final client/service/Indexer/Search/RPC/frontend/backend qualification;
- final static/security/deployment/config/build/lint/type closeout.

Because DOOBTUBE-4 changes no Solidity, ABI, deployment map, address namespace or Genesis state, running the full Foundry or Genesis inventories here would be ceremonial duplication rather than directly applicable Level 1 coverage.

## Limitations and blockers

No blocker remains for DOOBTUBE-4.

The adapter package intentionally does not perform live network I/O or expose a backend API. Those responsibilities begin in DOOBTUBE-5.

## Evidence SHA rule

This document is a durable **evidence-only** update after exact implementation qualification.

It changes no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements. Therefore the qualified implementation SHA remains authoritative without recursive qualification.

## Next canonical roadmap step

**DOOBTUBE-5 — Backend/API/indexing/service control plane**

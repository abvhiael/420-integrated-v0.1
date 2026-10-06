# 420Mail MAIL-2.36 Qualification

## Step
**MAIL-2.36 — Repository Qualification**

## Completion
- Status: **COMPLETE**
- Qualification level: **Level 1 — app-scoped repository qualification**
- Level 2: **not required for this step; Product/security milestone already closed at MAIL-2.35**
- Level 3: **NOT RUN / NOT DUE**
- Qualified feature SHA: `856177bd3a7ca2b9619f0e131ab2c27cfb967c95`
- Exact tested PR merge-candidate SHA: `f0ab41aef75ca85421fb417529b6c188c3e92daa`
- Tested/current `main` parent: `9bf48f473489a2ad9d0a70f45675c644745ddde8`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

## Canonical determination
MAIL-2.36 is the repository-consistency qualification gate inside the documented Phase-closeout sequence MAIL-2.36 through MAIL-2.40.

It is **not** the complete Level-3 app-phase closeout boundary. The canonical roadmap still requires:
- MAIL-2.37 — Live Testnet Integration;
- MAIL-2.38 — Security & Operations Qualification;
- MAIL-2.39 — Genesis Catalog Decision;
- MAIL-2.40 — Production Release.

Therefore repository-wide Solidity, Genesis/address-authority, 420 Integrated/global, Docs/global, Geth/global, deployed operations, and final production qualification are not claimed here.

## Repository gap resolved
The existing Mail workflow already executed exact-head, full Mail tests, race, vet, and the cumulative verifier, but the verifier did not distinguish MAIL-2.36 as an explicit repository-qualification gate.

MAIL-2.36 adds explicit checks that the accumulated repository state remains internally consistent before entering live-testnet work.

## Explicit repository qualification checks
The verifier now asserts:

### Canonical service registration
- `config/genesis-consumer-services.json` contains `420/service/mail/v1`;
- name remains `420Mail`;
- role remains `GENESIS_SHARED_INFRASTRUCTURE_AND_THIN_UI`;
- authority remains `REPLACEABLE_COMMUNICATION_SERVICE`;
- dependency list remains exactly 420 Identity, 420 Messenger, 420 Storage, 420 Notifications;
- `mail.external_smtp` remains disabled.

### Frozen Genesis boundary
- `config/genesis-applications.json` remains FROZEN;
- 420Mail remains absent until a later explicit MAIL-2.39 catalog decision;
- repository qualification does not silently promote Genesis status.

### Readiness boundary
`testnet/public-services/mail/readiness.json` must preserve:
- canonical application/service identity;
- `contractsRequired=false`;
- `deployment_status=PENDING_PUBLIC_TESTNET`;
- `liveTestnetEvidence=false`;
- `genesisCatalogPromoted=false`;
- `genesisCloseout=false`;
- `productionReady=false`;
- the existing MAIL-AUDIT-7 live-testnet handoff and deployment blockers.

### Roadmap reconciliation
The verifier now requires:
- MAIL-2.36 through MAIL-2.40 in the Phase 2 roadmap;
- the Phase-closeout boundary;
- the global `docs/ROADMAP.md` 420Mail MAIL-AUDIT testnet handoff;
- explicit unfinished MAIL-AUDIT-7 through MAIL-AUDIT-10 state;
- `mail.external_smtp=false` in that handoff.

### Dedicated workflow coverage
The verifier now requires the Mail workflow to retain:
- exact-head assertion;
- `go test ./mail/...`;
- `go test -race ./mail/...`;
- `go vet ./mail/...`;
- `python3 scripts/verify-420mail-audit.py`.

It also requires path triggers for:
- `mail/**`;
- `config/420mail-service-v1.json`;
- `config/genesis-consumer-services.json`;
- `config/genesis-applications.json`;
- `docs/420MAIL.md`;
- `docs/420MAIL-PHASE2-ROADMAP.md`;
- `scripts/verify-420mail-audit.py`;
- `testnet/public-services/mail/readiness.json`.

## Files changed
Implementation:
- `scripts/verify-420mail-audit.py`
- `docs/420MAIL.md`

Evidence/bookkeeping:
- `docs/audit/420MAIL-MAIL-2.36-QUALIFICATION.md`
- `docs/420MAIL-PHASE2-ROADMAP.md`

## Exact-head qualification
Workflow: **420Mail Audit Qualification**
- Run: **37548461179** (#426)
- Job: **112558031121**
- Qualified feature SHA: `856177bd3a7ca2b9619f0e131ab2c27cfb967c95`
- Exact tested PR merge candidate: `f0ab41aef75ca85421fb417529b6c188c3e92daa`
- Tested `main` parent: `9bf48f473489a2ad9d0a70f45675c644745ddde8`
- Exact checkout:
  `HEAD is now at f0ab41a Merge 856177bd3a7ca2b9619f0e131ab2c27cfb967c95 into 9bf48f473489a2ad9d0a70f45675c644745ddde8`

Results:
- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- verifier output:
  - `420Mail audit qualification PASS`
  - `MAIL-2.36 repository qualification: qualified by exact-head app repository checks`

## Security / invariant results
- no new Mail protocol authority introduced;
- frozen Genesis catalog remains unchanged;
- no contract requirement introduced;
- external SMTP remains disabled;
- live-testnet, Genesis, production, and deployment readiness are not overclaimed;
- accumulated Mail tests remain green and race-clean;
- repository workflow coverage remains explicit for Mail source/config/docs/readiness changes.

## Level 2
**Not required for MAIL-2.36.**

The Product/security Level-2 milestone was already completed at MAIL-2.35. MAIL-2.36 adds repository consistency checks but does not introduce a new shared runtime dependency or documented Level-2 milestone boundary.

## Level 3
**NOT RUN / NOT DUE.**

Per the canonical phase model, comprehensive Level 3 qualification occurs only at the applicable complete app-phase closeout after later live-testnet/security/Genesis/release gates are satisfied.

The following are intentionally deferred:
- canonical full Solidity inventory;
- Genesis/address-authority verification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- Geth/global qualification;
- deployed client/service/Indexer/Search/RPC integration where applicable;
- production deployment/config evidence;
- final security/operations and release qualification.

## Blockers
No repository-side blocker remains for MAIL-2.36.

The next step is intentionally live/deployment gated. Existing blockers include real deployed Identity, Messenger, encrypted Storage and Notifications adapters plus public-testnet runtime evidence.

## Evidence inheritance
This file and roadmap/PR bookkeeping are evidence-only and inherit qualification from exact tested merge-candidate SHA `f0ab41aef75ca85421fb417529b6c188c3e92daa` without recursive qualification.

## Next canonical step
**MAIL-2.37 — Live Testnet Integration**

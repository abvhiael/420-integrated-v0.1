# PB-14 qualification evidence

## Step
**PB-14 — Backend/API hardening — COMPLETE**

## Qualification
- **Level 1 — PB-14 backend/API hardening qualification — COMPLETE**
- Level 2: not triggered; PB-13 already completed milestone D and PB-14 introduces no new canonical shared authority/lifecycle owner.
- Level 3: intentionally deferred to complete app-phase closeout.

## Qualified implementation SHA
`221960afd66635b2161dbf631a8e1e58f5dc8b46`

## Repository relationship
- branch: `puffbuddies-pb14-backend-api-hardening-20261006`
- PR: #551
- stacked base branch: `puffbuddies-pb13-cross-app-integration-20261006`
- stacked base SHA: `f9cc887f46ae17971023d66b3d4b2b9d2168e210`
- current repository `main` at qualification: `c983daf1b451e1efe93a4ea87ed9d9f91528fb48`
- PB-11/PB-12/PB-13 remain open/qualified and intentionally unmerged.
- PR #551 was mergeable at qualification inspection.

## Implementation summary
PB-14:
- materializes the canonical `puffbuddies/api/` boundary;
- implements explicit PB-11/PB-12 route and method admission;
- requires effective HTTPS and an explicit allowed-host set;
- denies cross-site and mismatched-Origin requests;
- requires bounded Bearer authentication and current non-revoked/non-expired session authority;
- bounds content types and request-body sizes;
- rejects duplicate JSON keys and Content-Length disagreement;
- requires per-mutation idempotency keys;
- applies session/route rate limiting before business dispatch;
- rejects replay before application/domain dispatch;
- returns no-store and defensive security headers;
- uses bounded/generated request correlation;
- limits audit metadata to request ID, route ID and status;
- maps domain denial/dependency failure to generic fail-closed transport responses;
- rejects stale gateway authority generations;
- binds web/mobile mutations to replay protection;
- adds a deployment-neutral WSGI composition adapter;
- preserves all PB-13 cross-app authority boundaries;
- introduces no new contract, address, service ID, production hostname, credential or live deployment claim.

## Files changed
- `puffbuddies/api/__init__.py`
- `puffbuddies/api/hardening.py`
- `puffbuddies/api/wsgi.py`
- `puffbuddies/web/api-client.js`
- `puffbuddies/mobile/core/api-client.js`
- `puffbuddies/tests/test_pb_14_backend_api_hardening.py`
- `scripts/verify-puffbuddies-pb14.py`
- `.github/workflows/puffbuddies-pb14.yml`
- `.github/workflows/puffbuddies-pb0.yml`
- `docs/puffbuddies/PB-14-BACKEND-API-HARDENING.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `docs/puffbuddies/PB-0.19-MASTER-IMPLEMENTATION-ROADMAP.md`

## Exact-SHA Level-1 qualification

### PuffBuddies PB-14 Qualification
- workflow: **PuffBuddies PB-14 Qualification**
- run: `37552638976` — **SUCCESS**
- job: `112571475592` (`pb14`) — **SUCCESS**
- exact-head verification — PASS
- Python compilation — PASS
- PB-14 targeted backend/API hardening tests — PASS
- PB-14 hardening verifier — PASS
- complete retained PuffBuddies Python regressions — PASS
- retained PB-11 web tests/build — PASS
- retained PB-12 mobile tests/build — PASS
- PB-0 structure/authority verifier — PASS
- retained PB-13 cross-app verifier — PASS
- API privacy/authority negative gate — PASS

### Directly affected PB-0 owner
PB-14 materializes the PB-0.17-reserved API path and updates PB-0.19 current phase mapping.
- workflow: **PuffBuddies PB-0 Qualification**
- run: `37552639205` — **SUCCESS**
- job: `112571477859` (`pb0-fast`) — **SUCCESS**
- PB-0 canonical verifier — PASS
- PB-0 documentation invariant mutation tests — PASS
- implementation-path authorization gate — PASS

## Diagnosed superseded failure
Initial implementation candidate `ff96c27f28df91b31fea4307297dd444c235d560` passed the PB-14 workflow but PB-0 run `37552502411` failed only at **Reject implementation paths not yet authorized by current roadmap** because the historical PB-0 workflow still listed `puffbuddies/api` as forbidden.

That was a CI classification defect after current PB-14 canonically authorized the PB-0.17-reserved API path. The repair:
- removed only `puffbuddies/api` from the PB-0 forbidden-path list;
- retained all other not-yet-authorized path prohibitions;
- added PB-0 workflow changes to PB-14 qualification triggers;
- requalified the new exact implementation SHA `221960afd66635b2161dbf631a8e1e58f5dc8b46`.

The deterministic failure was diagnosed before rerun and is superseded by the successful exact-head evidence above.

## Security/adversarial results
PASS for:
- non-HTTPS transport;
- unapproved host;
- cross-site request;
- mismatched Origin;
- missing/invalid/revoked/expired session;
- authentication dependency outage;
- unknown route/wrong method;
- GET request body;
- unsupported media/content type;
- malformed/duplicate-key JSON;
- oversized request body;
- Content-Length mismatch;
- missing/invalid mutation idempotency key;
- duplicate/replayed mutation;
- replay-store failure;
- rate-limit denial and limiter failure;
- domain authorization denial;
- gateway/dependency outage;
- stale authority generation;
- private body/token/subject exclusion from audit metadata;
- forwarded-proto trust bypass;
- forbidden force-match/unblock/admin/safety-bypass API authority.

## Milestone status
No new Level-2 milestone is created by PB-14. The existing PB-13 milestone D remains the current retained cross-app integration milestone, and PB-14 re-ran the relevant retained application/client suites inside its Level-1 workflow.

## Intentionally deferred Level 3
Deferred to complete app-phase closeout:
- reconciliation of the complete accumulated PuffBuddies phase with then-current `main`;
- canonical full Solidity inventory;
- Genesis/address/namespace/frozen-address/manifest authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- Geth/fault/soak qualification;
- full deployment/configuration verification;
- final release/operations evidence.

## Limitations / later owners
- No public API endpoint or production hostname is configured.
- No production session provider, replay store, rate-limit backend, audit backend or application gateway deployment is claimed.
- No infrastructure credentials/secrets are committed.
- PB-15 owns the next canonical **Qualification** phase.
- PB-16 owns **Security/privacy audit**.
- PB-17+ own live testnet/mainnet/public release qualification.

## Blockers
**None for repository PB-14 qualification.**

## Completion state
**PB-14 COMPLETE** against exact implementation SHA `221960afd66635b2161dbf631a8e1e58f5dc8b46`.

## Evidence inheritance
Subsequent commits that add this qualification record and the roadmap COMPLETE marker are evidence-only provided they change no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements. They inherit the qualified implementation SHA above and require no recursive qualification.

## Next canonical roadmap step
**PB-15 — Qualification**

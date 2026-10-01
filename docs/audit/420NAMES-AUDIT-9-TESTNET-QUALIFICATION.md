# NAMES-AUDIT-9 — Production-equivalent testnet deployment qualification

Status: **NOT YET COMPLETE — BLOCKED ON OFFICIAL TESTNET**

Repository-side implementation status: **COMPLETE AND QUALIFIED**

Qualification level executed: **Level 1 harness/readiness qualification**

Qualified implementation SHA: `901a7b0a762ef14adb8080873ecc2e393f74afaf`

420Names exact-head qualification run: `36806948461` — **SUCCESS**

Directly affected 420Indexer run for the live-evidence module/tests: `36806878687` — **SUCCESS**

## Canonical requirement

NAMES-AUDIT-9 requires a production-equivalent official testnet deployment and live evidence for:

- selected chain identity;
- deployed code at canonical Names420 address `0x0000000000000000000000000000000000000435`;
- exact runtime code hash;
- predeploy/storage state;
- governance binding;
- ProtocolRegistry discovery;
- Wallet resolution against that same deployment;
- 420Indexer and 420Search state derived from that chain;
- complete user lifecycle: commit/register, renew, resolution, reverse and transfer/acceptance.

Repository-only or simulated evidence cannot satisfy those live exit criteria.

## Current external blocker

Repository truth currently contains no official public testnet network manifest:

`developer-hub/manifests/testnet.json` — **ABSENT**

The repository explicitly states that no testnet hostname, chain ID, RPC URL or Faucet URL should be invented before an official manifest is published.

Current launch/service state is also not production-equivalent:

- `testnet/config/launch.json` records chain ID `420` as `CANDIDATE_PENDING_COLLISION_PREFLIGHT`;
- `testnet/services/endpoints.json` still contains `REPLACE_WITH_*` / `PLACEHOLDER` values;
- no retained NAMES-AUDIT-9 PASS evidence exists, correctly;
- no live qualification is claimed.

Exact-head readiness output:

```
NAMES_AUDIT_9_READINESS=BLOCKED_OFFICIAL_TESTNET_MANIFEST
liveQualificationComplete=false
```

## Repository implementation completed

### Live evidence contract

`420-indexer/src/names-testnet-qualification.ts`

The evidence contract fails closed unless the official manifest and live observations agree on:

- environment `testnet`;
- positive manifest/live chain ID;
- secure HTTPS RPC with no embedded credentials;
- canonical Names420 `0x0435`;
- canonical ProtocolRegistry `0x0434`;
- valid genesis hash and live block number;
- Names runtime hash `0xa974fffd3a40e7f28db41e4ae30656b33789d2483b18b47c809ce2385de709b7`;
- `systemName() == "Names420"`;
- `protocolVersion() == 3`;
- governance timelock `0x0429`;
- expected zero mapping-root storage slots;
- active Registry discovery of the Names service at `0x0435` with the same runtime hash;
- all seven lifecycle transaction receipts;
- post-transfer owner/resolution reset and profile/service clearing;
- stale reverse record no longer authoritative;
- Indexer chain identity and latest lifecycle event;
- Search owner/resolution/provenance agreement;
- Wallet client resolution agreement;
- exact repository implementation SHA.

Registry publication revision is deliberately treated independently from Names protocol version. The live verifier requires a positive active Registry revision; it does not incorrectly require Registry revision `3`.

### Hostile-state tests

`420-indexer/test/names-testnet-qualification.test.ts`

The suite covers:

- official testnet manifest acceptance;
- rejection of local environments;
- rejection of HTTP/insecure RPC;
- rejection of embedded endpoint credentials;
- missing Indexer service;
- wrong Names address;
- wrong live chain ID;
- wrong runtime hash;
- wrong contract identity/version;
- wrong governance binding;
- wrong storage roots;
- wrong/inactive Registry discovery;
- complete lifecycle evidence;
- missing transaction evidence;
- stale post-transfer owner/resolution/profile/reverse evidence;
- wrong Indexer chain/latest event;
- stale Search state;
- stale Wallet resolution;
- exact repository-SHA binding;
- rejection of local-example provenance;
- empty runtime-code rejection.

Exact-head Names run: **10/10 PASS**.

### Live production-equivalent runner

`420-indexer/scripts/qualify-names-testnet.mjs`

Once the official testnet exists, the runner:

1. loads and validates the official manifest;
2. requires HTTPS RPC/Indexer/Search endpoints;
3. requires two distinct disposable testnet accounts supplied only through protected environment secrets;
4. verifies RPC chain identity and Genesis block;
5. reads live Names runtime code and computes the exact runtime hash;
6. checks Names identity/version/governance and storage roots;
7. verifies ProtocolRegistry active discovery of Names420;
8. performs a real commit/reveal registration;
9. renews the lease;
10. writes resolution/profile/service data;
11. writes and verifies reverse resolution;
12. nominates transfer to the second account;
13. accepts transfer from the second account;
14. proves the accepted transfer reset owner/resolution and cleared profile/service;
15. proves stale reverse resolution is no longer authoritative;
16. resolves the same name through the real Wallet Names client;
17. polls 420Indexer until the canonical `NameTransferred` event is visible;
18. polls 420Search until owner/resolution reconstruction agrees;
19. validates the entire evidence package against the exact repository SHA;
20. writes retained JSON evidence.

Signing keys are never committed and are required only as protected CI/deployment secrets:

- `NAMES_TESTNET_OWNER_PRIVATE_KEY`
- `NAMES_TESTNET_RECIPIENT_PRIVATE_KEY`

### Manual live workflow

`.github/workflows/names-live-testnet.yml`

This workflow is intentionally `workflow_dispatch` only. It requires:

- official manifest path;
- public 420Search HTTPS origin;
- protected disposable testnet account secrets;
- exact checkout SHA.

It uploads the resulting live evidence artifact only after the full production-equivalent lifecycle succeeds.

### Readiness verifier

`scripts/verify-names-audit-9-testnet-readiness.py`

The verifier enforces both sides of the deployment boundary:

- today, with no official manifest, the repository must remain explicitly blocked and must not contain fabricated PASS evidence;
- once the official manifest appears, secure non-placeholder endpoints, Names/Registry bindings and retained PASS evidence become mandatory.

## Level 1 results

Exact implementation head `901a7b0a762ef14adb8080873ecc2e393f74afaf`:

Names audit run `36806948461` — **SUCCESS**

- exact-head verification — PASS
- Genesis interface inventory — PASS
- Names dependency model — PASS
- Solidity formatting — PASS
- NAMES-AUDIT-5 frozen artifact verification — PASS
- NAMES-AUDIT-8 operator-document verification — PASS
- NAMES-AUDIT-6 deterministic Genesis verification — PASS
- NAMES-AUDIT-9 live-evidence module build — PASS
- NAMES-AUDIT-9 hostile/readiness suite — **10/10 PASS**
- fail-closed official-testnet readiness check — PASS
- Wallet Names integration/management tests — PASS
- Wallet Names static qualification — PASS
- authority/opcode scan — PASS

The current step did not modify Names420 contract/hardening or NAMES-AUDIT-7 Indexer/Search descriptor implementation, so their Level-2/Slither and descriptor-specific gates were correctly not rerun on this ordinary Level-1 head.

Directly affected full 420Indexer suite:

Run `36806878687` — **SUCCESS**

The initial full-Indexer attempt exposed only a negative-test expected-message mismatch. The validator correctly rejected stale post-transfer resolution; the test was corrected to assert the actual semantic error. The subsequent full suite passed.

## Exit-criterion status

| Canonical criterion | Status |
| --- | --- |
| Production-equivalent official testnet available | **BLOCKED** |
| Official chain ID / Genesis identity verified live | **NOT RUN — BLOCKED** |
| `eth_getCode` / exact Names runtime hash at `0x0435` | **NOT RUN — BLOCKED** |
| live storage verification | **NOT RUN — BLOCKED** |
| live governance binding | **NOT RUN — BLOCKED** |
| live ProtocolRegistry discovery | **NOT RUN — BLOCKED** |
| live Wallet resolution | **NOT RUN — BLOCKED** |
| live Indexer state/events | **NOT RUN — BLOCKED** |
| live Search reconstruction | **NOT RUN — BLOCKED** |
| real commit/register/renew/resolution/reverse/transfer flow | **NOT RUN — BLOCKED** |
| repository live-qualification harness | **SATISFIED** |
| hostile/fail-closed harness tests | **SATISFIED** |
| exact-head repository qualification | **SATISFIED** |

Because the live criteria are the substance of NAMES-AUDIT-9, this roadmap step **must remain open**.

## Level 2 status

No new Level-2 milestone is required merely to add the testnet harness. The NAMES-AUDIT-7/8 app-integration milestone already passed on exact SHA `4ddc8fb33db6ce2b5d908e9fcaf8c98934ac06a2`.

A future live production-equivalent execution is itself material cross-component evidence, but it does not justify inventing a synthetic Level-2 substitute while the official network is absent.

## Level 3

Intentionally deferred until the complete Names app phase:

- current-main reconciliation;
- repository-wide contracts/Genesis;
- 420 Integrated Qualification;
- Docs/global reconciliation;
- global Indexer/Search/RPC qualification;
- broader security/static suites;
- complete deployment/config verification;
- final accumulated merge-candidate qualification.

## Current main divergence

Current main observed during this evidence closeout:

`df8f639d8f43b763298c8750ef49d3e5849c597c`

Full main reconciliation remains a Level-3 closeout requirement.

## Blocker removal / exact continuation

Do not advance to NAMES-AUDIT-10.

When the official testnet manifest and non-placeholder production-equivalent endpoints are published:

1. fund two disposable testnet accounts;
2. configure the two protected workflow secrets;
3. run `420Names live testnet qualification` on the exact candidate SHA;
4. retain the generated PASS JSON as `docs/audit/420NAMES-AUDIT-9-LIVE-TESTNET-EVIDENCE.json` after independent review;
5. rerun the readiness verifier;
6. only then mark NAMES-AUDIT-9 COMPLETE and advance.

## Next canonical roadmap step

**NAMES-AUDIT-9 — production-equivalent testnet deployment** remains the current canonical step until the official live deployment criteria are satisfied.

NAMES-AUDIT-10 must not begin yet.

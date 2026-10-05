# CMP-3.5 — Content-addressed work-unit download qualification evidence

Status: **COMPLETE**

## Roadmap step

- Step: **CMP-3.5 — Content-addressed work-unit download**
- Qualification level: **Level 1**
- Milestone relationship: ordinary CMP-3 step; Level 2 not required
- Level 3: deferred to **CMP-3.14 — Phase closeout**

## Qualified implementation

- Implementation SHA: `14f178762534d23a5519782960735eb98a4a6ac7`
- Current `main` at qualification: `f6a426fc386b21f871b1805e00a57b1dad2bf902`
- Audit branch: `cmp-3.1-worker-daemon-20261004`
- Pull request: **#512 — CMP-3: node420 compute worker runtime**
- Branch divergence at qualification: **71 commits ahead / 109 behind** current `main`
- Merge base: `2280fb6f9915b849560d9d4d5a95d999c4adc669`

The branch is intentionally not fully reconciled during this ordinary Level 1 step. The relevant shared dependency surfaces were checked against current `main` and were blob-identical:

- `docs/compute-market/CMP-0.11-CLIENT-NODE-AND-420AI-INTEGRATION.md`;
- `execution/storage/filestore.go`;
- `execution/storage/developer_upload.go`.

No relevant shared dependency change requires an early Level 3 reconciliation.

## Implementation summary

CMP-3.5 adds a bounded HTTPS work-unit downloader under `compute/worker`.

Changed implementation/qualification surfaces:

- `compute/worker/download.go`;
- `compute/worker/download_test.go`;
- `.github/workflows/compute-worker-fast.yml`;
- `scripts/verify-cmp-3-5-content-addressed-work-unit-download.py`;
- `docs/compute-market/CMP-3.5-CONTENT-ADDRESSED-WORK-UNIT-DOWNLOAD.md`;
- `docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md`.

The downloader:

- accepts HTTPS sources only;
- requires exact lowercase SHA-256 and exact nonzero bounded byte length;
- rejects URL userinfo and fragments;
- supports request-scoped authorization without persistence;
- unconditionally rejects redirects even if a supplied client would otherwise follow them;
- streams into a private temporary file with expected-size + 1 bounding;
- hashes while streaming;
- requires exact size and digest before publication;
- optionally enforces declared media type;
- publishes verified bytes under `<stateDir>/work-units/sha256/<digest>.bin`;
- uses private directory/file permissions;
- syncs file and directory state around atomic publication;
- rehashes cached content before reuse;
- rejects symlink/non-regular cache entries;
- deletes corrupt cache content and reacquires it.

The downloader never executes work-unit bytes.

## Requirements satisfied

1. HTTPS-only work-unit retrieval.
2. Canonical lowercase SHA-256 content address required.
3. Exact nonzero bounded expected size required.
4. URL userinfo/fragments and unsafe header values rejected.
5. Redirects unconditionally rejected by a cloned client policy.
6. Request-scoped optional source authorization.
7. Authorization failure occurs before any network request.
8. Response body streamed through expected-size + 1 limit.
9. Exact streamed byte count required.
10. SHA-256 computed while streaming and compared exactly.
11. Optional declared media type enforced.
12. Failed downloads do not publish final artifact paths.
13. Content-addressed private cache path uses only validated digest.
14. Cached content is size/digest reverified before reuse.
15. Symlink/non-regular cache entries are not trusted.
16. Corrupt cache entries are reacquired.
17. Private temp file + sync + atomic rename + directory sync publication.
18. No execution/lifecycle/receipt/result authority introduced.
19. CMP-3.1 through CMP-3.4 remain regression-qualified.

## Security/adversarial results

Targeted coverage proves rejection or safe handling for:

- plaintext HTTP;
- URL credentials/userinfo;
- URL fragments;
- uppercase/malformed SHA-256;
- zero/oversized declarations;
- digest mismatch;
- truncated response;
- oversized response;
- HTTP redirect;
- media-type mismatch;
- corrupt cached bytes;
- symlink cache entry;
- authorization failure before request transmission.

Failed integrity checks leave no final content-addressed artifact.

## Exact-head Level 1 qualification

Required owner: **Compute Worker Fast Qualification**

- Workflow run number: **#83**
- GitHub Actions run ID: `37252325225`
- Job ID: `111582322633`
- Qualified implementation SHA: `14f178762534d23a5519782960735eb98a4a6ac7`
- Result: **SUCCESS**

Passing exact-head checks:

- checkout exact qualification head — PASS;
- verify exact qualification head — PASS;
- `go test ./compute/worker` — PASS;
- `go test ./execution/cmd/node420-compute` — PASS;
- `go vet ./compute/worker ./execution/cmd/node420-compute` — PASS;
- `go build ./execution/cmd/node420-compute` — PASS;
- build local CMP-3.4 sandbox probe image — PASS;
- real Docker sandbox isolation regression — PASS;
- CMP-3.1 daemon regression verifier — PASS;
- CMP-3.2 hardware/software discovery regression verifier — PASS;
- CMP-3.3 benchmark/capability evidence regression verifier — PASS;
- CMP-3.4 secure workload sandbox regression verifier — PASS;
- CMP-3.5 content-addressed work-unit download verifier — PASS.

No required CMP-3.5 Level 1 check was skipped, cancelled, missing or substituted.

## Level 2 status

**Not required for CMP-3.5.**

CMP-3.5 adds an app-local retrieval/integrity primitive and does not introduce a new shared authority or cross-component lifecycle. A later meaningful CMP-3 runtime convergence point may use broader app integration.

## Intentionally deferred

- CMP-3.6 execution lifecycle and assignment/attempt authorization;
- CMP-3.7 checkpointing/resume;
- CMP-3.8 result commitment;
- CMP-3.9 execution-key signed receipt;
- CMP-3.10 result/evidence upload;
- CMP-3.11 local resource controls;
- CMP-3.12 malicious workload protections beyond download-integrity controls;
- CMP-3.13 Windows/Linux/macOS packaging;
- complete accumulated reconciliation and Level 3 qualification at CMP-3.14.

No live/testnet dependency is required for CMP-3.5.

## Evidence-only closeout rule

The evidence and status commits following the qualified implementation SHA change documentation/bookkeeping only. They do not modify executable code, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements. They therefore reference the qualified implementation SHA above without recursively requiring another Level 1 qualification.

## Formal status

**CMP-3.5 — Content-addressed work-unit download: COMPLETE.**

Next canonical step: **CMP-3.6 — Execution lifecycle**.

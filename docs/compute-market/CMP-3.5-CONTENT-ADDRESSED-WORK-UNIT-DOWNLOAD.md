# CMP-3.5 — Content-addressed work-unit download

Status: **COMPLETE — Level 1 exact-head qualified on `14f178762534d23a5519782960735eb98a4a6ac7`.**

## Canonical definition

**Content-addressed work-unit download.**

CMP-3.5 gives the compute worker a bounded retrieval primitive for immutable work-unit artifacts. Downloaded bytes are accepted only when the exact declared size and SHA-256 content address match.

This step retrieves and verifies bytes only. It does not create attempts, authorize execution, start the sandbox, checkpoint work, produce result commitments, sign receipts, or upload results.

## Architecture boundary

The controlling worker architecture requires immutable artifact-digest verification before execution and requires inputs/outputs/secrets to remain off-chain over authenticated encrypted channels.

CMP-3.5 therefore establishes these worker-side invariants:

- remote retrieval uses HTTPS only;
- mutable or malformed content commitments are rejected;
- retrieval may use a request-scoped authorizer without persisting credentials;
- redirects are rejected;
- a response cannot be promoted to the local work-unit cache until exact size and SHA-256 verification succeed;
- cached bytes are reverified before reuse;
- work-unit files live in private worker state and are never executed directly by the downloader.

Authentication policy/attempt authorization remains separate from the downloader. Public immutable artifacts may be retrieved without an authorizer; private sources can inject request-scoped authorization through the `RequestAuthorizer` interface.

## Implementation

### Work-unit source

`compute/worker/download.go` defines:

- schema `420-compute-worker-work-unit-download-v1`;
- HTTPS source URL;
- lowercase 64-hex SHA-256 content address;
- exact expected byte length;
- optional media type;
- optional purpose label.

Rejected source forms include:

- HTTP/plaintext transport;
- URL userinfo;
- URL fragments;
- uppercase, malformed, or incomplete digests;
- zero-sized artifacts;
- artifacts above the configured worker limit;
- malformed purpose/media-type header values.

### Streaming retrieval

The downloader streams the response through:

1. an expected-size + 1 reader limit;
2. a private temporary file;
3. a SHA-256 hasher.

It requires:

- HTTP 2xx;
- no redirect;
- exact `Content-Length` when the server supplies one;
- exact streamed byte count;
- exact SHA-256 digest;
- exact media type when the canonical source declares one.

Oversized and truncated bodies fail closed.

### Content-addressed cache

Verified artifacts are stored under:

`<stateDir>/work-units/sha256/<digest>.bin`

Security properties:

- cache directory mode `0700`;
- artifact mode `0600`;
- file name derived exclusively from validated digest;
- no caller-controlled path component;
- temporary write + `fsync` + atomic rename;
- directory synchronization after publication;
- no verified path is returned until integrity checks pass.

Existing cache entries are not trusted by filename alone. Before reuse the worker requires:

- regular file;
- not a symlink;
- exact size;
- recomputed SHA-256 digest match.

A corrupt cache entry is deleted and reacquired.

### Redirect/credential boundary

The downloader clones the supplied HTTP client and unconditionally installs a no-redirect policy.

A caller therefore cannot weaken the worker's redirect rule through a permissive `http.Client.CheckRedirect`.

Authorization is injected only into the outbound `http.Request` through `RequestAuthorizer`. The downloader stores neither authorization material nor the source URL in the returned artifact/cache metadata.

### Non-execution boundary

CMP-3.5 never:

- invokes `exec.Command*`;
- starts Docker/Podman;
- executes downloaded files;
- marks an attempt running/completed;
- claims correctness;
- signs receipts;
- uploads outputs.

The only output of a successful fetch is a locally verified immutable artifact reference. CMP-3.6 must separately authorize and execute work through the CMP-3.4 sandbox.

## Security/adversarial requirements

CMP-3.5 must reject or safely handle:

- plaintext HTTP sources;
- URL credentials/userinfo;
- URL fragments;
- malformed/uppercase hashes;
- zero/oversize declarations;
- HTTP redirects;
- non-2xx responses;
- mismatched `Content-Length`;
- truncated bodies;
- oversized bodies;
- digest substitution;
- media-type mismatch when declared;
- authorization failure before network transmission;
- corrupt cache content;
- symlink cache entries;
- context cancellation;
- partial downloads.

Failed downloads must not publish the target content-addressed path.

## Exit criteria

CMP-3.5 is complete when one exact implementation SHA proves all of the following:

1. work-unit sources require HTTPS;
2. every source requires a canonical lowercase SHA-256 digest and exact nonzero bounded size;
3. URL userinfo/fragments and unsafe header values are rejected;
4. redirects cannot be enabled by the caller;
5. optional authorization is request-scoped and authorization failure makes no request;
6. responses are streamed with an expected-size + 1 hard bound;
7. exact streamed size is required;
8. SHA-256 is computed while streaming and must exactly equal the declared content address;
9. declared media type is checked when present;
10. failed size/digest/media/HTTP/authorization checks never publish the final artifact;
11. cache files are private and content-addressed solely by validated digest;
12. cache reuse requires regular-file, non-symlink, exact-size and recomputed-digest verification;
13. corrupt cache entries are reacquired rather than trusted;
14. publication uses private temp files, sync and atomic rename;
15. the downloader does not execute downloaded bytes or cross into CMP-3.6 lifecycle authority;
16. CMP-3.1 through CMP-3.4 regressions remain green;
17. targeted Go tests, vet, build and CMP-3.5 verifier pass on the same exact SHA.

## Qualification evidence

- Implementation SHA: `14f178762534d23a5519782960735eb98a4a6ac7`
- Compute Worker Fast Qualification: **#83**
- Run ID: `37252325225`
- Job ID: `111582322633`
- Result: **SUCCESS**
- Durable evidence anchor: `81919b68dc76923e7d87d452b887949e370b0fe4`
- Evidence record: [CMP-3.5 qualification evidence](CMP-3.5-QUALIFICATION-EVIDENCE.md)

## Qualification model

CMP-3.5 is an ordinary **Level 1** roadmap step.

Required owner: **Compute Worker Fast Qualification**.

This step introduces no shared contract, ABI, address, registry, custody, settlement, verifier or client authority change. Level 2 is therefore not required.

Level 3 remains reserved for **CMP-3.14 — Phase closeout**, where the accumulated CMP-3 branch is reconciled to current `main` and comprehensively qualified.

## Limitations / deliberately deferred

- assignment and attempt authorization — CMP-3.6;
- execution lifecycle — CMP-3.6;
- checkpointing/resume — CMP-3.7;
- result commitment — CMP-3.8;
- execution-key signed receipt — CMP-3.9;
- result/evidence upload — CMP-3.10;
- local resource controls — CMP-3.11;
- malicious workload protections beyond download integrity — CMP-3.12;
- OS packaging — CMP-3.13;
- complete branch reconciliation/global qualification — CMP-3.14.

Next canonical step: **CMP-3.6 — Execution lifecycle**.

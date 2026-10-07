# 420Media — MEDIA-AUDIT-5 qualification evidence

## Step

**MEDIA-AUDIT-5 — Basic livestreaming service**

Status: **COMPLETE**

Qualification level: **Level 2 — app integration milestone qualification**

This is the documented Media integration milestone following MEDIA-AUDIT-3 operator discovery and MEDIA-AUDIT-4 Storage-backed video upload/media-asset lifecycle.

## Authoritative implementation

- implementation SHA: `6833ed362214f453bfe0fb224424e7f09c7eb1f9`
- qualification base/current main SHA: `23ebff000a471bfbc4439894f797f3b17a530867`
- original audit baseline SHA: `d86a3810d2901dc1082b65dc9061896c46e1911d`
- audit branch: `audit/420media-complete-20261006`
- active PR: **#536**

## Implementation completed

MEDIA-AUDIT-5 now turns the existing live-gateway transport primitives into a Media application service with:

- create/start/stop/status session flows;
- canonical `MediaStreamRegistry420` controller lookup over the existing Media JSON-RPC abstraction;
- canonical controller revalidation on every controller-scoped action;
- retirement-aware authority semantics;
- Genesis feature-gate enforcement for `media.livestreaming`;
- durable `desired_live` session state;
- atomic file-backed session persistence;
- restart recovery for desired-live sessions;
- controller-transfer and retirement checks before recovery;
- bounded reconnect attempts;
- failed-stop semantics that persist `desired_live=false` before transport teardown;
- live-gateway restart support for failed and previously closed sessions;
- bounded endpoint, credential-reference, resolved bearer credential and session-duration inputs;
- explicit preservation of the off-chain raw-media and secret boundary.

## Canonical authority boundary

`MediaStreamRegistry420` remains authoritative for stream ownership/controller state.

The application-local durable session record is never sufficient authorization to start or recover a stream. The service re-reads canonical stream state before create/start/recovery and rejects:

- missing or malformed chain state;
- RPC failure;
- controller mismatch/transfer;
- retired streams for create/start/recovery.

The current controller may still inspect or stop a retired stream so canonical retirement cannot strand an already-running local transport.

## Feature-flag semantics

Canonical feature key:

`media.livestreaming`

Create, start and automatic recovery fail closed when the feature is disabled or feature-gate state cannot be obtained.

Status and stop remain available for already-created sessions so a disabled feature cannot prevent safe inspection or shutdown.

The Level 2 workflow also validates the canonical GEN-SVC registry contract with `scripts/validate-gen-svc-0.py`, proving the Genesis default remains enabled as documented.

## Persistence and recovery

The file-backed store uses:

- parent directory mode `0700`;
- state file mode `0600`;
- temporary-file + rename persistence;
- durable controller/session specification/lifecycle/reconnect state;
- opaque credential reference only.

Resolved bearer credentials, stream payloads and raw media are never persisted.

Recovery processes only records with `desired_live=true`, revalidates canonical ownership/state, applies the reconnect ceiling, and starts/restarts the transport only after those checks pass.

## Reconnect/failure semantics

Default reconnect-attempt ceiling: **3**.

- failed start/reconnect increments the durable counter;
- success resets the counter;
- reaching the bound produces `ErrRecoveryExhausted`;
- controller transfer clears `desired_live` and prevents automatic restart;
- failed stop retains `desired_live=false`, preventing accidental recovery;
- failed/closed gateway sessions may be explicitly restarted;
- active desired-live starts are idempotent.

## Input/credential bounds

- endpoint: maximum **4096 bytes**;
- opaque credential reference: maximum **256 bytes**;
- resolved WHIP/WHEP bearer credential: maximum **4096 bytes**;
- maximum session duration: **24 hours**.

Credentials embedded in endpoint userinfo remain rejected.

RTMP/SRT continue to receive endpoints as a single argv element and only an opaque credential reference; shell expansion is not introduced.

## Files introduced or changed for this step

- `media/livestream/service.go`
- `media/livestream/store_file.go`
- `media/livestream/ethereum_authority.go`
- `media/livestream/service_test.go`
- `media/livestream/ethereum_authority_test.go`
- `media/node/livegateway/gateway.go`
- `media/node/livegateway/drivers.go`
- `media/node/livegateway/recovery_test.go`
- `docs/420-MEDIA-LIVESTREAM-SERVICE.md`
- `scripts/verify-420media-audit.py`
- `.github/workflows/420media-audit.yml`
- `docs/420MEDIA-AUDIT.md`

## Requirements satisfied

- create flow: **PASS**
- start flow: **PASS**
- stop flow: **PASS**
- status flow: **PASS**
- controller authorization: **PASS**
- direct canonical stream-controller reader: **PASS**
- retired-stream fail-closed start/recovery: **PASS**
- feature-flag enforcement: **PASS**
- bounded credential resolution: **PASS**
- bounded endpoint/session inputs: **PASS**
- reconnect/failure semantics: **PASS**
- reconnect exhaustion: **PASS**
- persistent session state: **PASS**
- restart recovery: **PASS**
- controller-transfer recovery rejection: **PASS**
- safe stop persistence ordering: **PASS**
- raw-media/secret persistence boundary: **PASS**

Every canonical MEDIA-AUDIT-5 exit criterion is satisfied at repository scope.

## Exact-head Level 2 qualification

Workflow: **420Media audit**

- run: **37503557911**
- run number: **53**
- job: **112406387618**
- exact implementation SHA assertion: **PASS**
- canonical Media audit verifier: **PASS**
- changed-surface gofmt gate: **PASS**
- GEN-SVC-0 validator / feature contract: **PASS**
- `go test ./media/... ./cmd/420media-node`: **PASS**
- `go vet ./media/... ./cmd/420media-node`: **PASS**
- Media Solidity build: **PASS**
- retained Media Phase 1 protocol/hardening tests: **PASS**
- Media Anvil integration: **PASS**
- workflow conclusion: **SUCCESS**

This is the required broader retained app-specific Level 2 suite. It includes accumulated MEDIA-AUDIT-3, MEDIA-AUDIT-4 and MEDIA-AUDIT-5 Go coverage without expanding into unrelated repository-wide qualification.

## Diagnosed superseded runs

Superseded/intermediate runs are not qualification evidence.

- earlier runs exposed changed-source and inherited Phase 2 gofmt drift;
- the gate was narrowed to changed milestone surfaces rather than reformatting unrelated previously-qualified packages;
- run #52 reached the actual Go suite and failed because the new retired-stream test contained one unused local variable;
- that deterministic test-harness compile defect was fixed before run #53;
- no protocol assertion was weakened, skipped or removed to achieve qualification.

## Security / adversarial / failure-path results

PASS at the Level 2 milestone for:

- stale local controller state cannot authorize restart;
- controller transfer prevents recovery;
- retired canonical streams cannot create/start/recover;
- feature disable prevents create/start/recovery;
- feature disable does not block safe stop/status;
- canonical RPC failure cannot fall back to disk state;
- reconnect attempts are bounded;
- failed stop cannot create automatic restart intent;
- transport restart is limited to failed/closed state;
- endpoint userinfo secrets remain rejected;
- oversized opaque/resolved credentials fail closed;
- raw media and resolved secrets remain outside persistent control-plane state;
- direct argv transport semantics remain unchanged;
- prior Storage lifecycle and operator-discovery regressions remain protected by the accumulated Media suite.

## Milestone status

**Level 2 milestone COMPLETE.**

This milestone validates the accumulated Media application work through basic livestreaming.

It does **not** trigger Level 3.

## Intentionally deferred Level 3 checks

Deferred until the complete Media audit phase closeout:

- canonical full repository Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- repository-wide clients/services/Indexer/Search/RPC qualification outside affected Media scope;
- repository-wide security/static/deployment/configuration closeout;
- final reconciliation of the complete accumulated Media merge candidate against then-current `main`.

## Later canonical roadmap boundaries

- MEDIA-AUDIT-6 — Identity, Rights and ownership/provenance integration
- MEDIA-AUDIT-7 — Pay and Compute integration
- MEDIA-AUDIT-8 — Search, Notifications and indexing projections
- MEDIA-AUDIT-9 — Stable /v1 API and typed SDK
- MEDIA-AUDIT-10 — User-facing 420Media application
- MEDIA-AUDIT-11 — Security, abuse, moderation and repository closeout
- MEDIA-AUDIT-12 — Production-equivalent public-testnet qualification
- MEDIA-AUDIT-13 — Genesis / production release

## Limitations

- No public `/v1` Media API is claimed by this step.
- No user-facing Media UI is claimed.
- Identity/Wallet and Rights authority composition remains MEDIA-AUDIT-6.
- The feature-gate interface is application/runtime configuration; production deployment binding remains release-stage work.
- The canonical stream reader requires the qualified target MediaStreamRegistry address and ABI selector at runtime; this step does not invent a fixed address.
- File persistence is qualified for one-host restart recovery. Distributed/multi-host session coordination remains deployment architecture work and must not treat independent local files as shared authority.

## Blockers

None for MEDIA-AUDIT-5 repository Level 2 completion.

## Next canonical roadmap step

**MEDIA-AUDIT-6 — Identity, Rights and ownership/provenance integration**

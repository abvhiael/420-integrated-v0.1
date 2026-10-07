# DoobTube — DOOBTUBE-6 qualification evidence

Roadmap step: **DOOBTUBE-6 — Media processing, delivery and livestream integration**
Qualification level: **Level 1 — app-scoped media integration qualification**
Status: **COMPLETE**
PR: **#553**
Branch: `audit/doobtube-baseline-20261006`

## Implementation summary

DOOBTUBE-6 implements the repository-qualified DoobTube upload, Media-processing-result, verified playback-delivery and livestream integration layer while preserving 420Media/Storage/Compute authority.

Implemented:

- bounded video upload inspection;
- mandatory scanner/quarantine gate;
- exact Media upload-plan binding;
- DNS-aware SSRF/egress validation;
- exact Storage manifest/readiness admission;
- revision-bound/expirable safe playback locators;
- static allowlisted processing profiles;
- processing runtime/memory/CPU/PID limits;
- active/verified/fresh provider evidence admission;
- exact provider/operator/result binding;
- deadline enforcement;
- opaque livestream credential references;
- canonical controller validation;
- persisted desired-live recovery state;
- bounded reconnect behavior;
- restart revalidation and Media re-entry;
- backend schema migration v1 -> v2.

## Repository reconciliation

Before DOOBTUBE-6 implementation, current `main` advanced from:

`ff4440bfd7b69c0712ee3dd7c4b417cb049ae76d`

to:

`ea979e30e3c3b977c8b23aeaf346f53ae23ee23a`

The three mainline commits affected only PuffBuddies web assets/build configuration.

The DoobTube audit branch was reconciled before implementation using merge commit:

`a67ca3cdfc7fd9f411cbc11d17afa1987f048c2f`

After reconciliation the branch was 0 commits behind current main.

## Files changed

- `doobtube/media/__init__.py`
- `doobtube/media/types.py`
- `doobtube/media/security.py`
- `doobtube/media/service.py`
- `doobtube/tests/test_doobtube_media.py`
- `doobtube/api/persistence.py`
- `doobtube/tests/test_doobtube_backend.py`
- `docs/DOOBTUBE-MEDIA-INTEGRATION.md`
- `docs/DOOBTUBE-ROADMAP.md`
- `docs/DOOBTUBE-AUDIT.md`
- `scripts/verify-doobtube-baseline.py`
- `.github/workflows/doobtube-baseline.yml`

## Upload / malicious-media controls

Upload admission requires:

- `video/*` MIME;
- nonzero bytes;
- maximum 8 GiB;
- exact SHA-256 form;
- non-empty asset/source references;
- scanner verdict `CLEAN`;
- non-empty scanner identity.

QUARANTINE/REJECT/malformed/oversized input fails closed.

Media's returned upload plan must preserve the exact asset, byte size and idempotency identity plus complete Storage object/manifest/shard/commitment/upload references.

## SSRF / egress controls

Qualified egress validation rejects:

- wrong schemes;
- URL userinfo/embedded credentials;
- localhost/local hostnames;
- loopback;
- private/RFC1918;
- unspecified;
- link-local;
- multicast/reserved addresses;
- DNS names resolving to unsafe addresses;
- missing DNS-aware resolution.

Allowed production-style scheme mapping:

- upload/playback -> HTTPS;
- WHIP/WHEP -> HTTPS;
- RTMP -> RTMPS;
- SRT -> SRT;
- WebRTC -> WebRTC.

## Canonical manifest / playback delivery

Storage readiness requires exact equality across:

- object ID;
- manifest ID;
- shard index;
- shard root;
- byte size;
- commitment ID.

The manifest must be:

- positive revision;
- sealed;
- retrievable;
- live.

Playback locator admission requires:

- matching asset;
- exact current manifest revision;
- non-expired locator;
- safe DNS-aware HTTPS endpoint.

Transport/playback success remains non-authoritative.

## Processing / codec / process isolation

DoobTube accepts only static bounded profile IDs and does not construct shell command text.

Qualified allowlists:

- engines: ffmpeg, gstreamer;
- video: copy, h264, h265, av1, vp9;
- audio: copy, aac, opus;
- containers: mp4, matroska, mpegts, webm.

Resource limits:

- runtime <= 6 hours;
- memory <= 8 GiB;
- CPU quota <= 400%;
- PID limit <= 256.

This mirrors the qualified 420Media security model without turning DoobTube into a Compute scheduler/provider.

## Provider/operator compromise controls

Provider evidence must be:

- active;
- verified;
- exact expected provider;
- exact expected operator;
- not future-dated;
- within bounded freshness.

Processing result must preserve:

- Media job ID;
- expected provider;
- expected static profile;
- non-empty output asset;
- non-empty opaque result;
- verified result state;
- canonical deadline.

Substitution/stale/compromised evidence fails closed.

## Interrupted processing / retry

Processing interruption cannot:

- change source asset identity;
- create an output READY state;
- manufacture provider evidence.

Retry remains bounded by DOOBTUBE-5 job semantics and canonical Media/Compute idempotency.

Output still requires separate canonical Storage/Media readiness.

## Livestream integration

Session admission requires:

- session ID;
- stream reference;
- controller reference;
- supported protocol;
- safe endpoint;
- opaque credential reference;
- max duration <= 24 hours.

Controller authority is re-read from Media for create/start/recovery.

Retired stream or controller drift fails closed.

## Persistent recovery / schema migration

DOOBTUBE-6 advances DoobTube SQLite schema:

**v1 -> v2**

v2 adds:

`media_sessions`

Persisted fields are limited to:

- session spec;
- state;
- desired-live;
- reconnect attempts;
- bounded last error;
- update timestamp.

Raw stream secrets/media are not persisted.

On restart, desired-live sessions:

1. re-read canonical controller state;
2. reject controller drift/retirement;
3. enforce reconnect bounds;
4. re-enter Media start/recovery even if the persisted record had been ACTIVE;
5. reset attempts on success;
6. increment attempts on interrupted recovery;
7. fail closed after exhaustion.

## Level 1 qualification

Qualified implementation SHA:

`81b988e9e947cd504d605136f76ac225a53f5b64`

Workflow: **DoobTube baseline audit**
Run: **37567244055**
Job: **baseline / 112617652516**
Result: **PASS**

Exact-head steps passed:

- exact PR-head checkout;
- exact implementation SHA assertion;
- Python compile/build;
- retained DOOBTUBE-4 adapter tests;
- retained DOOBTUBE-5 backend tests;
- DOOBTUBE-6 media adversarial/integration tests;
- cumulative DOOBTUBE-0 architecture verification;
- cumulative DOOBTUBE-1 product verification;
- cumulative DOOBTUBE-2 dependency/trust verification;
- cumulative DOOBTUBE-3 lifecycle verification;
- cumulative DOOBTUBE-4 adapter verification;
- cumulative DOOBTUBE-5 backend verification;
- DOOBTUBE-6 media/security verifier;
- repository Media security-policy source assertions;
- repository Media processor isolation source assertions;
- repository livestream bound/credential source assertions;
- Media deployment security-profile assertions;
- roadmap/audit completion state;
- no false testnet/Genesis/production readiness claim.

No required DOOBTUBE-6 check was skipped, cancelled, missing, stale or silently substituted.

## Media adversarial coverage

Qualified tests cover:

- malformed/non-video media;
- zero/oversized upload;
- invalid SHA-256;
- scanner quarantine/rejection;
- unsafe URL schemes;
- embedded credentials;
- loopback/private DNS resolution;
- stale/mismatched canonical manifests;
- unsealed/unretrievable/dead manifests;
- stale playback revision;
- expired playback locator;
- playback SSRF;
- unsupported processing engine;
- runtime/memory/CPU/PID exhaustion bounds;
- inactive/unverified provider;
- provider/operator substitution;
- stale/future provider evidence;
- processing-result substitution;
- deadline expiry;
- livestream SSRF;
- empty credential ref;
- controller revalidation;
- persisted-session restart recovery;
- controller drift after restart;
- interrupted livestream start;
- bounded reconnect exhaustion.

## Superseded failed run

Implementation SHA:

`d27d3920163b4c628287df49cd9076320315650c`

Workflow run: **37567198547**
Job: **112617511004**
Result: **FAIL**

Classification: **test-surface/export defect**.

Passed before the failure:

- exact SHA assertion;
- Python compile;
- all adapter regression tests;
- all backend regression tests.

The media suite failed during `setUp` because `ScanResult` existed in `doobtube/media/types.py` but had not been exported from `doobtube/media/__init__.py`, while the test imported the public package surface with `from doobtube.media import *`.

The export was added. No test requirement or security condition was weakened.

## Security / invariant result

Qualified invariants include:

- malformed/unscanned media cannot enter upload transport;
- all outbound media endpoints are DNS-aware/fail-closed;
- transport success cannot become READY;
- stale/mismatched manifests fail closed;
- playback locators are revision-bound and non-authoritative;
- requester input never becomes shell command text;
- processing profiles are static and resource bounded;
- provider/result substitution fails closed;
- processing cannot bypass output readiness;
- livestream credentials remain opaque;
- restart recovery revalidates controller authority;
- reconnect attempts are bounded;
- raw media/secrets remain outside durable DoobTube state;
- DoobTube does not become Media/Compute authority.

No unresolved DOOBTUBE-6 media-integration defect remains.

## Repository base

Qualification base / current `main`:

`ea979e30e3c3b977c8b23aeaf346f53ae23ee23a`

The branch was 0 commits behind current main at exact-head qualification.

## Milestone status

DOOBTUBE-6 is an **ordinary Level 1 roadmap step**.

The canonical Level 2 milestone remains:

**DOOBTUBE-8 — Ecosystem integration milestone**

No Level 2 run is required here.

## Intentionally deferred Level 3 qualification

Deferred until **DOOBTUBE-11 — Repository Level 3 exact-head closeout**:

- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- unrelated app audits;
- global fault/soak qualification;
- final affected client/service/Indexer/Search/RPC/frontend/backend suite;
- final security/static/deployment/config/build/lint/type closeout.

## Limitations / blockers

No repository blocker remains for DOOBTUBE-6.

Live production scanner, egress firewall, transcoder/container runtime, provider fleet, Storage/CDN origin, TLS/domain binding and public-testnet transport remain deployment/testnet evidence and are not repository-Level-1 blockers.

## Evidence SHA rule

This file is a durable **evidence-only** update after the exact implementation SHA qualified.

It changes no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements. The qualified implementation SHA remains authoritative without recursive qualification.

## Next canonical roadmap step

**DOOBTUBE-7 — User-facing web application**

# DoobTube — media processing, delivery and livestream integration

Roadmap step: **DOOBTUBE-6 — Media processing, delivery and livestream integration**
Status: **ADOPTED / IMPLEMENTED**
Date: 2026-10-06

## 1. Purpose

DOOBTUBE-6 implements the repository-side DoobTube integration layer for upload admission, Media-owned processing results, verified playback delivery and livestream recovery.

DoobTube does not become a second media engine or Compute authority. 420Media remains authoritative for MediaAsset/Stream lifecycle, Storage remains authoritative for canonical readiness, and Media's qualified Compute integration remains authoritative for processing/provider evidence.

## 2. Runtime package

Implemented under:

- `doobtube/media/types.py`
- `doobtube/media/security.py`
- `doobtube/media/service.py`

Tests:

- `doobtube/tests/test_doobtube_media.py`

Persistent livestream recovery extends the DOOBTUBE-5 database through schema migration **v1 -> v2** with `media_sessions`.

## 3. Upload admission

### DT-MEDIA-001 — Video-only bounded input

Upload inspection requires:

- non-empty asset/source reference;
- normalized `video/*` MIME;
- non-zero byte size;
- maximum 8 GiB;
- exact 64-hex SHA-256.

Malformed or non-video metadata fails closed.

### DT-MEDIA-002 — Mandatory scanner gate

A qualified scanner must return:

- verdict `CLEAN`;
- non-empty scanner identity.

QUARANTINE, REJECT, unknown verdict and missing scanner identity fail closed.

### DT-MEDIA-003 — Upload plan binding

Media's returned plan must preserve:

- exact asset ID;
- exact size;
- object ID;
- manifest ID;
- shard index;
- shard root;
- commitment ID;
- upload ID;
- exact idempotency key.

Plan substitution fails closed.

## 4. SSRF / egress boundary

### DT-EGRESS-001 — Scheme allowlist

Upload/playback accepts HTTPS only.

Livestream scheme mapping:

- WHIP/WHEP -> HTTPS;
- RTMP -> RTMPS;
- SRT -> SRT;
- WebRTC -> WebRTC.

### DT-EGRESS-002 — Embedded credentials forbidden

Endpoint userinfo is rejected.

### DT-EGRESS-003 — Local/private destinations forbidden

Denied:

- localhost / *.localhost / *.local;
- loopback;
- RFC1918/private;
- unspecified;
- link-local;
- multicast/reserved address classes.

### DT-EGRESS-004 — DNS-aware resolution required

An endpoint is not admitted without a resolver result.

Every resolved address is rechecked against the unsafe-address policy, preventing hostname-only SSRF validation and basic DNS-rebinding bypass.

## 5. Canonical readiness / manifest validation

### DT-MANIFEST-001 — Exact identity

Playback/readiness requires the manifest to match the prepared upload exactly across:

- object ID;
- manifest ID;
- shard index;
- shard root;
- byte size;
- commitment ID.

### DT-MANIFEST-002 — Ready state

Manifest must be:

- positive revision;
- sealed;
- retrievable;
- live.

Transport acceptance cannot satisfy this gate.

## 6. Verified playback delivery

### DT-PLAYBACK-001 — Media-supplied locator only

DoobTube consumes a Media-supplied playback locator and never derives one from Storage identity.

### DT-PLAYBACK-002 — Revision binding

Playback locator manifest revision must equal current canonical manifest revision.

Stale locators fail closed.

### DT-PLAYBACK-003 — Expiry

Expired playback locators fail closed.

### DT-PLAYBACK-004 — Delivery egress

Playback URL passes the same DNS-aware HTTPS SSRF boundary.

Successful playback never becomes Storage/Rights authority.

## 7. Processing / isolation

### DT-PROCESS-001 — Static profile only

Processing accepts only bounded static profile identifiers.

Requester-controlled command text is not accepted.

### DT-PROCESS-002 — Engine/codec/container allowlists

Allowed engines:

- ffmpeg;
- gstreamer.

Allowed video codecs:

- copy;
- h264;
- h265;
- av1;
- vp9.

Allowed audio codecs:

- copy;
- aac;
- opus.

Allowed containers:

- mp4;
- matroska;
- mpegts;
- webm.

### DT-PROCESS-003 — Resource bounds

A processing profile must satisfy:

- runtime <= 6 hours;
- memory <= 8 GiB;
- CPU quota <= 400%;
- PID limit <= 256.

This mirrors the qualified Media security profile.

### DT-PROCESS-004 — No shell integration

DoobTube never constructs shell commands. Processing is invoked through the Media integration port using an opaque static profile ID and opaque input reference.

## 8. Provider / operator compromise controls

### DT-PROVIDER-001 — Active + verified

Provider evidence must be both active and verified.

### DT-PROVIDER-002 — Exact binding

Provider ID and operator reference must exactly match the expected Media processing request.

### DT-PROVIDER-003 — Freshness

Provider evidence must not be future-dated or older than the configured bounded observation age.

### DT-PROVIDER-004 — Result binding

Returned result must match:

- Media job ID;
- expected provider;
- selected profile;
- non-empty output asset ID;
- non-empty opaque output reference;
- verified result state;
- canonical deadline.

Substitution or unverified output fails closed.

## 9. Interrupted processing / retry

Processing interruption does not mutate source asset identity or fabricate READY state.

Retry remains owned by the DOOBTUBE-5 durable bounded-job layer and Media/Compute canonical idempotency boundaries.

A failed or interrupted processing response is not promoted to an output asset until a verified result and separate canonical Storage/Media readiness exist.

## 10. Livestream integration

### DT-LIVE-001 — Complete session identity

Session requires:

- session ID;
- stream reference;
- controller reference;
- supported protocol/direction;
- safe endpoint;
- opaque credential reference;
- bounded duration <= 24 hours.

### DT-LIVE-002 — Opaque credential reference

Credential material is never embedded in endpoint URLs or persisted as raw secret state.

### DT-LIVE-003 — Canonical controller

Create/start/recovery re-read canonical Media stream controller state.

Retired streams or controller mismatch fail closed.

### DT-LIVE-004 — Persisted recovery state

Schema v2 `media_sessions` retains only:

- bounded session spec;
- state;
- desired-live;
- reconnect attempts;
- bounded last error;
- update timestamp.

### DT-LIVE-005 — Restart revalidation

Recovery does not trust a persisted ACTIVE record.

Desired-live sessions re-enter Media start/recovery after fresh controller validation.

### DT-LIVE-006 — Bounded reconnects

Reconnect attempts are bounded 1..10; default is 3.

After exhaustion recovery fails closed.

### DT-LIVE-007 — Stop confirmation

Stop does not report CLOSED unless Media confirms closed state.

## 11. Session / key leakage controls

DoobTube persists only an opaque credential reference.

Forbidden:

- endpoint embedded username/password;
- stream key in URL;
- raw credential material in persistence;
- raw media payload in session state.

## 12. Restart recovery

On process restart:

1. durable desired-live sessions are enumerated;
2. canonical stream controller/retirement state is re-read;
3. authorization drift disables desired-live recovery;
4. exhausted retry sessions fail closed;
5. eligible sessions re-enter Media start/recovery;
6. success resets reconnect attempts;
7. failure increments bounded reconnect state.

## 13. Migration

DOOBTUBE-5 schema v1 is migrated forward to schema v2.

Schema v2 adds only:

`media_sessions`

Existing DOOBTUBE-5 tables remain intact.

A schema newer than v2 still fails closed.

## 14. Adversarial qualification

Required coverage includes:

- malformed/non-video uploads;
- zero/oversized uploads;
- invalid digest;
- scanner quarantine/rejection;
- localhost/private/resolved-private SSRF;
- embedded URL credentials;
- stale/mismatched/unsealed/unretrievable/dead manifests;
- stale/expired playback locator;
- unsupported processor engine/codec/container;
- excessive runtime/memory/CPU/PIDs;
- inactive/unverified/stale/substituted provider;
- substituted processing result;
- processing deadline expiry;
- unsafe livestream endpoint;
- empty credential reference;
- controller drift;
- interrupted start;
- bounded retry exhaustion;
- restart recovery.

## 15. Security invariants

- **DT-MEDIA-INV-001:** malformed or unscanned media cannot enter upload transport.
- **DT-MEDIA-INV-002:** upload transport endpoint must pass DNS-aware SSRF validation.
- **DT-MEDIA-INV-003:** transport success never equals canonical READY.
- **DT-MEDIA-INV-004:** stale/mismatched manifests fail closed.
- **DT-MEDIA-INV-005:** playback URL is revision-bound, expirable and non-authoritative.
- **DT-MEDIA-INV-006:** requester input never becomes shell command text.
- **DT-MEDIA-INV-007:** processing profiles are static, allowlisted and resource bounded.
- **DT-MEDIA-INV-008:** compromised/stale provider evidence cannot authorize processing result admission.
- **DT-MEDIA-INV-009:** processing completion alone does not bypass output Storage/Media readiness.
- **DT-MEDIA-INV-010:** livestream endpoint credentials are never embedded or persisted.
- **DT-MEDIA-INV-011:** restart recovery revalidates canonical controller state.
- **DT-MEDIA-INV-012:** livestream retries terminate after bounded attempts.
- **DT-MEDIA-INV-013:** raw media and raw secret material remain outside DoobTube durable control-plane state.
- **DT-MEDIA-INV-014:** DoobTube does not become a Compute provider/scheduler or Media authority.

## 16. Explicit deferrals

DOOBTUBE-6 does not claim:

- production codec binaries/container sandbox deployment;
- production egress firewall enforcement;
- live production scanner/provider;
- live Storage/CDN origin;
- public testnet transport;
- browser UI;
- Level 2 cross-app integration;
- production TLS/domain configuration.

Repository qualification verifies the integration/security contracts and adversarial behavior. Live infrastructure evidence belongs to DOOBTUBE-12/13.

## 17. Exit decision

DOOBTUBE-6 is satisfied when:

1. upload admission is scanner gated and resource bounded;
2. SSRF/egress is DNS-aware and fail-closed;
3. canonical manifest readiness is exact;
4. playback delivery is safe/stale-aware;
5. processing is static-profile and resource bounded;
6. provider/result substitution fails closed;
7. interrupted processing cannot fabricate readiness;
8. livestream credentials remain opaque;
9. controller drift fails closed;
10. restart recovery revalidates canonical authority;
11. retries are bounded;
12. schema migration is durable;
13. adversarial media/integration tests pass;
14. cumulative DoobTube qualification passes on the exact implementation SHA.

**Next canonical roadmap step: DOOBTUBE-7 — User-facing web application.**

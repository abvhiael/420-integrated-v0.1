# PR #368 / phase 368.0 step 4 — distinct health and publication states

Status: **specified, not yet implemented**. Scope: public GEN-SVC-2 Location/Events feed consumed by Travel; neither an operator-provided source label nor a readable snapshot establishes publication trust. This contract supersedes treating the current `/readyz` response as proof of authoritative live data.

References: [step 2 source inventory](GEN-SVC-2-368-0-2-SOURCE-INVENTORY.md), [step 3 write-authority trace](GEN-SVC-2-368-0-3-WRITE-AUTHORITY-TRACE.md); [current deployment adapter](https://github.com/abvhiael/420-integrated-v0.1/blob/1ebac4b82d83ee940a742738e48fc40b01a37e03/genesis/svc2/deployment/public.go), [current public HTTP API](https://github.com/abvhiael/420-integrated-v0.1/blob/1ebac4b82d83ee940a742738e48fc40b01a37e03/genesis/svc2/httpapi/handler.go), [Travel readiness consumer](https://github.com/abvhiael/420-integrated-v0.1/blob/1ebac4b82d83ee940a742738e48fc40b01a37e03/genesis/svc3/travelapp/deployment_readiness.go).

## Independent dimensions and response contracts

| Dimension | Predicate for `true` | `false` / `unknown` handling | Suggested endpoint and access |
| --- | --- | --- | --- |
| Process liveness `L` | Process HTTP loop can respond within a short fixed timeout; independent of publisher and disk. | `false` on process crash/hung loop; do not restart a responsive process just because upstream publication is unavailable. | `GET /livez` -> 200 `alive` while responsive; otherwise timeout/connection failure. Minimal no-store response; no record data. |
| Public projection availability `P` | A single **pinned generation** containing both Location and Events decodes, has supported schemas, intact checksums and references, and is suitable for serving public-only `/v1/places` and `/v1/events` with bounded index expansion. Storage and discovery access are working. | `false` if missing/corrupt/mixed-generation storage, incomplete promotion, incompatible schema, public privacy validation failure, or required index cannot be built. Return 503 to public consumers; do not silently fall back to another generation where withdrawal could reappear. | Internal projection probe or restricted diagnostics; public endpoints return 503 when `P=false`. A validated empty publication **can** have `P=true`. |
| Verified, fresh publication `V` | `P=true` **and** a trusted publisher identity is verified against an explicit deployment trust configuration; immutable manifest/generation ID binds both snapshot digests, source/provenance and approval evidence; publication is within the configured freshness limits; required source refresh and withdrawal/cancellation watermarks are within their limits; no unresolved mandatory revocation or publication integrity failure. | `false` when evidence missing, untrusted, expired, inconsistent, or freshness/watermarks exceed policy; `unknown` until independent live source/operator evidence exists. A `SVC2_PUBLICATION_SOURCE` string and nonempty JSON are insufficient. No "live authoritative" claim or Travel connection on `false`/`unknown`. | `GET /readyz` is **consumer readiness** and returns 200 only when `V=true`; otherwise 503 with generic body. Detailed evidence only in restricted `/internal/publication-status` or an equivalent operator channel, not a public enumeration of records or secrets. |

Operational definitions: publication generation age is `now - manifest.published_at` with a future-clock-skew tolerance; per-source age is `now - last_successful_source_refresh` and must respect source-specific limits. Event cancellation/occurrence-exception and place withdrawal watermarks must demonstrate application through the **active generation**, not merely receipt by the publisher. Freshness thresholds, permitted clock skew, source obligations and required publisher keys/identities are deployment policy inputs to be chosen and tested before live staging. Do not hard-code unreviewed one-size-fits-all hours for places and events.

## State matrix — do not conflate signals

| L | P | V | Meaning and serving behavior |
| --- | --- | --- | --- |
| 0 | n/a | n/a | Process is unavailable; host restarts/alerts; no HTTP promise. |
| 1 | 0 | 0 | Live process, unavailable projection: `/livez` 200; `/readyz` 503; both public APIs 503. |
| 1 | 1 | 0 | Decodable public projection but untrusted, stale or publication evidence unavailable: `/livez` 200; `/readyz` 503; **public API serving disabled for the authoritative deployment** pending explicit non-production fixture mode. Do not let Travel treat its JSON 200 as qualified source data. |
| 1 | 1 | 1 | Verified, fresh, consistent and available publication: `/livez` and `/readyz` 200; public APIs may return 200 with genuinely matching records or legitimately empty data. |
| 1 | 0 | 1 | Impossible: `V` implies `P`; treat as invariant failure, fail closed and alert. |

An untrusted or stale generation is not made safe by returning an old `200` response. Health probes are not public attestation endpoints; external consumers rely on the configured trusted deployment and explicit release evidence in addition to readiness.

## Implementation and security boundaries for later phases

1. Phase 368.5 introduces an immutable cross-store generation manifest and an atomic active-generation pointer; pin one validated generation per request. The current two independent file reads cannot satisfy `P` during concurrent publication.
2. Phase 368.1 establishes authorized publisher identity, provenance and approval evidence. Treat an unverifiable signer/record as `V=false`; do not create a local `verified=true` toggle that any importer can set.
3. Phase 368.7 implements `/livez`, truthful `/readyz` and restricted diagnostic status, with injected clock and storage/publisher verifiers for deterministic tests. Existing `/readyz` means *only readable snapshots* and must not be silently relabelled until these gates exist.
4. A publisher refresh outage need not kill the process (`L` remains true), but `V` becomes false when freshness/withdrawal limits expire. A broken storage mount may make `P=false` without making `L=false`.
5. API visibility and coordinate projection remain public-only even if `V=true`; a successful manifest verification does not authorize private routes or business ownership claims.
6. Travel strict mode must require the verified HTTPS upstream and probe its readiness plus both versioned public APIs (or use an authenticated deployment binding that makes the same guarantees). Its present `loadPublicDiscovery` probe demonstrates availability of data but not provenance. Do not set `TRAVEL_PUBLIC_SERVICE_URL` until live acceptance passes.

## Deterministic acceptance table (future executable tests)

- Process responds when snapshots absent, corrupted or publisher unreachable: `L=true`, `P/V=false`, `/livez` 200 and `/readyz` 503; public GETs 503.
- A valid paired generation with legitimately empty public records and verifiable fresh approval: `L=P=V=true`; APIs return correctly versioned, empty **public** views, not a claim that real launch-region data is populated.
- A valid paired generation without trusted publisher evidence, with a forged signer, tampered digest, future timestamp outside skew or expired source-refresh/cancellation watermark: `P=true` only if the data itself remains consistent; `V=false`; `/readyz` 503 and no authoritative API 200.
- Replace one of two snapshots mid-request, corrupt the active manifest, or crash mid-promote: never emit a cross-generation `200`; `P=false`/503 or serve a previously pinned **still-authorized** generation only under documented revocation-safe policy.
- Withdraw a place or cancel a recurring occurrence, then activate the new generation: no subsequent response from that generation contains the withdrawn record/occurrence; a stale index fails qualification.
- Healthy published snapshot with no events in the requested time window: `V=true` can coexist with an empty event result; freshness is determined from evidence and policy, **not row count**.
- Restricted diagnostics cannot be retrieved anonymously; public error bodies disclose no keys, private coordinates, unpublished records, raw source credentials or filesystem locations.

**Step 4 exit criterion:** three independent predicates, status mapping, acceptance cases and implementation responsibilities are defined here. This documentation commit does **not** claim executable tests passed or that the current server implements these semantics. Step 5 freezes feature scope and release limitations; the predicate implementation belongs to phases 368.1, 368.5–368.7 and live acceptance in 368.10–368.11.

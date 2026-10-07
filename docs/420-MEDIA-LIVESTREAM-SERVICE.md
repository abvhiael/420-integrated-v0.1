# 420Media — Basic livestreaming service

Roadmap step: **MEDIA-AUDIT-5 — Basic livestreaming service**

This step converts the existing transport primitives into the Genesis-enabled `media.livestreaming` application service while preserving the Phase 1 authority boundary.

## Scope

Implemented flows:

- create livestream session;
- start livestream session;
- stop livestream session;
- query livestream status;
- restart/reconnect a failed or previously closed transport session;
- persist desired/live session state across process restart;
- recover persisted desired-live sessions after restart;
- enforce the canonical `media.livestreaming` feature flag;
- verify the caller against the canonical `MediaStreamRegistry420` controller;
- fail closed when the canonical stream is missing, malformed, retired, unavailable or transferred to another controller.

Raw media, stream payloads and resolved credentials remain outside this service state.

## Canonical authority

`MediaStreamRegistry420` remains authoritative for stream controller ownership.

The service uses a read-only Ethereum adapter over the existing Media RPC abstraction to call the canonical stream mapping. It extracts:

- controller;
- stream lifecycle state;
- existence.

Create/start/recovery reject retired streams. Status and stop allow the current controller to inspect or terminate a transport after retirement so canonical retirement cannot strand a live local session.

A locally persisted controller is never sufficient for restart recovery. Recovery re-reads canonical chain state before any reconnect.

## Feature flag

The canonical feature key is:

`media.livestreaming`

Create, start and automatic recovery fail closed when the feature is disabled or the feature-gate dependency is unavailable.

Stop and status remain available for an already-created session so operators/controllers can shut down or inspect existing transport state even if the feature is subsequently disabled.

## Session lifecycle

Application records use the transport states:

```text
created
  -> starting
  -> active
  -> stopping
  -> closed

starting/active/stopping
  -> failed

failed/closed
  -> starting
  -> active
```

The record also persists `desired_live`.

### Create

Create requires:

- feature enabled;
- valid gateway session specification;
- canonical non-retired stream;
- exact caller/controller match;
- unique session ID;
- valid protocol/direction/endpoint;
- bounded endpoint and opaque credential-reference length;
- bounded maximum session duration.

Creation persists a `created` record but does not activate transport.

### Start

Before transport activation, the service:

1. re-reads canonical controller state;
2. requires the caller to remain controller;
3. requires the stream not to be retired;
4. re-checks the feature flag;
5. persists `desired_live=true` and `starting`;
6. invokes the live gateway.

Success persists `active`. Failure persists `failed`, the error summary and the reconnect attempt count.

An already-active desired-live session is idempotent.

### Stop

Stop:

1. revalidates the canonical caller/controller relationship;
2. persists `desired_live=false` before teardown;
3. stops the transport when active;
4. persists `closed` after successful teardown.

If transport stop fails, the record remains `desired_live=false` and becomes `failed`. Recovery therefore cannot accidentally revive a stream the controller asked to stop.

### Status

Status is controller-scoped and reads the durable application record. It does not expose resolved credentials or raw media.

## Persistent recovery

The file-backed store persists records atomically using a temporary file and rename. The parent directory is created with mode `0700`; the state file is written with mode `0600`.

Persisted data contains only:

- session specification;
- opaque credential reference;
- controller reference;
- desired-state/lifecycle information;
- reconnect counters;
- timestamps and non-secret error summaries.

Resolved credentials are never persisted.

After process restart, `Recover` scans records with `desired_live=true`.

For each candidate it:

1. re-reads canonical stream/controller state;
2. rejects controller transfer or retirement;
3. enforces the feature flag;
4. checks the reconnect-attempt ceiling;
5. starts a missing gateway session or restarts failed/closed transport state;
6. persists the resulting state.

Canonical read failure never grants local authority.

## Reconnect and failure semantics

Default maximum automatic/manual failed-session reconnect attempts:

`3`

A deployment may configure a stricter or explicit positive bound.

Each failed start/reconnect increments the durable counter. Once the limit is reached, further start/recovery attempts fail with `ErrRecoveryExhausted` rather than looping indefinitely.

A successful activation resets the reconnect counter.

## Credential and endpoint bounds

Credential material remains resolved only within the driver.

Current bounds:

- endpoint text: maximum 4096 bytes;
- opaque credential reference: maximum 256 bytes;
- resolved bearer credential: maximum 4096 bytes;
- session maximum duration: 24 hours.

WHIP/WHEP resolved bearer credentials are rejected if missing or above the bound.

RTMP/SRT process drivers continue to receive only the opaque credential reference and pass endpoints as a single argv element without shell expansion.

## Recovery and controller transfer

If canonical controller ownership changes while a session is persisted as desired-live, automatic recovery fails closed:

- no transport restart occurs;
- the record becomes failed;
- `desired_live` is cleared.

This prevents stale disk state from restoring authority after a controller transfer.

## Security invariants

- **MEDIA-LIVE-INV-001:** local session state cannot replace canonical controller authority.
- **MEDIA-LIVE-INV-002:** create/start/recovery fail closed when livestreaming is disabled.
- **MEDIA-LIVE-INV-003:** create/start/recovery reject retired canonical streams.
- **MEDIA-LIVE-INV-004:** controller transfer prevents automatic recovery.
- **MEDIA-LIVE-INV-005:** `desired_live=true` is persisted before transport activation.
- **MEDIA-LIVE-INV-006:** `desired_live=false` is persisted before teardown.
- **MEDIA-LIVE-INV-007:** failed stop cannot cause automatic restart.
- **MEDIA-LIVE-INV-008:** reconnect attempts are bounded and durable.
- **MEDIA-LIVE-INV-009:** resolved credentials are never persisted.
- **MEDIA-LIVE-INV-010:** endpoint/credential/session-duration inputs are bounded.
- **MEDIA-LIVE-INV-011:** raw media never enters service control-plane persistence.
- **MEDIA-LIVE-INV-012:** canonical RPC failure cannot fall back to local controller authority.

## Level 2 milestone

MEDIA-AUDIT-5 is the documented application integration milestone.

Qualification therefore includes the accumulated app-specific Media suite:

- canonical Media audit verifier;
- GEN-SVC-0 validator and feature-flag contract;
- Media Go tests across discovery, control plane, Storage lifecycle, livestream service and Phase 2 node;
- Media Go vet/static checks;
- Media Phase 1 Solidity build and retained protocol/hardening tests;
- Media Anvil integration.

This does **not** trigger Level 3 repository-wide Solidity, Genesis/address-authority, global qualification or Docs inventories.

## Deferred boundaries

Still deferred to later canonical roadmap steps:

- 420Identity/Wallet and 420Rights authority composition — MEDIA-AUDIT-6;
- canonical Pay and Compute Market integration — MEDIA-AUDIT-7;
- Search/Notifications projections — MEDIA-AUDIT-8;
- stable public `/v1` API and typed SDK — MEDIA-AUDIT-9;
- end-user frontend — MEDIA-AUDIT-10;
- full Media-specific abuse/security repository closeout — MEDIA-AUDIT-11;
- production-equivalent public testnet — MEDIA-AUDIT-12;
- Genesis/production release — MEDIA-AUDIT-13.

# 420Mail MAIL-2.9 qualification evidence

Step: **MAIL-2.9 — Drafts System**  
Status: **COMPLETE**  
Qualification level: **Level 1 — per-roadmap-step fast qualification**

## Repository identity

- Accumulated Phase 2 PR: **#530 — feat(mail): Phase 2 mailbox foundation (MAIL-2.1–2.9)**
- Audit/feature branch: `mail-2-1-mailbox-state-model-20261005`
- Reconciliation/base `main` SHA: `f5fe16414893a1e4bd4f3db22eb36b685a2030f5`
- Qualified implementation branch SHA: `0277754670083eb94e7105cdf2dba0400af3c347`
- Exact GitHub PR merge-candidate SHA tested by CI: `9139579df5dfca00f3fe4edcc67e879eedf00e2f`
- Roadmap bookkeeping SHA: `60e7067412fd40370a493b3c8ced0fa2611fae35`
- CI workflow: **420Mail Audit Qualification**
- Final implementation CI run: **37419067870** (run #160)
- Final implementation CI job: **112124124577** (`mail-audit`) — PASS

The roadmap closeout and this evidence record are bookkeeping/evidence-only changes. They do not alter executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state, or substantive MAIL-2.9 requirements. Under the phase qualification policy they inherit the exact implementation qualification above without recursive Level 1 qualification.

## Canonical definition

The canonical Phase 2 roadmap defines MAIL-2.9 exactly as:

> **MAIL-2.9 — Drafts System** — Add encrypted autosave/recovery/edit/discard and multi-device draft behavior.

MAIL-2.9 is an ordinary app-scoped Level 1 step inside the documented **Mailbox foundation milestone (MAIL-2.1 through MAIL-2.10)**.

## Pre-step gap analysis

Before MAIL-2.9:
- `DRAFTS` existed only as a reserved system-folder class;
- there was no canonical draft object or owner-scoped draft map;
- there was no autosave identity/idempotency mechanism;
- there was no recovery/list API;
- there was no optimistic revision model for multiple devices;
- there was no stale-write/stale-discard rejection;
- there was no discard path tied to private blob deletion;
- there was no v7 durable draft metadata migration;
- the thin Compose UI had no autosave/recovery/discard behavior.

## Requirements satisfied

### Private/encrypted autosave boundary — PASS

Draft body plaintext is never written into the Mail metadata store, public 420Search, or on-chain state.

Draft body content is written through the existing private blob provider boundary and the metadata store retains only:
- private blob reference;
- digest;
- owner/recipient/subject/reply metadata;
- revision/timestamps.

The canonical configuration now requires draft body storage through `PRIVATE_ENCRYPTED_BLOB_PROVIDER`.

Repository qualification proves the privacy boundary and proves draft plaintext is absent from durable Mail JSON metadata. It does **not** falsely claim that a live 420 Storage encryption/key-custody deployment has already been provisioned; that remains a live integration/deployment obligation.

### Autosave identity and recovery — PASS

Draft creation requires an owner-scoped `autosave_key`.

The draft ID is deterministically derived from:
- canonical domain `420/MAIL/DRAFT/V1`;
- authenticated owner;
- autosave key.

Replaying creation with the same owner/autosave key returns the existing draft rather than creating another autosave record.

Recovery supports:
- owner draft listing;
- single-draft recovery;
- private body recovery through the blob provider.

Drafts are ordered deterministically by:
1. `updated_at` descending;
2. draft ID ascending.

### Edit/autosave — PASS

`SaveDraft` replaces the canonical draft contents only when the caller supplies the current `expected_version`.

Each successful autosave increments the durable draft version.

Subject and body retain existing Mail size bounds. Autosave keys are bounded to 128 bytes and each owner is bounded to 500 drafts.

### Multi-device behavior — PASS

MAIL-2.9 implements explicit optimistic concurrency.

When two devices recover the same revision:
- the first successful save advances the canonical version;
- the second device's stale save fails with `ErrDraftConflict`;
- canonical content remains the first successful save;
- the stale device must recover the current draft before applying another edit.

Stale discard also fails with `ErrDraftConflict`.

The repository deliberately does not silently merge private text from two stale device copies.

### Owner authorization — PASS

Drafts are strictly owner-scoped.

Knowing another user's draft ID does not permit:
- recovery;
- editing;
- listing;
- discard.

Foreign access returns no draft record.

Draft create/save also preserve canonical Mail source enforcement and reject spoofed application source values.

### Discard — PASS

Discard is version checked.

Successful discard requires a private blob provider implementing the qualified deletion capability and removes:
- canonical draft metadata;
- the referenced private draft blob.

If blob deletion fails after metadata removal, Mail attempts immediate metadata rollback and returns `ErrDraftDeleteUnavailable` rather than falsely reporting a successful discard.

Qualification covers rollback recovery.

### Durable storage / migration — PASS

Durable metadata schema advanced from **v6 to v7**.

Schema v7 persists owner-scoped draft metadata.

Existing v6 stores migrate with an initialized draft map.

Restart qualification demonstrates draft metadata/references survive durable-store restart and the draft body remains recoverable from the private blob provider.

The durable JSON file is tested to ensure it does not contain draft body plaintext.

The `DRAFTS` reservation from MAIL-2.1 has been released to the MAIL-2.9 implementation. `OUTBOX` remains reserved for MAIL-2.10.

### HTTP/client surface — PASS

Authenticated API surfaces:
- `POST /v1/drafts`
- `GET /v1/drafts`
- `GET /v1/drafts/{id}`
- `PUT /v1/drafts/{id}`
- `DELETE /v1/drafts/{id}?expected_version=N`

Typed Go client methods mirror create/list/get/save/discard operations.

Unknown JSON fields are rejected.

Version conflicts map to HTTP conflict; private-delete unavailability maps to service unavailable.

### Thin UI — PASS

The Compose UI now:
- schedules autosave after edits;
- creates/reuses a stable draft;
- updates with `expected_version`;
- displays current draft revision;
- lists saved drafts;
- recovers a selected draft;
- exposes discard;
- warns when another device has changed the canonical revision;
- attempts to discard the matching draft after successful send;
- preserves inert `textContent` rendering for received private message bodies.

This is repository UI qualification, not evidence that the currently deployed static Cloudflare surface has a live Mail API backend.

### Authority/privacy boundaries — PASS

MAIL-2.9:
- introduces no Mail-owned smart contract;
- introduces no signing/custody authority;
- exposes no draft state to public 420Search;
- puts no draft content on-chain;
- preserves Identity/Messenger/Storage/Notifications authority boundaries;
- does not modify the frozen Genesis application catalog.

## Implementation summary

MAIL-2.9 introduced or materially changed:

- `mail/draft.go`
- `mail/draft_test.go`
- `mail/service_test.go` — private test blob deletion support
- `mail/store.go`
- `mail/http.go`
- `mail/http_test.go`
- `mail/client/client.go`
- `mail/web/index.html`
- `config/420mail-service-v1.json`
- `docs/420MAIL.md`
- `scripts/verify-420mail-audit.py`
- `docs/420MAIL-PHASE2-ROADMAP.md` — closeout bookkeeping only after implementation qualification.

## Security / adversarial / boundary coverage

MAIL-2.9 qualification includes:
- deterministic autosave-key replay;
- create/recover/edit/discard lifecycle;
- owner isolation;
- foreign save rejection;
- foreign discard rejection;
- source spoof rejection;
- autosave-key length boundary;
- multi-device stale write rejection;
- stale discard rejection;
- canonical content unchanged after stale write;
- deterministic newest-draft ordering;
- private blob deletion;
- metadata rollback when blob deletion fails;
- v6 -> v7 migration;
- restart recovery;
- no draft body plaintext in durable metadata;
- authenticated HTTP lifecycle;
- HTTP optimistic conflict behavior;
- strict HTTP unknown-field rejection;
- retained MAIL-2.1 through MAIL-2.8 regressions;
- race-detector coverage.

## Qualification history

Non-passing/superseded runs are not completion evidence.

1. **Run #156 / 37418876164 / job 112123535128** — stopped at Go format. Behavioral/static checks correctly did not run.
2. Exact formatter changes were applied.
3. **Run #159 / 37418996905 / job 112123905621** — stopped at one remaining Go-format difference in `draftCount`. Behavioral/static checks correctly remained skipped.
4. The exact remaining formatter change was applied.
5. **Run #160 / 37419067870 / job 112124124577** — final authoritative implementation qualification: PASS.

## Final Level 1 qualification

Workflow: **420Mail Audit Qualification**  
Run: `37419067870` (#160)  
Job: `112124124577`  
Qualified branch implementation: `0277754670083eb94e7105cdf2dba0400af3c347`  
Exact PR merge candidate: `9139579df5dfca00f3fe4edcc67e879eedf00e2f`  
Reconciliation base: `f5fe16414893a1e4bd4f3db22eb36b685a2030f5`

CI checkout explicitly recorded:

`HEAD is now at 9139579 Merge 0277754670083eb94e7105cdf2dba0400af3c347 into f5fe16414893a1e4bd4f3db22eb36b685a2030f5`

Results:
- exact head — PASS;
- Go format — PASS;
- `go test ./mail/...` — PASS;
- `go test -race ./mail/...` — PASS;
- `go vet ./mail/...` — PASS;
- `python3 scripts/verify-420mail-audit.py` — PASS.

The verifier explicitly reported:

`MAIL-2.9 drafts system: qualified by app-scoped checks`

## Level 2 status

**Intentionally deferred.**

MAIL-2.9 remains inside the documented **Mailbox foundation milestone (MAIL-2.1 through MAIL-2.10)**.

The retained broader Mail app-integration qualification is due after **MAIL-2.10 — Outbox & Delivery Queue**, unless MAIL-2.10 introduces a shared dependency that requires an earlier app-focused milestone run.

## Intentionally deferred Level 3 checks

Level 3 remains deferred to complete app-phase closeout.

MAIL-2.9 changes no Solidity contract, Genesis/frozen address, consensus code, token settlement authority, public indexer authority, or shared on-chain protocol.

Therefore full repository Foundry inventory, Genesis/address-authority closeout, Geth qualification, 420 Integrated global qualification, and global Docs closeout were not repeated for this ordinary app-scoped step.

## Limitations / downstream work

MAIL-2.9 does not prove:
- a deployed production-equivalent encrypted 420 Storage provider/key-custody configuration;
- live multi-device browser sessions against a deployed Mail API;
- production backup/recovery operations for the private blob provider;
- delivery queue/outbox behavior — MAIL-2.10;
- full desktop mail UX — MAIL-2.30;
- live testnet/security/operations qualification — later canonical phases.

Those are downstream obligations and do not block the repository-scoped Level 1 exit criteria for MAIL-2.9.

## Completion

**MAIL-2.9 — Drafts System: COMPLETE at Level 1.**

Next canonical roadmap step: **MAIL-2.10 — Outbox & Delivery Queue**.

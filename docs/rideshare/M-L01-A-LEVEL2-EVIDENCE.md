# M-L01-A — Level 2 integration evidence

Status: COMPLETE — PASS. Recorded 2026-10-13. Canonical milestone: identity + eligibility + durable trip + Location integration across L01.1–L01.5.

Implementation SHA: `d15966e2bd63f88c78cb01e1d193e29c050c57d8`. Main/base: `959288c8bd33b6da0325b6a5d060e00e7bcf0e48`. PR [#633](https://github.com/abvhiael/420-integrated-v0.1/pull/633), branch `build/liftd-l01-1-foundation`, open/draft/unmerged. Evidence SHA is the commit containing this record; it changes evidence/status only and inherits this implementation SHA. Current HEAD after evidence is that evidence commit, not a newly qualified implementation.

[Milestone run 38477582388](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38477582388), job 115572034673: SUCCESS. Inspected exact checkout, native checks, retained TAP, integration TAP, actual database crash/restart and uploaded artifact logs.

| Accumulated check | Result |
| --- | --- |
| Retained foundation, Identity/session, eligibility and Location unit/security tests | 41/41 PASS, zero failures/skips/cancellations |
| Real PostgreSQL signed multi-authority privacy/service journey | 6/6 PASS, zero failures/skips/cancellations |
| Native Location bridge and retained provider/privacy packages | PASS |
| Syntax, locked installation and canonical foundation verification | PASS |
| Fresh database migration and non-owner runtime enforcement | PASS |
| Actual PostgreSQL SIGKILL/restart with history/private-row digest recovery from new process | PASS: 2 trips, 6 events, 6 commands before/after |

Integrated journey uses actual RS256 verification with six independently pinned synthetic roots: Identity, sessions, Location, driver registry, vehicle registry and passenger transport. Actual HTTPS client is wired to intercepted transport returning signed nonce-bound proofs. Actual PostgreSQL runtime storage, service and HTTP handler compose route preparation -> atomic trip binding -> assignment -> arrival -> revoked start rejection -> authorized start -> completion. Assigned-driver access works only in allowed states, terminal driver loses access, rider access persists only until retention expires. Other accounts/roles, retry payload changes/rebinding, expiry/erasure, tombstone mutation and unauthenticated HTTP are denied. Encrypted endpoints remain absent from immutable trip/event/command records.

Artifact [11855820178](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38477582388/artifacts/11855820178): liftd-m-l01-a-d15966e2bd63f88c78cb01e1d193e29c050c57d8; ZIP SHA256 a209b32088d6f4caf4f0b101dae8c307088a938ba16621c0acda27f841892167. Contains exact SHA, retained and Location TAP, database checkpoint. Full PostgreSQL store inventory has a distinct Level 1 owner and passed 16/16 in the [L01.5 certificate](L01.5-LEVEL1-EVIDENCE.md); milestone avoids ceremonial duplicate inventory.

All milestone exit criteria are satisfied at repository scope: accumulated signed authority boundaries, fail-closed routing/eligibility, durable lifecycle, atomic private route binding, scoped privacy, precision, idempotency, retention and crash recovery. Milestone qualification uses fresh PostgreSQL service independent of Level 1. No source or test changes occur in this evidence commit.

Repository blockers: NONE. Independent live authority/provider/device acceptance and managed keys/scheduler/backup/failover remain pending under LT-01/LT-02/LT-04/LT-05/LT-07. Tests do not prove live provider approval, actual road classification or externally deployed service behavior. M-L01-B remains pending; single Phase L01 Level 3 is deferred to L01.10 (Solidity canonical inventory once, independent Genesis address authority, Integrated/global, Docs/global and applicable retained owners). No global workflow manually dispatched; PR remains draft/open/unmerged.

Next canonical step: **L01.6 — Driver availability, vehicle capacity, deterministic matching, assignment expiry and concurrent dispatch**. Not started.

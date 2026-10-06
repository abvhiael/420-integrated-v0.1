# PB-1.8 — Deletion & Revocation Foundations

PB-1.8 makes revocation monotonic at the persistence boundary. Each revocation advances a protected subject generation. Derived caches/projections are usable only when their generation equals current canonical authority; delayed writes and old backup snapshots cannot cross a newer revocation boundary.

DELETION_COMPLETE is terminal for derived authority and restore eligibility. Ordinary PB private state follows the PB-1.3 ORDINARY_DELETE classification. Protected safety state is not silently bulk-deleted with ordinary data: retained safety material must remain canonical and carry an explicit purpose-limited retention reason.

The implementation is storage-neutral foundation logic. It does not claim a production backup system, database tombstone/garbage-collection mechanism, cache/index integration, worker, API, deployment, or live restore process.

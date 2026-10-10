# GROW-V2-10 — Inventory, traceability and compliance exports

**Canonical step:** GROW-V2-10, the V2-06–10 accumulated app Level 2 boundary. **Status:** implementation candidate; qualification evidence is separately recorded after exact-SHA PASS.

## Retained architecture and data ownership

- All inventory data is **tenant private**, never a projection into public 420Location or blockchain Registry.
- V2-03 already declares `grow_private.inventory_lots` and `grow_private.inventory_movements` as legacy reservation tables. To avoid destructive migration, GROW-V2-10 uses new `inventory_lots_v2` and `inventory_ledger_v2` and leaves the legacy content unchanged. There is **no claim** that the old, potentially unscoped table has been imported or reconciled.
- Privileged migrations are checksummed; ordinary runtime traffic uses transaction-local `grow.tenant_id`, an unprivileged account, FORCE RLS, and server-verified `security.InventoryAdjust`, `security.View`, or `security.AuditExport` grants. No API endpoint claims to authenticate clients itself.
- A single stable lot belongs to a facility/zone, category (`SEED`, `CLONE`, `INPUT`, `MATERIAL`, `EQUIPMENT`, `HARVEST`), canonical unit (`g`, `kg`, `L`, `mL`, `each`), and human label. Seeds, clones, and equipment are `each`; recorded harvested dry material is `g`; other categories permit the canonical units with no unsupported conversion.
- A harvested-material lot must link the exact same tenant/facility/zone's **observed harvest record**, and its opening dry grams must match the recorded weight. No forecasts, user-entered planned dates or nutrient observations are treated as harvested inventory.

## Ledger contract, accounting and custody

- The V2 ledger is **append-only**. Opening, receipt, issuance, consumption, adjustment-in/out and custody-transfer movements have immutable event ID, globally tenant-scoped idempotency key, signed kind, positive finite bounded quantity, actor, source, reason, event/record timestamps, and optional reference ID.
- Inventory **balance is never silently negative**. Each appended event adjusts the parent lot in the same PostgreSQL transaction by a row-locked, bounded database trigger. Replayed idempotency conflicts never activate the accounting trigger. Concurrent overdrafts cannot both commit.
- Individual transfer legs are prohibited at the application-service boundary. A transfer is two correlated events, `TRANSFER_OUT` and `TRANSFER_IN`, with equal positive quantity, same material category and unit, distinct owned lots, distinct event/idempotency IDs and shared custody reference. PostgreSQL uses a deferred constraint to reject incomplete or mismatched pairs at commit.
- Operator or manager may create/adjust inventory; reader may inspect only their authorized facility/zone; only owner/manager/reviewer with `AUDIT_EXPORT` may export. A zone-narrowed grant cannot transfer into a different zone.
- Snapshots show bounded history and balance from the tenant-owned lot. Database-backed snapshots verify their balance against signed journal totals before returning; invalid or truncated history fails closed. No mutation of historical ledger events is permitted even for corrections, which create additional attributed adjustment events.

## Internal jurisdiction-configurable audit exports

- The explicitly supported export labels are `CA-SK`, `CA-AB`, `CA-NS`, `CA-ON` and `GENERIC`. Unsupported templates are rejected. These are **internal jurisdiction selectors**, not official prescribed statutory forms, verified legal rules, or a certification of cannabis-related compliance.
- Bounded, audited CSV exports provide lot and harvest provenance, creation actor/time, balance, unit, recorded movement IDs/kinds, quantities, reason, actor/source/time, custody reference, internal schema version and conspicuous `INTERNAL_UNVERIFIED` markers. Spreadsheet formula-leading values are escaped.
- Actual government electronic submission, legal reporting, retention schedules, consent/deletion integration and live licensed-operator acceptance are **not** claimed. Per-jurisdiction statutory mapping and required approvals remain deployment/testnet qualification obligations; app output is evidence for a human-reviewed export, not an attestation from a regulator.

## Required tests and acceptance

- Go: create/read/adjust, authorized roles and scope, invalid states/categories/units, nonfinite/negative quantities, idempotency/replay, simultaneous insufficient-stock prevention, individual-transfer prohibition, bounded audit export and dangerous CSV text.
- PostgreSQL: migration replay checksum, forced tenant RLS and composite parents, link to observed harvests, two-lot custody conservation, duplicate prevention, immutable ledger, atomic negative-stock rejection, cross-tenant read/parent denial, and ledger-balance reconciliation.
- **Level 1:** Existing `420grow-v2-fast.yml` plus retained `420grow-fast.yml` on the final exact implementation SHA.
- **Level 2:** At this V2-10 milestone, execute the retained accumulated V2-06 telemetry, V2-07 equipment safety, V2-08 cultivation history, V2-09 harvest analytics and V2-10 inventory packages with Go unit/race/vet and real PostgreSQL qualifications. No repository-wide Solidity or Genesis suite duplicated.
- **Level 3:** complete V2 app-phase reconciliation remains V2-15; production-equivalent acceptance remains V2-16.

**Next canonical step after qualified V2-10:** GROW-V2-11 — AI-assisted analysis and human-reviewed recommendations.

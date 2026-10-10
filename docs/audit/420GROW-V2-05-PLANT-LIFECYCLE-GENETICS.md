# GROW-V2-05 — Plant lifecycle, genetics and cloning records

**Scope:** first V2 Level-2 cumulative integration milestone (V2-02–V2-05), app only. This implements a private tenancy-aware lifecycle/domain service and PostgreSQL storage. Existing GROW-01–10 anonymous public directory and Genesis canonical addresses stay unchanged.

**Lifecycle:** SEED/CLONE -> VEGETATIVE -> FLOWERING -> HARVESTED -> RETIRED, with explicit early RETIRED transitions. No backwards, duplicate or invalid jumps. Optimistic expected revision and transactional event history prevent stale replacement; the validated authenticated subject is passed into lifecycle audit events. Persistent mutation requires existing owner/manager/technician `PLANT_WRITE` role and owning tenant/facility/zone.

**Genetics:** tenant-owned cultivars, plant label and cultivar ID; `plant_lineage` distinguishes CLONE_PARENT and SEED_PARENT with both endpoints belonging to the same tenant; clone parent requires child at CLONE state. Application validates ancestor reachability and PostgreSQL BEFORE trigger enforces acyclicity under tenant-scoped advisory lock for concurrent inserts. No fictitious traits or unverified genetic test assertions.

**Storage:** `0003_plant_lifecycle.up.sql` adds cultivar FK, immutable provenance event table and cycle-proof trigger; app SQLStore uses transaction-bound tenant RLS and tenant-keyed predicates. SQL migration 0003 is registered by checksummed migration runner. Existing V2-03/04 migration and topology tests must remain passing.

**Attack cases:** wrong tenant, missing session, denied role, wrong revision, missing parent, cross-tenant lineage, self-parent, multi-hop genealogy cycle, malicious state jump, lineage replay and concurrent cycle attempt. Physical genetic verification, GDPR/regulatory audit signoff and real provider integrations are not claimed here. Production live session adapter is later work.

**Acceptance:** exact SHA targeted Go unit/race/vet/format and PostgreSQL constraints/negative tests plus cumulative Level 2 V2-02–V2-05 security-policy, real PG schema/room/plant integration, retained original 420Grow fast suite, durable run/job SHA evidence. No global Solidity/Genesis/Docs reruns for this app milestone.

**Next canonical step after complete:** GROW-V2-06 — Sensor telemetry ingestion and historical charts.

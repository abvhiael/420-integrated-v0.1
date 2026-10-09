# GROW-V2-11 — AI-assisted analysis and human-reviewed recommendations

**Canonical step:** GROW-V2-11, Level 1 app-specific qualification. This document describes app-owned boundaries; it does **not** authorize provider deployment, ecosystem credential custody, autonomous control, testnet release, model accuracy claims, or regulatory/agronomic certification.

## Intent and ownership

420Grow can request an opt-in **advisory analysis** of a tenant-private plant state or validated observation. The server stores an immutable recommendation and a separately attributed human acceptance-for-review or rejection. Generated content remains an untrusted suggestion, never a measurement, observed outcome, statutory answer, control command, or automated actuator instruction.

Implementation: `grow/assistance/service.go`, `postgres.go`, `orchestrator.go` and their tests, `grow/assistance/qualify.sql`, `grow/storage/migrations/0010_ai_assistance.up.sql`, checksum-ordered migrator and the existing Grow V2 fast workflow.

## Explicit privacy, consent and least privilege

- All requests require an authenticated and active tenant grant with facility/zone scope and `PlantWrite`. Reviewers with read-only grants may read only their own permitted scopes but cannot enqueue work, forge results or turn advice into device commands.
- Consent must be **affirmative** for purpose `CULTIVATION_ADVICE` and scoped to tenant, facility, zone and the requesting subject. Withdrawing consent marks pending jobs `REVOKED`, prevents later result admission and leaves an immutable consent-transition audit.
- Requests accept server-owned source references only: one scoped `PLANT` or `OBSERVATION` record. Arbitrary freeform prompt text is forbidden by the input contract. Database and application both validate scoped source ownership and current consent; replayed job IDs and completed results cannot silently overwrite history.
- A provider receives a minimal, allowlisted input projection. Plant projection contains state and record time; observation projection contains kind, unit, numeric measurement and time. No credentials, facilities' street addresses, geocoordinates, file/image bytes, EXIF, tenant display names, contact details, human subjects or plant photos are passed.
- **Images and photographs are not yet sent to any provider.** The user-approved product decision permits only separately consented and sanitized visual inputs; implement approved media transport and metadata stripping in a later qualification before enabling image inference. This is not an assertion that image analysis is already available.
- No customer data is sent to a live inference provider until a separately qualified, authenticated provider adapter is installed and verified. `ProviderVerifier` is mandatory for result admission; missing adapter means fail closed.

## Recommendation contract and human authority

- Output has immutable tenant/facility/zone and job IDs, provider/model attribution, model text, explanation, limitations, confidence label and timestamp. Unsupported, missing, overly long or unsigned/unverified provider results are refused.
- Confidence labels are provider descriptions (`LOW`, `MEDIUM`, `HIGH`), **not** a validated probability or guarantee. The explanatory text, inference and suggestions are untrusted.
- Human reviewers with `PlantWrite` explicitly choose `ACCEPTED_FOR_REVIEW` or `REJECTED` with reason, actor and time. Neither decision writes to environment/equipment controls, nutrient dosing, irrigation, plant lifecycle, inventory, external notifications or public maps.
- Database enforces immutable recommendation/review audit, replay uniqueness, consent and source gating, scope-constrained review lineage, and FORCED tenant row-level security on advice, jobs, consents, and their history.
- Input or provider failures are terminal/fail-closed, not silently converted to a successful recommendation. Revocation between projection and result persistence blocks result admission.

## Qualification and releases

Level 1 owns `go test -count=1 ./grow/assistance`, race tests, vet, gofmt, real PostgreSQL migration checks, denial/replay/adversarial tests, revoked-consent job denial, cross-tenant record filtering, and immutable human audit tests. Retained `420grow-fast.yml` must independently pass at the **same exact SHA**. Missing or queued jobs do not count as passing.

No new Level 2 milestone is defined here: the existing accumulated V2-06–10 Level 2 is at V2-10, next app integration milestone is at an actual shared boundary if needed. Level 3 is V2-15; live production-equivalent acceptance is V2-16. Operational 420AI/provider credentials, model hosting, image media transport, Wallet, Indexer, Search, notifications and chain integration are not asserted to exist within V2-11; cross-service bindings belong to **GROW-V2-12 — Ecosystem integrations and notifications**.

**Next canonical step after completion:** GROW-V2-12 — Ecosystem integrations and notifications.

# LIFTd Phase L03 — canonical execution and qualification contract

**Status: LOCKED PLAN, NO WORK STARTED.** Source of step numbering: [LIFTd canonical roadmap](LIFTD-ROADMAP.md), Phase L03. Approved roadmap in source control must precede L03.1 implementation. Do not treat this planning change as implementation qualification.

## Scope and sequencing

L03 carries the original roadmap's service operations and release scope: disputes/reviews, abuse, observability/redacted telemetry, managed keys, concurrency/failover, backups/recovery, drills, passenger-transport jurisdiction gates, official testnet readiness and release acceptance. The immutable planned order is **L03.1, L03.2, L03.3, M-L03-A, L03.4, L03.5, L03.6, L03.7, M-L03-B, L03.8, L03.9, L03.10, M-L03-C, L03.11**. No combining, renumbering or advancement beyond unfinished exit criteria. This ledger does not invent production or regulator authority.

## Detailed qualification boundary

| Qualification boundary | Required test and evidence scope | Expensive global owner |
| --- | --- | --- |
| L03.1–L03.3 | Affected rideshare domain, PostgreSQL migrations/queries, application API/SDK and protected client, role/replay/dispute/safety/adversarial/race/privacy tests; exact-SHA Level 1 evidence | **None** |
| M-L03-A | Integrated dispute+abuse+telemetry journeys with real local PostgreSQL and independent principals, failure/revocation, redaction/privacy; exact-SHA Level 2 certificate | **None** |
| L03.4–L03.7 | Targeted configuration/key isolation, rotation/revoke, multi-process transaction/race/restart, queue isolation, restore, fault drill; local dependency equivalents and exact-SHA Level 1 | **None** |
| M-L03-B | Integrated managed-keys, multi-instance failover, backup/restore and operational fault suite with PostgreSQL and security/safety invariants | **None** |
| L03.8–L03.10 | Jurisdiction/authority matrices, predeploy checks, config signing and release gates; negative proofs for missing real authority; exact-SHA Level 1 | **None** |
| M-L03-C | Combined release-candidate consumer integration, versioned packages, default-deny go/no-go and failure/adversarial matrix | **None** |
| L03.11 | One main-reconciled frozen SHA with complete canonical Solidity Contracts inventory/coverage/aggregate, Genesis Address Authority, 420 Integrated Qualification, 420Docs Qualification, and retained LIFTd phase-specific suites | **Only once, after full preflight** |

**Inherited evidence:** Follow repository-wide [Level 3 evidence preservation policy](../../.github/LEVEL3-EVIDENCE-PRESERVATION.md). Note that this relative link is intended for repository readers; GitHub URL can be used if renderer rules require it. Record the **actual original run SHAs**, compare inputs, requalify only affected owner for narrow CI/evidence defects, never rerun costly unaffected Foundry shards. Solidity is the only owner of the full Foundry inventory. Before any Level 3 launch validate workflow registration, manifest checksums, artifact directory/output path consistency, dependencies and correct mandatory job selection.

## Required app invariants carried forward

- Terminal trips never reopen; trip state changes require persisted version, valid fresh admission and authorized participant; independent transport eligibility failure blocks assign/arrive/start.
- Disputes and reviews never create settlement/finality authority; Pay/Wallet and Treasury owners retain money movement; preserve consent and provable ledger conservation.
- Rider/driver/vehicle/account/issuer bindings must resist forgery, replay and cross-jurisdiction authority confusion.
- Safety incident authority never grants unlimited private-location access or cross-trip control; emergency operations retain independent audited approvals and bounded permissions.
- Store private documents and exact locations off-chain with redaction; forbid secrets/credentials/PII in public Indexer, logs, analytics, test artifacts or notifications.
- Messaging requires current assigned-participant scoped authorization; unavailable unless independent production Messaging gate is accepted.
- Safe outage behavior must not fabricate matching, payment capture, dispatch, location or regulatory acceptance; fail closed at all externally dependent boundaries.

## External handoff: never mark green by local mocks

The existing [Testnet Roadmap](LIFTD-TESTNET-ROADMAP.md) retains TN-0…TN-6 and tracks **LIFTd-TN-ID, ELIG, VAULT, MSG and A11Y**; none has an accepted production gate. The [Production and Independent Acceptance Register](L02-PRODUCTION-ACCEPTANCE-REGISTER.md) retains separate real Vancouver transport licences/operator/driver/vehicle proofs, insurance, provider signoffs, authorized independent reviewers and production release approvals. L03.8–L03.10 implement repository-side **default-deny enforcement and acceptance wiring**, not deployed signoff. Real provider availability, deployed testnet end-to-end tests, physical-device screen reader review and release authorization remain external. Actual operations stay disabled.

## Roadmap lock and change control

- This planning-only change creates no new service interfaces or source behaviour; **no L03.1 has started**.
- Only modify canonical step scope or numbering via a new explicitly approved roadmap amendment PR explaining reasons, changed dependencies, security/CI implications and updated testnet ledger references.
- After completing each step, amend only that step's status with linked exact-SHA evidence. Do not invent completed testing or call globally expensive qualification for ordinary steps.
- Close L03.11 only after its five canonical owners demonstrate all mandatory jobs and durable exact-SHA qualification certificates; merge only on separate authorization.

# S-01 — Provider access, APIs and permissions

**Status: COMPLETE — Level 1 scoped policy/inventory deliverable; NO PROVIDER ACTIVATION OR REWARD ELIGIBILITY.**

Canonical requirement: [CMP-9 scientific ingestion annex](CMP-9-SCIENTIFIC-INGESTION-AND-GRIDCOIN-ROADMAP.md), S-01. This step establishes the reviewable source inventory, evidence quality, provider-use constraints, threat model and explicit enable/disable decisions. Later S-02 ingestion and S-03 verification are deliberately deferred; the repository does not claim provider cooperation or monetization permission.

## Source-specific evidence and access

### Folding@home

Sources:
- Official statistics: https://foldingathome.org/statistics/
- Official current API schema: https://api5.foldingathome.org/openapi-spec
- Official points and passkey FAQ: https://foldingathome.org/faq/stats
- Official privacy policy: https://foldingathome.org/about/privacy

The official statistics page indicates donor/team rankings refreshed around hourly, sometimes delayed. It instructs automated consumers **not to script donor/team HTML pages** and instead use bulk donor files; robots.txt rules apply. The API lists donor/team/project routes, but documentation alone is not authorization for scraping or commercial monetization. Its published data are not a signed, per-work-unit acceptance receipt. A passkey is sensitive donor proof material and MUST NOT be collected or exposed as a shortcut to Wallet linking.

**Decision:** listed for future *read-only candidate evaluation*, but all production fetch, identity linking, attestation and rewards are **DISABLED**. Uniqueness and project acceptance cannot be proven from aggregate score changes. Any work-unit evidence endpoint and approved rate limits require explicit provider review. Follow source permissions at access time.

### BOINC

Sources:
- Framework stats architecture: https://github.com/BOINC/boinc/wiki/CreditStats
- XML and per-project stats format: https://github.com/BOINC/boinc/wiki/XmlStats
- Cross-project identifiers: https://github.com/BOINC/boinc/wiki/CrossProjectUserId
- Add-on interfaces: https://github.com/BOINC/boinc/wiki/SoftwareAddon

BOINC is a framework of separate project operators, not one universally authoritative project API. Its standard published credit feeds are project-specific compressed XML, often refreshed approximately daily; project Web RPCs normally support per-user credit lookups and should be polled no more frequently than the documented 1-hour recommendation, subject to each project's stricter limits. Public user IDs/CPIDs and host IDs are **not** proof of Wallet ownership; public aggregate credit is not proof of an individual completed accepted work unit. Some providers may support richer authenticated work-unit/validator evidence, but this must be confirmed for each explicitly approved project.

**Decision:** no particular BOINC project is approved yet. Global BOINC ingestion and funded rewards are **DISABLED** pending named per-project operator approval, source capability and ownership/work-unit evidence verification.

## Threat model and evidence tiers

- **T0 UNTRUSTED:** web stats pages, arbitrary JSON, supplied identifiers, self-declared credits, screenshots, relay/aggregator claims.
- **T1 AGGREGATE_OBSERVATION_ONLY:** official project-sourced summary/credit snapshots with provenance and freshness but lacking per-work-unit proof. Display as non-authoritative observations only, never feed a funded reward entitlement.
- **T2 VERIFIED_SOURCE_RECORD:** project-origin, authenticated verifiable assignment/result/acceptance record, revocation/correction provenance, source timestamp and stable work-unit identity; requires independent verifier and approved data-use permission before trusted attestation.
- **T3 QUALIFIED_REWARD_EVIDENCE:** T2 plus verified opted-in participant ownership, current governed attester, canonical work mapping, duplicate guard, approved monetary policy and funded Vault path. Only S-07–S-09 may establish T3.

Threats: forged statistics, score rescoring, replays, reused aliases, false wallet ownership, Sybil hosts, external project migration, duplicate work represented in different feeds, stale updates, compromised upstream/aggregator, credential exfiltration, rate-limit/scraping abuse, results/datasets disclosure, privacy deanonymization, fake official TLS hosts, revoked permission, colluding attesters, inflation from treating credit as currency.

Mitigations: separate source-policy allowlist, TLS/redirect/domain validation, HTTPS preferred, explicit individual-project approval, least data, no client secret collection, minimum poll interval, immutable source-version/digest/cursor, correction/revocation handling, identity challenge owned by provider, independent work-unit proof, governance-controlled attestation, no reward eligibility from stats alone, emergency stop and fail closed on expired/contradictory terms.

## S-02 input contract and source-change procedure

Machine-readable policy: `contracts/config/compute-market/cmp-s01-provider-access.json`. Each record MUST supply explicit source system, source/project scope, official reference, permitted candidate transport, interval, freshness SLA, data tier, evidence capability, owner proof support, review prerequisites, production approval and reward eligibility. Missing policy, ambiguous BOINC project, source errors or newly changed terms => disabled; never infer approval from reachable API. No production fetcher is enabled by adding a URL here.

Before using any candidate data: verify current upstream terms and robots, source certificate and redirect policy, authorization to redistribute/monetize, project operator identity, API terms and changes, user consent and data minimization. Reassess after provider changes, outage, revocation, schema upgrade, reported abuse or source disagreement. Incident response: disable collection and entitlements immediately, retain sanitized immutable hashes and operator evidence, notify affected users/providers as appropriate, require human approval to resume.

## Exit criterion reconciliation

| Requirement | S-01 finding |
| --- | --- |
| Folding@home source/API inventory | Satisfied: published official URLs and scraping constraint documented |
| BOINC project capability inventory | Satisfied at framework level; named project selection explicitly not approved |
| Terms/permission limitations | Satisfied as an explicit no-activation decision; legal/provider permission remains unresolved |
| Evidence strength/freshness | Satisfied: T0–T3 tiers, hourly/daily expected cadences; no assumption of work-unit proof |
| Identity, privacy and correction risk | Satisfied: documented threat model and fail-closed policies |
| Explicit per-provider decision | Satisfied: disabled for rewards and live ingestion pending independent approvals |
| Production monetization permission | **NOT ASSERTED**; prerequisite for later S-02/S-03 production use |

**Qualification:** app-scoped Level 1 policy verifier only; no Foundry/Genesis/global Docs/Geth suites. S-06 is the intended first Level 2 ingestion milestone. The only output is a source policy and implementation-safe inventory, not external integration.

**Next step: S-02 — Production-grade read-only ingestion clients.** S-02 must remain disabled against real providers until applicable permissions are established.

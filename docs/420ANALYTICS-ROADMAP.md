# GEN-10.4 — 420Analytics roadmap

420Analytics is a contract-free, non-authoritative derived-data application for the 420 Integrated ecosystem. It consumes qualified public projections, computes documented metrics and historical snapshots, and presents trends without becoming canonical authority for balances, accounting, ownership, identity, rights, governance, settlement, validator state, arbitration, or protocol execution.

Development is stacked on `feature/gen10-4-420analytics-v1` and merged once after ANALYTICS-10 closeout and reconciliation with current `main`.

## Frozen architecture

- 420Analytics owns no canonical protocol state.
- Chain-derived analytics consume the qualified 420Indexer public API only; Analytics does not crawl node420 RPC or reimplement ingestion, finality, checkpointing, reorg handling, or protocol decoding.
- Metrics, KPIs, cohorts, rankings, anomaly scores, forecasts, chart series, caches and materialized views are derived and rebuildable.
- Every metric result carries chain/source provenance, methodology/version identity, observation window and indexed/finalized snapshot context.
- Historical snapshots are immutable once published for a frozen methodology + source snapshot, but remain non-canonical evidence.
- Wrong-chain, stale, degraded, incomplete or provenance-invalid upstream state fails closed for metrics that claim canonical context.
- Private Messenger content, private Commons content, private Identity fields, encrypted Resource payloads and raw Attention telemetry are excluded.
- Aggregation never authorizes deanonymization or protected-payload recovery.
- Analytics failure or replacement cannot block Wallet, RPC, Explorer, Search or underlying protocols.

## Roadmap

| Phase | Scope | Exit condition |
| --- | --- | --- |
| ANALYTICS-0 | Architecture freeze and qualification contract | Authority boundary, source boundary, metric classes, privacy exclusions and ANL invariants executable in tests |
| ANALYTICS-1 | Qualified 420Indexer consumer | Health/readiness/status/snapshot consumer fails closed on wrong-chain, stale or non-authoritative upstream state |
| ANALYTICS-2 | Metric and snapshot model | Stable metric IDs, methodology versions, windows, dimensions, units, provenance, finality and immutable snapshot identity |
| ANALYTICS-3.1 | Network and chain metrics | block production, transaction activity, gas/fee, finality and address/activity aggregates |
| ANALYTICS-3.2 | Validator and staking metrics | validator-set, lifecycle, bond, readiness and reward aggregates without creating staking authority |
| ANALYTICS-3.3 | Protocol/application metrics | public Registry, Names, Identity-public, Swap, Bridge, Governance, Market, Rights, Commons and Pulse aggregates |
| ANALYTICS-3.4 | Treasury/economic metrics | public issuance, treasury, fee, grant and payment-derived aggregates with source-accounting provenance |
| ANALYTICS-4.1 | Methodology registry | versioned formulas, dimensions, windows, inclusion/exclusion rules and deprecation semantics |
| ANALYTICS-4.2 | Time-series engine | deterministic buckets, immutable snapshot keys, gap handling and fixed-snapshot pagination |
| ANALYTICS-4.3 | Cohorts/rankings | documented non-canonical cohorts/rankings with stable tie-breaking and privacy thresholds |
| ANALYTICS-4.4 | Forecast/anomaly layer | explicitly predictive/non-canonical outputs separated from observed facts |
| ANALYTICS-5 | Analytics HTTP API | versioned metrics/series/snapshots/methodologies/capabilities/health/readiness/status endpoints with bounded inputs |
| ANALYTICS-6.1 | Privacy hardening | admission tests prevent protected/private/raw telemetry from entering derived datasets |
| ANALYTICS-6.2 | Reorg/finality/freshness | finalized snapshots never rewrite; nonfinalized projections reconcile deterministically; stale data is explicit |
| ANALYTICS-6.3 | Abuse/resource controls | query/window/cardinality/result/time bounds and rate-limit hooks |
| ANALYTICS-7.1 | Dashboard shell | network overview, navigation, filters, windows and methodology access |
| ANALYTICS-7.2 | Metric presentation | cards/charts/tables expose units, windows, source and methodology consistently |
| ANALYTICS-7.3 | Trust presentation | provenance, finality, freshness, missing-data and predictive/non-canonical labels visible to users |
| ANALYTICS-8 | Runtime/deployment | `analytics420` runtime, configuration, graceful shutdown, container packaging and operational probes |
| ANALYTICS-9 | Testnet qualification | live Indexer integration, seeded metric evidence, restart/rebuild/reorg validation and machine-readable evidence |
| ANALYTICS-10 | Genesis closeout | full ANL invariant audit, docs/readiness completion, final qualification matrix and reconciliation with current main |


## Audit remediation status

- **ANALYTICS-AUDIT-1 — exact-head repository qualification: COMPLETE**
  - qualification level: Level 1 app-specific fast qualification;
  - qualified implementation SHA: `988842ee7fcfdb804af699358458718063624af1`;
  - durable evidence commit: `aab878b282ae6815ad9d55937c549a27573d2c92`;
  - workflow: `420Analytics Audit Qualification`;
  - run: `37102656876`;
  - job: `111145094012`;
  - unit/integration, race, static analysis, runtime builds, Analytics Genesis-profile verification and explicit ANALYTICS-9 live-gate verification all PASS;
  - no Level 2 milestone run was required;
  - Level 3 repository-wide closeout qualification remains intentionally deferred.
- **ANALYTICS-AUDIT-2 — durable repository audit evidence: COMPLETE**
  - qualification level: Level 1 evidence-only app-scoped closeout;
  - qualified implementation SHA remains `988842ee7fcfdb804af699358458718063624af1`;
  - durable AUDIT-2 evidence ledger commit: `06eecb26f1a3c66a1191f807b396ac51d4d42718`;
  - retained workflow/run/job evidence: `420Analytics Audit Qualification` / `37102656876` / `111145094012`;
  - no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces or deployment state changed in AUDIT-2;
  - no recursive CI run is required under the evidence-only qualification rule;
  - no Level 2 milestone run was required;
  - Level 3 repository-wide closeout qualification remains intentionally deferred;
  - live testnet and Genesis closeout gates remain incomplete and unchanged.
- **Next canonical roadmap step: ANALYTICS-9 — Testnet qualification.**
- Canonical product phase remains **ANALYTICS-9 / LIVE_QUALIFICATION_READY**; this audit bookkeeping does not advance or fabricate live-testnet evidence.

## Qualification policy

Every phase must remain green before moving forward. ANALYTICS-0 through ANALYTICS-10 remain stacked on this branch; the branch is reconciled against current `main`, fully requalified, and merged once at GEN-10.4 closeout.

# 420AI recovery roadmap

Status: **ACTIVE RECOVERY PROGRAM**

This roadmap tracks the repository-level recovery from a partially implemented 420AI architecture to a Genesis-qualified, testnet-operable application stack.

## AI-RECOVERY-1 — On-chain architecture recovery — COMPLETE

Delivered:
- missing mature 420AI authorization/policy/deployment/request/result/router/interface modules;
- full 420 ComputeMarket contract stack;
- AI-to-Compute adapter;
- duplicate model/version registry avoidance;
- recovery integration tests;
- contract-map reconciliation.

Exit condition: missing architecture-named on-chain surfaces restored without creating parallel canonical state.

## AI-RECOVERY-2 — Genesis address reconciliation — COMPLETE

Delivered:
- Step 6.2 system address map made sole physical predeploy authority;
- conflicting later canonical allocations removed;
- newer routers/factories classified as registry-resolved;
- verifier expanded across system map, deployment manifest, predeploy plan and Native AI Genesis;
- Wallet SmartAccountFactory/CapabilityRegistry hard-coded collisions removed;
- regression qualification green.

Exit condition: one physical contract per frozen Genesis address and no conflicting address authority.

## AI-RECOVERY-3 — Provider/runtime control plane — COMPLETE

Delivered:
- `420-ai-provider/` runtime;
- provider manifests and commitments;
- canonical AI/Compute reconciliation;
- provider eligibility and constraint checks;
- MATCHED -> ACCEPTED -> RUNNING progression;
- payload commitment verification;
- pluggable inference and storage ports;
- deterministic result/execution-manifest commitments;
- bounded metering and receipt submission;
- external signer/transaction boundary;
- readiness/status surface;
- dedicated CI gate.

Qualification: all exact-head AI Provider, Solidity, Integrated, Docs, Wallet Web, Wallet Extension and Wallet Mobile suites passed.

Exit condition: a safe reconstructable off-chain provider control plane exists without embedding wallet/private-key authority.

## AI-RECOVERY-4 — Derived API, Indexer projection and service discovery — IMPLEMENTED / QUALIFICATION IN PROGRESS

Goals:
- stable AI read API for user-facing clients;
- provider/model/job discovery projections;
- job lifecycle/history projection;
- canonical source references and freshness metadata;
- explicit non-authoritative semantics;
- service-manifest discovery for AI API endpoints;
- read adapter boundary that can use 420Indexer and direct RPC fallback;
- pagination/filter validation;
- health/readiness semantics suitable for `ai.420integrated.org`;
- dedicated tests/CI.

This phase must not create a second mutable source of job/provider/model truth.

## AI-RECOVERY-5 — ai.420integrated.org user interface — PLANNED

Planned:
- Wallet connection and network discovery;
- model/provider browser;
- request creation/funding flow;
- prompt/private payload handoff;
- job state timeline;
- result/evidence/verification display;
- spend/settlement/refund presentation;
- job history/disputes;
- provider operator dashboard.

The UI will consume AI-RECOVERY-4 APIs and canonical Wallet-authorized write paths.

## AI-RECOVERY-6 — Production adapters and verification/settlement integration — PLANNED

Planned:
- RPC/Indexer canonical state adapter for provider runtime;
- provider transaction signer adapter;
- 420Storage/420Gateway payload adapter;
- concrete model/GPU serving backend(s);
- encrypted payload transport;
- Vault settlement adapter;
- 420Trust evidence adapter;
- production verifier implementations;
- telemetry/process supervision.

## AI-RECOVERY-7 — Testnet deployment and end-to-end qualification — PLANNED

Planned:
- deployment/service manifests;
- provider node deployment;
- API deployment;
- UI deployment;
- Wallet -> AI -> Compute -> provider -> verification -> settlement/refund smoke;
- failure/recovery drills;
- fuzz/invariant expansion;
- security review;
- public testnet release evidence.

## Completion definition

420AI recovery is complete only when the on-chain protocols, provider runtime, derived API, user UI, production adapters and testnet deployment all agree on canonical identities and lifecycle semantics, and the complete user flow is qualified end to end.

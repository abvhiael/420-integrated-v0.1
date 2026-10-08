# CMP-8 — 420Compute application

Status: **IMPLEMENTED — app-scoped Level 1 + Level 2 qualification pending.**

## Canonical purpose

Provide the human-facing market and participation experience on top of the qualified CMP protocol and CMP-7 developer surfaces.

CMP-8 does not create a new protocol authority. Browser, API and Indexer data remain clients/projections; canonical writes require the existing Wallet/signing and contract boundaries.

## Required user surfaces

The application provides:

1. researcher/job-owner submission through the qualified Compute API and an unsigned Wallet-authorized plan;
2. worker onboarding using the existing packaged node420-compute identity/resource configuration;
3. verifier operations as non-authoritative identity/capability views, without exposing governance-only mutation as an ordinary user action;
4. research-project management with indexed project views and reviewed Wallet handoffs for canonical owner actions;
5. worker health and earnings, where “health” is explicitly indexed registration/activity and not local host telemetry;
6. completed-job views;
7. CPU/GPU contribution totals keyed by configured canonical reward metric IDs;
8. projects supported;
9. result and verification status;
10. worker reputation and stake-reference evidence.

## Participation loop

The app reduces participation to:

1. choose/download the worker package for the user’s platform;
2. enter canonical provider/node/resource/worker identifiers;
3. choose local CPU/GPU percentages;
4. optionally select local project preferences;
5. generate the one-argument-per-line worker configuration;
6. complete canonical worker registration/activation through reviewed 420Wallet handoff where a canonical runtime is configured;
7. explicitly start the packaged worker;
8. monitor indexed jobs, rewards, result status and trust/stake references.

Project preferences are deliberately labelled **LOCAL_PREFERENCE_ONLY**. The current canonical worker execution authorization does not carry a research project ID, so the browser must not claim those preferences override or filter canonical assignments.

## Read-model dependency

CMP-8 extends 420Indexer only as needed for human presentation:

- bounded jobs by owner;
- bounded workers by operator;
- bounded verifiers by authority;
- bounded research projects by owner;
- bounded useful-reward records by beneficiary;
- worker reputation-reference history;
- worker stake-reference history.

All records remain `authoritative:false`. Reputation signed totals are decoded as `int256`. Stake capture events expose policy/source/position reference metadata only; the app does not invent a stake amount absent from the indexed event.

## Runtime/deployment boundary

The checked-in runtime config is fail-closed:

- write actions are disabled;
- unresolved canonical contract addresses are null;
- Wallet handoff creation refuses to proceed without an explicitly enabled canonical write runtime.

This repository state qualifies the application implementation, not a live public deployment. Canonical endpoint/address materialization belongs to the later public-testnet deployment phase.

## Qualification model

CMP-8 is one canonical roadmap step; no synthetic substeps are introduced.

Level 1 is owned by the app-specific 420Compute workflow: web structure/security/tests/build plus directly affected Compute Indexer and Compute API/worker regressions.

The meaningful Level 2 milestone is **human participation convergence**: the retained web + Indexer + Compute API + worker configuration/resource-control suites pass together on one exact accumulated SHA.

Level 3 occurs once at CMP-8 phase closeout after reconciliation to current `main`.

## Exit criteria

CMP-8 is eligible for COMPLETE only when:

- every required user surface above exists and is exercised by app tests/verifier checks;
- the participation loop is understandable without internal protocol knowledge;
- job submission cannot bypass Wallet authorization;
- browser configuration rejects secret-bearing fields;
- default unresolved write runtime fails closed;
- Indexer collections are bounded and chain scoped;
- reputation/stake views remain non-authoritative and do not infer unavailable stake amounts;
- worker resource limits map to the existing packaged worker arguments;
- project preferences are not misrepresented as canonical scheduler policy;
- app-specific Level 1 passes on the exact implementation SHA;
- retained app Level 2 integration passes on the accumulated exact SHA;
- final Level 3 closeout passes on one reconciled exact merge-candidate SHA.

Next canonical roadmap step after phase closeout: **CMP-9 — Public testnet deployment**.

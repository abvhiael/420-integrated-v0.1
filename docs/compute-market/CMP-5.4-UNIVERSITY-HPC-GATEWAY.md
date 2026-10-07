# CMP-5.4 — University/HPC gateway

Status: **IMPLEMENTATION COMPLETE — LEVEL 1 EXACT-HEAD QUALIFICATION PENDING.**

Canonical roadmap step: **CMP-5.4 — University/HPC gateway**.

## Purpose

CMP-5.4 adds a provider-neutral normalization gateway for university and institutional HPC systems. It binds institution, gateway, scheduler, account, project, workload, allocation, result, resource usage, accounting and evidence commitments without requiring a university cluster to adopt the native CMP worker runtime.

The gateway is deliberately not an institutional credential verifier or external scheduler oracle.

## Canonical HPC record

`ComputeUniversityHpcGateway420.HpcRecord` binds:

- institution identity commitment;
- gateway identity commitment;
- scheduler identity commitment;
- external account identity commitment;
- research-project commitment;
- workload commitment;
- allocation commitment;
- optional queue/partition commitment;
- result commitment;
- submitted/start/completion timestamps;
- resource-usage commitment;
- accounting commitment;
- evidence commitment.

Raw usernames, institutional credentials, scheduler tokens, project data, queue names, allocation secrets, usage records and result bytes remain off-chain.

## Stable contribution identity

The stable contribution identity binds institution, gateway, scheduler, account, project, workload and allocation.

Queue/partition, result, lifecycle, usage, accounting and evidence observations are bound by the full record commitment and cannot manufacture a new underlying contribution identity.

## Validation and failure behavior

The gateway rejects missing institution, gateway, scheduler, account, project, workload, allocation, result, resource-usage, accounting or evidence commitments; zero submission time; start before submission; and completion before start.

Queue/partition commitment is optional because some institutional schedulers do not expose a stable public partition identity or intentionally hide it.

## Shared adapter compatibility

The gateway implements the existing `IComputeExternalContributionAdapter420` identity surface.

Retained cross-adapter tests cover Folding-at-home, BOINC, research-cluster and university/HPC families and require adapter-kind, external-system and protocol commitments to remain mutually domain-separated.

## Authority boundaries

CMP-5.4 does not:

- query Slurm, PBS, LSF or vendor schedulers;
- validate university credentials or federation assertions;
- assert that an external allocation actually ran;
- establish scientific correctness;
- create canonical verification state;
- create reward/payment entitlement;
- reserve, settle or refund Vault value;
- slash stake;
- prevent duplicate rewards.

CMP-5.6 owns **double-reward prevention**.  
CMP-5.7 owns **external-result attestation**.  
CMP-6 owns useful-computation reward economics.

## Qualification

CMP-5.4 is an ordinary **Level 1** step. It extends the provider-neutral external-adapter family without creating a new shared authority, lifecycle or settlement dependency.

CMP-5.2 remains the most recent CMP-5 Level 2 integration milestone. Level 3 remains reserved for CMP-5.8.

## Exit criteria

CMP-5.4 is complete when one exact implementation SHA satisfies every machine-readable exit criterion and the exact-head Compute Market workflow passes the affected build, retained Compute Solidity tests, verifier compilation, retained CMP-5.1 through CMP-5.3 verifiers and the CMP-5.4 verifier.

## Next canonical step

**CMP-5.5 — External proof/credit adapters**

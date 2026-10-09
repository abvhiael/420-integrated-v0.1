# COM-1.8 — Level 3 architecture closeout reconciliation and qualification ledger

**Canonical step:** COM-1.8 — Level 3 architecture closeout.  
**PR:** #588. **Branch:** `commerce/com-1-architecture-reconciliation`.  
**Status:** LEVEL 3 QUALIFIED AND MERGED — PR #588. The original pre-dispatch ledger below is retained as historical evidence and superseded by this verified closeout.

## Verified closeout (2026-10-09 UTC)

Implementation `d32c1eeacc2ba4f13d3a6fcd1afb84a5abb0aa3c`; reconciliation base `3de7a0d87600fa30ec6090c1351a11d36ba59de9`; merge `0ec695481fc84e6066aeae50baf6e0fd3c7f8731`.

| Gate | Exact-candidate evidence | Result |
| --- | --- | --- |
| Solidity | Run 37884486346; four shards, unique/complete inventory, Decision #10 fixture | All mandatory jobs SUCCESS |
| Genesis authority | Run 37884524888; cross-manifest-authority | SUCCESS |
| Integrated | Run 37884563459; offline-core, production-dependencies, geth-engine, fault-matrix | All four jobs SUCCESS |
| Docs | Run 37884412517; qualify | SUCCESS |

The manual Foundry recovery was included in this implementation candidate; old candidate results and cancelled PR-profile runs were not substituted. PR metadata records these results. Live Commerce execution, reporter deployment and testnet/mainnet readiness were never claimed. Next canonical phase: COM-2 — Contracts / upstream adaptations.

## Historical pre-dispatch ledger (superseded)

## Candidate and main reconciliation

At pre-closeout inspection, PR #588 was **ahead 20 / behind 0** compared with current main `ffc6a4028676907c266714b5c1ae8ba3af9a7137`. The comparison contained **only documentation under `docs/commerce/**`**: the phase roadmap, COM-1.1 inventory, COM-1.2–1.7 architecture documents and Level 1 evidence. No contract, executable service, tests, CI workflow, frozen address map, manifest or deployment config changed. Current pre-closeout implementation/reference SHA: `091963d9159ace816360f2a29083104201c110ec`.

**Exact closeout candidate:** The SHA of the final substantive roadmap/closeout reconciliation commit (to be recorded once committed). Evidence-only commits may reference that SHA, but a later substantive requirement edit requires requalification.

## Exit criteria reconciled

| Criterion | Result |
| --- | --- |
| COM-1.1 actual source discovery and canonical Market/Pay/Wallet boundaries | DOCUMENTED; COM-1.1 inventory lists a targeted automated check as pending |
| COM-1.2 requirements / authority matrix and noncanonical app service identity | DOCUMENTED, targeted checks 13/13, Docs PASS on evidence SHA `313e5d93c7c29a1b8153448e0bb0143762e46581` |
| COM-1.3 ABI-level Market/Pay architecture and reporter gap | DOCUMENTED, targeted checks 15/15; original evidence left exact-head CI unverified |
| COM-1.4 persistence, Indexer and reorg architecture | DOCUMENTED, targeted checks 15/15; Docs PASS on evidence SHA `89d6c607e39c128f5968ce979b7078a997be78d9` |
| COM-1.5 adapter integration, fail-closed and Wallet/Registry/Swap authority | DOCUMENTED, targeted checks 12/12; CI conclusion in evidence unverified |
| COM-1.6 storefront and merchant UX, accessibility and protected checkout states | DOCUMENTED, targeted checks 15/15; CI conclusion in evidence unverified |
| COM-1.7 risk-ranked threat model, financial/stock/replay/privacy release gates | DOCUMENTED, targeted checks 14/14; latest Docs PASS on evidence SHA `091963d9159ace816360f2a29083104201c110ec` |
| No duplicate Commerce financial/state/canonical ID authority | PASS source inspection, no executable modifications |
| 420Pay-to-Market proof-validating reporter and live checkout | **NOT IMPLEMENTED**; explicitly COM-2/COM-3 and COM-8, NOT a false architecture completion claim |
| Live website, Cloudflare binding, testnet tx evidence | **NOT IMPLEMENTED**; later phases |
| Exact-SHA comprehensive Level 3 | **NOT SATISFIED** |

## Required Level 3 exact-candidate qualification ledger

**Dispatch all against the exact final candidate SHA**, using existing canonical workflows and no coverage-weakening changes:

| Owner / workflow | Required evidence | State |
| --- | --- | --- |
| Solidity Contracts — `.github/workflows/contracts-foundry.yml` | Canonical complete Foundry repository inventory once, deployment bytecode constraints, required security/adversarial coverage; use retained runner-aware shards | NOT RUN for COM-1.8 candidate |
| Genesis Address Authority — `.github/workflows/genesis-address-authority.yml` | Address / namespace / frozen manifest / predeploy collision and cross-consumer verifiers; **do not repeat full Foundry** | NOT RUN for COM-1.8 candidate |
| 420 Integrated Qualification — `.github/workflows/qualification.yml` | Applicable global integration and infrastructure qualification, exact SHA | NOT RUN for COM-1.8 candidate |
| 420Docs Qualification — `.github/workflows/docs-qualify.yml` | Documentation, roadmap and metadata reconciliation on final candidate | NOT RUN for COM-1.8 candidate |
| Retained Commerce-specific suite | There is no established COM-specific executable web/backend/SDK suite in this documentation-only architecture PR. Do not invent a passing suite. Run verifiers if introduced | NOT APPLICABLE to unbuilt service; documented source checks exist |
| Affected clients / services / Indexer / Search / RPC | No executable changes in this PR. No affected app-specific runtime check identified by file diff | NOT TRIGGERED by docs-only changes |
| Security and deployment | Threat model source review only; real adapter penetration/invariant/live deployment gate belongs to later phases | DEFERRED, never claimed tested |

The workflow definitions include `workflow_dispatch` but the current GitHub connector surface inspected for this work does **not** expose a workflow dispatch operation. Creating a docs-only commit or observing unrelated auto-triggered workflows is NOT equivalent to running all four Level 3 workflows.

## Qualification policy / blocked next action

1. Commit this ledger and reconcile roadmap without changing normative requirements or falsely marking the phase complete.
2. Take the exact final implementation candidate SHA and invoke the four canonical workflow-dispatch actions on that SHA using an authenticated dispatch-capable GitHub session. Do not edit workflows or create duplicate inventory jobs just to make CI run.
3. Verify workflow IDs and individual job conclusions; diagnose any failures before rerunning. Preserve exact-SHA evidence.
4. If all required Level 3 checks pass, commit **evidence-only** final results, mark roadmap/PR COMPLETE, and only then consider merge.
5. If dispatch or checks are missing, keep COM-1.8 BLOCKED and PR unmerged. No skipped/cancelled/pending gate counts as PASS.

**Next canonical phase after verified closeout:** COM-2 — Contracts / upstream adaptations. Real testnet COM-8 and mainnet COM-9 remain independently blocked on their own evidence and authorization.

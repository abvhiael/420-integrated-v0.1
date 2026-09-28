# EXP-NEXT.4 — Production-equivalent deployment, live integration and recovery qualification

Status: **NOT YET COMPLETE — authoritative external infrastructure is not provisioned**

Canonical definition: `docs/audit/EXP-2R.5-authoritative-next-phase-roadmap.json`.

Repository inspection confirms that EXP-NEXT.1–3 repository work is present in the dependency branch history and the Indexer/Explorer artifacts are deployable. However, EXP-NEXT.4 explicitly requires production-equivalent deployment and approved live target-network evidence. The authoritative repository still records all public RPC/Explorer endpoints as placeholders and the testnet infrastructure inventory as `PLANNED` / `UNPROVISIONED`.

Accordingly, source tests, synthetic recovery fixtures, or a CI-only local stack MUST NOT be promoted to EXP-NEXT.4 completion evidence. The remaining blockers require approved chain-420 execution and consensus sources, non-placeholder deployed Indexer/Explorer endpoints, direct ProtocolRegistry runtime/publication verification, canonical-vs-indexed witnesses, and deployed restart/outage/reorg/rebuild exercises.

Repository-side work for this step may harden and pin the live qualification harness, but status remains NOT YET COMPLETE until the canonical completion conditions pass against one exact release candidate.


## Repository-readiness exact-head evidence

Candidate repository-readiness head `e970f723017c0e1f1fe23fdcb0378853583ae3fd` passed the full retained repository suite:

- EXP-NEXT.4 Repository Readiness — `36478286176` — SUCCESS — artifact `10995735271`
- EXP-NEXT.3 — `36478286157` — SUCCESS
- EXP-NEXT.2 — `36478286149` — SUCCESS
- EXP-2.2 — `36478286174` — SUCCESS
- EXP-2.3 — `36478286175` — SUCCESS
- EXP-2.4 — `36478286173` — SUCCESS
- EXP-2.5 — `36478286191` — SUCCESS
- EXP-2.6 — `36478286128` — SUCCESS
- EXP-1.7 — `36478286141` — SUCCESS
- EXP-1.8 — `36478286233` — SUCCESS
- EXP-1.10 — `36478286133` — SUCCESS
- 420Docs — `36478286163` — SUCCESS
- 420Indexer — `36478286210` — SUCCESS, including repaired EXP-0.4.1 cumulative CI inventory
- 420 Integrated — `36478286135` — SUCCESS (geth-engine, production-dependencies, fault-matrix, offline-core)

This evidence is **repository readiness only**. It does not satisfy EXP-NEXT.4 live/deployment/recovery completion conditions. The evidence-recording commit created by this update must itself re-pass the exact-head retained suite.

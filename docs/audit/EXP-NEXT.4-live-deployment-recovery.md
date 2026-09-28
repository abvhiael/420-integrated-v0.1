# EXP-NEXT.4 — Production-equivalent deployment, live integration and recovery qualification

Status: **NOT YET COMPLETE — authoritative external infrastructure is not provisioned**

Canonical definition: `docs/audit/EXP-2R.5-authoritative-next-phase-roadmap.json`.

Repository inspection confirms that EXP-NEXT.1–3 repository work is present in the dependency branch history and the Indexer/Explorer artifacts are deployable. However, EXP-NEXT.4 explicitly requires production-equivalent deployment and approved live target-network evidence. The authoritative repository still records all public RPC/Explorer endpoints as placeholders and the testnet infrastructure inventory as `PLANNED` / `UNPROVISIONED`.

Accordingly, source tests, synthetic recovery fixtures, or a CI-only local stack MUST NOT be promoted to EXP-NEXT.4 completion evidence. The remaining blockers require approved chain-420 execution and consensus sources, non-placeholder deployed Indexer/Explorer endpoints, direct ProtocolRegistry runtime/publication verification, canonical-vs-indexed witnesses, and deployed restart/outage/reorg/rebuild exercises.

Repository-side work for this step may harden and pin the live qualification harness, but status remains NOT YET COMPLETE until the canonical completion conditions pass against one exact release candidate.

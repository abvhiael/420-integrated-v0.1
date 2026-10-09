# 420Hz Generate + Community + Awards architecture

This directory contains the normative HZ-GCA-1 architecture set.

Start with:

- [Consolidated HZ-GCA-1 architecture](HZ-GCA-1-ARCHITECTURE.md)
- [Canonical roadmap](../../420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md)

## Qualified HZ-GCA-1 work packages

1. [HZ-GCA-1.1 — Product boundaries](HZ-GCA-1.1-PRODUCT-BOUNDARIES.md)
2. [HZ-GCA-1.2 — Canonical object model](HZ-GCA-1.2-CANONICAL-OBJECT-MODEL.md)
3. [HZ-GCA-1.3 — Generate lifecycle](HZ-GCA-1.3-GENERATE-LIFECYCLE.md)
4. [HZ-GCA-1.4 — AI disclosure](HZ-GCA-1.4-AI-DISCLOSURE.md)
5. [HZ-GCA-1.5 — Provenance](HZ-GCA-1.5-PROVENANCE-MODEL.md)
6. [HZ-GCA-1.6 — Rights & consent](HZ-GCA-1.6-RIGHTS-CONSENT-BOUNDARIES.md)
7. [HZ-GCA-1.7 — Privacy](HZ-GCA-1.7-PRIVACY-MODEL.md)
8. [HZ-GCA-1.8 — Storage & retention](HZ-GCA-1.8-STORAGE-RETENTION.md)
9. [HZ-GCA-1.9 — Generation economics](HZ-GCA-1.9-GENERATION-ECONOMICS.md)
10. [HZ-GCA-1.10 — Community authority](HZ-GCA-1.10-COMMUNITY-AUTHORITY.md)
11. [HZ-GCA-1.11 — Charts rules](HZ-GCA-1.11-CHARTS-RULES.md)
12. [HZ-GCA-1.12 — Awards architecture](HZ-GCA-1.12-AWARDS-ARCHITECTURE.md)
13. [HZ-GCA-1.13 — Nomination & voting](HZ-GCA-1.13-NOMINATION-VOTING-POLICY.md)
14. [HZ-GCA-1.14 — Moderation & disputes](HZ-GCA-1.14-MODERATION-DISPUTE-BOUNDARIES.md)
15. [HZ-GCA-1.15 — Threat model](HZ-GCA-1.15-THREAT-MODEL.md)
16. [HZ-GCA-1.16 — API/event/interface contracts](HZ-GCA-1.16-API-EVENT-INTERFACE-CONTRACTS.md)
17. [HZ-GCA-1.17 — Failure and recovery](HZ-GCA-1.17-FAILURE-RECOVERY-SEMANTICS.md)

## Machine-readable architecture

The exact machine-readable manifests live under `hz/config/gca-*.json`.

HZ-GCA-1.18 adds:

- `hz/config/gca-architecture-consolidation-v1.json`

The consolidation manifest indexes every HZ-GCA-1.1 through HZ-GCA-1.17 document/manifest and verifies there is no unresolved authority duplication.

## Reading rule

The consolidated architecture is the human-readable entry point.

For exact field-level policy, the subordinate machine-readable manifest for the relevant work package remains normative.

A future change that alters substantive subordinate semantics requires qualification at the applicable roadmap level rather than silently editing only this index.

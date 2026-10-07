# REEFER-AUDIT-7 — live dependency integration

**Canonical status:** NOT COMPLETE — BLOCKED ON APPROVED PRODUCTION-EQUIVALENT PUBLIC TESTNET  
**Repository-side handoff/harness:** IMPLEMENTED — Level 1 qualification required on exact implementation SHA  
**Canonical dependencies:** 420 Identity, 420 Rights, 420 Storage, 420 Search, 420 Notifications, 420Mail

## Purpose and exit criteria

REEFER-AUDIT-7 is the live integration step. It is not satisfied by interfaces, in-memory adapters, local fixtures, repository CI, or synthetic service responses.

The live exit criteria are:

1. one approved production-equivalent public testnet and official manifest exist;
2. Reefer Review is deployed from one exact repository SHA and exposes a real readiness endpoint;
3. the deployment binds to the exact live service identities for all six canonical dependencies;
4. Identity authorization is observed live and fails closed for inactive/wrong identity;
5. Rights/provenance assertion is observed live before publication and denial fails closed;
6. article bytes round-trip through qualified off-chain 420 Storage with integrity verification;
7. PUBLIC publication reaches the rebuildable 420 Search projection while restricted/private material does not;
8. opted-in 420 Notifications delivery is observed with provenance/dedup behavior;
9. signed/authorized internal 420Mail delivery is observed without enabling external SMTP/newsletters;
10. restart/idempotency and dependency outage/recovery behavior are exercised;
11. retained non-secret evidence is tied to the exact repository SHA, network identity and deployed service identities.

## Current external blocker

Repository truth still has no official `developer-hub/manifests/testnet.json`. Public-testnet metadata is candidate/placeholder and other canonical dependency audits also preserve live testnet gates. Therefore no live endpoint, deployment identity, transaction, delivery receipt, or PASS evidence may be invented.

Expected repository readiness while blocked:

```
REEFER_AUDIT_7_READINESS=BLOCKED_OFFICIAL_TESTNET_MANIFEST
liveQualificationComplete=false
```

## Repository-side implementation

- `docs/audit/REEFER-AUDIT-7-LIVE-EVIDENCE-DRAFT.example.json` — hostile-by-default evidence template covering all six dependencies and required positive/negative/recovery journeys.
- `scripts/qualify-reefer-review-testnet.py` — manual live-evidence validator. It requires the official testnet environment, exact SHA binding, credential-free HTTPS service/health URLs, live health probes, complete dependency identity evidence and all required journey evidence before it can emit PASS.
- `scripts/verify-reefer-audit-7-testnet-readiness.py` — fail-closed readiness verifier. It rejects retained PASS evidence before the official manifest exists and requires PASS evidence once the official manifest is present.
- `.github/workflows/reefer-review-live-testnet.yml` — manual-only live qualification workflow pinned to the dispatched SHA.
- `.github/workflows/reefer-review-audit-7.yml` — targeted Level 1 repository-harness qualification including exact-head assertion, Python syntax, hostile-template rejection, retained Reefer Review regressions and static/service-registry checks.

## Live criterion matrix

| Criterion | Status |
| --- | --- |
| approved public testnet + official manifest | **BLOCKED** |
| deployed Reefer Review exact release | **NOT RUN — BLOCKED** |
| Identity live binding/negative path | **NOT RUN — BLOCKED** |
| Rights/provenance live binding/negative path | **NOT RUN — BLOCKED** |
| Storage durable round-trip/integrity | **NOT RUN — BLOCKED** |
| Search PUBLIC-only projection/privacy negative | **NOT RUN — BLOCKED** |
| Notifications opt-in delivery/dedup | **NOT RUN — BLOCKED** |
| 420Mail authorized internal delivery | **NOT RUN — BLOCKED** |
| dependency outage/recovery | **NOT RUN — BLOCKED** |
| restart/idempotency | **NOT RUN — BLOCKED** |
| repository live-qualification harness | **IMPLEMENTED — LEVEL 1 PENDING** |
| TESTNET READY = YES | **NO** |

## Exact continuation when the public testnet exists

1. Freeze one approved release SHA and official testnet manifest.
2. Deploy Reefer Review with real production-equivalent adapters; staging/production must continue to fail closed if any adapter is absent.
3. Populate a reviewed `REEFER-AUDIT-7-LIVE-EVIDENCE-DRAFT.json` with real non-secret endpoint identities and evidence for every required journey.
4. Dispatch **Reefer Review live testnet qualification** on the exact release SHA.
5. Retain the generated PASS artifact as `docs/audit/REEFER-AUDIT-7-LIVE-TESTNET-EVIDENCE.json` after review.
6. Rerun the readiness verifier.
7. Only then mark REEFER-AUDIT-7 COMPLETE and advance to REEFER-AUDIT-8.

## Qualification model

This repository handoff is **Level 1**. No Level 2 milestone is required merely to add the blocked live-testnet harness. Level 3 remains deferred to app-phase closeout and cannot substitute for missing live REEFER-AUDIT-7 evidence.

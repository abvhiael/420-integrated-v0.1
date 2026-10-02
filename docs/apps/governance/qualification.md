# 420 Governance qualification ledger

This page is the application-level index to durable audit evidence. Individual evidence files remain authoritative for their exact implementation SHA, workflow run IDs and exit-criteria assessment.

| Step | Status | Durable evidence |
|---|---|---|
| GOV-AUDIT-1 | COMPLETE | `docs/audit/GOV-AUDIT-1-QUALIFICATION.md` |
| GOV-AUDIT-2 | COMPLETE | `docs/audit/GOV-AUDIT-2-QUALIFICATION.md` |
| GOV-AUDIT-3 | COMPLETE | `docs/audit/GOV-AUDIT-3-QUALIFICATION.md` |
| GOV-AUDIT-4 | COMPLETE | `docs/audit/GOV-AUDIT-4-QUALIFICATION.md` |
| GOV-AUDIT-5 | COMPLETE | `docs/audit/GOV-AUDIT-5-QUALIFICATION.md` |
| GOV-AUDIT-6 | COMPLETE | `docs/audit/GOV-AUDIT-6-QUALIFICATION.md` |
| GOV-AUDIT-7 | COMPLETE | `docs/audit/GOV-AUDIT-7-QUALIFICATION.md` |
| GOV-AUDIT-8 | phase closeout in qualification | `docs/audit/GOV-AUDIT-8-QUALIFICATION.md` after exact-SHA Level 3 qualification |
| GOV-AUDIT-9 | pending live production-equivalent testnet | canonical roadmap |
| GOV-AUDIT-10 | future Genesis candidate/production closeout | canonical roadmap |

## Current phase-closeout rule

GOV-AUDIT-8 is the repository documentation/operator/threat-model and app-phase closeout gate.

The closeout implementation SHA must be reconciled with current `main` and must pass, on that same SHA:

- canonical full Solidity inventory owned by **Solidity Contracts**;
- canonical Genesis/address-authority verification owned by **Genesis Address Authority**;
- **420 Integrated Qualification** where applicable;
- repository-wide **420Docs Qualification**;
- retained 420 Governance contract/deployment/integration qualification;
- retained Governance Wallet qualification;
- affected Governance Indexer/client/service qualification;
- security/adversarial/static/deployment/configuration checks.

No skipped/cancelled/missing required Level 3 owner is counted as passing.

## Evidence-only rule

After the exact implementation SHA is fully qualified, an evidence-only commit may record the workflow results and roadmap status without recursively invalidating qualification, provided it changes no executable source, tests, workflows, dependencies, configuration, generated artifacts, interfaces, deployment state or substantive requirements.

## Known closeout limitations

Repository Level 3 qualification proves the accumulated app phase against source/configuration and CI. It does not satisfy the later live production-equivalent testnet requirement in GOV-AUDIT-9.

The ordinary Wallet Governance UI remains intentionally limited to discovery, proposal inspection, eligibility and voting; proposal creation, queue and execution remain contract/developer/operator surfaces.

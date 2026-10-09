# 420Grow V2 cultivation operations roadmap

**Status:** GROW-V2-01 product decision COMPLETE at Level 1; V2-02 onward not yet implemented. Does not overwrite GROW-01–GROW-10 and does not assert Genesis authority.

**Decision source:** [GROW-V2-01](420GROW-V2-01-EXPANDED-PRODUCT-DECISION.md), which explicitly defines tenant-private cultivation software for lawful home, licensed small-business and commercial users. The prior public read-only FARM/BUSINESS directory remains independent. Canonical original audit is [420Grow initial roadmap](420GROW-INITIAL-AUDIT-AND-REMEDIATION-ROADMAP.md). Remaining former release/qualification work remains in [the deferred testnet ledger](420GROW-TESTNET-AND-DEFERRED-QUALIFICATION-ROADMAP.md).

| Step | Name | State / boundary |
| --- | --- | --- |
| GROW-V2-01 | Expanded product decision, personas and approved scope | COMPLETE / Level 1 — SHA `fc00b78f442c20eac35669d411dbe8d8ac8f99df`; runs 37846815165, 37846815166 SUCCESS |
| GROW-V2-02 | Architecture, tenancy, roles and security model | COMPLETE / Level 1 — SHA `2533e22b501802eeb913d0b143a68f8d2637ce97`; V2 CI 37862864718/job 113602515673 SUCCESS; original Grow 37862864805/job 113602515723 SUCCESS; [evidence](420GROW-V2-02-LEVEL-1-QUALIFICATION.md) |
| GROW-V2-03 | Persistent storage, schemas and migrations | COMPLETE / Level 1 — SHA `b38fc6c52d430dcc9969f0084324920b47c7d83a`; V2 run 37863365384/job 113604158748 and Grow run 37863365351/job 113604158759 SUCCESS |
| GROW-V2-04 | Facility, room and zone management | COMPLETE / Level 1 — SHA `f80edd1c6bd7592e2009d353b850f6f091c3f2e0`; V2 run 37865044110/job 113609659718 and retained Grow run 37865044115/job 113609659505 SUCCESS; [evidence](420GROW-V2-04-LEVEL-1-QUALIFICATION.md) |
| GROW-V2-05 | Plant lifecycle, genetics and cloning records | PLANNED / Level 2 accumulated V2-02–05 |
| GROW-V2-06 | Sensor telemetry ingestion and historical charts | PLANNED / Level 1 |
| GROW-V2-07 | Equipment adapters, monitoring and safe controls | PLANNED / Level 1 |
| GROW-V2-08 | Nutrients, irrigation and environmental history | PLANNED / Level 1 |
| GROW-V2-09 | Harvest forecasting and production analytics | PLANNED / Level 1 |
| GROW-V2-10 | Inventory, traceability and compliance exports | PLANNED / Level 2 accumulated V2-06–10 |
| GROW-V2-11 | AI-assisted analysis and human-reviewed recommendations | PLANNED / Level 1 |
| GROW-V2-12 | Ecosystem integrations and notifications | PLANNED / Level 1 |
| GROW-V2-13 | Full cultivation dashboard and mobile UX | PLANNED / Level 1 |
| GROW-V2-14 | Security, privacy, adversarial and recovery qualification | PLANNED / Level 1 |
| GROW-V2-15 | Documentation, exact-SHA phase reconciliation and complete Level 3 | PLANNED / Level 3 |
| GROW-V2-16 | Live production-equivalent testnet deployment and acceptance | BLOCKED / Testnet |

**Required qualification policy:** Step-specific Level 1 on each exact implementation SHA; Level 2 only at V2-05 and V2-10 or material shared boundaries; Level 3 at V2-15 once on reconciled exact implementation SHA. Solidity Contracts owns canonical full Foundry inventory, Genesis owns address authority without duplicate full Foundry, Docs and 420 Integrated each keep distinct ownership. Do not treat skipped/failed CI as passed. Evidence-only commits inherit only when no requirements/tests/workflow/runtime/config changed. Release evidence must not be invented.

# 420Pay application roadmap — PAY-APP

Owner-approved product scope, 2026-11-17. Normative product decision: [PAY-APP-0](PAY-APP-0-PRODUCT-SPECIFICATION.md). Existing PAY-AUDIT-1–8 numbering and historical results remain unchanged. All steps are unqualified unless exact-head evidence is retained. PAY-APP-0 tracks product approval, catalogue promotion and resident qualification. PAY-APP-1–18 are planned, not implemented. Steps 0–17 are repository-side, including configuration transition; only real external/device/provider blockers may be deferred. Step 18 requires the live public testnet. Independent security review remains PAY-AUDIT-8.

## PAY-APP-0 — Genesis catalogue amendment and product specification

**Status:** PARTIAL. Product approval recorded and V10 catalogue promoted under V3. Native artifact reconciliation remains open. **Testnet required:** No.

Exit criteria: Promote approved v10 candidate only with explicit configuration version transition, rematerialization of all affected residents, catalogue/docs/discovery/verifier reconciliation and exact-head evidence. Retain reproducible scoped qualification at exact implementation SHA.

### PAY-APP-0.2 — Dependency-aware regression discovery

Qualified at `c3fb2cf48b3429a9d7e8da96b2e204d7c452863d`. The independent inventory examined 627 tracked owners and selected 46. Of those, 33 passed in retained evidence and 13 passed in the full CI profile. All 138 retained source SHA-256 identities matched. Six discovery tests and 23 Indexer tests passed.

| Workflow | Run ID |
|---|---:|
| Full Pay regression | [44370481682](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44370481682) |
| PAY-AUDIT-7 | 44370481289 |
| 420Indexer | 44370482225 |
| CI-GUARD-02 | 44370481232 |
| 420Stake | 44370481363 |
| 420Explorer | 44370481580 |
| 420Registry | 44370481450 |
| 420Docs | 44370481391 |
| Native V3 candidate rehearsal | 44370481372 |

Retained artifacts are independent inventory `14457823388`, full regression `14458074983`, and derived runtime identities `14458808233`. The earlier regression archive `14447571280` belongs to run `44342384413` at `fa8cc74c0d5529ecd9032eba6afbe0f4b9247041`. The historical passes for `BetVideoPokerPaytable54.t.sol` and `ComputeJobPayerCustody420.t.sol` are retained outside the dedicated Pay coverage count.

### PAY-APP-0.3 — Permanent V3 Genesis configuration integration

The active configuration is `FROZEN_V3`, domain `420/GENESIS/CONFIG/V3`, with commitment `0x94321abcd7016ec0494a2c616fdf55bf4e8815dcc0f92d03933b335630e25d6d`. Independent Keccak-256 derivation also reproduced the historical V1 and V2 commitments. Git blob verification matched all six authority inputs. The only changed input was the approved V10 catalogue, blob `73a24bfe46787f3c2af043adc1de12eea1f456ab`.

The initial permanent V3 integration passed exact-head native rehearsal and Pay audit at `5b5560c0db4fe80710ae349f987b11aaf2713b35`. Native rehearsal reproduced 9 Pay and 4 Swap constructor runtimes and the disabled Bridge gateway. The Bridge package contained 113 compiler artifacts, and all 20 planner tests and 7 rehearsal checks passed across 11 core deployments. The configuration-sensitive Pay deployment, publication and wiring test passed under the full CI profile. The PAY-APP-0.2 evidence applies to the other unchanged Pay owners.

| Qualification | Run | Artifact |
|---|---:|---:|
| Committed V3 native rehearsal | [44378671347](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44378671347) | 14462148293 |
| Configuration-sensitive Pay regression | [44378671219](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44378671219) | 14462745884 |
| SWAP-AUDIT-6 materialized head | [44378671289](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44378671289) | See run |

Retained historical commitment blobs are V1 `c8537f6c984ba7d4965e8b51aaefc26c6e2e1cd5` and V2 `b69b140df641975f57f05c42e45d48ee93c0c1e0`. The historical Bridge qualification verifies against `95f6a94b7c313a14a6689fe754806a88e9bdc95d`. The V3 Swap deployment binding derives its four runtime identities from the committed predeploy states and remains subject to SWAP-AUDIT-8 live qualification.

### PAY-APP-0.4 — Native artifact reconciliation

**Status:** OPEN. This step owns full native artifact reconciliation and qualification.

### PAY-APP-0.6 — 420Wallet application discovery integration

Wallet lists the approved Pay service as `420/service/pay/v1` with
`https://pay.420integrated.org` as its proposed production origin. The web
catalogue offers connection help while Pay is unavailable. Extension navigation
requires a release-approved testnet or production entry, the corresponding
chain's active ProtocolRegistry record and matching runtime, and a reachable
approved endpoint. Navigation grants no account access or spending permission.

Local qualification covers catalogue visibility, manifest-only bypass attempts,
release and chain mismatches, unresolved and disabled records, endpoint failure,
and Wallet authorization regressions. Live launch depends on a published
release and active Registry binding.

## PAY-APP-1 — Shared application architecture and payment SDK

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Inventory reusable clients, ABI bindings, domain types, validation, private persistence, projection/HTTP boundaries; pin architecture and test contracts. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-2 — Registry, Wallet, Names and Identity integration

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Verified chain/service/code/origin resolution, account selection, exact Wallet simulation/confirmation and scoped revocation; reject wrong network and spoofed identities. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-3 — Consumer web dashboard and account management

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Responsive personal account UI, derived balances, history, receipts, settings, accessibility and explicit fixture mode. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-4 — Send, request, QR codes and payment links

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Validate recipients, invoice and address QR distinction, links, expiry, sharing, retries and duplicate protection. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-5 — Hosted checkout, quotes and payment confirmation

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Canonical prices, 42-second quote and fees, asset/settlement choices, explicit Wallet handoff, atomic failure and status. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-6 — Merchant registration and business dashboard

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Controller-bound onboarding, credential status, tenant isolation, authorized roles/locations/cashiers and reports. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-7 — Invoice builder and merchant payment management

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Online merchant acceptance, offline drafts, modes/tips/expiry, sharing, outstanding balances and canonical lifecycle. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-8 — Split settlement, refunds and tips

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Canonical split limits/rounding, actual refund asset delivery vs evidence, authorization and replay protections. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-9 — Accounting, reports and reconciliation

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Exact frozen 15-field export, private metadata/reporting, reconciliation, CSV/JSON and printable report. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-10 — Merchant POS and customer-facing display

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Quick pay, retail cart/tax/tip, cashier session, QR and verified settlement; offline draft only. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-11 — Developer APIs, webhooks and checkout integrations

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Versioned SDK/API, scoped credentials, hosted/embedded checkout, authenticated idempotent delivery and compensating reorg events; no signing. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-12 — Progressive Web App

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Installability, offline safe cache, camera/share support, authenticated navigation and stale-state protections. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-13 — Android application

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Shared SDK with native QR, verified Wallet links, secure sessions, notification privacy, build and device tests. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-14 — iOS application

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Same domain parity, verified universal links, native QR/share, session security, build and device tests. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-15 — Ecosystem integration and downstream consumers

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Reconcile Wallet/Swap/Registry/Indexer/Oracle/Commerce/Market and other authorized consumers; verify canonical state and recovery; no duplicate ledger. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-16 — Security, privacy, accessibility and adversarial qualification

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Static/adversarial and local-EVM tests; injection, authorization, replay, cross-tenant, stale quote, reorg, restart and device/accessible journeys. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-17 — Documentation, deployment preparation and local closeout

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Operator/user/developer manuals; deterministic packages, exact-SHA CI, release gates, security review preparation, merge only qualified candidate. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-18 — Public testnet deployment and live acceptance

**Status:** PLANNED. **Testnet required:** Yes.

Exit criteria: Bind deployed Pay/Wallet/Registry/Indexer; real receipts, runtime and recovery evidence, live web/mobile/POS flows; coordinate PAY-AUDIT-7 and -8 without duplicating authority. Retain reproducible scoped qualification at exact implementation SHA.

# Reefer Review complete audit and remediation roadmap

Audit baseline: `main` = `8614f4dbb5e05cdffd7f99c7b4929cb4f6d63d67`.

## Canonical determination

Reefer Review Publishing is service `420/service/reefer-review/v1`, a `GENESIS_FACING_MVP` replaceable application targeting `editorial_news_plus_medium_style_publishing`. Canonical dependencies are 420 Identity, 420 Rights, 420 Storage, 420 Search, 420 Notifications and 420Mail. Large article bodies are off-chain. Publishing must preserve rights/provenance. `publishing.paid_external_newsletters` is disabled at Genesis.

The frozen `config/genesis-applications.json` catalog does not contain Reefer Review. Genesis promotion requires an explicit decision update.

## Baseline finding

At the audited main SHA there was no Reefer Review source tree, contract package, API, SDK, UI, deployment executable, app-specific tests, app README, workflow or audit evidence. The repository contained only shared GEN-SVC registry/roadmap/fixture references, the disabled newsletter feature flag, and a 420Mail anti-spoofing test using Reefer Review as an example source ID.

No dedicated smart contract is required by the canonical architecture: the application is replaceable and must delegate authority-bearing rights/identity/storage functions to existing authoritative components.

## Requirement matrix

| Requirement | Canonical source | Current remediation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| service identity/scope | consumer registry | config + package constant | static verifier | README | COMPLETE | live Registry publication if adopted |
| Publication object | GEN-SVC-0 objects | model with opaque ID/timestamps/visibility/provenance | unit | README | COMPLETE | schema compatibility during live integration |
| off-chain article body | GEN-SVC-0 boundary | blob interface + digest/reference | unit | README | PARTIAL | durable encrypted 420 Storage adapter |
| Identity boundary | dependency registry | verified Wallet/Identity session-verifier boundary + active-identity claim gate | session/adversarial HTTP tests | README/RR-4 | COMPLETE AT REPOSITORY LEVEL | live deployed verifier composition |
| Rights/provenance | suite roadmap/threat model | mandatory rights assertion before publish | unit | README/security | PARTIAL | live 420 Rights + chain provenance validation |
| Search | registry | public-only projection hook | warning path unit | README/security | PARTIAL | live Search adapter/rebuild/reorg qualification |
| Notifications | registry/journey 006 | publish hook | integration-path unit | README | PARTIAL | live delivery/opt-in/dedup |
| 420Mail | registry/journey 006 | publish hook | integration-path unit | README | PARTIAL | live signed internal delivery |
| permissions | GEN-SVC-0 | Bearer-session actor derivation + scoped author/publisher/moderator capabilities | negative/adversarial/session tests | security/RR-4 | COMPLETE AT REPOSITORY LEVEL | live capability/session issuer deployment |
| moderation | GEN-SVC-0 | HIDE/RESTORE scoped actions | unit | security | PARTIAL | report/appeal/audit persistence |
| /v1 API | GEN-SVC-0 | HTTP routes, stable errors, size bounds | HTTP | README | COMPLETE | deployed ingress qualification |
| cursor pagination | GEN-SVC-0 | opaque cursor public feed | HTTP | README | COMPLETE | load qualification |
| SDK/client | GEN-SVC-0 | typed Go client boundary | compile in CI | README | COMPLETE | compatibility tests against deployed service |
| thin UI | app target | static repository UI + memory-only Wallet session gateway seam | static verifier + frontend syntax | README/RR-4 | PARTIAL | production routing/gateway deployment, E2E/a11y/mobile |
| paid external newsletters | feature flag | absent and disabled | static verifier | README | COMPLETE | keep disabled unless explicit later decision |
| dedicated contracts | on/off-chain rule | none | N/A | architecture | NOT APPLICABLE | do not create parallel rights/identity authority |
| deployment/runtime | release requirement | development executable; protected routes fail closed without verified-session composition; prod mode fails closed | compile/session tests | README/security | PARTIAL | live verifier + live adapters + public testnet |
| Genesis catalog authorization | frozen catalog | absent by design | shared validator | roadmap | BLOCKED | explicit frozen-catalog decision |
| production security/ops | threat model | repository controls only | unit/static | security | BLOCKED | rate limits, abuse ops, encryption, monitoring, recovery, load |
| independent review | release gate | none | none | self-audit only | BLOCKED | external review after freeze |

## Ordered remediation roadmap

1. **REEFER-AUDIT-1 — canonical definition and baseline inventory:** COMPLETE by this audit.
2. **REEFER-AUDIT-2 — repository publishing service baseline:** COMPLETE at repository level.
3. **REEFER-AUDIT-3 — authorization, rights and moderation security baseline:** COMPLETE at repository level, including fail-closed public item reads.
4. **REEFER-AUDIT-4 — API and typed client contract:** COMPLETE at repository level.
5. **REEFER-AUDIT-5 — thin UI and repository deployment baseline:** COMPLETE at repository level; live browser qualification remains BLOCKED on deployment.
6. **REEFER-AUDIT-6 — documentation/static qualification and durable evidence:** COMPLETE at repository level; see `REEFER-REVIEW-QUALIFICATION.md`.
7. **REEFER-AUDIT-7 — live dependency integration:** **TRANSFERRED TO `docs/ROADMAP.md` TESTNET HANDOFF.** Repository-side live-integration handoff/harness is COMPLETE and Level 1 qualified on exact implementation SHA `3be49df1727510a342ecb2535890a5d3a9f2e861`; live completion remains testnet-gated.
8. **REEFER-AUDIT-8 — deployed security/operations qualification:** **TRANSFERRED TO `docs/ROADMAP.md` TESTNET HANDOFF.**
9. **REEFER-AUDIT-9 — Genesis decision/release closeout:** **TRANSFERRED TO `docs/ROADMAP.md` TESTNET HANDOFF.**
10. **REEFER-AUDIT-10 — production closeout:** **TRANSFERRED TO `docs/ROADMAP.md` TESTNET HANDOFF.**

**Repository audit phase handoff:** all unfinished REEFER-AUDIT work now lives in the canonical testnet work roadmap. This app-specific audit roadmap has no remaining repository-side implementation task before the testnet gate.

Green repository tests are necessary but not sufficient for testnet, Genesis or production readiness.

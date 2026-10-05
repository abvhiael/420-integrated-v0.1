# 420Mail complete audit and remediation roadmap

Audit baseline: current `main` before remediation = `4840e9a3e1c89d8c6a9e241ea387166f33202697`.

## Canonical determination

420Mail is a provider-neutral `GENESIS_SHARED_INFRASTRUCTURE_AND_THIN_UI` service with target `identity_addressed_ecosystem_inbox`. Dependencies: 420Identity, 420Messenger, 420Storage and 420Notifications. Message bodies remain private/off-chain; `mail.external_smtp` is disabled.

The frozen `config/genesis-applications.json` decision does not contain 420Mail. Genesis promotion requires an explicit catalog decision.

## Baseline finding

Direct repository search for `420Mail` on the audited main baseline found shared GEN-SVC architecture/registry/fixture references only. There was no Mail source tree, dedicated tests, UI, API, SDK, deployment/readiness record, app README, audit evidence, or Mail-specific PR history.

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| service identity | consumer registry | ServiceID + profile | verifier | 420MAIL | COMPLETE | live Registry publication if adopted |
| identity-addressed inbox | suite roadmap/registry | Go send/inbox/read baseline | unit | 420MAIL | PARTIAL | wire real Identity |
| private off-chain bodies | GEN-SVC-0/threat model | private blob interface + ref/digest | unit | 420MAIL | PARTIAL | qualify encrypted Storage provider |
| Messenger policy | registry/threat model | pre-send policy interface | negative unit | 420MAIL | PARTIAL | wire live Messenger |
| Notifications | registry/journey 006 | notification sink | unit | 420MAIL | PARTIAL | wire live Notifications |
| idempotent send | API conventions | sender-scoped key + fingerprint | unit | 420MAIL | COMPLETE | distributed-store atomicity live |
| /v1 API | API conventions | HTTP handler | package tests | 420MAIL | COMPLETE | deployed ingress qualification |
| cursor pagination | API conventions | opaque cursor | unit | 420MAIL | COMPLETE | deployment load limits |
| authenticated write | threat model | injected auth + actor binding | negative unit | 420MAIL | PARTIAL | bind Wallet/Identity session |
| thin UI | registry | inbox/read/compose page | static verifier | 420MAIL | PARTIAL | browser E2E/accessibility |
| external SMTP disabled | feature flags | absent + false | verifier | 420MAIL | COMPLETE | keep disabled |
| smart contracts | on/off-chain rule | none required | n/a | 420MAIL | NOT APPLICABLE | do not invent Mail authority |
| deployment/runtime | release requirements | readiness only | none live | 420MAIL | BLOCKED | public-testnet deploy |
| Genesis catalog authorization | frozen catalog rule | absent | shared validator | roadmap | BLOCKED | explicit catalog decision |
| production security/ops | threat model | repo controls only | unit/static | limitations | BLOCKED | limits, abuse ops, encryption, monitoring, recovery, load |
| external audit | release qualification | none | none | self-audit only | BLOCKED | independent review after freeze |

## Ordered roadmap

1. **MAIL-AUDIT-1 — canonical definition and inventory:** COMPLETE.
2. **MAIL-AUDIT-2 — repository service baseline:** COMPLETE.
3. **MAIL-AUDIT-3 — repository security tests:** COMPLETE.
4. **MAIL-AUDIT-4 — API/client contract:** COMPLETE.
5. **MAIL-AUDIT-5 — thin UI:** repository baseline COMPLETE; live browser qualification remains.
6. **MAIL-AUDIT-6 — documentation/static verification:** COMPLETE once exact-head CI passes.
7. **MAIL-AUDIT-7 — live dependency integration:** BLOCKED on deployed Identity/Messenger/Storage/Notifications adapters and production-equivalent public testnet.
8. **MAIL-AUDIT-8 — deployed security/operations qualification:** BLOCKED on TLS ingress, rate limits, privacy/encryption, retention, backup/recovery, monitoring, load/soak and accessibility evidence.
9. **MAIL-AUDIT-9 — Genesis decision/release closeout:** BLOCKED until explicit frozen-catalog promotion, if intended, then exact deployed evidence.
10. **MAIL-AUDIT-10 — production closeout:** BLOCKED on independent security review, production deployment, incident/recovery evidence and final exact-artifact qualification.

Green repository tests alone are insufficient for Genesis-ready or production-ready status.

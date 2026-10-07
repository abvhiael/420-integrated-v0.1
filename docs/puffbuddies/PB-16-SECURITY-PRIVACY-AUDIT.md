# PB-16 — Security/privacy audit

## Purpose
Audit the complete repository-side PuffBuddies implementation through PB-15 against the canonical PB-0 privacy, consent, adult-eligibility, threat/trust, state-ownership, safety/moderation, data-lifecycle, visibility and non-goal invariants; remediate concrete repository findings; and produce exact-SHA security/privacy qualification evidence before closed testnet.

PB-16 is app-scoped security/privacy work. It is not the comprehensive repository-wide Level-3 closeout and does not claim live testnet or production readiness.

## Canonical audit domains
1. privacy minimization and metadata leakage;
2. wallet/profile unlinkability and public enumeration;
3. precise-location confidentiality and triangulation resistance;
4. consent/match/message/block authority;
5. adult eligibility fail-closed behavior;
6. stale-state, replay and revocation;
7. moderation evidence and least privilege;
8. deletion/retention/anti-resurrection;
9. external dependency authority limitation;
10. payment/premium non-consent;
11. client/API trust boundaries;
12. secret/session handling;
13. rate limiting/anti-automation;
14. media/input validation;
15. dangerous runtime execution primitives;
16. live deployment/config claim hygiene.

## Audit finding and remediation
### PB16-F1 — Client-controlled request correlation metadata
**Severity:** medium privacy/audit-integrity risk.

PB-14 accepted a syntactically valid client `X-Request-Id`, then reflected it and wrote it into protected audit metadata. PB-0.4 treats request IDs/log metadata as privacy-sensitive surfaces; arbitrary client-controlled correlation text could encode sensitive relationship/profile information or deliberately create audit collisions.

**Remediation:** authoritative PuffBuddies request IDs are now server-generated only. Client-supplied `X-Request-Id` is ignored for canonical audit correlation. The emitted value is a fresh `pb-` + 128-bit random hex identifier and is the only request ID passed to the application gateway, response metadata and protected audit sink.

## Requirements
- preserve all PB-0 through PB-15 authority and privacy semantics;
- close PB16-F1 without weakening PB-14 fail-closed behavior;
- retain server-generated request correlation and privacy-safe audit metadata;
- run focused PB-16 security/privacy tests;
- run complete retained PuffBuddies regressions after remediation;
- run PB-11 web and PB-12 mobile tests/builds;
- run PB-0, PB-13, PB-14 and PB-15 verifiers;
- reject dynamic execution/shell primitives in PuffBuddies runtime;
- reject committed secret material and prohibited public graph surfaces;
- reject PuffBuddies contract/address/service-ID invention;
- reject live/production/mainnet runtime claims;
- verify retained privacy, adversarial eligibility, state-machine, safety and API tests remain present;
- record residual risks and later live/environment owners explicitly.

## Qualification
**Level 1 — app-scoped PB-16 security/privacy audit qualification.**

PB-15 already completed Level-2 milestone E immediately before this audit. PB-16 changes no new shared authority owner and therefore does not create another redundant Level-2 milestone.

## Intentionally deferred Level 3
Final current-main reconciliation, canonical full Solidity inventory, Genesis address/namespace/predeploy/frozen-address/manifest authority, 420 Integrated/global, Docs/global, Geth/fault/soak and full deployment/config qualification remain deferred to complete app-phase closeout.

## Residual risks / live-environment limitations
Repository qualification cannot prove production secrets rotation, infrastructure ACLs, deployed TLS/proxy correctness, production data-at-rest encryption, live WAF/rate-limit capacity, operator IAM, backup expiry, real processor deletion, live telemetry minimization, device signing, app-store controls, or adversarial behavior of deployed dependencies. PB-17+ own live-environment qualification.

## Exit criteria
- PB16-F1 remediated;
- focused security/privacy tests pass;
- complete retained PuffBuddies regressions and clients pass;
- PB-0/PB-13/PB-14/PB-15 verifiers pass;
- static privacy/security/deployment gates pass;
- durable exact-SHA evidence recorded;
- no repository blocker remains for PB-16;
- PB-17 — Closed testnet remains next canonical step.

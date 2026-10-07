# DoobTube — security, abuse and moderation qualification

Roadmap step: **DOOBTUBE-9 — Security, abuse and moderation qualification**
Status: **ADOPTED / IMPLEMENTED**
Qualification level: **Level 1 — app-scoped security qualification**
Date: 2026-10-07

## 1. Purpose

DOOBTUBE-9 performs the application-specific threat review required by the canonical roadmap after the DOOBTUBE-8 Level 2 integration milestone.

The review distinguishes:

- DoobTube-owned attack surfaces;
- inherited 420Media security boundaries;
- canonical external-authority risks owned by Wallet/Rights/Storage/Pay/Compute;
- threats that are not applicable because V1 has no contract, custody, bridge or oracle surface;
- live infrastructure evidence intentionally deferred to DOOBTUBE-12/13.

No threat is marked resolved merely because another service exists. The exact owning boundary and retained test evidence are identified.

## 2. Security implementation

DoobTube app-owned hardening is implemented under:

- `doobtube/security/policy.py`
- `doobtube/tests/test_doobtube_security.py`

Runtime integrations:

- `doobtube/api/service.py` — actor/operation abuse limits and privacy-safe durable job errors;
- `doobtube/media/service.py` — privacy-safe persisted livestream transport errors.

Qualified upstream dependency controls are retained from:

- `media/security/session.go`;
- `media/security/moderation.go`;
- `media/security/webhook.go`;
- `media/security/policy.go`;
- `media/api/security.go`.

## 3. Protected assets

The threat model protects:

- Wallet/session actor authority;
- Smart Account execution boundary;
- Media asset/stream/controller identity;
- Rights/provenance decisions;
- Storage readiness/integrity references;
- PRIVATE/UNLISTED visibility;
- creator-update consent;
- moderation reports/decisions/appeals;
- idempotency/replay state;
- durable job/session state;
- upload/media integrity metadata;
- external transport locators;
- opaque credential references;
- operational metrics;
- logs/durable error text;
- user privacy and pseudonymity.

## 4. Adversary classes

Qualified adversaries include:

- unauthenticated public caller;
- authenticated caller with wrong capability;
- authenticated caller on wrong chain/network;
- malicious/Sybil Wallet actor;
- report spammer;
- compromised creator/controller session;
- compromised moderator attempt;
- compromised Media/processing provider;
- malicious upload author;
- external endpoint/SSRF attacker;
- callback/webhook replayer at the Media boundary;
- stale Registry/Search/Storage/Identity dependency;
- malicious or buggy browser/client;
- operator whose transport/provider credentials are compromised.

## 5. Broken access control

### DT-SEC-ACCESS-001 — Wallet/capability boundary

DoobTube-owned mutation routes require:

- non-empty Wallet context;
- exact configured chain;
- exact configured network;
- explicit operation capability.

Negative tests reject:

- anonymous rebuild;
- missing operator capability;
- wrong-chain operator.

### DT-SEC-ACCESS-002 — Media secure API

420Media protected routes require expiring sessions with exact capability.

Media cross-checks session actor/Wallet against request actor fields for:

- upload owner;
- livestream controller;
- notification user;
- signing-intent Wallet;
- report reporter;
- moderation moderator;
- appeal appellant.

### DT-SEC-ACCESS-003 — Client controls are not authority

DoobTube browser route guards/buttons are presentation only.

Server/service authorization remains required.

## 6. Privilege escalation

### DT-SEC-PRIV-001 — Capability separation

DoobTube operator rebuild/metrics capability cannot be inferred from ordinary preference capability.

### DT-SEC-PRIV-002 — Moderator separation

420Media moderator decisions require:

- `media.moderate` session capability;
- actor/moderator binding;
- qualified moderator authorizer;
- allowed moderation action.

A reporter/user cannot self-promote into moderator authority.

### DT-SEC-PRIV-003 — No shadow authority

DOOBTUBE-8 retained tests reject substitution of DoobTube into every canonical authority domain.

## 7. Signature / authorization replay

### DT-SEC-REPLAY-001 — DoobTube request replay

DoobTube mutation idempotency is scoped by:

`actor + operation + Idempotency-Key + semantic request hash`

Exact replay returns the stored result.

Changed payload under the same key returns `IDEMPOTENCY_CONFLICT`.

### DT-SEC-REPLAY-002 — Abuse limiter and safe replay

An exact idempotent replay does not consume a second actor abuse-limit slot because the abuse check is inside the first-execution effect.

A new idempotency key still consumes a new mutation allowance.

### DT-SEC-REPLAY-003 — Media API replay

420Media retriable writes use bounded Idempotency-Key replay fingerprints.

### DT-SEC-REPLAY-004 — No local signature verifier

DoobTube V1 does not accept or verify raw cryptographic signatures itself and defines no DoobTube signing domain.

The canonical Media signing-intent service owns domain/nonce/expiry construction where a signing intent is required.

## 8. Nonce / domain mistakes

### DT-SEC-DOMAIN-001 — Canonical Media signing domain

Repository Media API freezes:

`420/MEDIA/API/SIGNING/V1`

Media signing intents validate:

- domain;
- chain ID;
- network;
- Wallet;
- action;
- resource;
- payload hash;
- non-empty nonce;
- expiry;
- message.

DoobTube does not invent a second domain or nonce namespace.

### DT-SEC-DOMAIN-002 — Browser does not custody signing material

The browser connects to an injected Wallet only.

No private key, mnemonic or seed input exists.

## 9. Reentrancy / external-call risk

### Applicability decision

**On-chain reentrancy: NOT APPLICABLE to DoobTube V1.**

Reason:

- no DoobTube Solidity contract;
- no DoobTube deployment graph;
- no app-owned funds;
- no app-owned on-chain callback.

External HTTP/provider calls remain applicable and are covered separately by:

- SSRF/egress validation;
- bounded retries;
- provider verification;
- timeout/deadline semantics;
- canonical-state revalidation.

This N/A decision does not waive underlying protocol contract security; it only scopes the DoobTube application.

## 10. Accounting / custody / refund errors

### Applicability decision

**DoobTube V1 accounting/custody/refund logic: NOT APPLICABLE.**

V1 has no:

- paid subscriptions;
- PPV;
- creator payout;
- tipping;
- app escrow;
- balance ledger;
- refund ledger;
- direct Pay call.

420Pay remains Media-transitive and authoritative for any future monetary state.

Direct DoobTube Pay invocation remains denied.

## 11. Front-running / MEV

### Applicability decision

**App-specific front-running/MEV logic: NOT APPLICABLE to current V1.**

DoobTube has no contract-ordering, auction, swap, settlement or value-moving transaction algorithm.

Any future value-bearing protocol action must be qualified at its owning protocol and at the roadmap step that adopts it.

## 12. Stale oracle / bridge risk

### Applicability decision

**Oracle and Bridge risk: NOT ADOPTED / NOT APPLICABLE to V1.**

DoobTube has no Oracle or Bridge dependency.

A future adoption requires a new canonical architecture/dependency decision and qualification; it may not be silently introduced.

Stale adopted dependencies that are applicable—Registry, Media, Rights, Storage, Search, Identity/provider evidence—already fail closed under DOOBTUBE-2/4/6/8.

## 13. Content-rights abuse

### DT-SEC-RIGHTS-001 — Rights remains authoritative

Public flow requires current Rights authorization and no revocation.

### DT-SEC-RIGHTS-002 — Revoked content cannot remain public through Search

DOOBTUBE-8/9 tests reject a READY+PUBLIC projection when Rights state is revoked.

### DT-SEC-RIGHTS-003 — Moderation does not rewrite Rights

App moderation may hide/quarantine content for review but cannot manufacture, delete or rewrite canonical Rights/provenance state.

## 14. Moderation abuse

### DT-SEC-MOD-001 — Report actor binding

Report reporter must match the verified Media session actor/Wallet.

### DT-SEC-MOD-002 — Report spam limit

420Media ModerationService applies an actor-keyed report limiter.

### DT-SEC-MOD-003 — Moderator capability

Moderation decision requires scoped moderator authorization.

### DT-SEC-MOD-004 — Audit trail

Reports, decisions and appeals retain separate records.

Appeal does not overwrite prior decision history.

### DT-SEC-MOD-005 — Bounded authority

Moderation cannot:

- move funds;
- sign Wallet actions;
- rewrite Rights;
- change protocol identity;
- invoke Arbitration automatically.

420Arbitration remains NOT_ADOPTED_V1.

## 15. Spam / Sybil behavior

### DT-SEC-SYBIL-001 — Pseudonymity remains allowed

DoobTube does not falsely claim one-person-one-account guarantees.

### DT-SEC-SYBIL-002 — Abuse is bounded by actor/action

App-owned sensitive operations have bounded actor+operation windows:

- preference mutation;
- operator rebuild;
- operator metrics.

### DT-SEC-SYBIL-003 — Report abuse

Report spam is rate-limited at the Media moderation owner.

### DT-SEC-SYBIL-004 — Sybil cannot manufacture authority

Additional Wallets/accounts do not create:

- moderator capability;
- Rights authorization;
- Storage readiness;
- paid entitlement;
- Search authority;
- Smart Account execution authority.

## 16. Malicious uploads

Retained DOOBTUBE-6 protections cover:

- video-only MIME validation;
- 8 GiB maximum;
- SHA-256 form;
- mandatory scanner;
- quarantine/reject fail-closed;
- exact upload-plan binding;
- static processing profiles;
- no requester shell command;
- processing runtime/memory/CPU/PID limits;
- provider/result verification;
- DNS-aware SSRF denial;
- output readiness separation.

No DOOBTUBE-9 weakening is introduced.

## 17. Rate / resource exhaustion

### DT-SEC-RATE-001 — DoobTube mutation limiter

`AbuseGuard` applies bounded actor+operation windows.

Default repository policy:

- preference writes: 30 / 60 seconds;
- operator rebuild: 5 / 60 seconds;
- operator metrics: 120 / 60 seconds.

### DT-SEC-RATE-002 — Replay semantics

Exact idempotent replay does not consume another mutation slot.

### DT-SEC-RATE-003 — Existing resource bounds

Retained bounds include:

- backend page limit;
- cursor size;
- durable job retry count/backoff;
- media upload size;
- media processing runtime/memory/CPU/PIDs;
- livestream duration/reconnect attempts;
- Media request/response size and pagination limits.

### DT-SEC-RATE-004 — Deployment edge limits

Production edge/network rate limits remain mandatory operational evidence for DOOBTUBE-12/13.

Repository-level per-process protection does not claim distributed/global throttling.

## 18. Webhook replay

### Applicability decision

**DoobTube-owned webhook receiver: NOT PRESENT in V1.**

DoobTube therefore exposes no unsigned callback endpoint.

The inherited 420Media security package does contain a webhook verifier that requires:

- HMAC-SHA256 signature;
- key ID;
- bounded timestamp skew;
- event ID;
- replay cache.

The focused Media security dependency suite is retained in DOOBTUBE-9 qualification.

Any future DoobTube webhook receiver must adopt equivalent signed replay protection before enablement.

## 19. Operator / provider compromise

Retained protections include:

- active + verified provider requirement;
- exact provider/operator binding;
- bounded provider evidence age;
- result/job/profile binding;
- output verification;
- canonical deadline;
- canonical livestream controller revalidation;
- bounded reconnect attempts;
- Registry/authority substitution rejection;
- rebuild from canonical owning state.

A compromised provider cannot become Wallet, Rights, Storage, Pay or Compute protocol authority.

Live operator suspension/key rotation remains deployment/operator evidence for DOOBTUBE-12/13.

## 20. Secrets / logging / privacy leakage

### DT-SEC-PRIVACY-001 — No private-key custody

DoobTube accepts no private key, mnemonic or seed phrase.

### DT-SEC-PRIVACY-002 — Secret-like persistence fields

The security policy rejects secret-like field names in structures intended for application persistence/log contexts.

### DT-SEC-PRIVACY-003 — Durable error redaction

Persisted backend job and livestream transport error text is sanitized for:

- Bearer tokens;
- `secret://`, `vault://`, `keyring://` references;
- URL username/password;
- token/key/secret/password/signature query values.

### DT-SEC-PRIVACY-004 — Bounded durable errors

Redacted durable error text remains bounded to 500 characters.

### DT-SEC-PRIVACY-005 — Browser authority state

Authority-sensitive retry state is memory-only and invalidated on account/network change.

### DT-SEC-PRIVACY-006 — Visibility

PRIVATE/UNLISTED data cannot become public Search/feed state through DoobTube derived projections.

## 21. Residual deployment risks

The following remain real operational requirements but are **not unresolved repository vulnerabilities**:

- distributed edge/network rate limiting;
- live secret manager and credential rotation;
- live external media scanner behavior;
- egress firewall/network policy;
- production TLS/origin;
- production codec/container sandbox;
- operator suspension/runbook execution;
- live monitoring/alerting;
- production backup/restore;
- public-testnet abuse/load testing.

They are explicitly reserved by the canonical roadmap for DOOBTUBE-10/12/13.

They must not be interpreted as production readiness in DOOBTUBE-9.

## 22. Security acceptance matrix

| Threat | Disposition |
| --- | --- |
| broken access control | CLOSED by DoobTube + Media actor/capability checks |
| privilege escalation | CLOSED by capability/moderator/authority separation |
| authorization replay | CLOSED by durable idempotency + Media replay boundaries |
| nonce/domain mistakes | CLOSED/DELEGATED to canonical Media signing intent; no local verifier |
| reentrancy | N/A — no DoobTube contract |
| external-call risk | CLOSED at repository layer by SSRF/provider/retry/deadline controls |
| accounting/custody/refund | N/A — no V1 monetary/custody path |
| front-running/MEV | N/A — no value-ordering algorithm/contract |
| oracle/bridge staleness | N/A — dependencies not adopted |
| content-rights abuse | CLOSED by Rights/publication gate |
| moderation abuse | CLOSED by Media session/moderator/rate/audit boundaries |
| spam/Sybil | CLOSED to app authority scope; pseudonymity remains allowed |
| malicious uploads | CLOSED at repository layer by scanner/isolation/resource controls |
| rate/resource exhaustion | CLOSED at app repository layer; live distributed limits deferred |
| webhook replay | N/A for DoobTube receiver; inherited Media verifier qualified |
| operator compromise | CLOSED at repository authority boundary; live response deferred |
| secrets/logging/privacy leakage | CLOSED at app repository layer by custody prohibition/redaction/visibility controls |

No item requires an application-authority risk acceptance to complete DOOBTUBE-9.

## 23. Security invariants

- **DT-SEC-INV-001:** no public/browser control substitutes for server authority.
- **DT-SEC-INV-002:** actor/capability/chain mismatch fails closed.
- **DT-SEC-INV-003:** exact replay cannot execute a changed request.
- **DT-SEC-INV-004:** replay does not create artificial abuse-limit consumption.
- **DT-SEC-INV-005:** Sybil accounts cannot manufacture privileged authority.
- **DT-SEC-INV-006:** Rights revocation blocks public eligibility.
- **DT-SEC-INV-007:** moderation cannot rewrite Rights/funds/protocol identity.
- **DT-SEC-INV-008:** malicious media cannot bypass scanner/resource/egress gates.
- **DT-SEC-INV-009:** provider compromise cannot become canonical authority.
- **DT-SEC-INV-010:** raw secrets/private keys never enter DoobTube custody.
- **DT-SEC-INV-011:** persisted error text cannot retain recognized secret/token forms.
- **DT-SEC-INV-012:** no webhook callback is enabled without replay protection.
- **DT-SEC-INV-013:** no Pay/Oracle/Bridge/Arbitration dependency is inferred from unrelated service availability.
- **DT-SEC-INV-014:** repository security qualification does not claim live production infrastructure proof.

## 24. Exit decision

DOOBTUBE-9 is satisfied only when:

1. every original threat category is explicitly dispositioned;
2. applicable threats have executable controls/tests;
3. non-applicable threats have repository-grounded rationale;
4. DoobTube mutation abuse bounds pass;
5. replay/idempotency interaction passes;
6. privacy-safe durable error logging passes;
7. content-rights negative path passes;
8. retained Media session/moderation/webhook/security tests pass;
9. retained DoobTube adapter/backend/media/web/integration regressions remain green where directly affected;
10. the cumulative verifier passes on the exact implementation SHA;
11. roadmap/audit/security evidence record the final result;
12. no unresolved repository vulnerability remains.

**Next canonical roadmap step: DOOBTUBE-10 — Documentation, deployment and operator closeout.**

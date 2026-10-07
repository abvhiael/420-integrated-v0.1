# 420Mail MAIL-2.14 Qualification

## Step

**MAIL-2.14 — External Integrations Framework — Add provider-neutral connector architecture.**

## Completion

- Status: **COMPLETE**
- Qualification level: **Level 1 — app-scoped step qualification**
- Qualified implementation SHA: `aa299b706ff2739e9e010f1140c435af3fdd0218`
- Qualified PR merge-candidate SHA: `36c768ce3f60bfdb79295eaf53a3f1bbb54a33b5`
- Reconciliation/base `main` SHA: `d86a3810d2901dc1082b65dc9061896c46e1911d`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

The exact pull-request merge candidate above combined the implementation SHA with current `main` and is the authoritative tested state.

## Canonical purpose

MAIL-2.14 establishes a provider-neutral connector architecture for later Discord, Signal, Telegram, and other external-integration roadmap steps without prematurely implementing provider-specific behavior or moving external credential authority into 420Mail core.

## Implementation summary

Implemented repository surfaces:

- `mail/integrations.go`
  - normalized provider registry;
  - explicit connector capability declarations;
  - provider-neutral `ConnectorAdapter` interface;
  - owner-bound link/unlink lifecycle;
  - opaque cursor pull handoff;
  - idempotent push handoff;
  - transport-authenticated webhook verification handoff;
  - provider/result/isolation validation;
  - bounded payloads and identifiers.
- `mail/integrations_test.go`
  - deterministic registry ordering;
  - duplicate/invalid provider rejection;
  - link/unlink/pull/push/webhook lifecycle;
  - capability enforcement before adapter invocation;
  - cross-provider/cross-identity/custodial result rejection;
  - malformed/oversized request rejection;
  - dependency fail-closed behavior.
- `mail/integrations_http_test.go`
  - provider discovery and owner lifecycle routes;
  - authenticated user-operation boundary;
  - raw secret-field rejection;
  - public webhook transport boundary;
  - unsupported-capability rejection.
- `mail/http.go`
  - authenticated provider/link/unlink/pull/push routes;
  - public provider webhook route;
  - transport-header capture;
  - connector-specific error mapping.
- `mail/client/client.go`
  - typed provider discovery, link/unlink, pull and push client methods.
- `mail/web/index.html`
  - provider-neutral discovery/link shell using deployment-provided connector authorization adapters.
- `config/420mail-service-v1.json`
  - explicit provider-neutral architecture, capability, credential, webhook, isolation and privacy policy.
- `docs/420MAIL.md`
  - connector architecture, authority boundaries and intentionally deferred provider-specific scope.
- `scripts/verify-420mail-audit.py`
  - retained MAIL-2.14 configuration/source/API/client/UI qualification.

## Original requirement: provider-neutral connector architecture — SATISFIED

### Provider registry

Connectors register:

- normalized provider ID;
- display name;
- explicit declared capabilities.

Core recognizes only generic capability classes:

- `LINK`
- `PULL`
- `PUSH`
- `WEBHOOK`
- `WALLET_VERIFY`

Duplicate providers, malformed provider IDs, duplicate capabilities and unknown capabilities are rejected.

No Discord/Signal/Telegram provider behavior is hard-coded into Mail core.

### Account-linking boundary

Owner operations require the authenticated Mail identity.

Link input is limited to:

- provider;
- opaque secure-broker authorization reference;
- optional account hint.

Strict HTTP decoding rejects unsupported raw secret fields such as access tokens, refresh tokens and client secrets.

Returned connections must:

- match the requested provider;
- belong to the authenticated Mail identity;
- have connection/external IDs;
- be active;
- be explicitly non-custodial;
- include link/update timestamps.

Mail core does not add provider credentials to its durable mailbox store.

### Pull boundary

Pull requests bind provider, connection ID and opaque cursor.

Returned provider/connection identity must match the request. Returned items require external ID, kind, timestamp and bounded payload.

### Push boundary

Push requests bind provider, connection ID, kind, bounded payload and explicit idempotency key.

Accepted results must match provider/connection and return external ID, acceptance timestamp and `accepted=true`.

### Webhook boundary

The public webhook transport endpoint exists because external provider servers do not possess Mail user sessions.

This is not an authorization bypass:

- provider selection comes from the URL route;
- raw payload is bounded;
- verification metadata comes from actual HTTP transport headers;
- the connector adapter owns provider-specific signature/timestamp/replay verification;
- accepted results must be `verified=true` and bind provider, Mail identity and connection ID.

Mail core does not deserialize provider payloads into a provider-specific authentication schema.

### Provider isolation

Qualification verifies that:

- unsupported capabilities never reach adapters;
- a connector cannot return another provider and be accepted;
- a connector cannot link another Mail identity;
- custodial/invalid link results fail closed;
- malformed/oversized requests fail before provider action;
- adapter dependency failure has no generic impersonation/fallback path;
- connector credential state is not promoted into Mail authority.

## Level 1 qualification

Workflow: **420Mail Audit Qualification**

- Run: **37497394655** (#222)
- Job: **112385344705**
- Exact tested merge candidate: `36c768ce3f60bfdb79295eaf53a3f1bbb54a33b5`
- Branch implementation parent: `aa299b706ff2739e9e010f1140c435af3fdd0218`
- Base/current `main` parent: `d86a3810d2901dc1082b65dc9061896c46e1911d`

Results:

- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- Static verifier explicitly reported: `MAIL-2.14 external integrations framework: qualified by app-scoped checks`

## Superseded qualification attempt

Run **37497275716** / job **112384933536** failed only at Go format before tests executed. CI identified formatting drift in the newly added connector/client test files. The exact formatter output was applied. That candidate is superseded and is not completion evidence.

## Milestone relationship

MAIL-2.14 closes the documented **Wallet-native identity milestone (MAIL-2.11 through MAIL-2.14)**.

The same exact qualification run is also the retained **Level 2 app-integration qualification** for that milestone because the repository has one canonical 420Mail workflow and it executes the full accumulated Mail suite on the exact merge candidate:

- `go test ./mail/...`;
- `go test -race ./mail/...`;
- `go vet ./mail/...`;
- cumulative static verifier for MAIL-2.1 through MAIL-2.14.

The final verifier output explicitly reconfirmed MAIL-2.1 through MAIL-2.14 on the same exact candidate. A duplicate ceremonial run would add no coverage and was intentionally not manufactured.

Milestone durable evidence: `docs/audit/420MAIL-WALLET-NATIVE-IDENTITY-MILESTONE-QUALIFICATION.md`.

## Intentionally deferred Level 3

Level 3 remains deferred to app-phase closeout.

No canonical full repository Solidity inventory, duplicate Genesis Foundry inventory, 420 Integrated Qualification, Geth qualification, global fault/soak suite or unrelated app audit was deliberately run for MAIL-2.14.

## Live/deployment limitations

Repository completion does not claim:

- live Discord OAuth/linking;
- live Signal integration;
- live Telegram integration;
- production provider secrets/credential broker;
- production webhook signature/replay qualification;
- provider-specific rate limiting/retries;
- provider-specific message schemas;
- public-testnet connector operation.

These remain later roadmap or live testnet/security/operations gates.

## Evidence inheritance

This file, the milestone evidence file and the companion roadmap status update are evidence/documentation-only changes. They change no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements and therefore inherit qualification from the exact implementation SHA above without recursive requalification.

## Next canonical step

**MAIL-2.15 — Discord Account Linking**

# 420Mail MAIL-2.25 Qualification

## Step

**MAIL-2.25 — 420Mail → Telegram Delivery**

## Completion

- Status: **COMPLETE**
- Qualification level: **Level 1 — app-scoped step qualification**
- Qualified implementation SHA: `1868ae2a56d9a53c0695e5379b84627f7fcdb02b`
- Exact qualified PR merge-candidate SHA: `723d073547a3272f41b00c2656da8bd671dcce88`
- Current `main` / base SHA: `721a7f358e802bce91835851721eb93c4340f501`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

## Canonical requirement satisfied

MAIL-2.25 adds authenticated **420Mail → Telegram outbound delivery** using the provider-neutral connector `PUSH` capability.

It preserves MAIL-2.23 Telegram account linking and MAIL-2.24 Telegram inbound sync while leaving webhook ingestion and Telegram wallet verification disabled.

## Implementation summary

Implemented/updated repository surfaces:

- `mail/telegram_delivery.go`
  - `TelegramDeliveryKind`
  - `TelegramDeliveryMessage`
  - `TelegramDeliveryReceipt`
  - `TelegramDeliveryAuthority`
  - `TelegramDeliveryRequest`
  - `TelegramDeliveryResult`
  - `TelegramDeliveryService`
  - bounded outbound content
  - optional reply target
  - mandatory idempotency
  - strict receipt validation
- `mail/telegram_link.go`
  - advertises `PUSH` only when authority implements `TelegramDeliveryAuthority`
  - validates connection, idempotency and payload before authority execution
  - validates provider message/chat/timestamp receipt
- `mail/telegram_delivery_test.go`
  - capability advertisement
  - linked-connection binding
  - idempotency propagation
  - reply target propagation
  - malformed request rejection before authority
  - invalid provider receipt rejection
  - authority-failure propagation
  - proof non-delivery authorities cannot push
  - authenticated HTTP delivery
  - unauthenticated rejection
  - secret-bearing request rejection
- `mail/http.go`
  - authenticated `POST /v1/connectors/telegram/deliver`
  - `TelegramDeliveryService` handler dependency
- `mail/client/client.go`
  - typed `DeliverTelegram`
- `mail/web/index.html`
  - capability-gated **Send to Telegram** action
- `config/420mail-service-v1.json`
  - explicit Telegram delivery authority, destination, idempotency, receipt and credential/privacy policy
- `docs/420MAIL.md`
  - Telegram delivery authority, API, capability and failure boundaries
- `scripts/verify-420mail-audit.py`
  - retained MAIL-2.25 config/source/API/client/UI/capability checks

## Exit criteria / invariants individually verified

### Linked Telegram identity boundary

Delivery requires:
- authenticated 420Mail actor;
- canonical `telegram:{user-id}` connection ID.

The Telegram user ID is derived from that connection ID before the authority is called.

### Conditional connector capability

Telegram advertises `PUSH` only when the configured authority implements `TelegramDeliveryAuthority`.

Authorities that provide only link/sync support cannot push.

### Delivery request validation

A valid request requires:
- valid Telegram connection ID;
- valid signed-decimal Telegram chat ID;
- non-empty content;
- content no larger than 4096 bytes;
- optional positive-decimal reply message ID;
- non-empty bounded idempotency key.

Malformed requests fail before external authority execution.

### Idempotency

The caller-supplied idempotency key is mandatory and is passed unchanged to the external Telegram delivery authority.

No success is fabricated locally.

### Provider receipt validation

A successful provider receipt must include:
- positive-decimal Telegram message ID;
- exact requested chat ID;
- non-zero accepted timestamp.

Malformed, contradictory or incomplete receipts fail closed with `ErrTelegramInvalidResult`.

### Credential boundary

The strict HTTP request does not accept raw:
- Telegram bot token;
- access token;
- refresh token;
- client secret;
- phone-number credential;
- verification code;
- provider/device signing material.

Secret-bearing unknown fields are rejected before authority execution.

### Existing Telegram capabilities preserved

MAIL-2.25 preserves:
- `LINK` from MAIL-2.23;
- `PULL` from MAIL-2.24;
- durable inbound cursor semantics;
- external Telegram authority ownership.

Still disabled:
- webhook ingestion;
- Telegram wallet verification.

### API/client/UI

Qualified surfaces:
- `POST /v1/connectors/telegram/deliver`;
- typed `DeliverTelegram`;
- thin UI **Send to Telegram** action only when Telegram descriptor advertises `PUSH`.

The deployment shell supplies delivery input; it does not supply provider credentials to Mail.

### Failure semantics

External Telegram authority failure:
- is returned to the caller;
- does not fabricate an accepted delivery;
- does not mutate canonical Mail state.

## Level 1 qualification

Workflow: **420Mail Audit Qualification**

- Run: **37519924596** (#370)
- Job: **112462409109**
- Qualified implementation SHA: `1868ae2a56d9a53c0695e5379b84627f7fcdb02b`
- Exact tested merge candidate: `723d073547a3272f41b00c2656da8bd671dcce88`
- Current-main parent: `721a7f358e802bce91835851721eb93c4340f501`

Exact checkout evidence:
`HEAD is now at 723d073 Merge 1868ae2a56d9a53c0695e5379b84627f7fcdb02b into 721a7f358e802bce91835851721eb93c4340f501`

Results:
- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- verifier explicitly reported:
  `MAIL-2.25 420Mail to Telegram delivery: qualified by app-scoped checks`

## Superseded attempts / diagnosed failures

### Run 37519611123 / job 112461346381

- Exact head — PASS
- Go format — FAIL
- tests/race/vet/verifier skipped
- diagnosis: formatting-only differences in `mail/http.go` and `mail/telegram_delivery_test.go`
- action: exact formatter diff applied

### Run 37519715046 / job 112461701936

- Exact head — PASS
- Go format — PASS
- Go test — PASS
- Go race — PASS
- Go vet — PASS
- static verifier — FAIL
- diagnosis: stale cumulative verifier guard from MAIL-2.23 still forbade `ConnectorCapabilityPush`, which MAIL-2.25 legitimately introduces
- action: narrowed the legacy guard to continue forbidding only webhook and wallet-verification capabilities

Neither superseded run is completion evidence.

## Main reconciliation status

At MAIL-2.25 qualification:
- current `main`: `721a7f358e802bce91835851721eb93c4340f501`
- branch compare status: ahead
- branch behind count: 0
- PR mergeable: true

No additional main reconciliation commit was required during MAIL-2.25.

## Milestone status

MAIL-2.25 is an ordinary step inside the documented **External bridge milestone (MAIL-2.15 through MAIL-2.29)**.

- Level 2: **NOT RUN / NOT DUE**
- prior Mailbox Foundation and Wallet-native identity Level 2 evidence remains valid
- External bridge Level 2 remains deferred to MAIL-2.29 unless a material shared-dependency reason requires it earlier

## Intentionally deferred Level 3

Level 3 remains reserved for complete app-phase closeout.

No deliberate full repository Solidity inventory, duplicate Genesis full Foundry inventory, 420 Integrated/global qualification, Geth/global fault/soak suite, unrelated app audit, or broad repository closeout was run for this ordinary step.

Automatically triggered unrelated workflows are not claimed as MAIL-2.25 evidence.

## Live/deployment limitations

Repository completion does not claim:
- live Telegram credentials/provider availability;
- production Telegram delivery authority implementation;
- production chat authorization/routing behavior;
- live Telegram message delivery;
- production provider rate-limit/retry behavior;
- public-testnet Telegram delivery qualification.

Those remain later roadmap/live testnet/security/operations gates.

## Evidence inheritance

This evidence file and companion roadmap/PR bookkeeping are documentation/evidence-only and inherit qualification from the exact implementation SHA above without recursive requalification.

## Next canonical step

**MAIL-2.26 — Unified Integrations Inbox**

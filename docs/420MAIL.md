# 420Mail

420Mail is the provider-neutral, identity-addressed ecosystem inbox defined by the GEN-SVC consumer-service architecture.

## Canonical status

The authoritative frozen Genesis application catalog is `config/genesis-applications.json`. 420Mail is **not** currently a frozen Genesis application in that file. It is a `GENESIS_SHARED_INFRASTRUCTURE_AND_THIN_UI` implementation target in `config/genesis-consumer-services.json`. Promotion into the frozen catalog requires a separate explicit decision.

Service ID: `420/service/mail/v1`. Authority: `REPLACEABLE_COMMUNICATION_SERVICE`.

420Mail has no canonical smart contract and no independent settlement, wallet, identity, rights, governance, registry, bridge, validator, treasury, or custody authority.

## Purpose and boundaries

Provide a private ecosystem inbox addressed by 420Identity references. Genesis scope is internal ecosystem delivery only. External SMTP is explicitly disabled by `mail.external_smtp=false`.

- 420Identity resolves sender/recipient identity references.
- 420Messenger supplies message eligibility/block policy.
- 420Storage supplies private off-chain body storage.
- 420Notifications receives optional non-authoritative delivery signals.
- Mail metadata is application state, not consensus.
- Message bodies remain off-chain and are excluded from public indexing.
- Wallet private keys are never handled by 420Mail.
- Retriable send uses a sender-scoped idempotency key; conflicting reuse fails closed.
- Visibility is `PRIVATE`.

## API and client

Stable prefix: `/v1`.

- `POST /v1/messages`
- `GET /v1/inbox?cursor=&limit=`
- `GET /v1/messages/{id}`
- `POST /v1/messages/{id}/read`

The HTTP handler requires an injected authentication function and does not trust a user-supplied sender header as identity proof. `mail/client` is the typed Go client.

## Thin UI

`mail/web/index.html` provides inbox, read and compose surfaces. It assumes the deployment shell establishes the authenticated 420Identity. This is repository UI evidence, not deployment evidence.

## Security

Applicable shared threats include SPAM, SYBIL, MESSAGING_ABUSE, INDEX_POISONING and WEBHOOK_REPLAY where adapters use callbacks. Repository controls include actor/sender binding, identity resolution, Messenger policy checks before persistence, private body references, input bounds, idempotency conflict detection, recipient-only read acknowledgement, no public list/search route, injected authentication and bounded pagination.

Deployment still requires rate limits, abuse/report operations, attachment policy/scanning if attachments are added, encrypted private storage, secret handling, observability, backup/recovery, retention policy, provider failure behavior and live privacy testing.

## Build and test

```bash
go test ./mail/...
go vet ./mail/...
python3 scripts/verify-420mail-audit.py
```

No Solidity build is required because the canonical service has no Mail-owned contracts.

## Deployment order

1. establish authenticated Wallet/420Identity session;
2. configure qualified Identity resolution;
3. configure qualified Messenger policy;
4. configure private 420Storage-compatible body provider;
5. configure Notifications adapter;
6. deploy API/UI behind TLS, request-size limits and rate limits;
7. run live privacy, idempotency, provider-failure, recovery, load and accessibility tests;
8. record URL/runtime hashes and adapter versions;
9. only consider Genesis closeout after an explicit frozen-catalog decision.

## Current limitations

The repository baseline does not prove deployed Identity, Messenger, Storage or Notifications integration; provider encryption/key custody; public-testnet operation; production observability; SMTP; attachments; spam operations; or disaster recovery. Those remain release gates.

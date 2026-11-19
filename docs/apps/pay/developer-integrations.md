# 420 Pay developer integrations

The v1 API exposes `GET /v1/invoices/{invoiceId}` with a Bearer credential scoped
to one merchant and `invoices:read`. A response contains the finalized invoice
amount in base units, currency, status, credited amount and checkout links when
the invoice is open. Private invoice metadata stays outside the response. The API
rechecks the configured controller and merchant status against Registry state.
All payment approval and signing take place in 420 Wallet.

Use `createPayDeveloperClient(apiOrigin, serverToken)` on the merchant server.
For browser presentation, expose only the returned checkout URLs. The hosted URL
opens the canonical invoice. The embedded URL can be used as an iframe source with
a descriptive title and sandbox permissions
`allow-scripts allow-popups allow-popups-to-escape-sandbox`. Its link opens
hosted checkout in a top-level tab. It does not expose a Wallet session to the
merchant page. Apply `Content-Security-Policy: frame-ancestors 'none'` to the
hosted dashboard response. Serve the embed separately with the approved parent
origins as its `frame-ancestors` policy.

## Service configuration

Build the shared SDK, then run `node pay/developer/server.mjs path/to/config.json`
with Node.js 22.13 or newer. Terminate TLS in front of the loopback listener.
Set `rpcUrl`, the approved Pay `deployment`, the persistent SQLite `database`
path and optional `port`. Use a directory accessible only to the service
account and keep its database and WAL on the same persistent volume.

Each entry in `credentials` supplies `merchantId`, `controller`,
`expiresAt` in milliseconds since epoch, `scopes`, and the lowercase SHA-256
hex digest in `tokenHash`. Credentials use `pay_` followed by 32 random
bytes in lowercase hex. Use a separate credential and `ingestTokenHash` for
the Indexer connector. Replace or remove credential entries and restart to
revoke them. Expose the Indexer ingress through a private operator route.
The API does not create invoices or accept transaction requests.

Configure approved webhook `endpoints` with a unique `id`, `merchantId`,
HTTPS `url` and a unique 32-byte lowercase hex `secret`. Restrict service
egress to the approved RPC and webhook destinations. Merchant API credentials
cannot set destinations. Configure the existing Indexer replay consumer to call
`forwardPayIndexerEvent` before advancing its cursor. The ingress independently
verifies the canonical receipt, Payment Registry runtime and invoice binding.

## Receiver contract

Verify the `pay-signature` header over the exact bytes delivered. It is
`v1=` followed by hex HMAC-SHA-256 over
`pay-timestamp + "." + pay-delivery-id + "." + rawBody` using the decoded
endpoint secret. Reject timestamps more than 300 seconds from receiver time.
Persist the delivery ID atomically with the receiver-side operation before
returning a 2xx acknowledgment. Retries keep the delivery ID and use a fresh
authentication timestamp.

`payment.changed` contains a canonical observation and the event's raw Pay
lifecycle status. It does not change the payment's acceptance policy.
`payment.retracted` refers to the same event ID if its block is replaced before
finality. A replacement block has different event IDs. Treat webhook messages as
notifications and re-read canonical state for settlement decisions. The outbox
preserves retry state across process restarts.

# Pay security and accessibility qualification

The hosted dashboard clears rendered payment review and request artifacts on
Wallet invalidation. The browser regression checks that an invalidated
session has neither payment history nor a retained QR, link, or download URL.
The merchant API reads bind the requested invoice ID to the authorized
tenant and check credential expiry again before returning a response.
The local-EVM checkout test verifies that a quote issued for one payer cannot
authorize a second payer and that rejection does not consume either nonce.

Use the native checkout and consumer dashboard workflows for exact-revision
qualification. Their scoped tests cover stale quotes, replay, delivery rollback,
cross-tenant API access, request input validation, webhook reorg and restart,
and Chromium accessibility checks at desktop and narrow mobile widths.

Retained qualification for unchanged consumers and device code is available
from [PAY-APP-15](https://github.com/abvhiael/420-integrated-v0.1/pull/1219)
at `ff5f60b86f7a062ac22500d949dc2c06aa3ed223`, including
[Indexer](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44472881986),
[Android](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44472882052)
and [iOS](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44472881844).
Live device handoff still depends on signed platform associations and Wallet
approval transport.

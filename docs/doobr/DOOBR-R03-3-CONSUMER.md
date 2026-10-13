# DOOBR R03.3 — Consumer account, Wallet consent where allowed, order state and receipts

Canonical R03.3 (app Level 1); development in PR #601, `roadmap/doobr-bc-vancouver-infrastructure`. Initial main at this step `6d2932deb243328e1956619e10ef250a8bcc1d88`. R03.2 passed SHA `ba5cab4f6005108b7ef2279a2df31c67ce9ca53c`.

The server consumer view in `doobr/consumer_view.py` requires an independently signed 420Identity token with correct audience, nonrevoked issuer/session, per-order CONSUMER grant and owner match, exact tenant scoping and read-only database transaction. It returns only order identifier, state, revision, explicit receipt NOT_VERIFIED and whether already-authorized Wallet consent remains unexpired. Wallet consent does not mean age or payment authorization; no receipt is invented from order state. Errors deny by default without leaking other tenant/order data.

The site account section and `web/doobr/consumer.mjs` disclose sign-in/order/receipt unavailable until actual canonical 420Identity, 420Wallet, retailer and 420Pay integrations have been accepted. Browser-supplied fake user/wallet/order/receipt input cannot authorize anything. No public user credentials, address, receipt or shopping experience is collected. Production account creation, authenticated session provisioning, actual signed Wallet consent, independent verified retailer and payment receipt adapters and browser UI for private order history remain outstanding operational/client requirements; **the static site does not claim these are live.** The isolated server view is not a deployed authenticated HTTP API. No regulated transaction pathway is opened.

Focused qualification is `.github/workflows/doobr-r03-3-level1.yml`: compile, authorization denial tests, wallet/revocation cases, cross-owner denial, forged browser state refusal, retained R03.1/R03.2 shell/coverage and exact-SHA. **STATUS PENDING successful exact-SHA run; no claimed production acceptance.**

Client Level 2 at R03.12. Final repo-wide Level 3 at R05.10, including current main reconciliation once. Next canonical R03.4 Courier enrollment, credential status and availability.

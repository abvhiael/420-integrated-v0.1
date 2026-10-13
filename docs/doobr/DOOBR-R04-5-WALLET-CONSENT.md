# DOOBr R04.5 — Wallet consent/session revocation and replay prevention

Canonical R04.5 in `docs/doobr/DOOBR-R01-R06-ROADMAP.md`. PR #601, branch `roadmap/doobr-bc-vancouver-infrastructure`. Main SHA at inspection `bc0faa5dafecda3de0620a9581f9953b89cd95fb`; 349 ahead/1110 behind.

`doobr/wallet_consent.py` adds a fail-closed, **non-custodial, non-transactional** Wallet authorization adapter. It first reauthorizes independently verified current Identity session, role/resource grant and wallet-consent validity with the R02.2 boundary. It then requires an independently verified canonical Wallet-signed consent binding audience, tenant, actor, token, scoped action, resource, consent ID, nonce, valid interval and nonrevoked state. It separately checks current canonical withdrawal, then consumes the nonce via an injected **durable atomic unique** ledger; duplicate, unknown or unavailable returns deny, before downstream effects. There is no DOOBr local wallet signer, age inference, wallet balance authorization, payment, escrow or permission broadening.

Implementation does not itself provide cryptographic Wallet signature verification, a deployed nonce datastore or an authenticated Wallet revocation endpoint: these **must be supplied by canonical services** and verified during integration/testnet acceptance; missing trust must not enable a live route. Nonce consumption and downstream command execution require transactionally coherent command handoff for exactly-once effects; a nonce ledger insert alone is not evidence a regulated order was executed. Any live signed consent must be bounded in scope and time and never reused as global credentials.

`doobr/storage/tests/test_wallet_consent.py` tests authorized consumption, repeat replay, expired/future consent, actor/tenant/resource/action/token scoping, issuer/session revocation and ledger outage. `.github/workflows/doobr-r04-5-level1.yml` runs R04.5 tests, retained R02.2 identity, R03.9 replay regressions and R04.1 reuse guard with exact SHA checking.

**Implementation SHA:** `a1362b9b8e1b1b2cfbcd35b7c6d279eb69237b0c`. Level 1 exact-SHA pass **pending inspection**, not certified. R04.11 retained app Level 2 and R05.10 comprehensive Level 3 are reserved; live Wallet/Identity issuer, nonce database, browser wallet device integrations and regulatory acceptance remain deferred under established testnet roadmap.

**Next canonical step:** R04.6 Identity, Verify, Registry provenance with expiry/revocation handling.

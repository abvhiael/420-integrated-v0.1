# 420BnB Runtime Slice — implementation and testnet gating

**Phase:** BNB-1.10 executable remediation, **PARTIAL / NOT LEVEL 3 QUALIFIED**. This service is a secure development scaffold, not a production-ready or transaction-enabled Airbnb substitute.

## Implemented and source-controlled

- `api.py`: FastAPI public published-listing reads, verified-identity-gated host property **draft** creation, guest inventory holds with PostgreSQL row-level property locking, idempotency digest/key enforcement, capacity checks, expiring holds, outbox event, private hold reads, health/readiness; payments endpoint **503 PAYMENT_UNAVAILABLE**. No booking can be confirmed by client input.
- `migrations/001_initial.sql`: PostgreSQL property, availability blocks, holds, reservations, audit, outbox and dedupe tables.
- `web/bnb/index.html`: accessible public discovery and host onboarding preview; host form deliberately disabled until authentication and publication controls are ready; no payment buttons.
- `tests/test_api.py` and `tests/test_postgres_adversarial.py`: untrusted identity, payment-disabled, idempotency collision, capacity lock and concurrent booking hold tests.
- `Dockerfile`, `compose.local.yml`: non-root application container, loopback-only local API and disposable local PostgreSQL topology; NOT a production deployment.
- `.github/workflows/bnb-runtime.yml`: per-commit PostgreSQL 16 migration, Python compile and HTTP/adversarial tests, exact PR SHA. This **does not** exercise live Identity, Pay or deployed applications.

## Authentication and trust boundary

BNB API rejects all host/guest mutations until `BNB_IDENTITY_ASSERTION_SECRET` is independently configured with at least 32 characters; signed assertions bind `bnb-v1`, subject, role and timestamp (maximum 30-second skew). **Only a trusted ingress that has separately authenticated user Identity claims may produce signatures.** It MUST strip incoming `X-Authenticated-*` headers from clients, authenticate the source, keep the secret inaccessible to browsers and rotate keys. This does not itself implement a certified Identity verifier, replay cache, full property controller/Verify check or service-to-service mTLS. Do **not** enable a public service directly with the signature secret and forgeable headers.

## Local verification

```bash
python -m pip install -r services/420bnb/requirements.txt
# Use a disposable PostgreSQL 16 database, never production.
export BNB_DATABASE_URL="postgresql://bnb:...@127.0.0.1:5432/bnb"
python -c "import pathlib,psycopg,os; c=psycopg.connect(os.environ['BNB_DATABASE_URL']); c.execute(pathlib.Path('services/420bnb/migrations/001_initial.sql').read_text()); c.commit()"
pytest -q services/420bnb/tests
```

Local Compose launch needs dedicated `BNB_LOCAL_DB_PASSWORD` and `BNB_IDENTITY_ASSERTION_SECRET`; do not expose to the Internet. No real identity assertion signer or client login is bundled.

## Remaining non-negotiable blockers

1. Implement and qualify real end-user login with Identity/Verify claims and property control authorization; signed proxy adapter must not trust an unverified source.
2. Implement property verification, revision publication, manager delegation, calendar edits, quote locking, host decisions, booking lifecycle, cancellation policies, one-booking-per-confirmed-hold financial reconciliation and accessible guest/host end-to-end browsers.
3. Integrate canonical 420Pay verified payment proof, governed invoices/refunds/settlement/payouts and approved Pay-bound 420Swap, with network, Registry, code hash, chain, finality and reorg proofs. Application must not take custody or treat API/webhook state as finality.
4. Expand PostgreSQL and multi-instance adversarial tests for max overlap intervals, blocked dates, DST, stale version, ABA/simultaneous cancellation, privacy IDOR, cross-tenant reads, forged webhooks, poison queue, rollback, restore and economic invariants.
5. Deliver independently authorized live testnet deployment, signed artifacts, migrations, real provider bindings, TLS, access controls, alerts, disaster restoration, user acceptance and actual **deployment evidence**. Static preview + ephemeral CI PostgreSQL does not satisfy deployed acceptance.
6. Only then reconcile PR to current `main`, establish one exact merge candidate, and complete **Level 3**: Solidity full inventory owned once by Solidity Contracts, Genesis Address Authority without duplicate Foundry, 420 Integrated, Docs, app/client/indexer/search/rpc, security and deployment qualification.

**Do not merge PR #600 or claim BNB-1.10 closed.** Keep `travel.bnb_booking=false` and Travel Genesis compatibility transaction methods fail closed until separately approved and accepted.

# 420Exchange PRE-11 operations runbook

Status: **PRE-TESTNET ONLY**. This runbook does not authorize a live gate, live signing key, live bridge proof, production payout or deployment.

## 1. Operating baseline

The canonical machine-readable readiness record is:

- `exchange/pretestnet-readiness.json`
- mirrored at `contracts/config/exchange/pretestnet-readiness-v1.json`

Every listed LIVE GATE must remain `DISABLED_PRETESTNET` until its separately scoped live/testnet qualification and deployment evidence exist.

The browser, quote service, order service and read service must fail closed when required live deployment dependencies are absent.

## 2. Quote signer rotation

1. Publish the new PRE-05 producer/key version and public-key fingerprint through the approved runtime policy path.
2. Keep the previous key active only for the bounded overlap allowed by `maxKeyOverlapSeconds`.
3. Inject the new private signing key externally. Never commit it to repository files, runtime config, logs, fixtures or CI variables exposed to PRs.
4. Verify a quote from the new producer/version against the exact deployment ID, manifest hash, account, chain, endpoint and transaction fingerprint.
5. Revoke or expire the old key through the PRE-05 policy after the overlap.
6. Confirm an old mathematically valid signature fails after revocation/expiry.
7. If rotation fails, stop issuing executable quotes. Do not widen client trust or restore an old key outside its policy window.

## 3. Quote/order/read service outage

- Browser read-only rendering may degrade according to its existing read-state rules.
- Executable quote, order publication, withdrawal/cancellation and bridge flows fail closed if their required backend is unavailable.
- Do not convert cached or fixture data into executable authority.
- `/ready` failures are non-ready service state, not permission to bypass dependency checks.
- Restore the service from the same qualified source SHA/config, then rerun readiness and contract checks before routing traffic back.

## 4. 420Indexer backfill

1. Put affected projection-dependent functions into degraded/read-only posture where necessary.
2. Record the canonical indexed head and the expected backfill range.
3. Backfill from canonical chain data through the normal 420Indexer path.
4. Preserve stable record IDs and mark orphaned records inactive; do not delete provenance.
5. Verify reorg replacement links, finality and freshness.
6. Reconcile Exchange V13 history against the backfilled Indexer output.
7. Keep projection records `authoritative:false`; they do not become settlement, quote, bridge-proof or cancellation authority.
8. Restore readiness only after lag/staleness is cleared.

## 5. Emergency pause

Use the narrowest existing gate. A PRE-11 incident does not create new governance or custody authority.

For a suspected execution-path compromise:

- keep `swapSubmission` OFF;
- keep `orderSigning` / `orderPublication` OFF;
- keep `orderWithdrawal` / `orderCancellation` OFF if order authority is suspect;
- keep `bridgeSubmission` / `bridgeProofAcceptance` OFF if bridge proof or route identity is suspect.

Do not enable an unrelated gate to work around an outage.

Preserve signed quotes, reviewed intents, transaction fingerprints, order hashes, bridge manifest fingerprints, proof IDs, Indexer record IDs and service request IDs required for reconciliation.

## 6. Rollback

Rollback is source-SHA and configuration specific.

1. Stop traffic to the affected release.
2. Preserve logs after redaction and retain package/build manifests.
3. Select the last exact qualified Exchange source SHA.
4. Rebuild from clean checkout with the same deterministic packaging procedure.
5. Verify browser build metadata and PRE-11 package hashes.
6. Verify the machine-readable LIVE GATES remain OFF.
7. Restart services with qualified deployment dependencies.
8. Run health/readiness, backend contract tests and browser smoke/acceptance tests before restoring traffic.

Never rollback by copying an unknown local `dist` directory or mutable service state without provenance.

## 7. Reconciliation after incident or rollback

Reconcile independently:

- browser build source SHA and runtime deployment binding;
- PRE-05 quote producer/key/deployment/fingerprint evidence;
- PRE-07/PRE-08 order status and settlement state;
- PRE-09 bridge source/proof/destination lifecycle;
- PRE-10 Indexer canonicality/finality/freshness/replacement records.

Treat disagreements as conflicts requiring investigation. Never choose the most favorable value or let Indexer projections override canonical execution/settlement authority.

## 8. Credentials, origins and logs

Backend browser-facing requests use an explicit exact HTTPS origin allowlist.

The pre-testnet HTTP services do not accept ambient browser credentials:

- `Authorization`
- cookies
- proxy authorization
- `X-API-Key`

No `Access-Control-Allow-Credentials: true` response is emitted.

Quote-service structured logs redact credential/token/secret/private-key/mnemonic/signature fields and truncate oversized hostile strings.

## 9. Release evidence

Before PRE-11 can close, retain exact-head results for:

- 420Exchange Web Verification;
- Solidity Contracts, because the Exchange contract-facing readiness config is part of this release record;
- 420Docs Qualification;
- 420 Integrated Qualification.

PRE-12 remains responsible for current-main reconciliation and the final complete app-phase merge-candidate qualification.

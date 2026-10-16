# BNB-5.6 — Search/Travel consumer transport contracts: qualification gate review

Status: **OPEN — NOT QUALIFIED**. This is a repository evidence/gap review, not a Level 1 certificate. Canonical roadmap definition remains unchanged: *Authenticated versioned transport and acknowledgments against repository-controlled consumers; authority revalidation, privacy, expiry/retraction; no unapproved real publication.*

## Verified starting point

Phase 5 PR #644 remains draft, open, unmerged on `audit/bnb-phase5-bnb-5-1-baseline-20261014`; BNB-5.5 certificate and its underlying qualified implementation remain authoritative. At review start HEAD `96e6df23a1681a593a9c4fed5b16dd5709b1a87b`, main observed `eeaa4e593e8f5f16e2bc566b20ddbe04576589c1`, phase base `3f2cf64897e96c4f16213bcaf93564db72a174c9`. Verify fresh refs before any implementation writes.

## Existing qualified ingredients (not complete 5.6 transport)

- `api.py`: RS256-scoped internal discovery read, resync creation and resync-page APIs; actor/consumer/scope checks.
- `discovery_feed.py` and `discovery_sync.py`: ordered journal, bounded epoch/high-watermark paging, authorized snapshots and current-authority minimized tombstones.
- `consumer_delivery.py`: durable independent per-consumer subscriptions, leased claims, fenced receipts, replay and dead-letter controls.
- `worker.py`: supervised bounded consumer delivery with `LocalValidationSink`. The executable explicitly refuses any network worker sink other than `local-validation`; this is a safety gate, **not** Search/Travel receipt acceptance.
- `outbox.py`: allowlisted, redacted event envelope, bounded retry, idempotency expectations. The existing local worker result must never be described as real Search/Travel publication.

## Unmet exit criteria

1. **Repository-controlled Search and Travel consumer endpoints/clients:** no verified active versioned consumer ingress with independently approved identity, signed delivery scopes and trust boundaries. Define fixed per-consumer audience/issuer/service identity, protocol version, TLS verification, timeout and response limits; reject redirects and untrusted destinations.
2. **Durable end-to-end consumer acknowledgment:** bind each accepted receipt to immutable event ID, consumer identity, envelope digest/revision, epoch and consumer-side durable transaction; reject forged, replay-conflicting, wrong-consumer, stale-lease and revoked-grant receipts. A send or HTTP 2xx without durable acceptance is not a receipt.
3. **Current-authority and expiry/retraction:** prove publication eligibility at delivery/admission, not only during historical feed reading. Expiry, property withdrawal, compliance/location/Identity changes must produce end-to-end retractions without stale resurrection on retries or older revisions.
4. **Privacy:** enforce field allowlist at both transport producer and repository-controlled consumer, no private address or guest/host/payment/message content, sanitized logs and bounded wire payload.
5. **Failure/recovery qualification:** actual isolated verified-TLS PostgreSQL/HTTP fixtures for independent Search and Travel consumers; duplicate, reordered, tampered, delayed, timeout-after-accept, consumer crash/restart, lease race, revoked authorization, stale epoch and resync recovery tests.
6. **Production safety:** real publication and independent issuer activation remain OFF. No unapproved external endpoints, consumer registrations, credentials, notifications, funds or booking authority.

## Required next engineering/qualification actions

Implement the missing transport and receipts on this existing branch, with repository-owned fake Search/Travel consumers and explicit versioned schemas. Wire the supervised worker to an independently enabled *CI-only* transport fixture without relaxing its production fail-closed configuration. Add affected tests and any needed append-only schema upgrades and infrastructure checks. Run the canonical `420BnB Runtime Slice` app Level 1 workflow against the new exact implementation SHA and inspect required jobs/logs. Commit a certificate only on verified PASS. No evidence-only commit can substitute for these unimplemented steps.

Level 2: BNB-5.7 and BNB-5.13, not due yet. Level 3: BNB-5.14, not due yet. Preserve all external acceptance gates and disabled flags. **Do not advance to BNB-5.7 until this canonical step is genuinely qualified.**

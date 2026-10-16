# BNB-6.9 — Security and abuse readiness

Canonical scope: revocation, least privilege, issuer outage/compromise, replay, rate limits, cross-account/privacy, abuse and dependency exhaustion.

## Security implementation and evidence
- Signed authority rejects malformed, non-finite, boolean and impossible timestamps; rejects invalid subjects and replay identifiers. Issuer outage denies authorization instead of anonymous fallback.
- Retained identity session revocations, compliance/Travel revocations, scoped operator approvals and database nonce dedupe remain owned by the full BnB app-specific regression suite.
- `tests/test_bnb69_authority.py` tests malformed claims, issuer outage, subject scope, privilege crossing and invalid purpose.
- Operator response: on suspected issuer compromise revoke sessions and suspend dependent promotion; on replay preserve bounded non-secret audit and deny; on exhaustion block publication and escalate; on privacy breach preserve redacted incident evidence.

**External acceptance gate:** multi-replica gateway request limits, live revocation propagation, issuer compromise drills, real load/exhaustion tests and authenticated alert delivery require independent testnet/production infrastructure evidence. They are not proven merely by these local regressions. Record them on `docs/bnb/BNB-TESTNET-WORK-ROADMAP.md` before any live release. Booking, Pay execution and Travel booking stay disabled.

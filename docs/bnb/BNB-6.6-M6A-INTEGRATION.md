# BNB-6.6 — M6-A Level 2 integration milestone

The canonical BNB-6.6 exit criteria are one exact implementation SHA covering deployment/configuration (BNB-6.2/6.3), forward-only migrations and recovery (BNB-6.4), and seven external-provider boundaries (BNB-6.5), with failure injection, restart/recovery and security regression coverage.

## Retained inventory
- `tests/test_bnb66_m6a.py` explicitly combines versioned topology, provider contract, activation denials, repeated startup/restart assessment, unsafe provider/DB fault injection, unapproved restore/replay refusal and separate PostgreSQL reconnect/ledger/compatibility tests.
- The canonical `.github/workflows/bnb-runtime.yml` runs all `services/420bnb/tests` with PostgreSQL 16, verified-TLS fixture, migration and concurrent-worker tests, operational backup/restore, packaged nonroot worker fail-closed startup, production configuration, API/security/browser and deployment/infrastructure smoke, against an exact Git SHA.
- The nine BNB-1.1–1.9 guardrails are supplementary app-specific regression evidence. The Oracle audit is supplemental; full Solidity, Genesis, Integrated and Docs are not Level 2 owners.
- No synthetic external provider approval or production readiness is asserted. Production issuer, managed database, independent consumers, payment settlement, real TLS and human acceptance are still gated by `docs/bnb/BNB-TESTNET-WORK-ROADMAP.md`.
- The Phase 6 branch is not reconciled with current main for Level 3 yet, by explicit roadmap requirement. Leave PR #667 draft/unmerged.

**Certificate may be issued only after actual exact-SHA retained CI success is verified.**

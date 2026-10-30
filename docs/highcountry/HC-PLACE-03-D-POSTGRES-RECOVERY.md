# HC-PLACE-03 Package 3 — PostgreSQL concurrency and recovery

This bounded implementation reconstructs occupancy from durable placement instances, verifies qualified geometry revisions, parent/child support chains, exclusive attachment slots, scene revisions, placement receipt shapes and exact-unit custody. Recovery is read-only and requires a registered principal. The browser remains unauthorized.

A lost PostgreSQL COMMIT acknowledgement is an unknown outcome, not a proven rollback. Placement transactions read the original operation's durable receipt under a fresh serialized transaction and require an exact payload match. Missing or conflicting receipts fail closed; no automatic second mutation or custody issue is attempted.

The existing PostgreSQL 16 HC-PLACE-03-B5 Level 2 suite now includes restart reconstruction, malformed persisted geometry rejection, uncertain-commit receipt reconciliation and multi-worker same-operation races. Existing tests and authority/custody boundaries are retained. Final exact-SHA test results must be recorded separately.

Historical runs 40825485722 (03-P1), 40955559181 (03-C), 40955559238 (03-A) and 40955559444 (03-B5) remain evidence at their original SHAs. Real production PostgreSQL disaster recovery, external signer feeds and finality remain testnet/release gates. Package 3 is not a claim of full HC-PLACE-03 phase closure.

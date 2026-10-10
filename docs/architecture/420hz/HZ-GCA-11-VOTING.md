# HZ-GCA-11 — Eligibility, nominations and voting

Status: IMPLEMENTED in repository-local coordinator; exact-SHA Level 1 qualification pending.

Canonical source: `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`; frozen policy: `hz/config/gca-nomination-voting-policy-v1.json`.

The `AwardVoting420` coordinator in `hz/generate/src/award-voting.js` enforces explicit policy schema, window gates, visible published targets, AI category constraints when configured, nominator caps/self-nomination modes, optional explicitly qualified public support, stable nomination idempotency, frozen deduplicated ballots, wallet/account versus verified identity versus jury voter eligibility, ballot-scoped replay protection, abstention, quorum, tie policy, deterministic result commitments and immutable domain result references.

An external authority adapter is mandatory. Production requires trustworthy Wallet authentication and Creative canonical source resolution, privacy-preserving identity eligibility/nullifiers for unique-human mode, rate limits and durable transactional storage. A caller-supplied boolean or Wallet address by itself is **not** production authorization. The fixed `admin` subject in the repository-local adapter is test-only and must never be exposed on production transport without verified authorized capability enforcement. No deployed vote, public election, legal identity credential, rights movement, Civic governance action, financial prize, Search or on-chain settlement is claimed.

Voting auditability is local only; this is not a production independent election verifier. Failure handling must fail closed when eligibility source or freshness is unavailable. Public unique-human claims are prohibited without qualified Identity proof.

Level 1: retained `hz/generate npm run qualify`, HZ-GCA-1.12 and HZ-GCA-1.13 verifiers via `.github/workflows/420hz-gca-11.yml`. Full Level 3 deferred.

Next canonical: HZ-GCA-12 (confirm full name from roadmap before beginning).

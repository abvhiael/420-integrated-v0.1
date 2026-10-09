# HZ-GCA-10 — Awards domain model

Status: IMPLEMENTED; Level 1 pending exact-SHA verification.

Canonical domain objects: AwardProgram, AwardSeason, AwardCategory, EligibilityPolicy, AwardNomination, AwardBallot, AwardVote, AwardResult and AwardBadge.

Implementation `hz/generate/src/awards.js` is a deterministic repository-local state machine, not a production persistent Awards service or deployed on-chain contract. Category keys are versioned per season rather than restricted to an immutable global list, allowing the 10 initial suggested categories and later additions. Frozen policy commitments, ordered season windows, immutable ID allocation, ballot candidate commitments, independent product-domain votes, finalized results and historical badges preserve frozen HZ-GCA-1.12 authority semantics. No Creative, Identity, Wallet, Governance, Pay or Charts privileges are derived from Awards.

The `authority(actor,action)` callback must be a trusted authorization boundary. This local model does not manufacture Wallet signatures, canonical Creative eligibility or qualified vote proofs. The HZ-GCA-11 implementation must enforce exact eligibility, dedupe, Sybil-resistance, quorum, tie math and voter proofs before any public real-world vote/finalization pathway is deployed. Until then, the model must remain local/non-public and never present externally submitted votes or results as legitimately qualified.

Level 1: `npm run qualify` in `hz/generate`; frozen Awards architecture and nomination/voting boundary verifiers. No Level 2 or Level 3 broad tests at this ordinary step.

Next canonical: **HZ-GCA-11 — Eligibility, nominations and voting**.

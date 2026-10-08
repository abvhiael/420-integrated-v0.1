# S-05 — Canonical record binding and cross-provider deduplication

**Status: OFFLINE LEVEL 1 CANDIDATE — live authoritative bindings deferred to testnet.**

S-05 consumes separately verified external work-unit/identity evidence and *reads* the canonical CMP-5.7 trusted attester mapping and CMP-5.6 consumed state using injected contract readers. No off-chain SHA-256 digest replaces Solidity keccak256 `abi.encode` contract commitments. `sourceBinding`, `resultCommitment`, `evidenceBinding`, `canonicalWorkCommitment` and `attestationId` MUST originate in existing CMP-5.1/5.2, CMP-5.5 and CMP-5.7 contract authorities. The consumer fails closed on absent/revoked/expired/untrusted mappings, chain mismatch or unavailable claim state. Changes to credits, names, observations or presentation wrappers cannot create additional canonical work from identical authoritative identity. It is display/audit planning only: no contract writes, authorized claim consumption, economic rewards, escrow or eligibility occur.

**Not complete for real-world dedup:** distinct off-chain sources claiming the same computation are equal only where governed CMP-5.7 canonical mapping establishes equivalence. The current ledger is process-memory and lacks persistent/reorg rebuild, source correction ledger or real deployed contracts; no live attester identities or source receipts have been qualified. Actual CMP-5.6 authorized consumer one-time consumption, replay, reorg and rollback drills remain testnet-gated. Claim uniqueness stays owned by CMP-5.6, not this module. Do not assert global cross-provider duplicate protection or fund payout.

Level 2 is reserved at S-06; Level 3 at full phase closeout.

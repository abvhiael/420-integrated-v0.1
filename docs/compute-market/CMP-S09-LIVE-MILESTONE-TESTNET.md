# S-09 — Live end-to-end two-provider milestone: deployment execution checklist

**Status: BLOCKED pending real funded testnet, approved Folding@home and BOINC project source evidence, verified participant identities and governance. No synthetic receipt may close S-09.**

The S-09 testnet evidence validator (`compute/ingestion/src/milestone.mjs`) requires both distinct providers, signed/independently accepted work, real source proof reference, participant control evidence, finalized canonical attestation, authorized one-time guard consumption, CMP-6 reward accounting, actual funded canonical Vault settlement and 420Wallet/Indexer/420Compute readback for each. It requires independent operator and reviewer signoff and the exact deployed release SHA.

**Before an attempted Level 2 closeout:**
1. Complete S-01–S-04 operational approvals, DNS-pinned ingestion, genuine work-unit validation, cryptographic Wallet linking and durable identity registry.
2. Complete S-05/S-06 durable 420Indexer source/attestation/claim event ingestion and actual `/v1/compute/external-science` endpoint, with canonical rollback/backfill.
3. Resolve S-07 policy governance approval, external third-party reward disposition, approved budget and funded testnet Vault proofs.
4. Complete S-08 narrow authorized external-to-CMP-6 accounting path as needed; deploy canonical contract manifest; onboard governed attester and claim consumer; record funding, accounting and beneficiary transfer transaction hashes/finality.
5. Run one Folding@home and one independent named BOINC project accepted-work flow, record provider authority, identity and actual receipt evidence; no private datasets or passkeys in evidence.
6. Perform wrong-user, duplicate work, stale rescoring, source outage, settlement failure, rollback/reorg, malicious attester and funding exhaustion drills, with PASS/FAIL and recovery artifacts.
7. Run the retained Level 2 app suite on the exact release SHA and collect real chain/provider receipts, signer/governance identities, Wallet and Indexer readback plus independent reviewer/operator signoff.

The gate is offline **structural evidence validation**, not a substitute for independently checking submitted signatures, RPC receipts, on-chain finality or operator identities. A user-authored manifest cannot independently establish truth: all evidence refs must be authenticated and independently reviewed. Fail closed if even one provider cannot supply approved work-unit evidence.

**S-09 exit is NOT satisfied by this repository implementation.** The required real two-provider funded testnet milestone is deferred until the network is running. The following canonical step is S-10 — Operational soak, CMP-9 and CMP-10 handoff; it also requires live testnet evidence.

# 420Bridge — Testnet Work Roadmap

## BRIDGE-AUDIT-3.V.7 — Solana (SOL and SPL assets)

**Status: DEFERRED TO TESTNET / FINAL QUALIFICATION OPEN.** User authorization: 2026-11-14. Priority: High. This records unfinished requirements of the existing audit step; it does not add a new audit phase or change its acceptance criteria. Implementation is integrated through [PR #1161](https://github.com/abvhiael/420-integrated-v0.1/pull/1161). Routes remain inactive pending genuine qualification.

### Retained repository qualification

Implementation SHA: `6de0a1a34cdb33156caeca32d2847f1dfe214995`. Original Solidity/SBF evidence source: `dba26122ba09e242a9a222f257abb82ecaeea9d6`; SDK security repair and six-test normal/optimized evidence: `6de0a1a34cdb33156caeca32d2847f1dfe214995`. Retain 53 unique Solidity test passes including 2,500 fuzz cases, six SBF execution passes, six SDK tests in both execution modes, and signature/decoding evidence for 1,053 genuine historical transactions. CI run IDs: none; evidence is in [solana-qualification](solana-qualification/RESULTS.json) and its original logs/checksums. Detailed requirement mapping and trust assumptions: [Solana audit](BRIDGE-AUDIT-3-V-7-SOLANA.md).

### Remaining original requirements

- [ ] Establish an independently authenticated epoch validator/stake snapshot, with eligible effective stake and authorized vote-account voters from the same authenticated bank. Reconcile canonical Solana mainnet genesis, epoch and slot, root, snapshot hash and total stake. The checked-in 699-account RPC observation is untrusted and cannot establish this authority.
- [ ] Obtain genuine authorized validator certificates for the implementation's bridge-specific finality/execution digest, exceeding two-thirds effective stake under the authenticated epoch root. Qualify finalized slot/bank and committed transaction execution, canonical cluster identity and historical evidence. Public native consensus votes or Alpenglow certificates are not signatures over this oracle's domain and cannot be substituted.
- [ ] Deploy and authenticate the approved source gateway and deployed executable code hash for the claimed bank. Bind gateway program, vault/PDA, selected direct/CPI instruction, destination chain/router/route, source owner, native SOL or canonical RAY/EURC mint and units, amount and nonce to genuine committed deposit evidence.
- [ ] Complete historical end-to-end qualification for SOL and configured SPL routes using those authenticated dependencies, genuine signatures and committed-execution evidence. Retain source transaction/signature, slot/bank/epoch, certificate and membership proofs, deployed program/code and route/mint identities, destination receipts and replay identity. Existing historical transactions are genuine but do not call the new gateway and do not satisfy this requirement.
- [ ] Qualify live rejection of unsupported RPC-only finality/execution assertions, unknown or disabled epochs, invalid/insufficient/duplicate signatures, conflicting banks, failed or rolled-back CPI effects, wrong cluster/program/code/mint/route and replay attempts against the deployed release. Preserve passing repository negative evidence; rerun only qualifications affected by actual deployment or implementation changes.

### Closure

Record the exact repository/deployment lineage and actual proof/receipt evidence against every original requirement in the Solana audit table. Keep controlled certificates explicitly test-only. Running the 420 testnet alone does not provide source-Solana validator authority, historical certificates or a deployed approved gateway. No production trust root or route activation is authorized by this deferral. Full BRIDGE-AUDIT-3.V.7 qualification stays open until genuine finality, execution and historical transfer evidence passes. Next numbered audit step BRIDGE-AUDIT-3.V.8 is unchanged and has not begun.

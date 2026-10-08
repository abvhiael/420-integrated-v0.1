# S-08 — Funded entitlement and Wallet settlement integration — qualification evidence

**Status:** PARTIAL — offline Level 1 PASS; canonical actual funded testnet payout and deployment gates remain BLOCKED/DEFERRED TO TESTNET.

- Exact qualified implementation SHA: `eef073be5d9eb66fc9fb8f5c69fbc5291b3b5b3d`.
- Branch `cmp-s08-funded-settlement-20261008`; PR #581 stacked on S-07 PR #580 through S-01 PR #574. No merge.
- Main reconciliation reference at start: `ffc6a4028676907c266714b5c1ae8ba3af9a7137`. S-07 evidence parent: `05854d097e9b57e7b64ea796cdc485d9692086ba`.
- Files: `compute/ingestion/src/settlement.mjs`, `compute/ingestion/test/settlement.test.mjs`, `compute/ingestion/package.json`, `docs/compute-market/CMP-S08-FUNDED-SETTLEMENT.md`, `.github/workflows/cmp-s08-settlement.yml`.
- [CMP S-08 Settlement Evidence run 37846634873](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37846634873) — SUCCESS at exact SHA; job `113549022260` SUCCESS. Node 22 syntax and targeted S-08 tests plus retained S-02–S-07 ingestion regressions via `npm run qualify`.
- Validated synthetic sequence: source-verification, CMP-5.7 attestation, CMP-5.6 guard consumption, CMP-6 native reward accounting, separate canonical Vault funding, finalized beneficiary receipt and exact credited amount; all are read-only inputs requiring real chain provenance before any operational acceptance.
- Negative tests: governance or treasury approval missing, wrong-chain receipts, missing finality, recipient mismatch, unfunded reward, revoked provider, unauthorized claim consumer, duplicate transaction reuse. Payout planner refuses to initiate money movement, including for approved fixture flags.
- No Solidity/Genesis/Vault/Wallet/browser signing authority, claim consumption or funding behavior was modified. Source pollers and indexers remain non-monetary; no live actual native-$420 reward entitlement or settlement was created.
- **Full S-08 exit NOT SATISFIED**: require actual approved projects/source truth and consent, economic governance decision, exact deployed CMP-5/6 authority and addresses, funded testnet Treasury/Vault, verified external contribution-to-CMP-6 canonical integration, authorized guard consumer, genuine transfer/receipt, accounting conservation and payout replay/revocation/expiry/exhaustion drills, Wallet/Indexer reconciliation.
- Level 2: S-09 live two-provider payout milestone; Level 3: accumulated phase closeout, with canonical Foundry owned solely by Solidity and independent Genesis verification.
- Next canonical roadmap step (repository planning only): **S-09 — Live end-to-end two-provider milestone**. Do not claim S-08 COMPLETE before live funded payout evidence.

This evidence-only closeout inherits the qualified implementation SHA without recursive substantive rerun.

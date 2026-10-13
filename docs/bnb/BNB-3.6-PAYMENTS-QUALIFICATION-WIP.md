# BNB-3.6 — Payments and refunds, qualification work in progress

Status: **PARTIAL — not certified; Level 1 CI and M3-A Level 2 milestone outstanding**.

Canonical scope is the approved BNB-3.6 row of `BNB-PHASE3-ROADMAP.md`: Pay-owned invoice, quote, Wallet consent, finality, recovery, refund and payout; original-payer/beneficiary authority, immutable splits, replay fences and conservation; adversarial late receipts, invoice duplicates, concurrency, under-delivery, reorg/recovery and provider outages.

Latest implementation candidate: `c0ca9556503cf8c297f532d1404a358eb045bff1`. Audit PR #620, branch `audit/bnb-phase3-infrastructure-20261012`, draft/open/unmerged; observed PR base `fa3ebf8bf70df341a91ad2efa701827ca2bea7e7`.

Implemented in this increment:
- Hardened `services/420bnb/api.py`: replay of an existing canonical Pay intent now verifies every immutable invoice/quote, merchant/controller, chain/asset/amount, expiry and Swap route field, rather than only invoice ID. A mutated economic intent fails 409. Existing finality and custody boundaries remain fail-closed.
- Added `services/420bnb/tests/test_bnb36_pay_authority.py`: missing Pay proof, false Pay authority, missing registry version, modified signed payload hash are denied before DB mutation.
- Added adversarial regression in `services/420bnb/tests/test_postgres_adversarial.py` for an existing invoice replayed with a changed asset amount. Previous retained synthetic Pay tests cover independent signer, route provenance, quote mismatch, duplicate receipt, late-finality recovery, immutable split and payout/refund conservation.

Qualification pending: BNB Runtime Slice [run 38328214271](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38328214271) on exact candidate; at evidence-authoring time run is queued/pending and has no jobs. Nine retained BNB-1.1 to BNB-1.9 workflows succeeded on candidate. These do not replace the runtime gate. Global Docs was skipped as expected and is NOT PASS.

**Still required before complete**: runtime/security exact-SHA success; reconcile Wallet user consent integration, Pay-specific finality rollback/reorg and provider-outage recovery behavior, explicit end-to-end refund/payout original-payer and beneficiary evidence; perform milestone Level 2 M3-A retained app integration against the final source SHA and record all results. Never infer external signoff from fixture tests.

**External gates remain blocked/deferred**: `T-BNB-QUOTE-1`, `T-BNB-BOOKING-1`, `T-BNB-PAY-2`, `T-BNB-SETTLEMENT-3`. No independently authorized 420Pay/Wallet real fund movement, merchant controller, governance authority, actual chain receipts, real issuer/settlement signer, official testnet reorgs or operator/security witnesses are established. `travel.bnb_booking=false` and booking/financial release remain disabled.

The next canonical roadmap step, once BNB-3.6 and M3-A are qualified, is **BNB-3.7 — Guest experience**. Level 3 phase closeout remains BNB-3.12, with Solidity and Genesis separate nonduplicative owners.

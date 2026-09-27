# CMP-1.2.10 — Phase reconciliation and release closeout

Status: **COMPLETE WITHIN REPOSITORY QUALIFICATION SCOPE; CMP-1.2 LIVE/PRODUCTION RELEASE REMAINS BLOCKED BY LIVE DEPLOYMENT AND CMP-1.5 STAKE-SLASH PREREQUISITES.**

This step is the final reconciliation gate for the original CMP-1.2 ComputeEscrow deliverable. It reconciles the implementation history, current `main`, the original roadmap requirements, repository qualification evidence and the remaining operational/cross-phase gates. It does not convert an unavailable live network or an unimplemented stake-slashing source into synthetic evidence.

## Current-main reconciliation

The CMP branch was reconciled with the latest `main` after the Explorer EXP-0 merge:

- reconciled `main`: `b03e247aa4df0a6a6d978ffad8eedfe2487a3a6b`;
- reconciliation commit: `ee5e97bd9cc322e0794e2c57a4523035370788be`;
- post-reconciliation comparison: branch ahead of `main`, **behind by 0 commits**.

The reconciliation used GitHub's clean merge result for the current PR and preserved both histories. No frozen system-address assignment was replaced by the CMP branch.

## Reconciled step ledger

| Step | Final repository disposition |
| --- | --- |
| CMP-1.2.0 | Design baseline complete. Historical “implementation open” wording is now explicitly superseded by later executable qualification. |
| CMP-1.2.1 | Complete within repository scope: signed-payer Vault funding, dedicated CMP Vault fence, payer isolation, lifecycle integrity. |
| CMP-1.2.2 | Complete within repository scope: accepted-price reservation, max-spend and funded-credit enforcement. |
| CMP-1.2.3 | Complete within repository scope: unique verified provider entitlement. |
| CMP-1.2.4 | Complete within repository scope: provider liability split, claimability and actual Vault payout. |
| CMP-1.2.5 | Complete within repository scope: cancellation, expiry, failure and original-payer refunds. |
| CMP-1.2.6 | Complete within repository scope: dispute hold, independent adjudication and contested-liability resolution. |
| CMP-1.2.7 | Complete within repository scope: solvency, reentrancy, privilege and hostile-accounting hardening. |
| CMP-1.2.8 | Complete within repository scope: integrated real-contract fixed-price native-$420 E2E success/refund/dispute transcripts. |
| CMP-1.2.9 | Repository deployment package complete; live testnet qualification blocked because the canonical public/authorized testnet is not live. |
| CMP-1.2.10 | **Complete within repository scope.** Latest-main reconciliation and retained exact-head qualification are green; live/release blockers remain separately recorded. |

## Original ComputeEscrow requirement reconciliation

The authoritative roadmap names:

- `deposit`
- `reserve`
- `release`
- `refund`
- `partial release`
- `timeout refund`
- `dispute freeze`
- `slash redistribution`

Repository-level disposition:

- **deposit** — qualified through signed-payer native-$420 funding into the dedicated registered Vault path;
- **reserve** — qualified through payer-specific safety obligations and accepted-price reservation;
- **release** — qualified through verified entitlement and provider claim release;
- **refund** — qualified through original-payer terminal refund paths;
- **partial release** — qualified through provider earning plus independent payer residual obligation/refund;
- **timeout refund** — qualified through bounded terminal expiry/failure/refund paths in the fixed-price single-assignment model;
- **dispute freeze** — qualified through held provider liability, bounded independent adjudication and fail-closed resolution;
- **slash redistribution** — **not implemented as payer-escrow redistribution and intentionally remains fail-closed**. The 1.2.0 frozen design requires any slash redistribution to originate only from separately backed and objectively forfeited CMP-1.5 stake/collateral. CMP-1.5 stake, slash adjudication and recipient-split qualification must close before this requirement can become operational. Payer deposits must never substitute for stake.

This is an explicit cross-phase dependency, not an omitted escrow test.

## Live deployment blocker

CMP-1.2.9 remains a real release gate. Repository authority currently states:

- `public_testnet_live = false`;
- real public endpoints are not configured.

Therefore the closeout still lacks canonical live evidence for:

- deployed CMP component addresses and deployment receipts;
- runtime code hashes;
- actual capability grant inventory;
- registered/ACTIVE dedicated CMP Vault topology;
- sealed policy bindings;
- deployed router graph hash;
- authorized ProtocolRegistry publication;
- real native-$420 funding, provider payout and payer refund transactions.

The canonical live verifier remains:

`python3 scripts/verify-cmp-1-2-9-deployment.py`

It must pass in default/live mode before live CMP-1.2 release can be claimed.

## Machine-readable closeout

The closeout authority is:

- `contracts/config/compute-market/cmp-1.2.10-phase-closeout.json`
- `scripts/verify-cmp-1-2-10-closeout.py`

The verifier is designed to pass only when the repository closeout is internally consistent and the unresolved blocker set remains exactly:

1. `CMP-1.2.9-LIVE`
2. `CMP-1.5-STAKE-SLASH`

If the public testnet becomes live, the verifier deliberately fails until CMP-1.2.9 is rerun and its evidence is updated.

## Release disposition

**CMP-1.2.10 repository reconciliation step: COMPLETE within repository qualification scope.**

**CMP-1.2 overall repository escrow implementation: qualified for the current fixed-price, single-assignment native-$420 scope, excluding the separately gated stake-slash path.**

**CMP-1.2 live/production release: BLOCKED.**

Do not claim production readiness, live Registry publication, live funded settlement, operational stake slashing or full release until both the CMP-1.2.9 live gate and the CMP-1.5 stake/slash prerequisite are satisfied.

## Exact-head CI evidence

The reconciled implementation/evidence head `b2b3ee9fb1322b09669325f84eafd6689e6d866e` completed the retained qualification suite successfully before this final evidence-recording commit:

- Solidity Contracts run `36342887946` — **success**; all **16/16 PR shards** successful.
- Genesis Address Authority run `36342888001` — **success**; cross-manifest authority plus all **16/16 full Foundry inventory shards** successful.
- 420 Integrated Qualification run `36342888290` — **success**; `offline-core`, `production-dependencies`, `geth-engine`, and `fault-matrix` all successful.
- 420Docs Qualification run `36342888026` — **success**.
- 420Indexer run `36342888155` — **success**.

The Indexer regression initially exposed a retained Explorer EXP-0.4 verifier that incorrectly applied its audit-only delta whitelist to unrelated feature PRs. The verifier was corrected so the whitelist remains strict on the canonical Explorer audit branch while unrelated branches execute the retained state/regression checks without misclassifying their own product files as Explorer audit drift. The corrected exact head above passed 420Indexer.

Because this closeout record itself changes the branch head, the resulting evidence-recording head must receive one final exact-head retained qualification cycle before merge. No live/production claim is authorized by that final CI pass.

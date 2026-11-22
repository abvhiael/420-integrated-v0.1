# GOV-PRE-01 — Canonical policy and 42M Genesis supply reconciliation

**Scope status: QUALIFIED CANDIDATE ACCOUNTING; NOT A SIGNED OR FUNDED NETWORK GENESIS.**

- Authoritative repository: `abvhiael/420-integrated-v0.1`
- Candidate implementation SHA: `a8790f9ffb234ced3735e89efeecc79bea413792`
- Dedicated exact-head workflow: [GOV-PRE-01 #44971227517](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44971227517) — **SUCCESS**, one job, all steps passed
- Independent unchanged founder vesting check at earlier implementation SHA: [Three-founder Genesis vesting #44971035941](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44971035941) — **SUCCESS**. A subsequent exact-head run is not assumed until verified.
- Source PR: [#1316](https://github.com/abvhiael/420-integrated-v0.1/pull/1316), draft, **unmerged**

## Canonical accounting

The working `config/genesis-allocations.json` contains 13 unique *additive* entries totaling exactly **42,000,000 $420** (42,000,000 × 10¹⁸ kief).

| Entry group | Native $420 |
| --- | ---: |
| Three founders, liquid and vested | 1,000,000 |
| Validator bootstrap reserve | 3,000,000 |
| Attention bootstrap | 4,200,000 |
| Development bootstrap | 4,200,000 |
| Community validator-credit reserve | 6,300,000 |
| Community/testnet reward reserve | 2,100,000 |
| Three public-distribution tranches | 12,600,000 |
| ProtocolReserve at immutable `0x0424` | 8,600,000 |
| **Additive total** | **42,000,000** |

Existing `ProtocolReserve` is the **explicit** funding-source allocation for two *non-additive* purpose earmarks: Operations 4,200,000, Contingency 840,000, leaving 3,560,000 unearmarked. These are NOT separately minted Genesis entries, NOT funded Treasury Vault balances and NOT grants of ProtocolReserve custody. No validator-credit, Community Reward, Development, Attention, public or founder allocation was reduced.

The 8.4M community/testnet umbrella is 6.3M validator credit + 2.1M Community Reward, not a second treasury credit. Actual available 21K matched-bond capacity is at most 300 from the 6.3M credit reserve; full 42K sponsorship uses the same reserve, at most 150 full bonds before collateral recycling and slashing. The historical 400 figure assumes that the 2.1M reward allocation were reallocated, which is not authorized.

The three founder grants total 1M, distributed 500K administrator / 250K Andrew / 250K Janet, half direct to verified personal wallets and half to 0x0427 for thirteen 14-day releases. Exactly three payees are enforced. The separate 50/25/25 development compensation stream remains unchanged.

## Qualification performed

On the candidate SHA listed above, the dedicated workflow successfully executed:

1. Python compilation of the strict verifier, adversarial test harness and two downstream founder/Genesis gates.
2. Full candidate supply and frozen-destination reconciliation (`PASS_CANDIDATE_ONLY`, 42M supply, 13 entries, zero additional issuance).
3. **15 independent adversarial mutations**, all rejected: counterfeit/duplicate Genesis rows, reserve overstatement, double-spend, redirected system destination, wrong denomination, altered Treasury source, false Vault funding, fourth founder and historical V3 tampering.
4. `verify-founder-vesting-three.py` and `verify-founding-genesis-integration.py` default structure gates, both successful.
5. Native `go test ./genesis/cmd/420-genesis -count=1 -v`, verifying candidate and unchanged historical V3 plus counterfeit-issuance, duplicate-entry, forged-V4 and earmark negatives.
6. Native `go run ./genesis/cmd/420-genesis -allocations config/genesis-allocations.json -ai-genesis config/ai-genesis.json`, reporting **42,000,000,000,000,000,000,000,000 kief** and valid native-AI Genesis surface.
7. Explicit negative release-mode test: `verify-founder-vesting-three.py --require-release` rejects pending founder addresses/signatures and the stale `FROZEN_V3` commitment.

No unrelated protected Level 3 suite was manually dispatched. Historic `testnet/genesis`, RC bundles, frozen `contracts/config/system-addresses.json`, issuance parameters and committed V3 assets were **not modified**.

## Boundaries retained

The source-of-funds earmarks are arithmetic policy only. Actual Founding Operations and Contingency Vault funding requires Governance-approved transfers and on-chain accounting; `allThreeFunded=false` and `supplyReconciled=false` remain fail-closed deployment conditions. The three personal founder addresses are still unknown. V4 configuration signature, consensus reward backing, production deployment, and post-Genesis governance bootstrap remain separate workstreams. The old V3 network bundle must not be treated as the new candidate.

**GOV-PRE-01 exit criterion: SATISFIED FOR CANONICAL POLICY / CANDIDATE SUPPLY CONSERVATION, NOT LIVE GENESIS RELEASE.** Next separate pre-testnet workstream: **GOV-PRE-02 — founder wallet enrollment and claims**. This record does not initiate it.

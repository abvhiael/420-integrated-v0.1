# 420Bet 5D.6 — Pre-testnet production hardening and operational controls

**Status:** Pre-testnet code and deterministic qualification are independent from live-chain, legal and provider acceptance. A PR merge does **not** authorize wagering.

## Contract-enforced settlement safety

`SportsFundedTickets420.bindOracle(market, gate)` is restricted by the vault's market-scoped `BET_SPORT_TICKET_BIND_ORACLE` capability. The gate must be a deployed contract that exposes the exact vault, registry and certifier dependencies and an actual Oracle address. Once bound, a market **cannot** rotate its gate in-place and the vault refuses `resolve` from anyone except that gate, **even when the principal also holds a legacy RESOLVE capability**.

`enableOracleOnlyFunding()` is an irreversible, authorized global prelaunch fuse. It requires no ticket to have been funded in the vault, and thereafter refuses funding for any market lacking both a gate and a risk group. Deploy a fresh vault for production or testnet; do not flip the fuse on a vault with historical tickets. Emergency recovery uses the pre-existing status-aware, permissionless `refund` path. There is no emergency bypass to settle unverified winners.

**Funding activation order:** deploy authority and certified oracle components; deploy fresh vault and market-bound gate; configure group limits and feed policy; bind every market to gate; grant the gate's market-scoped RESOLVE capability; revoke old resolver grants where possible; grant the independent deployer only `BIND_ORACLE`; activate the fuse; verify that all non-gate settlement reverts; verify an honest oracle result; only then permit new funded admission. Do not grant the vault RESOLVE right to operator accounts.

## Conservative exposure

Markets can be assigned once to one immutable risk group by scoped authority with `bindRiskGroup`. The required group ID is derived on-chain as `keccak256(abi.encode("420.BET.SPORT.EVENT.RISK.V1", eventId, asset))` so every proposition on the same sporting event and token shares one cap; arbitrary subgroup identities are rejected. Group identity binds a single token and a fixed maximum outstanding **sum** of profit liabilities. Group exposure increments atomically with funding and decrements on winning, losing or refunding. The sum-of-open-profits bound covers correlated simultaneous wins without guessing correlation coefficients; it is deliberately conservative. Once group membership has begun, the risk group cannot be relabeled or its cap silently raised. Group limits are **not capital guarantees** without funded operator collateral, which remains independently checked on admission.

## Canonical oracle policy

For each market, feed ID is `keccak256(abi.encode("420.BET.SPORT.RESULT.FEED.V1", marketId))`. Result observations must commit to `keccak256(abi.encode("420.BET.SPORT.RESULT.V1", block.chainid, marketRegistry, marketId, certifiedSelection, certifiedEvidence))`. The feed must have `FEED_OUTCOME`, `AGGREGATION_QUORUM_EQUAL`, at least two active independent provider IDs, bounded heartbeat, confidence >= 9000 bps, a nonhalted risk policy and freshness no older than the configured gate limit. Wrong market, stale data, missing quorum, revoked/rotated source, conflicting quorum and halted feed revert.

For a provider disagreement, leave the ticket FUNDED, halt admission/settlement as appropriate, collect independently timestamped evidence, and use the certifier's documented challenge/VOID decisions or the existing refund deadline. Do **not** substitute a single publisher or forge a fallback report. A declared cancellation or abandonment must be reflected through the event registry; 5D.5 refunds remain available. Source data and governance cannot be mocked into live acceptance.

## Independent publisher governance: mandatory off-chain evidence

Each publisher must be a separately controlled organization with independent source rights and nonshared operator keys. Record signed documents proving legal entity identity, feed license/data-rights scope, operational separation, beneficial ownership, key origin/rotation and incident response. The adjudicator must be a distinct independent principal; the operator and owner of the vault cannot adjudicate alone. No transfer of the repository owner's governance authority is implied by these operational separations.

Use issuer-controlled hardware-backed keys or separate custody domains; deny publisher keys custody/settlement authority; require two-person key rotation approvals; record provider epochs and feed source epochs. Revoke provider registrations and source membership immediately following compromise, preserve the evidence hash, and prove the router rejects old observations before restoring feed active status. Log incident timestamps and governance decisions.

## Runbook for outages, disputes and safe recovery

1. Detect unhealthy or absent oracle quorum, stale observation, disabled publisher, source disagreement or chain-finality uncertainty.
2. Suspend affected market admission, halt the affected risk policy if necessary, and preserve already-funded tickets.
3. Reject unverified resolution, replay and cross-market reports. Never overwrite finalized historical evidence.
4. Capture observation IDs, provider/source epochs, signed evidence, market/quote epochs, token liabilities, ticket and certification states.
5. If an official event is postponed/cancelled/abandoned, update the authenticated event registry; otherwise follow certified VOID or contractual refund deadline. Refund original stakes once, to original beneficiaries.
6. Restore only after authorized provider rotation and independent verification of quorum, freshness, code hashes and finality; lift risk-policy halt, refresh quotes and resume market when ready.
7. Demonstrate invariants after reboot/replay: token balance = aggregate nominal liability, outstanding group exposure = sum of unsettled profits in that group, no duplicate terminal ticket, no stale grant bypass.

## Manifest, verification and production release

Template: `contracts/config/bet/sports-5d6-pretestnet-manifest.v1.json`.

Verifier: `python3 scripts/verify-sports-5d6-deployment.py --mode prelaunch`. The prelaunch template intentionally has null addresses, chain IDs and code hashes. It is **not deployable proof**.

To attempt production acceptance, populate and review the exact deployment addresses, code hashes, chain ID, immutable bindings, sources, risk groups, certified evidence, resolver revocations, independent external reports and approval records. Invoke `python3 scripts/verify-sports-5d6-deployment.py --mode production --rpc-url <trusted_testnet_rpc>`. The verifier fails closed on absent attestation or invalid on-chain data, and manual independent review remains necessary.

A testnet acceptance record must include: deployment transaction hashes, code hash check at finalized block, oracle feed setup transaction IDs, source/provider epoch snapshots, valid report with independent publisher signatures, revoked-provider and stale-report rejection, multi-market stress, reorg and retry drills, funded token reconciliation, challenge and refund evidence, audit finding disposition and qualified SHA. The pretestnet CI suite does not substitute for these reports.

## Remaining external and testnet gates

The independent auditor, operator licensing/geographic controls, real data license, publisher/adjudicator independence, chain finality, actual W420 custody, real transaction retry/reorg and RPC fault experiments, approved compiled bytecode addresses, and deployment certificates remain unfulfilled until independently demonstrated. Keep `BET-5D4-TN-01..07` intact and append 5D.6 oracle-specific findings rather than silently declaring them complete.

## CI evidence boundary

Bounded Level 1: `.github/workflows/420bet-sports-5d6-hardening.yml`, real OracleRouter tests and inherited 5D.4/5D.6 assertions, plus deployment-manifest syntax and negative release-gate tests. Level 2 app cross-lifecycle qualification is appropriate if later integration introduces shared authorization or release dependencies; Level 3 full repository closeout is a separate frozen phase gate.


# 420 Integrated Security Audit Plan

## Mainnet rule

A third-party security audit is a mainnet release gate. Internal tests, fuzzing and static checks
do not substitute for an independent audit.

## Recommended sequence

1. Freeze protocol decisions and contract interfaces.
2. Build from a clean checkout with pinned Foundry/Solidity configuration.
3. Run unit, fuzz and stateful invariant tests.
4. Generate coverage and static-analysis reports.
5. Run an internal manual threat-model review.
6. Deploy the exact candidate contracts to a public testnet.
7. Complete a soak period and incident/fault exercises.
8. Freeze an audit commit and provide auditors the source, specifications and known issues.
9. Remediate findings and add regression tests.
10. Obtain a remediation/re-review report.
11. Rebuild deterministic runtime bytecode from the reviewed commit.
12. Verify every genesis predeploy code hash against that build.
13. Only then authorize mainnet genesis/release.

## Minimum external audit scope

The audit must cover value custody, privilege boundaries, upgrade/governance paths, accounting
invariants, oracle assumptions, settlement atomicity, refund bounds, paymaster abuse limits, bridge
replay/rate limits and all external protocol integrations.

Bridge adapters deserve special attention because their security assumptions differ:
- CADC: Loon/LayerZero OFT/OFTAdapter configuration and DVN stack;
- USDC: Circle CCTP contracts/domain configuration;
- ETH: light-client/zk verifier;
- BTC: proof verifier plus separately reviewed withdrawal custody.

## Audit deliverables

Require:
- severity-ranked findings;
- affected commit hash;
- exact files/contracts reviewed;
- trust/privilege assumptions;
- remediation status for every finding;
- re-review statement after fixes;
- disclosure of excluded components.

The deployed bytecode must be reproducibly linked to the audited source commit.

# STAKE-AUDIT-9.4 qualification record

The authoritative exact-head run IDs, artifact URLs, qualified SHA and merge verification are retained in the qualification section of the pull request for `feature/stake-audit-9-4-accounting`. CI artifacts embed the candidate SHA and exact tested source/binary hashes. This source record defines the coverage and preserves prior evidence; it does not substitute a base SHA for tested working-tree changes.

Preserved evidence:

- STAKE-AUDIT-9.1 production signing boundary: PR #1191, candidate `3cfd666c3723d8bf2db2bdc66338fe800950f533`, successful run [44146233112](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44146233112), merged as `cb80ce9517824dc5a27efd6d03715fff144dcd6c`.
- STAKE-AUDIT-9.3 Indexer recovery: PR #1190, candidate `3627687a0a35542de2e5f2972dce7d16fe659263`, successful run [44137388796](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44137388796). TS/PostgreSQL lifecycle evidence remains valid; no TS projection/economics/signing implementation is changed here.
- STAKE-AUDIT-9.2 certified settlement recovery remains documented in its original record. New execution source changes require new exact-head execution qualification and do not inherit an unchanged-binary claim.

Implemented coverage: read-only BLS-certified history observation; gross scheduled and realized accrual accounting; validator rewards, owned collateral/protocol credit, reserves, replacement/recycling, proportional/finality slashing, exit/withdrawal accounting; ABI-strict event reconstruction; authenticated block-pinned execution comparisons; Indexer checkpoint/finality/event comparison; deterministic restart/replacement reports and machine-readable discrepancies; accepted-block native event persistence and production Indexer consumption.

Local qualification uses Go 1.25.3, solc 0.8.24, pinned upstream Geth v1.17.5 commit `9621c6ad10934a01b5514886fb6fbd87640b6c05`. Local working-tree evidence includes exact source hashes; a base SHA alone does not identify uncommitted changes. The pull request qualification section records actual candidate/run/artifact provenance after exact-head CI.

Known fixture failures diagnosed and corrected before CI: a slash fixture initially ignored post-replacement proportions; the initial native replacement assertion expected two calls while the retained replacement branch contains one. Neither failure weakened contract or recovery assertions. Native archive unit tests also exposed JSON null-topic encoding; archive writes normalize empty topic arrays without accepting missing archives.

Accounting basis: frozen RewardController accrual counters, not a claim that the current code mints equivalent native supply. No testnet, live provider, external signer custody or production-network deployment is claimed. Historical financial state and accepted-block archives are required operational inputs; unavailable evidence fails closed.

The repository roadmap names STAKE-AUDIT-9 as the operational recovery/observability umbrella and STAKE-AUDIT-10 as external security review/final Genesis closeout. No independently specified STAKE-AUDIT-9.5 title was found; do not infer completion of the remaining observability/alarm scope or begin another sub-step.

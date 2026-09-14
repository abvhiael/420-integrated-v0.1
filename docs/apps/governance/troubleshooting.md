# 420 Governance troubleshooting

If voting weight differs from current balances or validator status, inspect the proposal's frozen electorate snapshot. If rules changed after proposal creation, the proposal still uses its frozen revision.

If queue/execution fails, verify the exact action batch hash and timelock state. Do not substitute a different batch.
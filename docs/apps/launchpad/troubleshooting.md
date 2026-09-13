# 420 Launchpad troubleshooting

## Project not found

Verify network and project identifier, then confirm Registry/Launchpad contract addresses.

## Sale unavailable

The sale may be inactive, outside its valid window, fully allocated, policy-blocked or mismatched to the selected project. Do not bypass protocol checks through an alternate client.

## Contribution appears stuck

Look up the transaction by hash and inspect canonical receipt/finality state before retrying.

## Allocation missing

Confirm that the contribution finalized successfully and that the sale's allocation rules actually create the expected entitlement. Escalate using transaction hash, public project ID and public error data only; never provide secrets.

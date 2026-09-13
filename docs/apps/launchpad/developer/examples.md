# Launchpad integration examples

A safe client flow is: resolve canonical contract addresses; read the project; confirm active sale and expected asset; calculate/display the intended contribution; request an exact Wallet authorization; submit once; record the transaction hash; wait for the required receipt/finality; then refresh allocation state.

Never replace a failed verification step with a hard-coded alternate address or cross-environment fallback.

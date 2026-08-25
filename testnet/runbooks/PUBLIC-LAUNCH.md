
# S5.4 Public Testnet Launch Runbook

## Before launch

1. Step 5.3 observation must complete and promote to S5-PUBLIC.
2. Global Step 5 and public-promotion preflights must pass.
3. Freeze and publish chain ID, genesis hashes and release checksum.
4. Publish at least three bootnodes and three HTTPS RPC endpoints.
5. Publish WSS, explorer, faucet and status page.
6. Finalize wallet network metadata.
7. Publish validator and user onboarding guides.
8. Sign or attest the release artifacts.
9. Mark every publication checklist item READY.
10. Run `public-launch-preflight.py`.

## Launch

Run `public-testnet-controller.py launch`.

Immediately verify:
- chain ID from all RPC endpoints;
- all RPCs report the same finalized chain;
- explorer finalized block matches node/RPC state;
- faucet sends testnet 420 correctly;
- status page components are green;
- bootnode peer counts are healthy.

## After launch

Monitor continuously for:
- finality degradation;
- conflicting QCs;
- SAFETY_HALT;
- validator pool/active-seat reductions;
- Engine errors;
- RPC availability/error rate;
- explorer lag;
- faucet abuse;
- randomness degradation.

Public testnet assets have no monetary value.

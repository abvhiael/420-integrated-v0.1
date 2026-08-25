
# Step 5 — Testnet Launch

Status: **LAUNCH PACKAGE IMPLEMENTED; PUBLIC TESTNET NOT YET AUTHORIZED**

Step 5 changes the system from an RC build into an operational network launch.

The initial bounded network requires 60 eligible validators to support a 15-seat active committee.
The launch package therefore defines 60 validator records:
- 15 active seats;
- 45 eligible standby validators.

No private keys are included. All identity material is ceremony-generated.

## Rollout

- S5-CANARY: private, minimum 24 hours.
- S5-OBSERVATION: invite-only/external observation, minimum 72 hours.
- S5-PUBLIC: public endpoints only after every hard launch gate passes.

## Hard gates

Public launch requires:
- all Step 4.9 formal evidence PASS;
- genesis checksums PASS;
- chain-ID collision preflight PASS;
- 60 validator identities ready;
- 15 active seats fillable;
- at least three bootnodes ready;
- at least three public RPC endpoints ready;
- explorer and faucet ready;
- no unresolved safety-critical issue.

The preflight script fails closed. Missing evidence or placeholder infrastructure is BLOCKED.

## Chain ID

420 is still the testnet candidate because it preserves the project identity and current source
configuration. A public launch must run `check-chain-id.py` against the live chain registry and freeze
the decision before genesis. The historical 420-vs-2020 archaeology remains recorded rather than
silently erased.

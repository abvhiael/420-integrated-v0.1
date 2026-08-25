
# 420 Integrated Testnet Launch Runbook

## Phase 1 — Canary

1. Complete the secure validator identity ceremony for all 60 eligible validators.
2. Replace every placeholder validator ID, BLS public key, owner address, and withdrawal address.
3. Complete the genesis seed ceremony and freeze `consensus-genesis.json`.
4. Run the chain-ID collision preflight.
5. Freeze the exact genesis SHA256 manifest.
6. Deploy at least three libp2p bootnodes in distinct failure domains.
7. Start 60 validator nodes or otherwise ensure all 60 registered eligible validators meet the
   frozen readiness rules; fill exactly 15 active seats.
8. Start execution/consensus pairs with production BLS and libp2p builds.
9. Keep RPC, explorer and faucet private.
10. Run at least 24 hours before advancing.

## Phase 2 — Observation

1. Enable controlled external RPC access.
2. Enable explorer.
3. Enable faucet with testnet-only rate limits.
4. Invite external validators/users.
5. Run at least 72 hours.
6. Exercise proposer failures, 11/15 quorum edge, restart, gateway pause, and AI-node absence.
7. Do not open public distribution or represent test assets as having monetary value.

## Phase 3 — Public

Only after `scripts/testnet-preflight.py` exits zero:
1. publish RPC/WS endpoints;
2. publish bootnode multiaddrs;
3. publish explorer and faucet;
4. publish genesis hashes and RC checksum;
5. publish validator onboarding documentation;
6. monitor finality, participation, Engine health and peer count continuously.

A launch failure never authorizes rewriting finalized history.

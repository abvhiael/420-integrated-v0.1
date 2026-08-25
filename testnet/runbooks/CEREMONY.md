
# S5.1 Canary Ceremony Runbook

## A. Validator identities

1. Assign one coordinator record per validator index 0–59.
2. Each operator generates BLS, owner and withdrawal keys independently.
3. Operator publishes only public keys/addresses and proof of possession.
4. Coordinator verifies canonical encoding, uniqueness and PoP.
5. Operator signs the canonical public record hash with the owner key.
6. Coordinator sets the record to `READY`.
7. Run `finalize-validator-registry.py`.
8. Production `blst` verification must independently verify every proof of possession before canary.

## B. Genesis seed

1. Select at least 7 independent contributors; 15 is preferred.
2. Freeze the contributor list before commitments.
3. Each contributor generates 32 random bytes privately.
4. Publish commitment `SHA256(contributor_id || secret)`.
5. Freeze all commitments.
6. Publish reveals.
7. Resolve missing reveals deterministically.
8. Set the final Step 4.9 test checkpoint root.
9. Set an external public-randomness value obtained after commitments were frozen.
10. Run `finalize-genesis-seed.py`.

## C. Genesis freeze

1. Select the UTC genesis time.
2. Run `freeze-testnet-genesis.py --genesis-time ...`.
3. Publish `FROZEN-SHA256SUMS.txt`.
4. Every operator independently verifies all frozen hashes.
5. No file in the frozen bundle may be edited after this point.

## D. Infrastructure

1. Provision at least 3 bootnodes in 3 failure domains.
2. Configure production libp2p identities and publish multiaddrs.
3. Keep public RPC/explorer/faucet closed during canary.
4. Start validator/execution pairs.
5. Run `canary-preflight.py`.
6. Start the 24-hour canary only if the script exits zero.

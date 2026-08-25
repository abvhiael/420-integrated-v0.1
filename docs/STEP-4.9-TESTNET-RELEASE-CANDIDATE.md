
# Step 4.9 — Testnet Release Candidate Packaging

Status: **TESTNET_RC PACKAGE IMPLEMENTED; PUBLIC LAUNCH REMAINS EVIDENCE-GATED**

Step 4.9 creates the first formal release-candidate packaging process.

## Release identity

- channel: `TESTNET_RC`
- version: `0.1.0-rc1`
- chain ID: 420
- consensus binary: `fourtwentyd`
- execution wrapper: `node420`
- execution baseline: go-ethereum v1.17.5

An RC is not public-launch authorization.

## Formal evidence gates

The following must each have a machine-readable PASS record:
1. production BLS (`blst`);
2. production libp2p/GossipSub;
3. live Engine payload flow;
4. 15 real node420/fourtwentyd pairs;
5. production fault/partition matrix;
6. production restart recovery;
7. production soak;
8. release archive checksum verification.

`check-release-evidence.py` is the only release gate evaluator. Missing evidence never defaults to PASS.

## Real 15-pair harness

`prepare-real-devnet15.sh` creates fifteen isolated node420 execution datadirs from the exact 420
execution genesis.

`run-real-devnet15.py` starts:
- 15 node420/Geth execution processes;
- verifies all fifteen Engine endpoints;
- starts 15 fourtwentyd consensus processes with live Engine sinks;
- fails if any required process exits unexpectedly.

The current RC qualification workflow uses the deterministic broker for the consensus control plane
until fourtwentyd's production libp2p CLI peer-bootstrap surface is wired. Production libp2p compilation
is nevertheless a separate mandatory gate and cannot be skipped.

## RC build

`build-testnet-rc.py`:
- requires the default Go test suite to pass;
- stages release source/config/docs;
- produces an internal SHA256SUMS manifest;
- creates `420-integrated-0.1.0-rc1.zip`;
- creates a detached `.sha256` file.

## CI

`.github/workflows/testnet-rc.yml` performs the network-dependent qualification and uploads the RC,
formal evidence records, and qualification reports as CI artifacts.

## Launch rule

`public_testnet_ready` becomes true only when every formal gate is PASS and the source test suite is
healthy. Test harness results, source adapters, or an RC archive by themselves cannot authorize launch.

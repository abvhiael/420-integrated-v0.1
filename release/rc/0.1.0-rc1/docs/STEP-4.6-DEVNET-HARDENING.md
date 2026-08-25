
# Step 4.6 — Devnet Hardening

Status: **IMPLEMENTED HARDENING HARNESS**

## Added

### QC deduplication
Each node now publishes at most one QC per slot/block threshold crossing and ignores duplicate QC
messages already processed. This removes the Step 4.5 QC amplification behavior.

### Persistent consensus state
Each devnet validator persists:
- head;
- safe;
- finalized;
- next local slot;
- last observed QC identifier.

State writes use a temporary file + fsync + atomic rename.

On restart, `fourtwentyd` restores its consensus status and continues its slot counter.

### Engine fork-choice propagation
Consensus now uses a `ForkchoiceSink` interface. The production implementation calls the Engine API;
the deterministic devnet sink persists the latest head/safe/finalized tuple to a file so tests can
verify the consensus → execution boundary without a real Geth process.

### Quorum loss
The devnet runner can start fewer than 15 validator processes while preserving the protocol committee
size of 15.

Expected:
- 11–15 live validators: certification possible;
- 0–10 live validators: no QC/finality progress.

### Restart recovery
`--restart-test` runs the same validator identities in a second phase using their persisted state.
Slot counters continue rather than restarting from zero.

### Production network/crypto boundary
The existing libp2p/GossipSub and `blst` adapters remain the production targets. This sandbox still
cannot fetch their external modules, so they remain build-tagged and are not falsely represented as
compiled production dependencies.

## Still required before a public testnet

- compile/run libp2p GossipSub on networked build hosts;
- compile/run production `blst`;
- run one real node420/Geth execution process per validator node;
- initialize node420 from a 420 execution genesis;
- exercise live Engine API payload building rather than the deterministic Engine mock/file sink;
- adversarial network partition matrices;
- persistent validator keys/remote signer;
- disk corruption/recovery tests;
- long-running soak tests.

# Certified consensus settlement and recovery

`fourtwentyd --certified-settlement` is the production settlement consumer. It
accepts the existing consensus header/body envelope, its quorum certificate,
finalized Stake outcomes and exact execution payload as newline-delimited
`recovery.Record` JSON. It does not sign, manufacture quorum counts, run the
deterministic devnet simulator or select consensus history from execution RPC.

Build with `go build -tags blst -o bin/fourtwentyd ./consensus/cmd/fourtwentyd`.
The untagged build fails closed for this mode. The pinned BLST implementation
validates public keys, individual proofs of possession and the existing
chain/version-domain-separated 11-of-15 (or corresponding 15–30 member) quorum.

Supply an independently provisioned `recovery.Trust` file and its independently
verified SHA-256. It pins chain 420, protocol version, consensus/execution genesis,
slot timestamp, committee root, ordered keys/PoPs and their rotation. Unknown
committees/rotations halt; RPC cannot install new signing authority. Committee
provisioning and the unfinished STAKE-AUDIT-9.1 signing boundary are not replaced
by this settlement consumer. No production private keys enter this process.

Example (paths and pin must come from the operator's actual provisioning):

```sh
bin/fourtwentyd --certified-settlement \
  --engine http://127.0.0.1:8551 --jwt-secret /node/jwt.hex \
  --settlement-trust /node/trust.json \
  --settlement-trust-sha256 <independently-verified-sha256> \
  --settlement-dir /node/consensus < certified-blocks.jsonl
```

Only cryptographically verified records can enter history. The pinned committee
is the consumer's authority context; a certificate cannot introduce another
committee. The signed header must bind the exact execution hash, batch root,
parent QC, slot timestamp and randomness. Outcomes must independently derive the
same ordered calls as the committed body. The existing one-certified-child
finality tracker is rebuilt from the complete authenticated history; replacement
parents must descend from its durable finalized root. This consumer does not
claim to implement proposal signing, election or a full validator networking loop.

## Durable boundary

The directory has a single process owner (an exclusive file lock):

- `history.json`: integrity-protected, append-only successful selection records,
  including replaced heads, plus at most one authenticated pending intent.
- `checkpoint.json`: independently persisted committed head, finalized high-water
  and execution anchor. Truncated history cannot override it, even during repair.
- `sequence.json`: the existing integrity-protected V2 gateway cursor.

All writes use same-directory temporary files, file fsync, atomic rename and
mandatory directory fsync. Persistence errors latch a halt until restart.

A pending record is persisted **before** Engine staging/import/canonicalization.
It is not a settlement checkpoint. Engine ACCEPTED/SYNCING/INVALID, staging
acceptance or a failed write cannot advance committed settlement. After exact
VALID/canonical verification, every reconstructed header commitment and the
pinned gateway sequence are checked; `CommitVerifiedSequence` persists the cursor,
then history and the high-water checkpoint are committed. Interrupted writes
reconcile from the authenticated pending record, including a cursor ahead of the
committed history after a crash between these writes.

Execution may lose buffered path-state on SIGKILL while retaining canonical
payloads. Recovery restages the selected canonical history, reconstructs retained
state before importing unknown children and verifies all resulting commitments.
Known already-applied blocks are not repeated as new settlements. Unavailable
execution leaves consensus alive with a durable pending intent and unchanged
settlement checkpoint; reconciliation retries when the paired Engine returns.

`engine420_replaceSystemCallsV1` permits explicit conflicting staging only after
the consumer verifies a certified replacement. The authenticated native endpoint
also rejects wrong chains, noncanonical parents and replacement at/below execution
finality. Normal staging continues to reject conflicting roots. Payload VALID is
still distinct from canonical settlement.

## Recovery operations

Preserve the complete consensus directory, paired execution database, JWT and
pinned trust file. Restart the same binaries/directories after consensus-only,
execution-only or simultaneous failure. No journal deletion or sequence-zero
fallback is permitted. Normal cursor/intent crash windows reconcile automatically.

A missing, legacy, corrupted or unexpectedly stale cursor requires the explicit
`--recover-sequence` flag. With that flag the daemon still verifies all QCs,
ancestry, finalized high-water, canonical headers and block-pinned gateway state
before writing V2 state. A wrong chain, unknown execution head, missing/corrupt
history, invalid QC/PoP, conflicting batch or crossed finalized boundary cannot
be repaired by overriding the cursor. Keep the node halted and restore the
independently authenticated history/provisioning instead.

The existing execution harness supports `--consensus` for actual paired-process
qualification. It uses real quorum signatures and proofs, real binaries,
persistent databases and SIGKILL. Only the separate local fixture producer has
known test private keys. The `blst recoveryfault` instrumented daemon stops after
canonical verification so the harness can kill its PID before journal persistence;
the normal production binary has no environment-controlled fault hook.

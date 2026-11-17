# STAKE-AUDIT-9.6 — Integrated fault-injection qualification

The assigned 9.6 scope extends the existing local process recovery owner. It does
not change consensus rules, signing authorization, finality, frozen addresses,
accounting authority or public-testnet acceptance thresholds. Indexed projections
and monitoring reports remain observations, never settlement authority.

## Reproducible local drill

Build the pinned patched Geth using `scripts/build-node420-upstream.sh`, node420,
`fourtwentyd` with `blst`, `fourtwentyd-recovery-fault` with `blst recoveryfault`,
`settlement-fixture` with `blst`, production `stake-signer` with `blst`, and
`stake-signer-fault` with `blst stake_signing_faults`. The existing harness builds
the actual Indexer and observer. Provide an isolated, initialized PostgreSQL
witness database with `consensus/signing/witness.sql`, authenticated TLS with
`sslmode=verify-full` and a trusted certificate in `STAKE_SIGNER_PG_DSN`.
Never use a deployed validator identity/database for these drills.

```
python3 scripts/qualify-execution-recovery.py --consensus --integrated \
  --solc /absolute/path/to/solc-0.8.24 --output /fresh/private/output-directory
```

The integrated option fails if required consensus mode/witness configuration is
missing. Each run requires fresh execution/consensus/Indexer/outbox directories
and a never-used signing fixture identity in its isolated witness database.
The deterministic seed is public test material, not a deployable signer key.
TLS transport credentials are generated for the local run. Logical fault order,
protocol inputs and assertions are fixed; timestamps, ports, PIDs and binary
hashes are retained as observed rather than relabeled deterministic.

## Integrated boundary

An indispensable seat-zero share of an 11-of-15 quorum passes through actual
`fourtwentyd --protected-signing`, mTLS, the separate production signer, private
local journals and the independent PostgreSQL witness. Ten other shares are
explicit local co-signing fixtures. The fixture's local seat-zero key is destroyed
before certification in protected mode. There is no fallback on signer failure;
returned share identity/root/signature is verified before aggregation, and the
production settlement daemon independently verifies the entire certificate.
An unavailable or conflicting protected vote emits no certificate and cannot be
submitted for settlement. Local payload construction/staging is not settlement.

The existing matrix supplies real consensus-only, execution-only, simultaneous,
pre-journal acceptance crashes; bounded canonical replacement and finalized
boundary rejection; invalid payload/native-call rollback and gateway replay;
Indexer replacement/repeated restart; stale/corrupt/truncated state; wrong-chain
rejection and alarms. Existing passing evidence retains its original SHAs/runs.

The added coordinated scenarios assert:

- SIGKILL during a partially written/fsynced private temporary journal leaves the
  previous committed journal unchanged and emits neither signature nor QC.
- SIGKILL after local reservation before witness commit rejects automatic restart;
  explicit witnessed recovery permits only safe retry, then actual protected-QC
  settlement. Identical duties return identical certificates. Duplicate settlement
  and conflicting typed QC votes are rejected without extra execution effects.
- Overlapping unavailable signer and Engine produce actual categorical runtime
  alarms, including Engine debounce, while durable settlement remains fixed.
  The observer is also killed/restarted during the outage; durable incidents,
  outbox IDs and subsequent recovery notifications survive.
- Missing/contradictory accounting fixtures produce unavailable/discrepancy alarms
  without changing settlement. They are simulated observation faults, not new
  financial lifecycle qualification; 9.4 financial evidence is preserved.
- An actual stale consensus sequence journal halts processing; only verified
  canonical repair restores it and clears the matching mismatch alarm.
- A checksum-valid execution checkpoint contradicting independently certified
  history cannot be adopted even with sequence recovery enabled. The observer
  reports unavailable consensus evidence. Restoration uses the exact saved valid
  checkpoint in this isolated fixture, never invented RPC authority.
- Conflicting finalized history remains rejected with the observer running.
- A protected-QC transition accepted by execution before journal persistence
  survives consensus SIGKILL and reconciles from durable pending history once.
- The actual Indexer, running during the coordinated outage, is SIGKILLed and
  restarted on the same store after recovery. Canonical new-head logs retain
  earlier entries without duplication; final gateway sequence/effect count,
  consensus checkpoint and recovered critical incident state are asserted.

The write fault exists only under the explicit `stake_signing_faults` build tag.
Production builds have no environment-controlled interruption. A regression test
sets the same environment trigger in a normal build and verifies durable writes
and conflicting-proposal rejection still work. Existing signing fault stages and
private-history invariants remain unchanged.

## Evidence ownership and limitations

`node420-release-gate.yml` reuses its existing pinned execution/process owner and
adds authenticated TLS PostgreSQL plus the production/instrumented signer builds.
The signing owner qualifies the affected slashing write boundary. No unrelated
accounting, Solidity or TypeScript Indexer full suite is added. No branch rules or
approval gates are added.

The release artifact retains `integrated-fault-evidence.json`, original process
and monitoring evidence, actual PIDs, candidate/source/binary SHA-256 values,
before/after execution/checkpoint data, alarm IDs/transitions and categorical
child logs. Private signer/TLS/witness credentials and databases are excluded.
A failed partial run is explicitly `pass:false`. The PR qualification section is
the authoritative exact-candidate/run/artifact-digest and merged-tree record;
source documentation does not embed a self-referential commit SHA.

Preserved prior scope: 9.5 PR #1193 candidate
`4561e95809e672a3b69177fbcd069a5f35c1551b`, runs 44173816629, 44173816598,
44173816647, merge `834e28bb95167b1ebda1090b3be4b9bdfa800919`; 9.4 PR #1192;
9.3 PR #1190; 9.1 PR #1191; 9.2 PR #1189. The new run extends these boundaries
rather than relabeling their old results as new exact-head evidence.

No testnet is required for this scope. A real external receiver, deployed public
network and long-duration observation are not claimed by local drills. The
remaining umbrella STAKE-AUDIT-9 acceptance, STAKE-AUDIT-8 live deployment and
STAKE-AUDIT-10 external review/final Genesis boundaries remain intact. No next
substep is invented or begun.

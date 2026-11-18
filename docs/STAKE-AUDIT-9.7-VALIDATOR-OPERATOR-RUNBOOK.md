---
title: Validator onboarding and operator runbook
component: stake-operator
audience: [validator, operator]
category: how-to
status: current
version: current
---

# STAKE-AUDIT-9.7 — Validator onboarding and operator runbook

This is the operator entry point for the repository interfaces qualified through
STAKE-AUDIT-9.6. It documents local procedures, not public-network admission or a
deployment approval. The approved network release must independently supply its
genesis, trust/committee files, peer configuration, certified-record producer,
validated duty stream and any operator exit-request intake. Do not substitute the
local devnet or deterministic qualification producer for those authorities.

`fourtwentyd --protected-signing` and `--certified-settlement` are **separate
process modes**, not a combined autonomous validator launcher. Their stdin
transports consume typed duties and quorum-certified records respectively. They
do not provide a public proposer-election/P2P service or an exit-request CLI.
The current CLI rejects mixing protected signing with Engine credentials or
settlement. Older architectural descriptions of a complete daemon/P2P/database
must not be read as additional working flags. This runbook gives executable
interfaces for the implemented boundaries and identifies deployment inputs where
there is no repository command. An EOF ends protected signing; keep its authorized
producer connected and supervise both sides. Settlement EOF alone does not shut
the reconciliation loop down; use SIGTERM.

## 1. Eligibility, collateral and identity

Canonical sources are [ValidatorRegistry](../contracts/src/system/ValidatorRegistry.sol),
[the frozen lifecycle specification](VALIDATOR-LIFECYCLE-SLASHING-v1.md),
[dynamic committee rules](DYNAMIC-VALIDATOR-REWARD-RAMP-v0.4.md) and finalized
consensus history. Wallet/Indexer projections never confer eligibility.

| Requirement | Canonical value / behavior |
| --- | --- |
| Effective native `$420` bond | Exactly 42,000; 18 decimals |
| Participant-owned bond | At least 21,000 |
| Protocol credit | At most 21,000, preassigned to this validator ID and owner; not automatic |
| With no assigned credit | Owner supplies all 42,000 plus transaction gas |
| Activation delay | 17,640 execution blocks; full bond, key validity, readiness and canonical admission still required |
| Epoch / rotation | 420 blocks / 42 epochs = 17,640 blocks; target slot 12 seconds |
| Active term / ordinary cooldown | Three rotations / three rotations |
| Voluntary notice | One rotation; does not shorten existing active duties |
| Post-duty slashability hold | Six rotations = 105,840 blocks after the canonical hold starts |
| Bonded handoff | Earliest block 4,200 AND at least 60 eligible validators; neither is automatic admission |
| Active committee / quorum | 15–30 under existing sizing/hysteresis; quorum floor(2N/3)+1 (11/15, 21/30) |

The owner has one registered validator slot. `validatorId` is a unique nonzero
bytes32; the 48-byte BLS public key cannot be reused after exit. The withdrawal
address must be nonzero and is the only address allowed to call final withdrawal.
Owner, withdrawal address, bytes32 registration ID, numeric signing-policy
validator ID, BLS public key, approved consensus genesis and committee/seat must
be explicitly reconciled in the deployment record; do not truncate a bytes32 ID
into the numeric signing ID. Contract registration checks key length/uniqueness;
consensus validates the key/proof/readiness. A registration receipt is not a PoP
or admission certificate. There is no public delegation or stake-weighted
validator governance at Genesis. Protocol credit is protocol property and cannot
be withdrawn as owned collateral. Ordinary inactivity loses applicable rewards
and may affect readiness; it is distinct from principal-slashable safety faults.

## 2. Host, software, storage and network

Use separate least-privileged Linux service identities and durable filesystems
supporting exclusive locks, atomic rename, file fsync and directory fsync. The
repository does not publish a benchmark-qualified CPU/RAM/disk/bandwidth minimum;
do not present an invented hardware size as admission evidence. Select and
measure production-equivalent capacity against the approved network workload:
CPU must meet 12-second slots, memory must cover execution/state growth without
OOM, and SSD capacity/IOPS must cover the full execution database, retained
certified/signing history, Indexer snapshots, outbox growth, logs, snapshots and
restore headroom. Disk/inode exhaustion and sync failures are fail-closed
incidents. Monitor capacity trends; do not prune signing history to free space.
Keep clocks synchronized (TLS, JWT time and evidence freshness depend on it),
provide reliable power/networking, restricted operator access and tested backups.

Build requirements: the root Go module declares Go 1.23; patched Geth v1.17.5
uses the existing release builder's Go environment (CI uses 1.24.x). Go 1.25.3
also builds the commands locally. Install a C compiler for CGO/blst, Git, Python 3,
OpenSSL and Node.js for the command/Wallet qualification. The supported execution
binary is the **patched** Geth v1.17.5 at upstream commit
`9621c6ad10934a01b5514886fb6fbd87640b6c05`, not an arbitrary binary that happens
to report that version. Retain the release-gate manifest, patch/binary digests and
approved release SHA; `node420 --verify-geth` checks a version string, not all
patch identity or authenticated RPC capability requirements.

```sh
# operator-command: build
mkdir -p bin
go build -tags blst -o bin/fourtwentyd ./consensus/cmd/fourtwentyd
go build -tags blst -o bin/stake-signer ./consensus/cmd/stake-signer
go build -tags blst -o bin/stake-operator-init ./consensus/cmd/stake-operator-init
go build -tags blst -o bin/stake-monitor ./consensus/cmd/stake-monitor
go build -tags blst -o bin/stake-reconcile ./consensus/cmd/stake-reconcile
go build -tags blst -o bin/indexer420 ./indexer/cmd/indexer420
go build -o bin/node420 ./execution/cmd/node420
```

Obtain the patched execution binary from the qualified release or use
`scripts/build-node420-upstream.sh` when intentionally building/qualifying it.
Do not compile production services with `recoveryfault` or `stake_signing_faults`.
Do not run `settlement-fixture`, known test keys, `--devnet-validator`, accelerated
slots or the devnet broker as a live validator.

| Boundary | Exposure / default |
| --- | --- |
| Execution peers | Geth TCP/UDP 30303; approved peers/firewall policy |
| Ordinary execution RPC | node420 defaults to loopback 8545; private unless separately hardened |
| Engine API | Loopback 8551 on the same host; private authenticated network only across hosts |
| Remote signer | mTLS 9443 in the provided compose; only approved validator client reaches it |
| Rollback witness | Independent TLS PostgreSQL; only signer role reaches its provisioned endpoint |
| Observer / Indexer | Operator loopback 9545 / explicitly set 8420; not public authority |
| Consensus peer/duty intake | Approved deployment integration; no fabricated CLI port; 9420 is the devnet broker |

## 3. Persistent layout and ownership

Example host paths below are operator-selected and consistent across commands.
Create directories before startup; use actual approved service ownership.

| Path under `/srv/420` | Owner / contents |
| --- | --- |
| `execution/` | execution owner; complete Geth datadir |
| `settlement/` | settlement owner; `history.json`, `checkpoint.json`, `sequence.json` and lock files |
| `validator-history/` | UID 10001; private local signing `history.json` plus lock |
| `signer-history/` | UID 10002; private signer `history.json` plus lock |
| `signer-private/` | UID 10002; `bls.hex`, approved policy, signer P-256 TLS key/cert, CA, witness DSN |
| `validator-private/` | UID 10001; approved policy, distinct client TLS key/cert, signer CA |
| `indexer/` | Indexer owner; persistent `index.json` |
| `monitor/` | UID 10003; durable incident/outbox state and lock |
| `health/{signer,validator,settlement}/` | Each producer owns its directory; public categorical files only |
| `monitor-inputs/` | Source-owner-published, readable redacted views; observer mounts read-only |

Private key/history/outbox directories must be mode 0700, private files 0600;
reject symlink aliases. Public health lives outside private directories. Preserve
complete directories; copying just an execution head hash or a sequence number
is not a recoverable database. Witness storage is independently administered and
outside these hosts' backup/rollback failure domain. Do not bundle a witness
rollback with signer snapshots. The observer never mounts signer secrets or
private signing journals. Use the UIDs and read-only/capability restrictions in
[protected-signing compose](../deployments/consensus/protected-signing.compose.yml)
and [monitor compose](../deployments/monitoring/stake-monitor.compose.yml).

## 4. BLS generation, custody, policy and first-use protection

Run the initializer on the isolated signer host, as its owner, in a private
parent directory. It uses OS cryptographic randomness and the repository's real
blst derivation/PoP. It creates a **new** directory exclusively, writes/fsyncs
`bls.hex` (32-byte IKM encoded as 64 hex digits) and `public.json`, syncs the
parent, and prints only public key/proof. An existing directory, alias or public
parent is refused. A failed partial initialization is retained for investigation;
never delete it and silently generate a replacement identity. There is no Wallet
key or deterministic seed input and no HSM/threshold-signer support claim.

```sh
# operator-command: key-generation
bin/stake-operator-init --generate-key-dir /srv/420/signer-private/new-identity
```

Keep `bls.hex` only in signer custody; the live signer flag must point to this
actual file or an owner-controlled private copy. Keep encrypted offline backups
with audited access and restore drills. Public key/proof may leave the signer;
IKM, private TLS keys, witness DSN and Engine JWT may not enter Wallet forms,
chat, logs, Git, command arguments, telemetry or the Indexer. Wallet owner signing
uses a separate secp256k1 key; remote transport uses distinct P-256 keys. Check
public key and PoP against approved registration/admission records. Never run two
signers for the same identity, including restored hosts or standby replicas.

An approved `signing.Policy` JSON is provisioned independently: `Identity`
contains ChainID 420, consensus Genesis root, numeric ValidatorID and BLS
PublicKey; top-level ProtocolVersion 1, CommitteeRoot and Seat bind the duty
context. Go public-root/key fields are byte arrays in policy JSON, not the
public.json hex strings. Provision the SHA-256 pin independently to both roles;
a locally computed hash is a comparison, not independent approval. Do not learn
policy, finality, genesis or committee authority from arbitrary RPC responses.
Review identity/committee changes while retaining history. Do not downgrade a
used signer to software unable to read its complete duty history.

Provision a fresh validator-side local journal only for an independently
confirmed **never-used** key, using the approved policy/pin:

```sh
# operator-command: validator-history
bin/stake-operator-init --initialize-never-used-validator-history \
  --policy /srv/420/validator-private/policy.json \
  --policy-sha256 "$STAKE_SIGNING_POLICY_SHA256" \
  --history /srv/420/validator-history/history.json
```

On the independently administered witness, an administrator installs
`consensus/signing/witness.sql`. Use a temporary provisioning role for initial
INSERT. Normal signer access is SELECT/UPDATE, without DELETE/TRUNCATE or schema
administration; enforce TLS `sslmode=verify-full`, authenticated credentials and
trusted server CA. DSN is loaded from a private file, never a command-line URL.

For the never-used signer identity, run the following command with the temporary
provisioning DSN, then replace its private DSN file with the normal restricted
role before serving. It initializes signer history and the missing witness once;
it refuses reuse. Do not initialize either history for an existing validator.

```sh
# operator-command: signer-provision
bin/stake-signer --policy /srv/420/signer-private/policy.json \
  --policy-sha256 "$STAKE_SIGNING_POLICY_SHA256" \
  --history /srv/420/signer-history/history.json \
  --bls-ikm /srv/420/signer-private/new-identity/bls.hex \
  --witness-dsn /srv/420/signer-private/witness.dsn \
  --provision-never-used-key
```

## 5. Wallet registration and collateral actions

Open the Wallet's Stake management surface ([implementation](../wallet/web/stake-management-ui.js)).
Connect the **owner** account to approved chain 420 (`0x1a4`) and verify genesis,
release bindings/code hashes using the approved deployment manifest. Wallet's
binding/code-presence checks are necessary but are not full code-hash attestation.
Frozen destinations are ValidatorRegistry `0x0000000000000000000000000000000000000423`,
Stake420 `0x000000000000000000000000000000000000043a`, RewardController
`0x0000000000000000000000000000000000000420`, and CommunityValidatorReserve
`0x0000000000000000000000000000000000000425`. ProtocolReserve is the distinct
`0x0000000000000000000000000000000000000424` destination.
The [Stake safety-provider manifest](../deployments/stake-security/safety-provider.json)
requires an actual governance-approved Registry/code-hash binding before production
activation; no provider address or live binding is inferred from local tests.

Enter the approved nonzero validator ID, **public** BLS key (48 bytes / 96 hex
digits after `0x`), withdrawal address and metadata commitment. Never paste IKM or
a private key. Obtain `registrationQuote`: it verifies any pending credit and its
beneficiary and computes ownedRequired = 42,000 minus assigned credit. Inspect
native amount, destination, gas and withdrawal address in Wallet confirmation.
The contract call is payable `register(bytes32,bytes,address,bytes32)`; there is
no ERC-20 approval/delegation transaction. Simulation and gas estimation precede
`eth_sendTransaction`; chain/account/bindings are rechecked before sending.
Record the transaction hash, successful receipt, canonical inclusion and later
finalization. `confirm()` means a successful receipt, not finalized admission.

The actual Wallet module exports `createStake420ManagementClient`,
`registrationQuote`, `sendRegistration`, `sendTopUp`, `sendReplaceCredit`,
`sendWithdraw`, `summary` and `confirm` (factory methods, not globals). Its
required factory options are provider, chainId, account, stakeAddress,
validatorRegistryAddress and rewardControllerAddress. Its existing negative
Wallet fixtures verify wrong-chain, changed-account, reverted simulation and
collateral/withdrawal permissions; do not bypass those checks with raw RPC.

After registration, await finalized lifecycle transitions and readiness. Use
owner-only `topUpOwnedBond(bytes32)` to replenish a slash within the fixed bond;
`replaceProtocolCredit(bytes32)` replaces assigned credit with owned native
collateral and recycles credit. Neither increases the effective bond above
42,000 or buys a committee seat. Keep gas funds separate from bonded principal.

## 6. Engine JWT and execution configuration

Run as the execution owner on a private host. On an approved release, provision
an exclusive JWT file; retain the same file for execution and settlement. The
command refuses an existing file through shell noclobber. Share read permission
only with the Engine-owning settlement/observer identities by approved secret
mounts/ACLs, not public chmod. The protected-signing process receives no JWT.

```sh
# operator-command: jwt
(umask 077; set -C; openssl rand -hex 32 > /srv/420/engine-jwt.hex)
```

Initialize execution once on an empty datadir with the **approved** genesis file,
not a regenerated local fixture. Preserve its approved digest. Do not re-init a
used datadir or change chain identity to recover a startup failure.

```sh
# operator-command: execution-init
bin/node420 --geth bin/upstream/geth-v1.17.5-420 \
  --datadir /srv/420/execution --init-genesis "$APPROVED_EXECUTION_GENESIS"
```

```sh
# operator-command: execution
bin/node420 --geth bin/upstream/geth-v1.17.5-420 \
  --datadir /srv/420/execution --jwt-secret /srv/420/engine-jwt.hex \
  --authrpc.addr 127.0.0.1 --authrpc.port 8551 \
  --http.addr 127.0.0.1 --http.port 8545 --port 30303
```

Cross-host/container Engine access requires a private address, firewall isolation
and approved host/vhost routing; the wrapper supplies authrpc vhost `localhost`.
Its loopback defaults do not make the example `node420:8551` reachable between
containers. Do not assume compose DNS alone changes the bind/vhost policy.
Use an approved private proxy/namespace arrangement, verify authenticated
connectivity and capabilities, and never publish Engine on an Internet interface.
Coordinate JWT rotation while duty production is stopped; atomically replace the
private secret, restart/reconfigure both endpoints, probe and reconcile before
resuming. Never print JWTs or use an unauthenticated Engine fallback.

```sh
# operator-command: engine-probe
bin/fourtwentyd --engine-probe --engine http://127.0.0.1:8551 \
  --jwt-secret /srv/420/engine-jwt.hex
```

Probe success is capability negotiation, not a canonical checkpoint or full
patched-binary identity proof. Verify approved chain/genesis, block-pinned gateway
sequence and certified history before settlement readiness.

## 7. Remote signer, settlement and Indexer startup

Provision P-256 TLS client/server certificates with correct EKUs and SANs for the
actual endpoint (e.g. `stake-signer`). Pin each peer SPKI SHA-256 independently,
in addition to CA/name checks. Certificate renewal/key rotation must update pins
out of band. Do not use `-k`, disabled certificate checks or shared Wallet keys.
For a PEM certificate, this command computes the public SPKI digest to compare
against the independently approved pin:

```sh
# operator-command: spki
openssl x509 -in "$PEER_CERTIFICATE" -pubkey -noout | \
  openssl pkey -pubin -outform DER | openssl dgst -sha256
```

Start the independently backed witness, then signer, then protected duty consumer.
Health directories must already exist. On a single host these use loopback;
the provided [compose template](../deployments/consensus/protected-signing.compose.yml)
uses separate users and `https://stake-signer:9443` with matching certificate SAN.

```sh
# operator-command: signer
STAKE_SIGNER_HEALTH_FILE=/srv/420/health/signer/signer.json \
  bin/stake-signer --policy /srv/420/signer-private/policy.json \
  --policy-sha256 "$STAKE_SIGNING_POLICY_SHA256" \
  --history /srv/420/signer-history/history.json \
  --bls-ikm /srv/420/signer-private/new-identity/bls.hex \
  --witness-dsn /srv/420/signer-private/witness.dsn \
  --tls-cert /srv/420/signer-private/server.pem \
  --tls-key /srv/420/signer-private/server.key \
  --tls-ca /srv/420/signer-private/client-ca.pem \
  --client-spki-sha256 "$STAKE_VALIDATOR_SPKI_SHA256" --listen 127.0.0.1:9443
```

```sh
# operator-command: signing
STAKE_VALIDATOR_HEALTH_FILE=/srv/420/health/validator/validator.json \
  bin/fourtwentyd --protected-signing --signer https://127.0.0.1:9443 \
  --signing-policy /srv/420/validator-private/policy.json \
  --signing-policy-sha256 "$STAKE_SIGNING_POLICY_SHA256" \
  --signing-history /srv/420/validator-history/history.json \
  --signer-client-cert /srv/420/validator-private/client.pem \
  --signer-client-key /srv/420/validator-private/client.key \
  --signer-ca /srv/420/validator-private/signer-ca.pem \
  --signer-spki-sha256 "$STAKE_SIGNER_SPKI_SHA256" < "$APPROVED_DUTY_FIFO"
```

Start execution and the capability probe before the separate settlement consumer:

```sh
# operator-command: settlement
STAKE_SETTLEMENT_HEALTH_FILE=/srv/420/health/settlement/settlement.json \
  bin/fourtwentyd --certified-settlement --engine http://127.0.0.1:8551 \
  --jwt-secret /srv/420/engine-jwt.hex --settlement-dir /srv/420/settlement \
  --settlement-trust "$APPROVED_CONSENSUS_TRUST" \
  --settlement-trust-sha256 "$APPROVED_CONSENSUS_TRUST_SHA256" \
  < "$APPROVED_CERTIFIED_RECORD_FIFO"
```

Trust binds independently approved consensus genesis/time, execution genesis and
committee public keys/PoPs. Records include payload, outcomes, ancestry and a real
QC; a JSON transport does not make unverified producer claims authoritative.
Check `settled` status, canonical execution hash/batch root/gateway sequence,
verified finalized checkpoint and health READY. Never promote Engine staging
`ACCEPTED` or payload `VALID` to durable consensus settlement on its own.

The Go Indexer uses environment variables, not invented CLI flags:

```sh
# operator-command: indexer
INDEXER_RPC_URL=http://127.0.0.1:8545 \
INDEXER_ENGINE_URL=http://127.0.0.1:8551 \
INDEXER_JWT_SECRET=/srv/420/engine-jwt.hex \
INDEXER_CERTIFIED_DIR=/srv/420/settlement \
INDEXER_SETTLEMENT_TRUST="$APPROVED_CONSENSUS_TRUST" \
INDEXER_SETTLEMENT_TRUST_SHA256="$APPROVED_CONSENSUS_TRUST_SHA256" \
INDEXER_EXPECTED_GENESIS_HASH="$APPROVED_EXECUTION_GENESIS_HASH" \
INDEXER_STORE_PATH=/srv/420/indexer/index.json \
INDEXER_HTTP_ADDR=127.0.0.1:8420 bin/indexer420
```

Start monitoring/public-view publishers before enabling duties, and only enable
actual duty production after canonical/signing/Engine reconciliation succeeds.
Monitor and Indexer failures do not authorize settlement. A `--version` response,
open TCP port, process survival or successful transaction receipt is not readiness.

## 8. Shutdown, upgrades and maintenance

Use the actual supervisor's process IDs/stop operation. There are no repository
systemd unit names to invent. Stop the approved duty producer first; fence the
identity against failover. Send SIGTERM to its protected-signing consumer and
wait for exit, then stop/drain the certified-record producer and settlement
consumer, then stop execution, Indexer and observer cleanly as required for the
maintenance. Stop signer after consumers; preserve the independent witness.
Retain diagnostics if a supervisor eventually needs SIGKILL, and apply crash
reconciliation on restart. Do not send SIGKILL as a normal shutdown procedure.

Before upgrade record release/binary digests, chain/genesis, head/finalized roots,
execution hashes, batch root, gateway sequence and both signing histories' backup
provenance. Verify compatible journal schemas (V2 sequence, V1 complete protected
signing with typed QC/attestation records), protocol/ABI and approved pins. Stop
all old signing paths before starting replacements. Reapply permissions/mounts,
restore dependencies, run Engine probe, reconcile settlement, check signer
semantic health and alarms, then resume the approved producer. A protocol upgrade
cannot create an empty signing history or silently reset finalized checkpoints.

## 9. Backup and restoration

Make a coherent filesystem snapshot while relevant writers are stopped, retaining
complete execution, settlement, both private signing histories, Indexer and
observer outbox directories with owners/modes and checksums. Persist configuration,
approved trust/pins, release manifest and the observed canonical checkpoint in the
backup record. Use encrypted storage and authenticated encrypted off-host backup;
keep BLS/TLS/DSN/JWT backups separately access-controlled. Require the backup
platform's durable commit acknowledgment; tar completion alone is not a durable
off-host backup acknowledgment. The following creates
only a private local state archive on an already encrypted backup volume; it is
not an encryption command and must not be uploaded unprotected:

```sh
# operator-command: backup
(umask 077; test ! -e "$BACKUP/state.tar" && \
 tar --create --acls --xattrs --numeric-owner --file "$BACKUP/state.tar" \
 --directory /srv/420 execution settlement validator-history signer-history indexer monitor && \
 cd "$BACKUP" && sha256sum state.tar > SHA256SUMS)
```

Maintain the independently administered witness's own durable backup/recovery
procedure and latest signing high-water. Restoring the journal AND witness from
an older coordinated snapshot defeats anti-rollback; a checksum is not proof
that no later signature escaped. A lost/unavailable/uncertain witness means stop
signing, not provision a replacement for a used key.

Fence the old host first. To verify an independently approved archive and extract
into a new empty private staging directory, as the authorized restore administrator:

```sh
# operator-command: restore
(cd "$BACKUP" && sha256sum --check SHA256SUMS) && \
 tar --extract --acls --xattrs --numeric-owner --same-owner \
 --file "$BACKUP/state.tar" --directory "$RESTORE_STAGE"
```

The staging path must already exist with mode 0700 and must not contain live state.
Verify the backup manifest against independently held
provenance, then restore to an empty private staging location, never over live
writers. Preserve ownership under the authorized administrator. Compare restored
identities, trust pins, chain/genesis, finalized/history high-water and independent
witness before moving staged paths into service. An archive digest only detects
byte corruption, not completeness or malicious rollback. Restore stale signer
journals by the verified witness procedure below before any duty can run. Restore
stale Indexer state via certified canonical ingestion/rebuild; restore the outbox
only if incident/delivery history is complete, otherwise investigate deduplication
and receiver history before sending. Never assume an older valid outbox backup
proves no notification was already delivered.

## 10. Restart, reorganization, divergence and signing protection

| Incident | Safe recovery and verification |
| --- | --- |
| Consensus only | Keep execution; restart same settlement directory/trust, verify recorded finalized boundary, canonical hash/batch commitment and block-pinned sequence before next derivation |
| Execution only | Keep same datadir; settlement cannot advance while unavailable; restore paired binary/JWT, let durable verified consensus history reconstruct staged batches and replay missing canonical payloads |
| Both processes | Restore independent stores/config, start execution then settlement reconciliation; do not empty/reset either journal to match the other |
| Execution accepted before sequence/checkpoint persistence | Preserve pending certified intent; restart reconciliation verifies independently certified history/canonical gateway, completes the journal/checkpoint once without repeating applied effects |
| Stale/orphan V2 journal or legacy V1 journal | Halt first; explicit verified recovery below is permitted only from complete certified canonical history and matching execution; migration is not accepting a legacy checksum-free schema |
| Bounded reorganization | Only production certified ancestry/finality rules may replace an unfinalized branch; restore replacement parent's gateway sequence and rebuild Indexer projections, excluding orphaned effects |
| Wrong chain/hash, contradictory finalized checkpoint or missing history | Stop duties; preserve stores and diagnose approved identity/authority. Sequence repair does not override finalized/high-water state; unresolved authority stays halted |
| Corrupt/missing signing history or possible equivocation | Stop all identity instances; preserve evidence and verify complete independent witness/history. Never initialize, truncate, prune or copy an uncertain older journal to resume |

Explicit sequence repair is the settlement command above with `--recover-sequence`,
using the **same** Engine, JWT, approved trust/pin and settlement directory, after
stopping the prior writer. It cannot authorize an orphan checkpoint or overwrite
contradictory finalized history. File/directory synchronization errors are fatal;
there is no best-effort persistence mode. Treat a rejected transition as rejected,
not as permission to manually call the gateway or edit sequence numbers.

For offline signer rollback or local-reservation/pre-witness crash, stop signer
and duty consumers and run:

```sh
# operator-command: signer-recovery
bin/stake-signer --policy /srv/420/signer-private/policy.json \
  --policy-sha256 "$STAKE_SIGNING_POLICY_SHA256" \
  --history /srv/420/signer-history/history.json \
  --witness-dsn /srv/420/signer-private/witness.dsn --recover-witness-history
```

This acquires the independent lock, validates/replays complete witness history,
atomically replaces the signer journal and exits without signing. Recovery after
witness commit normally permits same-duty retry. Restore a stale validator-side
journal only from that same complete independently verified history under the
authorized operator; transfer public signing-history data with private filesystem
permissions, not the witness DSN or BLS key. Existing-key witness import is an
exceptional `--import-verified-history-sha256` operation on independently verified
complete prior history, never a way to promote an uncertain backup; see
[signer recovery details](../consensus/signing/README.md). Missing/corrupt witness
or conflicting evidence stays halted. No downgrade, force-sign or skip-protection
operation exists.

## 11. Monitoring, alarms and incident response

Use [the monitoring runbook](../consensus/monitoring/README.md),
[deployment configuration](../deployments/monitoring/config.example.json),
[Prometheus rules](../deployments/monitoring/stake-alarms.yml) and
[Grafana dashboard](../deployments/monitoring/dashboard.json). Provision approved
trust/pin and real input paths before initializing a never-used outbox. The
example deliberately contains an unusable placeholder trust pin and simulated
loopback receiver; it is not a deployment-ready credential bundle.

```sh
# operator-command: monitor-init
bin/stake-monitor --config /etc/stake-monitor/config.json --initialize
```

```sh
# operator-command: monitor
bin/stake-monitor --config /etc/stake-monitor/config.json
```

Source owners publish readable redacted views without relaxing private directories:

```sh
# operator-command: publish
bin/stake-monitor --config /etc/stake-monitor/source-owner.json \
  --publish-public-inputs /srv/420/monitor-inputs --publish-component consensus
```

Other publication components are indexer, accounting, canary, signer-health,
validator-health and settlement-health; refresh every 15 seconds within the
45-second freshness budget, preserving source timestamps. Produce fresh,
head-bound accounting output using:

```sh
# operator-command: accounting
bin/stake-reconcile --trust "$APPROVED_CONSENSUS_TRUST" \
  --trust-sha256 "$APPROVED_CONSENSUS_TRUST_SHA256" \
  --consensus-dir /srv/420/settlement --indexer-store /srv/420/indexer/index.json \
  --engine http://127.0.0.1:8551 --rpc http://127.0.0.1:8545 \
  --jwt-secret /srv/420/engine-jwt.hex --output /srv/420/accounting/report.json
```

Pre-create the report's parent directory with its producer ownership. A report
is a reconciliation observation; reward accrual is not a native minting proof.
Never use report, Explorer or Indexer output as settlement authority.

Keep existing thresholds: 42 uncertified slots MAJOR; eligible pool below 60
MAJOR; active/available seats below 15 CRITICAL; dynamic 11/15 or 21/30 quorum;
Indexer lag above 3 blocks WARN; existing canary peer floor 3 MAJOR. Engine
errors fire after three failed observations, not a changed consensus tolerance.
`/live` is process liveness, `/health` readiness (503 on degraded evidence/delivery),
`/metrics` fixed-label observations and `/v1/alarms` sanitized incidents.

On CRITICAL signing/persistence/divergence/safety/accounting incidents, stop
unsafe duty/value flows, preserve categorical logs/checkpoint hashes and incident
IDs, verify underlying canonical evidence and involve the authorized operator.
Do not clear an alarm by deleting state. Unknown/stale evidence cannot resolve
an active incident. Delivery is at least once with stable idempotency IDs;
receiver effects require durable deduplication before acknowledgment. Retry,
auth/permanent failure, dead letters and ordered recovery are durable. Repair the
cause/credential, stop the live monitor writer, then use the monitor command with
`--redrive` to retry dead letters with original IDs; restart normal service.
Do not enable duplicate independent paging routes. External monitoring must
cover observer outage and failed outbox persistence. Never include raw signing
keys, DSNs, JWTs, bearer tokens or private error strings in incident evidence.

## 12. Voluntary exit and collateral withdrawal

Arrange voluntary exit through the approved deployment's consensus-owned intake,
continue required duties until the finalized notice/term permits departure, and
monitor finalized `exitNoticeRotation`, `exitEligibleRotation`, scheduled exit,
withdrawal hold and withdrawable block. The repository exposes no standalone
operator exit-request CLI or owner-authorized exit transaction. Wallet currently
shows exit guidance; it must not call `applyExitNotice(bytes32,uint64)`, which is
`onlyConsensusSystem`. A deployment must supply its qualified intake before
advertising a self-service exit. Do not manufacture a system-call batch, invoke
privileged governance, use simulator fixtures or stop service mid-term as an
exit substitute. This is an explicit interface boundary, not a new exit protocol.

After final duty/notice requirements and the complete 105,840-block hold, wait
for canonical `WITHDRAWABLE`, including current Stake security gates and any
valid pending slash. Connect the **registered withdrawal address** in Wallet,
inspect `summary().canWithdraw` and simulate/confirm `sendWithdraw({validatorId})`.
The actual contract operation is `withdrawBond(bytes32)` with zero transaction
value; only the withdrawal address may call it. Remaining owned collateral goes
to that address; protocol credit returns to CommunityValidatorReserve. Record
receipt, canonical/finalized settlement, EXITED status and reconciled custody.
A reverted transfer reverts settlement; do not assume withdrawal succeeded from a
submitted hash. Rewards are separate accrual accounting; this operation is not a
reward-claim API. Preserve signing/slashing evidence after exit, and never reuse
a BLS key whose prior identity/history remains slashable or permanently reserved.

## Command qualification and retained evidence

[scripts/verify-stake-operator-runbook.py](../scripts/verify-stake-operator-runbook.py)
builds actual documented binaries, compares documented flags/environment/API
names with repository interfaces, syntax-checks shell blocks and checks links,
executes safe protocol/version/first-use commands and adversarial initializer
checks, and retains machine-readable evidence. Network mutation/startup examples
are interface-checked, not executed against a live validator. Prior real process,
recovery, financial and Wallet qualification stays attributed to its original
SHA/run; no unchanged full suite is rerun for prose changes. The exact candidate,
run/artifact digests and merge-tree verification live in the PR qualification
record to avoid a self-referential source SHA.

Preserved 9.6: PR #1194, candidate `f1bd533fc09675da248068bc636cb85a48ffd730`,
signing run 44178284286, release run 44178284273, merge
`70fd17db75c5dc1592039fcd944b3f355f6e14e3`. Earlier signing/recovery/Indexer/
accounting/monitoring evidence remains linked through PRs #1189–#1193.
This documentation qualification does not claim an autonomous public validator
runtime, available public-network endpoints, live registration/exit, hardware
capacity certification or external custody acceptance. No testnet is needed for
the documentation/local initializer scope; actual deployment inputs remain with
STAKE-AUDIT-8/9 acceptance. STAKE-AUDIT-10 is not begun here.

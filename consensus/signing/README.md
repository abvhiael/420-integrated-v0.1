# Protected validator signing

`fourtwentyd --protected-signing` is the production typed-duty signing boundary.
It reads `signing.Duty` JSON lines, reserves local protection state, calls the
isolated signer over pinned mTLS, verifies the returned public key, root and
actual BLS signature, and only then emits the signed proposal/attestation.
An error halts the stream. It accepts no validator BLS key, witness database
credential, Wallet key or owner signing endpoint. The deterministic devnet mode
continues to be a simulator and does not acquire these credentials.

This boundary signs duties already selected and validated by consensus; it does
not choose forks, run proposer elections or replace certified settlement.
Only the consensus process receives the dedicated validator client credential.
Browser sessions, Indexer projections and owner Wallet actions are not signing
callers. There is no arbitrary-root/domain API and no unauthenticated fallback.

## Keys and policy

Build both executables with `-tags blst`:

```sh
go build -tags blst -o bin/fourtwentyd ./consensus/cmd/fourtwentyd
go build -tags blst -o bin/stake-signer ./consensus/cmd/stake-signer
```

The pinned `Policy` contains the existing `slashing.HistoryIdentity` (chain,
genesis, validator ID, BLS public key), protocol version 1, committee root and
seat. Provision its SHA-256 independently to both processes. Bindings are never
learned from a signing request or execution RPC. Retain protection history over
committee/version changes; an identical QC vote cannot be re-signed under a
changed committee root. A protocol upgrade requires an explicit implementation
supporting its frozen domains, not a new empty protection journal.

The signer alone loads a private file containing 32 bytes of hex BLS IKM. It
checks the derived public key against policy. Client/server transport keys are
separate P-256 X.509 credentials with client/server EKUs, CA verification,
TLS 1.3 and independently pinned peer SPKI hashes. This excludes the Wallet's
secp256k1 key class and BLS keys from transport authentication. Private files
and directories reject symlink aliases and group/world access. Clear transient
IKM buffers and destroy the in-memory BLS key when closing the signer.

`deployments/consensus/protected-signing.compose.yml` provides separate Unix
identities and volumes: validator UID 10001, signer UID 10002, read-only roots,
no capabilities, no privilege escalation and no BLS/witness mount in the
validator service. Prepare their private/history directories with the matching
owner and mode 0700, secret files 0600. Issue the signer certificate for the
configured service DNS name. Never mount Wallet/owner credentials into either
service. The qualification also checks that UID 10001 cannot read a signer
secret even when its volume is deliberately mounted.

## Independent rollback witness

The signer requires a separately administered PostgreSQL service with persistent
storage outside the journal backup/failure domain. Install `witness.sql` with an
administrator credential. The normal signer role needs SELECT/UPDATE on the
witness table, not CREATE, INSERT, DELETE or TRUNCATE; use a separate provisioning
credential for initial INSERT. Require SCRAM authentication or client certificates
on the server, hostname/CA validation (`sslmode=verify-full`), a dedicated database
identity and bounded `connect_timeout` in the private DSN file. The code rejects
unverified TLS, missing authentication material and writable/aliased trust roots.

Use a direct/session-preserving connection, not a transaction pooler. Startup
requires a logged witness table, `fsync=on`, `full_page_writes=on`, and forces
`synchronous_commit=on` for its dedicated session. An asynchronous database
acknowledgement must never authorize a signature.

The witness owns the complete canonical protection snapshot and a generation
counter. Its session-level per-key lock excludes a second signer, including on
another machine or with a copied journal. The witness identity is stable across
BLS key changes for the same chain/genesis/validator: changing a key cannot
create a new empty witness for an existing validator. Any future authorized key
migration must preserve complete history and explicit protocol authority. Every
duty follows:

1. Verify the current independent witness still equals the last committed state.
2. Reserve the complete typed duty in the local, locked, fsynced protector.
3. Commit its complete snapshot to the witness with a compare-and-swap update.
4. Only after acknowledgement, create the BLS signature and release it over mTLS.

A database error, uncertain write, stale/missing/corrupt journal or conflicting
duty disables that signer instance. It never reconnects and continues signing
from uncertain state. Same-root retries are idempotent. A lost HTTP response
cannot erase protection for a signature already created.

A checksum alone cannot detect an integrity-valid offline backup rollback.
Startup therefore compares the journal with the independent witness, even when
its checksum is valid. Do not restore the witness together with validator
backups. Its independence is an operational trust assumption: simultaneous
rollback/compromise of both authorities is not solved by a local checksum or
claimed to be hardware anti-rollback. Preserve the complete history; no pruning
or new consensus/slashing rule is introduced. The existing snapshot store grows
with duty history and must be provisioned/monitored accordingly; exhaustion
fails closed rather than discarding old duties.

## Provisioning and recovery

Run `stake-signer --help` for the policy, history, key, witness and TLS flags.
Normal startup never creates history or a missing witness.

For a genuinely never-used key, explicitly run `--provision-never-used-key` with
the independent policy pin and provisioning database credential. It refuses an
existing file/witness and verifies the BLS key identity before provisioning.
The validator-side journal must likewise be provisioned explicitly using the
existing `slashing.InitializeHistory` operation for that never-used identity.

Existing keys require independently verified complete prior signing history.
Use `--import-verified-history-sha256` with its independently established
canonical snapshot digest and the existing journal. This only inserts a missing
witness; it cannot overwrite one. A digest does not establish completeness by
itself: never promote an uncertain backup as the prior signer authority.

For an offline journal rollback, or a crash after local reservation but before
the witness update, stop the signer and run `--recover-witness-history` using the
independent witness and correct policy pin. This acquires the independent key
lock, verifies and semantically replays its complete history, atomically replaces
the journal, and exits. It does not sign. Reopen normally afterwards. The witness
contains every reservation eligible to release a signature, so this operation
cannot erase a released duty. A crash after witness commit permits normal
restart and same-duty retry. For a stale validator-side journal, an authorized
operator can restore that same verified history to its separate path; the
validator process never receives witness database credentials.

If the independent witness is missing, corrupt or unavailable, remain halted.
Do not initialize a replacement for a used key, delete history, bypass the key
lock, weaken mTLS, or continue on a different signer with an empty database.
Restore only from an independently verified complete authority. Conflicting
protected duties require a safety incident investigation before restart.

## Protocol representation and qualification

Supported duties are complete proposals (`DomainBlockProposal`), full
attestations (`DomainAttestation`) and protected QC votes (`DomainQC`). QC shares
bind the existing collector's exact `QuorumCertificate.SigningDataRoot` and are
qualified by real 11-of-15 BLS aggregation and production QC verification.
Votes retain full source/target data for double-target and both surround checks,
as well as their actual signing-domain/context root. Existing recovery-record
protection remains intact. No frozen recovery message/domain exists in the
protocol types, so remote recovery signing is explicitly rejected rather than
inventing one.

The existing V1 journal schema and prior records are preserved. New typed QC /
attestation root records are validated on load; older software fails closed on
these unknown duty kinds. Do not downgrade a used signer to software that cannot
read its complete history.

The owning `stake-audit-9-1-protector.yml` workflow runs real BLS and authenticated
PostgreSQL tests, actual `stake-signer`/`fourtwentyd` subprocesses, SIGKILL at the
local-reserved, witness-committed and signature-created boundaries, offline
backup rollback and explicit recovery. Production binaries handle provisioning,
restart, safe retry, next-duty signing and conflict rejection. Only the explicit
`stake_signing_faults` qualification build contains pause hooks; production
images have none. Default builds have no signature fallback. See the 9.1
qualification record for original evidence and exact-head CI provenance.

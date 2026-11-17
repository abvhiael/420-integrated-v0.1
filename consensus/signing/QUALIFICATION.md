# STAKE-AUDIT-9.1 — Production signing-boundary closeout

Continuation baseline: main `eaf0e647530544591a0c16497d2da6b15f29d449`, after
qualified 9.2 and 9.3. Original protector candidate
`f8ee0e7e2c79b42b5b4aa8796645a51317df2634`, merged by PR #1188 as
`263dad07462cae1fef5c474d4c4c1a7dc731dfd3`, passed protector run
[44027029893](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44027029893).
That evidence covered durable local protection, not production signing or
offline rollback detection. It is retained without promoting its scope.

## Closed implementation gaps

| Previously outstanding | Implemented boundary |
| --- | --- |
| Production BLS dependency | Existing pinned blst v0.3.16/checksum retained; production binaries/images compile with blst; unavailable builds reject signing, without a substitute algorithm |
| Authenticated remote signer | Separate `stake-signer` executable; TLS 1.3, verified CA/EKU/name and peer SPKI pins; dedicated P-256 client/server credentials; typed duties only |
| Credential separation | `fourtwentyd` has only its client transport key and local history; signer alone reads the BLS key and witness credential; separate UID/volume deployment; no Wallet/owner signing endpoint |
| Production caller | `fourtwentyd --protected-signing` reserves local protection, invokes the authenticated remote signer, verifies the exact BLS key/root/signature, emits typed signed objects and halts on error |
| Durable witness acknowledgement | Logged table, fsync and full-page writes required; synchronous commit forced even if the connection defaults to asynchronous commit |
| Validator key replacement | A new BLS key cannot create an empty witness for an existing chain/genesis/validator identity |
| Offline journal rollback | Independently persisted, locked PostgreSQL witness records complete history before signature creation; startup rejects an old integrity-valid journal; explicit recovery restores verified witnessed history |
| Domain/context replay | Full vote protection additionally records the signing root, preventing the same vote data being signed under a changed QC committee context |

This closes the requested signing boundary, not autonomous proposer election,
gossip or fork choice. Consensus remains responsible for selecting/validating
duties before the signing boundary. The devnet simulator remains distinct. No
economics, finalized consensus rules, frozen addresses or new recovery-signature
domain is introduced. Unsupported recovery-signing requests fail closed; the
existing recovery-record protection remains tested.

## Actual qualification

Local execution uses Go 1.25.3, real blst and a PostgreSQL 17.12 process configured
with verified TLS and SCRAM authentication. Actual signer and consensus process
IDs, termination and state assertions are emitted by the Go qualification tests.
The final local race-enabled run passed 48 test/subtest results with zero skips;
Go vet also passed for the changed production boundary and command packages.
No testnet, live validator key or invented external authorization is claimed.

| Scenario | Asserted evidence |
| --- | --- |
| Proposal signing / same-root retry | Real BLS verification, deterministic retry, wrong-domain verification failure |
| Double proposal | Local protection rejects conflict; a fresh/copied node journal cannot bypass remote protection |
| Votes and QCs | Double target, both surround directions and changed-committee signing roots rejected; 11 protected shares assemble a production-verifiable 15-member QC; tampering rejected |
| Authentication | A certificate signed by the trusted CA but with the wrong authorized SPKI fails; remote history unchanged |
| Remote response integrity | Wrong key, root and signature rejected by the consensus client |
| Crash before witness update | Actual signer SIGKILL; no signature output; local/witness mismatch blocks startup; explicit witnessed recovery enables safe retry |
| Crash after witness commit | Actual signer SIGKILL; witnessed reservation persists; production binary safely retries and signs the next duty |
| Crash after BLS signature creation, before response | Actual signer SIGKILL; no response output; witness preserves protection; production restart retries safely |
| Offline integrity-valid rollback | Both processes stopped; old journal bytes restored; independent witness rejects startup; explicit recovery restores history and blocks conflict |
| Duplicate signer | Local file lock and independent per-key database session lock reject another instance |
| Interrupted / unavailable persistence | Canceled witness write and real file-write failure release no signature and halt the instance; missing/corrupt witness cannot initialize itself |
| Prior-history migration | Used history cannot be provisioned as fresh; verified complete-history import requires its independent digest and cannot replace an existing witness |
| Packaging / credentials | CI builds both production images and verifies actual Unix-role denial of signer-secret access, plus distinct deployment mounts |
| Default build | No production signing/verification fallback without blst |

An initial local failure correctly exposed private-directory/symlink requirements
in the fixture; fixtures now use real private canonical paths. Another local
failure exposed timing in the qualification-only stop hook; the hook now holds
its boundary until parent termination. Production code has no pause hook. These
are corrected local diagnostics, not reported as successful prior executions.

The existing 9.1 workflow is extended for exact-head qualification and retains
candidate SHA, binary hashes/build metadata, real process scenario logs, default
build evidence and credential isolation results in
`stake-audit-9-1-signing-<candidate SHA>`. The pull request qualification entry
binds the actual run/artifact IDs and final qualified SHA, avoiding a
self-referential hash in this document. Go regression coverage includes the
changed protector/BLS and their attestation/finality/certified-recovery consumers.
Unchanged Geth execution-process evidence from 9.2 is preserved, rather than
rerunning its full release gate for a signing-mode change.

## Operational authority and limits

See `consensus/signing/README.md` for policy/key provisioning, witness SQL and
role separation, required persistent directories, verified history import,
explicit recovery and halt conditions. The independent witness must live in a
separate administrative/backup domain and must not be rolled back with the
journal. This is a stated operational trust boundary, not a claim of hardware
anti-rollback if both authorities are maliciously restored together. Complete
history is retained; storage exhaustion halts signing rather than pruning safety
records. Real deployment requires independently provisioned keys, certificates,
policy pins and a secured witness service; local qualification supplies isolated
fixtures for all of those interfaces.

Historical 9.2/9.3 records that say 9.1 was open remain accurate for their original
qualified candidates. This record supersedes that status for the signing-boundary
implementation only after exact-head qualification. No subsequent roadmap work
is begun or renamed.

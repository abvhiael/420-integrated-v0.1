---
title: node420 infrastructure
component: node420
audience:
  - developer
  - operator
  - architect
category: architecture
status: development
version: current
---

# `node420` infrastructure

`node420` is the 420 Integrated execution-process wrapper and distribution boundary around the maintained, protocol-patched Geth execution client. It owns EVM execution and execution-state persistence while exposing the public Ethereum-compatible execution interfaces and the private Engine API used by `fourtwentyd`.

The wrapper deliberately keeps consensus and execution as separate processes. `fourtwentyd` decides consensus ordering/finality; `node420` executes candidate payloads and maintains canonical EVM state.

## Responsibilities

`node420` is responsible for:

- locating and verifying the required Geth binary;
- enforcing the pinned Geth compatibility baseline;
- initializing the execution datadir from the canonical execution genesis;
- launching the execution client with the expected JSON-RPC, Engine API, P2P, and synchronization configuration;
- exposing the private JWT-authenticated Engine endpoint to `fourtwentyd`;
- exposing bounded public HTTP JSON-RPC for execution clients and ecosystem tooling;
- supervising the optional 420Store provider service when explicitly enabled;
- propagating clean process termination across the execution client and optional supervised service;
- preserving the separation between execution authority and optional provider services.

`node420` does **not**:

- select proposers or validator committees;
- form attestations or QCs;
- determine consensus finality independently;
- hold validator signing authority;
- replace the 420Indexer projection layer;
- grant storage providers execution or consensus authority;
- emulate protocol system calls through ordinary user transactions or public JSON-RPC.

## Execution lineage and release compatibility

The current wrapper reports version `0.1.0-dev` and requires the go-ethereum **v1.17.5** baseline.

The execution distribution is anchored to upstream Geth commit:

`9621c6ad10934a01b5514886fb6fbd87640b6c05`

plus the maintained 420 protocol patchset.

This compatibility requirement is not cosmetic. Genesis requires the native consensus-system-call path, including `engine420_submitSystemCallsV1`, block-header commitment checks, deterministic bounded system-call execution, and state-root inclusion. Stock unpatched Geth cannot safely substitute for the qualified 420 execution build.

The wrapper performs a runtime version check by invoking `geth version` and requiring `1.17.5` in the result. Release qualification is stricter: the node420 release gate verifies the exact upstream commit, applies the maintained patchset to clean source, runs the generated `systemcall420` tests, compiles modified packages, builds the patched binary, and retains SHA-256 evidence.

## Binary discovery

`node420` locates the execution binary in this order:

1. explicit `--geth <path>`;
2. the `NODE420_GETH` environment variable;
3. `geth` discovered on `PATH`.

Failure to locate or verify the pinned binary is a startup failure. Operators must not bypass the compatibility check by substituting an arbitrary Geth build.

Useful current inspection commands include:

```sh
node420 --version
node420 --verify-geth
node420 --dry-run
```

`--dry-run` prints the Geth command line that would be launched and, when storage is enabled, the configured local storage-service information.

## Genesis initialization

The execution datadir must be initialized against the canonical 420 Integrated execution genesis before normal network operation.

The wrapper exposes:

```sh
node420 --init-genesis <genesis-file> --datadir <path>
```

which resolves to the equivalent pinned-Geth initialization flow:

```text
geth --datadir <path> init <genesis-file>
```

The default datadir is:

`./data/node420`

Genesis initialization is an identity-critical operation. Operators must verify the intended network/genesis before initialization. Re-initializing or replacing a populated datadir with a different genesis is not an ordinary configuration change.

## Default execution interfaces

The current wrapper launches Geth with the following defaults:

| Surface | Default | Role |
| --- | --- | --- |
| datadir | `./data/node420` | execution chain/state storage |
| Engine address | `127.0.0.1` | private authenticated consensus/execution control plane |
| Engine port | `8551` | Engine API |
| JWT secret | `./jwt.hex` | Engine authentication |
| HTTP JSON-RPC address | `127.0.0.1` | public/application execution API, loopback by default |
| HTTP JSON-RPC port | `8545` | execution JSON-RPC |
| HTTP API modules | `eth,net,web3` | bounded default RPC surface |
| execution P2P port | `30303` | execution peer networking |
| sync mode | `full` | canonical execution synchronization |

Additional Geth arguments may be appended after the wrapper's flags, but operators must treat overrides of identity, Engine, RPC, P2P, or state-critical settings as compatibility-sensitive.

## Public JSON-RPC boundary

The wrapper enables HTTP JSON-RPC with the default modules:

- `eth`
- `net`
- `web3`

The default bind address is loopback. Public production access should be provided through deliberate operator configuration and, where appropriate, a gateway/proxy layer rather than accidentally exposing the local process control surface.

Public JSON-RPC may be used for transaction submission, execution queries, network identity checks, and application/tooling access. It is **not** the consensus control interface.

DOC-5.5 defines the broader public RPC/gateway/ingress architecture.

## Private Engine API boundary

The Engine API is the privileged control channel between `fourtwentyd` and the execution client.

The wrapper configures:

- authenticated RPC on `127.0.0.1:8551` by default;
- JWT authentication via `--authrpc.jwtsecret`;
- `localhost` as the default authenticated-RPC vhost.

The Engine surface must remain private or equivalently protected. Exposing it as a public convenience endpoint would allow callers to reach a control plane intended only for the consensus/execution relationship.

`fourtwentyd` and `node420` must use the same valid JWT secret. A JWT mismatch is a readiness failure, not a reason to disable authentication.

## Consensus system-call execution

420 Integrated uses a protocol-level consensus-to-execution system-call mechanism that cannot be emulated through normal user transactions.

Frozen execution identities include:

- native system origin `0xfffffffffffffffffffffffffffffffffffffffe` (`params.SystemAddress`);
- `ConsensusSystemCall420` gateway predeploy at `0x000000000000000000000000000000000000043c`.

The patched execution client:

1. receives a canonical batch through authenticated `engine420_submitSystemCallsV1` staging;
2. requires execution-header `extraData` to equal the canonical SHA-256 batch root;
3. enforces the 64-call / 256 KiB batch limits;
4. executes system calls after ordinary transactions and Geth post-execution queues;
5. executes them before final execution state-root assembly;
6. uses protocol-owned gas accounting and the native system origin;
7. commits resulting state into the execution state root;
8. invalidates the candidate payload atomically if any required system call fails.

The wrapper alone cannot reproduce these semantics around an unpatched execution client.

## Execution P2P

The execution client uses Geth's execution P2P stack and defaults to port `30303`.

Execution P2P is distinct from the consensus P2P network used by `fourtwentyd`. A node may therefore have separate consensus and execution peer-health conditions.

Execution peer connectivity should be monitored independently from consensus peer connectivity and Engine health.

## Synchronization and canonical readiness

`node420` defaults to full sync. Process liveness alone is insufficient for readiness.

A production readiness decision should confirm at least:

- expected chain/genesis identity;
- qualified execution binary/patch level;
- execution datadir readable and internally valid;
- execution peer connectivity sufficient for the intended role;
- chain synchronization/freshness acceptable for the environment;
- Engine API reachable locally by `fourtwentyd`;
- JWT authentication succeeds;
- required Engine and 420-specific capabilities are available;
- canonical head/safe/finalized state can be coordinated with consensus;
- no state-recovery or corruption condition remains unresolved.

A node that answers JSON-RPC while attached to the wrong network is not ready.

## Optional 420Store supervision

`node420` can optionally supervise the execution-adjacent 420Store provider service with `--storage`.

Current configuration includes:

- canonical storage node ID;
- local capacity in bytes;
- provider HTTP listen address;
- execution JSON-RPC source;
- initial scan block;
- confirmation depth;
- synchronization interval;
- canonical storage-contract addresses for agreements, commitments, capacity, settlement, proof schemes, and object manifests.

The default provider listen address is:

`127.0.0.1:8420`

When no explicit storage RPC URL is provided, the service uses the local node420 HTTP RPC endpoint.

Provider data is stored beneath:

`<node420 datadir>/storage`

Storage-service enablement does not elevate the provider into execution authority. DOC-5.6 documents the full storage/resource boundary.

## Process supervision

When the optional storage service is disabled, `node420` runs the verified Geth process directly.

When storage is enabled, `node420` supervises both processes as one operational unit:

- if Geth exits, the storage service is cancelled and must stop;
- if the storage service exits unexpectedly, Geth is terminated rather than leaving a partially healthy combined deployment;
- on operator shutdown, both are cancelled;
- Geth receives `SIGTERM` first and is forcibly killed only if it fails to stop within the shutdown timeout;
- the current shutdown timeout is 10 seconds.

This fail-closed supervision prevents a storage-enabled deployment from advertising a combined service when one required local process has silently died.

## Startup ordering

A representative safe startup is:

1. verify expected chain/genesis/environment configuration;
2. verify the pinned/qualified Geth binary;
3. verify datadir ownership, disk capacity, and execution-state integrity;
4. verify JWT secret availability and permissions;
5. start `node420`/Geth;
6. allow execution state and peer connectivity to reach the required readiness level;
7. verify authenticated Engine connectivity/capabilities;
8. start or enable `fourtwentyd` consensus duties;
9. if configured, verify the supervised 420Store service is synchronized and healthy;
10. only then expose the node through intended public gateway/routing layers.

Consensus signing should not be resumed merely because port 8551 accepts TCP connections.

## Shutdown and maintenance

Planned maintenance should preserve the consensus/execution boundary.

A conservative sequence is:

1. remove/drain public ingress where appropriate;
2. stop validator duties or otherwise prevent unsafe consensus signing;
3. stop `fourtwentyd` cleanly and preserve consensus/slashing-protection state;
4. stop `node420` and any supervised storage service cleanly;
5. perform execution maintenance only after preserving the known finalized boundary;
6. restart execution and verify canonical compatibility;
7. re-establish Engine readiness;
8. restart consensus/signing only after the execution boundary is safe.

Destroying execution data before identifying the trusted finalized checkpoint can turn a recoverable service outage into an ambiguous recovery event.

## Failure modes

### Geth binary missing or wrong version

`node420` fails startup. Install/resolve the qualified binary rather than disabling the check.

### Genesis/datadir mismatch

Treat as a network-identity failure. Do not continue serving the datadir as if it belonged to the intended network.

### Engine authentication failure

Keep the Engine boundary closed. Reconcile JWT configuration and permissions; do not expose unauthenticated Engine access.

### Required Engine capability missing

Treat the execution client as incompatible. In particular, absence of the required 420 system-call capability prevents a production-compatible consensus/execution relationship.

### Execution P2P/sync failure

The process may remain alive but should not be considered canonically ready if it cannot maintain the required execution state.

### JSON-RPC failure

Application access may degrade while local execution/consensus state remains intact. Public gateway failure should not be interpreted as chain failure.

### Execution process crash

Consensus must not continue pretending execution payload construction/validation is healthy. Restart/recover execution first, verify the known finalized relationship, then resume normal consensus operation.

### Storage-service failure

In storage-enabled combined mode, an unexpected storage-service exit causes the supervised execution process to be stopped. Operators should diagnose the provider configuration/service before restarting the combined deployment.

### Disk or execution-state corruption

Preserve evidence and the trusted finalized checkpoint. Recover or resynchronize execution from trustworthy canonical sources. Do not mutate consensus history to make a damaged local datadir appear valid.

## Recovery order

A representative recovery sequence is:

1. identify the trusted finalized consensus checkpoint;
2. stop public ingress and validator duties if correctness is uncertain;
3. validate the expected genesis/network and qualified execution build;
4. repair/resynchronize the node420 execution datadir to a state compatible with the trusted finalized boundary;
5. restore execution P2P and synchronization;
6. restore private authenticated Engine connectivity;
7. verify required Engine/420 capabilities;
8. reconcile `head`, `safe`, and `finalized` with `fourtwentyd`;
9. restore validator duties only after signing safety and execution readiness both pass;
10. rebuild/reconcile derived services such as 420Indexer after canonical execution is healthy;
11. restore optional storage/provider service and public routing last.

## Security boundaries

Operators should keep separate:

- execution datadir permissions;
- Engine JWT secret;
- validator remote-signing credentials;
- user Wallet keys;
- RPC/gateway credentials;
- storage-provider keys/identity;
- host/cloud/SSH credentials.

Compromise of the Engine JWT is serious but must not automatically expose validator private keys or user Wallet keys.

## `node420` invariants

- **NODE-001** — `node420` must execute only on a qualified 420-compatible Geth baseline/patchset for production operation.
- **NODE-002** — execution genesis/network identity must be verified before a datadir is initialized or declared ready.
- **NODE-003** — public JSON-RPC and the private Engine API are distinct trust surfaces and must remain segregated.
- **NODE-004** — the Engine API must remain authenticated; JWT failure is a readiness failure, not permission to disable authentication.
- **NODE-005** — ordinary JSON-RPC/user transactions cannot substitute for native consensus-system-call execution.
- **NODE-006** — execution process liveness does not imply canonical synchronization or consensus compatibility.
- **NODE-007** — `fourtwentyd` must not resume normal consensus duties until required Engine capabilities and canonical execution readiness are established.
- **NODE-008** — execution P2P state and consensus P2P state are separate operational domains and must be monitored independently.
- **NODE-009** — optional 420Store/provider functionality receives no ambient execution or consensus authority.
- **NODE-010** — recovery must preserve the trusted finalized boundary rather than rewriting canonical history to match damaged local execution state.
- **NODE-011** — derived services must recover downstream of canonical node420 execution state, never the reverse.
- **NODE-012** — execution, Engine, validator-signing, user-key, provider, and operator credentials must remain separately scoped.

## Related documentation

- [Infrastructure overview](infrastructure-overview.md)
- [`fourtwentyd` infrastructure](fourtwentyd.md)
- [Execution layer](../chain/execution-layer.md)
- [Network identity and configuration](../chain/network-identity-and-configuration.md)
- [Consensus failure, recovery, and operator safety](../consensus/failure-recovery-operator-safety.md)
- `execution/README.md`
- `execution/cmd/node420/main.go`
- `docs/CONSENSUS-SYSTEM-CALL-v1.md`

---
title: Storage and Resource integration
audience:
  - developer
category: developer
status: development
version: current
---

# Storage and Resource integration

The 420 Resource Protocol coordinates provider identity, service eligibility, offers, sessions, metering, storage agreements, capacity, commitments, proofs and settlement while payload bytes remain off-chain.

The developer boundary is strict: providers perform storage/relay/cache/gateway work, but canonical authorization and economic state stay in the Resource Protocol and 420Vault.

For executable v1 examples, local/testnet setup, SDK usage, the S3 support matrix and troubleshooting, use the [420Storage Developer Hub](420storage-developer-hub.md).

## Shared Resource flow

For Relay, Cache, Gateway and metered resource use:

1. resolve a qualified provider/node and service class;
2. resolve an effective canonical offer;
3. obtain user authorization for the bounded spend/action;
4. open a session with explicit unit/spend ceilings;
5. consume the off-chain service;
6. accept cumulative metering only within the bound session;
7. settle only through canonical protocol state.

A provider's local invoice or usage counter cannot create additional spend authority.

## 420Store flow

A safe durable-storage path is:

1. resolve an effective STORE offer and qualified provider/node;
2. prepare object identity, content root, manifest hash and encryption/erasure commitments;
3. reserve canonical capacity;
4. create the immutable storage commitment and proposed agreement;
5. activate only after offer/provider/capacity/commitment/proof-scheme invariants agree;
6. upload encrypted payload/shards off-chain;
7. register compatible shard placements and seal the manifest when complete;
8. monitor current retrievability rather than assuming sealed means permanently available;
9. submit challenge-bound storage proofs through the configured verifier;
10. allow only matching proof-window evidence to release the corresponding 420Vault obligation.

## Proof semantics

An accepted storage proof establishes one verifier-approved challenge for one immutable commitment. It does not establish perpetual availability, satisfy unrelated proof windows or authorize arbitrary payment.

Proof submission is deadline-bound and replay-safe. The current protocol bounds raw proof payloads at 65,536 bytes and retains canonical proof identity/digest/receipt rather than requiring all raw proof bytes in permanent state.

## Settlement

420Vault remains the custodian. Storage settlement creates/releases/cancels bounded Vault obligations; the settlement controller does not become custody authority.

Each funded proof window ends as either PAID or REFUNDED. A missed deadline cannot later be repaired by substituting unrelated proof evidence.

## Privacy

Keep plaintext payloads, encrypted payload bytes, shard bytes, decryption keys, private application metadata, relay traffic and cache contents off-chain. Canonical state should contain only the commitments and metadata needed for identity, authorization, capacity, evidence and settlement.

## Provider failure and repair

Provider suspension blocks new work where active status is required but does not erase historical commitments. Repair/replacement must preserve object identity, old agreement/commitment/proof history and settled/refunded windows while creating new qualified provider/capacity/commitment/placement state.

Never rewrite historical commitment fields to make a replacement provider appear to have been the original provider.

## Application checks

Before presenting a storage object as healthy, distinguish at least:

- manifest completeness;
- current retrievability;
- provider/node activity;
- live agreement/commitment state;
- proof freshness;
- settlement state.

A healthy provider filesystem alone is not canonical proof of availability, and a canonical reservation alone is not proof that local bytes remain intact.

## Canonical Resource contract actions and lifecycle

The on-chain Resource component is `keccak256("420/RESOURCE/COMPONENT/V1")`. The canonical service classes remain exactly `420Relay`, `420Store`, `420Cache` and `420Gateway`; operators must not invent a fifth service class for repair or other runtime behavior.

The current core action identifiers are:

| Action | Canonical preimage | Scope |
|---|---|---|
| register provider | `420/RESOURCE/ACTION/REGISTER_PROVIDER/V1` | provider |
| update provider | `420/RESOURCE/ACTION/UPDATE_PROVIDER/V1` | provider |
| set provider state | `420/RESOURCE/ACTION/SET_PROVIDER_STATE/V1` | provider |
| register node | `420/RESOURCE/ACTION/REGISTER_NODE/V1` | provider + node |
| update node | `420/RESOURCE/ACTION/UPDATE_NODE/V1` | provider + node |
| set node state | `420/RESOURCE/ACTION/SET_NODE_STATE/V1` | provider + node |
| publish offer | `420/RESOURCE/ACTION/PUBLISH_OFFER/V1` | provider + node |
| open session | `420/RESOURCE/ACTION/OPEN_SESSION/V1` | session |
| submit receipt | `420/RESOURCE/ACTION/SUBMIT_RECEIPT/V1` | provider + node |
| settle | `420/RESOURCE/ACTION/SETTLE/V1` | session, with amount bound |

Storage-specific capability preimages currently include `420/STORAGE/ACTION/CONFIGURE_CAPACITY/V1`, `420/STORAGE/ACTION/RESERVE_CAPACITY/V1`, `420/STORAGE/ACTION/REGISTER_PROOF_SCHEME/V1`, `420/STORAGE/ACTION/SET_PROOF_SCHEME_STATE/V1`, `420/STORAGE/ACTION/REGISTER_STORAGE_COMMITMENT/V1` and `420/STORAGE/ACTION/ACCEPT_STORAGE_AGREEMENT/V1`.

### Provider and node states

Provider state is `NONE -> REGISTERED -> ACTIVE|RETIRED`; an ACTIVE provider may move to `SUSPENDED|RETIRED`, and a SUSPENDED provider may return to `ACTIVE` or move to `RETIRED`. Activation requires a nonzero staking reference. Provider metadata/stake-reference mutation is rejected while ACTIVE or RETIRED. Successful mutation increments revision and emits `ProviderUpdated`; state changes emit `ProviderStateChanged`.

Node state follows the same `NONE/REGISTERED/ACTIVE/SUSPENDED/RETIRED` shape. A node may become ACTIVE only while its parent provider is active. Endpoint/capacity metadata may be changed only while the node is neither ACTIVE nor RETIRED. The exact node operator, parent-provider operator or an exact node-scoped `ACTION_UPDATE_NODE` capability may perform that update. Successful mutation increments revision and emits `NodeUpdated`; state changes emit `NodeStateChanged`.

### Offers, sessions and receipts

Offer publication emits `OfferPublished` and is immutable in the current contract. An offer is valid only for an active node/service policy, cannot exceed the governance service `maxUnits`, snapshots price/unit cap/terms/expiry, and becomes ineffective if its node/provider/policy is no longer effective.

A Resource session is `NONE -> OPEN -> CLOSED -> SETTLED` or `NONE -> OPEN -> CANCELLED`. Only the consumer may close or cancel an OPEN session. Opening rejects units above either the offer or governance service ceiling and rejects an expiry beyond `maxSessionSeconds`. `SessionOpened`, `SessionClosed`, `SessionCancelled` and `SessionSettled` provide the canonical transition provenance. Settlement requires exact session-scoped `ACTION_SETTLE` authority and cannot exceed `maxSpend420`.

Metering receipts emit `ReceiptSubmitted`. Receipt identity is domain-separated by chain ID, receipt-registry address, session, cumulative units and usage hash. Cumulative units must be nonzero, strictly advance from the last accepted value and remain within the session cap. Submission is allowed only to the exact node operator or an exact node-scoped `ACTION_SUBMIT_RECEIPT` delegate while the session remains open and unexpired.

### Storage lifecycle states

Storage agreements are `NONE -> PROPOSED -> ACTIVE -> COMPLETED`, with cancellation available according to the agreement contract's guarded lifecycle. Storage settlements are `NONE -> OPEN -> FUNDED -> COMPLETE` or enter `ABORTING` before terminal `CANCELLED`. Storage proof, capacity, commitment, manifest and settlement events are the canonical provenance for derived/indexed views; provider-local files, invoices or counters are never canonical substitutes.

## Genesis descriptor status semantics

`contracts/config/420resource-genesis.json` currently uses `"status": "IMPLEMENTATION_QUALIFICATION"`. Repository review for RESOURCE-AUDIT-7 found that this value is also retained by other current genesis descriptors and that the repository does not define a single authoritative migration enum that would permit replacing it with `COMPLETE_REPOSITORY_SCOPE`, `TESTNET_READY`, `GENESIS_READY` or another invented value.

For Resource, interpret `IMPLEMENTATION_QUALIFICATION` narrowly: the descriptor belongs to the implementation/qualification lifecycle and does **not** assert a deployed target network, ProtocolRegistry publication, Genesis acceptance or production readiness. The durable Resource audit roadmap and exact-head qualification evidence are authoritative for the finer-grained repository state. The descriptor status must not be promoted until a repository-wide genesis-config status vocabulary/migration rule is established and the corresponding deployment evidence exists.

This preserves the existing schema rather than silently changing lifecycle meaning during an app-specific audit.

## Deterministic deployment and verification instructions

These instructions define the operator/developer contract for deployment. They do not replace the versioned deployment package required by RESOURCE-AUDIT-8 and do not allocate a fixed Resource predeploy.

### Required external bindings

Before materializing the Resource graph, identify and record:

- exact chain ID and target-network/genesis identity;
- qualified `CapabilityRegistry420` address for Resource authorization;
- qualified governance timelock address for `ResourcePolicyRegistry420`;
- qualified 420Vault address(es) and asset binding used when Storage settlements are opened;
- exact source/implementation commit, Solidity/compiler version and build profile.

Do not substitute EOAs for canonical governance/capability dependencies merely to make deployment succeed.

### Canonical constructor order

Deploy in dependency order and retain every address and constructor argument:

1. `ResourceAuthorization420(capabilityRegistry)`
2. `ResourcePolicyRegistry420(governanceTimelock)`
3. `ResourceProviderRegistry420(resourceAuthorization)`
4. `ResourceNodeRegistry420(resourceAuthorization, resourceProviderRegistry)`
5. `ResourceOfferRegistry420(resourceNodeRegistry, resourceProviderRegistry, resourcePolicyRegistry, resourceAuthorization)`
6. `ResourceSessionRegistry420(resourceOfferRegistry, resourceAuthorization)`
7. `ResourceReceiptRegistry420(resourceSessionRegistry, resourceOfferRegistry, resourceNodeRegistry)`
8. `ResourceRouter420(resourcePolicyRegistry, resourceNodeRegistry, resourceOfferRegistry)`
9. `StorageProofSchemeRegistry420(resourceAuthorization)`
10. `StorageCapacityRegistry420(resourceAuthorization, resourceNodeRegistry, resourceProviderRegistry)`
11. `StorageCommitmentRegistry420(resourceAuthorization, resourceProviderRegistry, resourceNodeRegistry, storageProofSchemeRegistry)`
12. `StorageProofRegistry420(storageCommitmentRegistry, storageProofSchemeRegistry, resourceNodeRegistry)`
13. `StorageAgreementRegistry420(resourceAuthorization, resourceOfferRegistry, resourceNodeRegistry, resourceProviderRegistry, storageProofSchemeRegistry, storageCommitmentRegistry, storageCapacityRegistry)`
14. `StorageObjectManifestRegistry420(storageAgreementRegistry, storageCommitmentRegistry)`
15. `StorageSettlementRegistry420(storageAgreementRegistry, storageProofRegistry)`

A settlement's Vault and asset are supplied when `openSettlement(agreementId, vault, asset)` is called; they are not constructor dependencies of `StorageSettlementRegistry420`.

### Artifact and runtime verification

For every deployed contract, the deployment record must include the exact artifact name, compiler/build settings, constructor arguments, transaction hash, deployed address and expected runtime bytecode hash. After deployment:

1. call `eth_getCode` at every recorded address;
2. reject empty code;
3. hash the returned runtime bytecode and compare it to the expected qualified artifact/runtime commitment;
4. query immutable/public dependency getters and verify every constructor binding against the deployment manifest;
5. verify `systemName()` and `protocolVersion()` for each I420System contract where exposed;
6. retain machine-readable results rather than screenshots alone.

A source build passing CI is not evidence that a target address contains that build.

### ProtocolRegistry publication

Resource uses the registry-resolved/no-fixed-Genesis-address model. Do not add a new frozen predeploy address. Registry publication must happen only after codehash and constructor-binding verification and must use the exact service key, version, interface and dependency metadata defined by the versioned RESOURCE-AUDIT-8 deployment package. Operators must not guess or locally invent Registry identifiers.

Publication evidence must record the authorized publisher, transaction/block identity, published address/version metadata and a read-back proving the Registry resolves to the verified deployed graph.

### Operator activation sequence

After deployment verification, operators should:

1. configure governance-owned service policies for the four canonical service classes;
2. register/activate approved Storage proof schemes where needed;
3. register providers with nonzero staking references before activation;
4. register service-bound nodes and activate them only after the parent provider is active;
5. configure STORE capacity before accepting storage work;
6. publish bounded offers;
7. exercise a minimal provider/node/offer/session/receipt smoke path;
8. exercise STORE capacity/commitment/proof/agreement/manifest/settlement flows against the verified Vault binding;
9. test capability grant and revocation behavior;
10. retain all deployment and smoke evidence for RESOURCE-AUDIT-9.

Do not treat repository simulation or local Anvil execution as production-equivalent testnet evidence.

### Recovery and rollback boundary

Resource contracts are registry-resolved rather than fixed predeploys. A failed deployment must not be papered over by mutating historical evidence or reusing an address with a mismatched codehash. Preserve the failed deployment record, deploy a newly qualified graph, re-run exact verification, and update Registry publication only through the authorized governance/publication process. Historical sessions, receipts, storage commitments, proofs, agreements, manifests and settlements remain historical records and must not be rewritten to make a replacement deployment appear continuous.

## Related architecture

- [420Storage Developer Hub](420storage-developer-hub.md)
- [420Storage production topology qualification](420storage-production-topology.md)
- [420Storage adversarial and fault-injection qualification](420storage-fault-injection.md)
- [420Storage load and capacity qualification](420storage-load-capacity-qualification.md)
- [420Storage upgrade and compatibility qualification](420storage-upgrade-compatibility.md)
- [420Storage credential rotation and recovery qualification](420storage-credential-rotation.md)
- [420Storage backup, restore and disaster recovery qualification](420storage-disaster-recovery.md)
- [420Storage security and abuse-resistance qualification](420storage-security-abuse-review.md)
- [420Storage operator runbooks, alerts and SLO qualification](420storage-operator-slos.md)
- [420Storage testnet deployment evidence](420storage-testnet-evidence.md)
- [420Storage production launch closeout](420storage-production-launch-closeout.md)
- [Storage Proof and Resource Protocol](../architecture/protocols/storage-proof-resource-protocol.md)
- [Storage and Resource infrastructure](../architecture/infrastructure/storage-resource-infrastructure.md)
- [Provider-backed integration model](provider-backed-integrations.md)

# End-to-end dApp integration

This guide ties the current Developer Hub phases together into one production-oriented dApp workflow while keeping each subsystem's authority separate.

## Goal

Build a dApp that can discover a network, read protocol state, render indexed UX, submit wallet-authorized writes, deploy and verify app contracts, and register/publish through 420Registry and 420AppStore without turning Developer Hub into a privileged control plane.

## 1. Bootstrap network and contracts

Start with explicit network discovery and canonical catalogue resolution.

```text
420 network
420 contract <ContractName>
420 service indexer
420 service verify
```

Initialize the shared SDK only after chain ID, RPC and contract metadata are validated.

## 2. Build the read model

Use canonical RPC for security-sensitive state and 420Indexer for fast read models such as:

- recent activity;
- searchable transactions/logs;
- protocol event feeds;
- projected object state;
- explorer-style navigation.

```text
420 indexer diagnostics
```

Always preserve source provenance in the UI or developer model when displaying indexed projections.

## 3. Route writes through Wallet

Application code may prepare calldata and human-readable intent. Any authorization, signing or account-capability decision belongs to 420 Wallet/Smart Account runtime.

Never add a fallback path that accepts a raw private key because a wallet connection is unavailable.

Confirm submitted transaction state from canonical RPC before treating the operation as final.

## 4. Deploy application contracts when needed

Use the DEVHUB-9 deployment planner:

```text
420 deploy plan deploy.json
420 deploy view deploy.json
```

Preserve artifact provenance and hand execution to the declared external signer. Confirm receipt and deployed runtime code from canonical RPC.

## 5. Publish reproducible verification evidence

For deployed app contracts, build DEVHUB-10 evidence and submit it to 420Verify:

```text
420 verify plan verify.json
420 verify view verify.json
```

Keep the meanings separate:

- deployed code comes from chain state;
- verification classification comes from 420Verify;
- official ecosystem registration comes from 420Registry;
- AppStore listing is a non-canonical catalogue projection;
- wallet authorization comes from Wallet/Smart Account authority.

## 6. Register and publish the application

DEVHUB-13 validates the application release and prepares the canonical Registry governance handoff:

```text
420 app plan app-release.json
420 app view app-release.json
```

Before Registry submission, confirm from canonical sources:

1. release chain ID matches the selected network;
2. implementation code exists at the declared address;
3. deployed runtime code hash matches the release evidence;
4. the service ID is Genesis-canonical or already approved by 420Registry;
5. Registry `currentVersion(serviceId) + 1` equals the proposed version;
6. Registry governance authorization is available.

The resulting `publishRegisteredService` call remains governance-only. Developer Hub cannot sign or bypass that authority.

After Registry confirmation, 420AppStore may project the application into discovery/catalogue UX. Categories, descriptions, rankings, screenshots and featured placement remain non-canonical and cannot create or revoke Registry legitimacy.

## 7. Operational diagnostics

Before blaming application logic, inspect:

- selected network/chain ID;
- RPC availability;
- canonical contract catalogue entries;
- Indexer health/readiness/status;
- 420Verify service availability when verification is needed;
- Wallet chain/account/capability state for writes;
- Registry service-ID approval and current version before application publication.

## End-to-end authority map

| Concern | Owning authority |
| --- | --- |
| Network identity | selected canonical manifest + chain ID |
| Contract identity/interface | canonical contract catalogue / Registry source |
| Chain state | 420 chain RPC / owning protocol contract |
| Search/history/projections | 420Indexer, non-canonical |
| User/account authorization | 420 Wallet / Smart Account |
| Deployment signature | Wallet or qualified project adapter |
| Deployed bytecode | canonical chain state |
| Source/build verification | 420Verify |
| App registration/version legitimacy | 420Registry / ProtocolRegistry governance + chain state |
| AppStore catalogue presentation | 420AppStore, non-canonical |
| Developer orchestration | Developer Hub, non-authoritative |

## Safe design rule

Every time an application crosses from reading to authorizing, signing, settling, registering or governing, identify the owning canonical authority explicitly. Developer Hub may make that handoff easy; it must never erase it.

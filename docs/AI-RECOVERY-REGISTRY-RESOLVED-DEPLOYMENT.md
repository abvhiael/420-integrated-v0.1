# AI-RECOVERY: registry-resolved application deployment and publication

Status: IMPLEMENTATION PLAN; NOT DEPLOYED, NOT REGISTERED, NOT QUALIFIED. Applies to reconciliation working branch only.

## Existing source of truth

- `contracts/config/system-addresses.json` and `config/system-addresses.json` freeze the Step 6.2 predeploy assignments, including AIProviderRegistry 0x042f, AIModelRegistry 0x0430, AIJobManager 0x0431, AIJobEscrow 0x0432, AIReputationRegistry 0x0433 and ProtocolRegistry 0x0434. No application deployment may reuse these addresses. Keep the physical deployment manifest and predeploy plan aligned with this map.
- `contracts/src/apps/ProtocolRegistry.sol` is the discovery/version authority; its `publishRegisteredService` requires an authorized governance caller, existing code at the implementation address, and a committed registration profile. It records the runtime `extcodehash`. The registry does NOT grant execution, custody, Vault permission, upgrade, or user consent.
- `contracts/config/genesis-canonical-addresses.json` currently has overlapping application anchors and must be reconciled as a distinct tracked change. A documentation plan or a publication transaction cannot make that conflicting configuration valid. The main-branch canonical address policy, including its Names reservation, must not be silently overwritten.

## Implementation sequence

1. Inventory each application that claims an occupied 0x0420–0x043c slot. Classify its actual contract and system-address dependency. Never relocate the existing frozen predeploy owner to accommodate a later application. A contract explicitly required by the frozen system map remains a predeploy, not a registry-resolved replacement.
2. For a non-predeploy application contract, remove the conflicting fixed `address` assertion from canonical application-anchor declarations; declare it registry-resolved by exact Solidity contract name and approved service ID. Preserve the unmodified frozen predeploy map and required main-branch policy fields. Confirm its ABI/interface version, constructor dependencies and deployment authorization. No placeholder `0x` address may be marked canonical.
3. Obtain an approved network, chain ID, RPC/finality policy, signer and governance authorization. Deploy the actual application bytecode by an ordinary deployment transaction to an address outside every frozen, reserved and already deployed address. Confirm finalized creation receipt, on-chain runtime code, exact runtime code hash, constructor args, proxy implementation/admin if any, and versioned source/build provenance. Never assign a proposed address before observing its real deployment.
4. Resolve the canonical ProtocolRegistry 0x0434 on that specific chain and verify its runtime identity against a pinned manifest. Determine the established service ID from `ServiceIds420.sol` or obtain governance approval for an extension ID and descriptor hash. Using authorized governance, call `publishRegisteredService(serviceId, actualDeployment, metadataHash, nextVersion, active, componentType, manifestHash, dependencyRoot, interfaceHash)`; the manifest/interface hashes must be nonzero. Do not grant Vault/custody permissions through service publication.
5. Independently read back `getService`, `getRegistrationProfile`, `resolveActive`, codehash, chain ID and finalized publication receipt; check version increments, service identity, correct implementation and no stale/reorged result. Pin these as network-scoped evidence. Clients must fail closed on missing/inactive/wrong-chain/codehash-mismatched entries; only render features whose separate security and release gates have passed.
6. Update the generated application catalog, Developer Hub discovery and web runtime manifest with verified registry lookup references, not unverified fixed addresses. Keep `ai/web` writes and paid settlement disabled pending AI-RECOVERY qualification. Run Genesis collision checks and all required main-branch 16-shard Solidity, AI provider, API, web and repository tests on the eventual combined commit.

## Evidence required before claiming completion

For each application: name, source/build SHA, chain ID, original conflicting address and frozen owner, final deployment transaction/receipt, actual address, runtime/proxy hashes, registry service ID, governance publication transaction/receipt, version/profile/readback, security review, and CI workflow/commit references. All deployment and registration fields are NOT YET AVAILABLE until independently observed on an approved network.

## Stop conditions

Stop rather than deploy when the intended contract is a frozen predeploy, the address map or Names policy is unresolved, existing deployment identity cannot be verified, governance authorization is absent, the proposed address is merely guessed, or registry publication would implicitly enable money movement. Reconcile the canonical manifest and its validator before declaring integration ready.

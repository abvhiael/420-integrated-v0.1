# 420AI deployment and Genesis materialization — AI-AUDIT-9

## Scope

AI-AUDIT-9 prepares and qualifies the repository-side deployment topology for the frozen 420AI V1 architecture. It **does not claim a live production-equivalent testnet deployment**. Live chain addresses for Registry-resolved modules, transaction hashes, evidence blocks, public DNS/API endpoints and real-provider execution belong to AI-AUDIT-11.

## Address authority

The five legacy compatibility identities remain fixed Genesis predeploys and must never move or be repurposed:

- AIProviderRegistry — `0x000000000000000000000000000000000000042f`
- AIModelRegistry — `0x0000000000000000000000000000000000000430`
- AIJobManager — `0x0000000000000000000000000000000000000431`
- AIJobEscrow — `0x0000000000000000000000000000000000000432`
- AIReputationRegistry — `0x0000000000000000000000000000000000000433`

ProtocolRegistry remains frozen at `0x0000000000000000000000000000000000000434`.

The mature V1 modules remain Registry-resolved and receive **no implied fixed address**:

- AIAuthorization420
- AIPolicyRegistry420
- AIModelDeploymentRegistry420
- AIRequestRegistry420
- AIResultRegistry420
- AIComputeAdapter420
- AIRouter420

The machine-readable deployment package is `contracts/config/ai/ai-audit-9-deployment-package.json`.

## Canonical component IDs

AI-AUDIT-9 freezes explicit ProtocolRegistry component-ID preimages under `420/component/ai/.../v1` in `AIIds420.sol` for the five frozen compatibility components and the seven Registry-resolved V1 modules. The public AI service remains the canonical Genesis service ID `420/service/ai/v1`.

## Repository materialization sequence

1. Materialize the exact compiled runtime of each frozen AI compatibility contract at its fixed Genesis address with GovernanceTimelock `0x0429` embedded as the immutable governance authority.
2. Verify each frozen runtime has code and reports the frozen governance timelock.
3. Deploy AIAuthorization420 against the canonical CapabilityRegistry.
4. Deploy AIPolicyRegistry420 against GovernanceTimelock.
5. Deploy AIModelDeploymentRegistry420 against AIAuthorization420 plus the frozen provider/model registries.
6. Deploy AIRequestRegistry420 and AIResultRegistry420 against the frozen AIJobManager.
7. Deploy AIComputeAdapter420 against the frozen AIJobManager/provider/model registries, the canonical ComputeRouter graph and the deployment registry.
8. Deploy AIRouter420 against the complete AI V1 graph.
9. Register all twelve AI component identities in ProtocolRegistry as `SUSPENDED` and verify the stored runtime code hash equals `EXTCODEHASH`.
10. Apply one-shot bindings:
   - AIJobManager -> AIComputeAdapter420
   - AIJobEscrow -> canonical CMP funding adapter
   - AIJobEscrow -> canonical CMP settlement adapter
   - AIReputationRegistry -> canonical Trust adapter
11. Verify the bindings and that no non-governance caller can rewrite them.
12. Activate the twelve component identities.
13. Publish `420/service/ai/v1` through `publishRegisteredService` with AIRouter420 as implementation and nonzero manifest, dependency-root and interface commitments.
14. Verify service resolution, component version support and runtime-code-hash identity.

## Runtime-code-hash and receipt evidence

`contracts/test/AIDeploymentMaterialization420.t.sol` is the deterministic local deployment receipt. It emits the runtime code hash for every frozen AI predeploy and every Registry-resolved module, plus the AI dependency root, manifest hash and interface hash. The AI-AUDIT-9 qualification record must bind those values to one exact implementation SHA.

Local Foundry deployment addresses for Registry-resolved modules are ephemeral test evidence only and must not be copied into public manifests as production addresses.

## Governance/admin handoff

There is no deployer-owner fallback. Governance-only mutable bindings remain behind the frozen GovernanceTimelock. The deployment smoke proves an unrelated EOA cannot rebind AIJobManager after the canonical adapter is bound. One-shot binding guards additionally prevent replacement of the compute, Vault/settlement and Trust adapters.

## Smoke tests

Repository qualification must prove:

- frozen predeploy runtime placement at 0x042f–0x0433;
- frozen GovernanceTimelock identity in those runtimes;
- construction of the full Registry-resolved V1 graph;
- SUSPENDED-before-wiring publication discipline;
- exact runtime-code-hash recording by ProtocolRegistry;
- one-shot dependency binding;
- ACTIVE component resolution only after wiring;
- canonical AI service publication to AIRouter420;
- governance bypass rejection.

## Monitoring

Monitor ProtocolRegistry AI lifecycle/runtime-hash drift, AI one-shot bindings, ComputeMarket component graph identity, Indexer AI descriptor/reorg/replay health, provider-runtime health/redaction, and browser network/read-API configuration.

## Rollback and recovery

A Registry-resolved bad candidate is suspended/deprecated and replaced by a newly qualified deployment; bytecode is never mutated. Frozen predeploy addresses are never moved or repurposed. Recovery must not manufacture settlement/refund/dispute state or rewrite canonical CMP/Vault history.

## DNS/API dependencies

The browser remains fail-closed until a real network manifest, read API origin and supported chain configuration exist. Public DNS, TLS, API origin and provider endpoint evidence are live operational evidence and therefore remain unset here. They are verified during AI-AUDIT-11/12, not invented during repository materialization.

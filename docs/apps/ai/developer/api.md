# 420 AI API and provider boundary

420AI read access is exposed through the shared **420Indexer v1** API. These responses are rebuildable projections and always carry `authoritative: false`; protocol authorization, funding, verification, settlement and dispute outcomes remain canonical on-chain state.

## AI-AUDIT-7 read routes

| Method | Route | Paged | Projection |
| --- | --- | --- | --- |
| GET | `/v1/ai/providers?chainId=` | yes | AI provider identity, settlement/stake/CMP provider refs and state |
| GET | `/v1/ai/providers/:providerId?chainId=` | no | one provider |
| GET | `/v1/ai/models?chainId=` | yes | models |
| GET | `/v1/ai/models/:modelId?chainId=` | no | one model |
| GET | `/v1/ai/model-versions?chainId=` | yes | model versions and deprecation state |
| GET | `/v1/ai/model-versions/:modelVersionId?chainId=` | no | one model version |
| GET | `/v1/ai/deployments?chainId=` | yes | provider/model/CMP-offer deployment binding |
| GET | `/v1/ai/deployments/:deploymentId?chainId=` | no | one deployment |
| GET | `/v1/ai/jobs?chainId=` | yes | AI job + CMP correlation + escrow/settlement evidence |
| GET | `/v1/ai/jobs/:jobId?chainId=` | no | one job |
| GET | `/v1/ai/policies?chainId=` | yes | policy revisions projected from public events |
| GET | `/v1/ai/policies/:policyId?chainId=` | no | one policy projection |
| GET | `/v1/ai/reputation?chainId=` | yes | Trust-applied provider evidence counters |
| GET | `/v1/ai/reputation/:providerId?chainId=` | no | one provider's evidence counters |

Collection routes use the shared opaque cursor contract and bounded `limit` (1–200), with `direction=asc|desc`.

Every AI projection uses schema identifier `420-ai-read-v1` and is chain scoped. Deployments may configure `aiExpectedChainId`; a mismatched requested network fails closed.

## Canonical source and rebuild behavior

AI descriptors cover current events from `AIProviderRegistry`, `AIModelRegistry`, `AIModelDeploymentRegistry420`, `AIJobManager`, `AIJobEscrow` and `AIPolicyRegistry420`. Deployment addresses remain Registry/deployment-resolved rather than hardcoded by the read model.

The AI read layer reconstructs current state from the canonical `idx_protocol_events` journal in ascending block/transaction/log order. The shared indexer ingestion layer owns canonical block history, reorg detection, rollback and replay; deleting rolled-back protocol events and replaying the canonical branch deterministically rebuilds the AI state.

Job projections preserve `computeRequestId`, `computeJobId` and CMP provider references but do not become a second ComputeMarket authority.

## Private data boundary

AI descriptors and DTOs contain only IDs, addresses, numeric lifecycle/economic fields, hashes/commitments and nonsecret provenance. The read model rejects event payloads containing plaintext/private-field classes such as payloads, prompts, documents, datasets, tokens, secrets, credentials, private/API keys or raw input/output byte fields.

Private prompts, documents, datasets, access material, raw model inputs and raw model outputs must never be written to public indexer projections.

Off-chain provider endpoints may handle encrypted payload delivery and worker operations, but they are not canonical authorization.

Policy event projections intentionally leave `privacyPolicyId` and `servicePricingPolicyId` null because the current `PolicyConfigured` event does not emit those values. The indexer does not invent or infer them. Canonical current-state enrichment can use `AIPolicyRegistry420.getPolicy` once deployment/Registry addresses are materialized in AI-AUDIT-9.

AI reputation reads expose only Trust-applied evidence counters and latest evidence/outcome references. They do not synthesize a universal reputation score.

<!-- AI-AUDIT-7 qualification trigger: no behavioral change -->


## Browser client

The production browser client source is `ai/web`. It consumes this read API only for non-authoritative discovery and lifecycle display, while requester-authorized mutations are sent directly through the user's injected EIP-1193 wallet to the canonical `AIJobManager`.

Private input plaintext is reduced locally to a bytes32 commitment before request calldata is produced. The browser does not persist private input to runtime configuration or public indexed storage. Funding is display-only because direct AI escrow custody is deliberately disabled; canonical funding arrives through the Vault/settlement adapter path.

The committed `runtime-config.json` is intentionally unresolved/fail-closed until AI-AUDIT-9 deployment materialization.

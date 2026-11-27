# A3 canonical identifiers and grant migration

Baseline: 35c54a93edfa0b7ed35477f2bee06edae366d859. A3 does not close A2–A14 or assert live deployment.

CapabilityRegistry component: keccak256("420/RESOURCE/COMPONENT/V1"). ProtocolRegistry service: keccak256("420/service/resource-protocol/v1"). Register the former through the verified CapabilityRegistry component registrar with the approved authority; publish the latter through ProtocolRegistry. Do not substitute the router or service identity for capability authority. The four service-class IDs and three proof-class IDs remain distinct. The unused OPEN_SESSION capability is retired; canonical opening is consumer-only.

Canonical scopes use Ethereum Keccak-256 of Solidity abi.encode(string, bytes32...) with the exact domain strings in ResourceAuthorization420. Provider and session previously used abi.encode(id); node used abi.encode(providerId,nodeId). Proof-scheme derivation is unchanged. No fallback is permitted. Generate proposed component/action/scope triples with scripts/resource-capability-grant.py (Foundry cast required); the script cannot sign or submit transactions.

## Migration gate
1. Freeze delegated admission and grant issuance during cutover; inventory active grants from CapabilityGranted/CapabilityRevoked events and reconcile activeGrantId/grant on the exact chain and registry. Record principal, component, action, scope, validity, limits, usage and original grant ID. Resolve original typed IDs from authoritative registry state, never guess from a hash.
2. Verify the canonical component authority and registrar; reject any service ID used as capability component. Check current source action allowlists and ownership/lifecycle policy. Discard unsupported OPEN_SESSION grants.
3. Revoke old provider/node/session grants through the registered authority and verify receipts. Review unchanged proof-scheme grants individually. Never renew expired, revoked, unknown or ambiguous grants.
4. Deploy the qualified dependency graph under the approved migration plan. Do not mutate frozen predeploys, rewrite historical state or leave old endpoints authoritative. Verify code hashes, bindings and publication; preserve historical sessions and obligations.
5. Generate new grants with new unique grant IDs and reviewed exact domain scopes. Preserve or tighten original remaining validity and limits. Never reset usage budgets through migration; if remaining allowance cannot be faithfully represented, revoke and require new explicit authorization. Verify registry reads and negative old-scope/cross-domain checks before enabling delegated access.
6. Retain chain/block identity, grant/revocation receipts, old/new mapping, budget reconciliation and deployment evidence. Fail closed on incomplete inventory or verification. Live receipts remain required in Resource Audit 9; local CI is not live migration evidence.

Qualification: the A1 source inventory gate checks exact adapter action sets; ResourceIdentifierDomains420 exercises all 15 actions plus retired and unknown actions against every scope using real CapabilityRegistry grants, including legacy and wrong component. The deployment generator emits deterministic ABI-derived vectors for independent SDK consumption. No security gates are waived.

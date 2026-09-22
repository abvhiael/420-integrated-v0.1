# CMP-1.5 — ComputeMarket foundation qualification and scope closeout

Status: **IN PROGRESS / FOUNDATION NOT CLOSED / NO PRODUCTION RELEASE**. This record concerns only the CMP-1.1–1.4 contracts in draft PR #369. It does not supersede the frozen V1 architecture or CMP-0.12 operational gate register. A repository workflow green is not proof of funded execution, live provider eligibility, verified hardware, deployment, or authorization of a future matching contract.

## Baseline and evidence rules

- CMP-0 specification is merged at `3d4bc0e047a8a6f2fe2661b1ba78b9ea4c2551bc`. At CMP-1.5 intake, current `main` was `091759183d01ae22fabc279163f68a3e4f39157b`; CMP branch was 53 commits behind. Comparing CMP-0 merge base to this `main` showed unrelated GEN-SVC-2 documentation, publisher, deployment and location-service additions; **the CMP branch has NOT been reconciled with this newer main**. Refresh this statement against the then-current `main` before final qualification.
- Baseline CMP-1.4 branch head `2a4a09a63733842a5c552696f3c4b393554c0ad6` passed [Solidity Contracts #3037](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35679122993), [420Docs #2688](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35679122999) and [420 Integrated #5304](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/35679123000). This qualifies that historical head only.
- CMP-1.5 found a false-positive pattern in `contracts/test/ComputeIds420.t.sol`: `try this.derive(...) returns (...) { revert("accepted"); } catch {}` caught the test's own assertion, potentially recording PASS when malformed inputs were accepted. Commit `075dbe0b69ba68eca67c607a597d3269aa93dd07` changes every negative ID case to inspect the target `staticcall` failure and exact `InvalidComputeIdentity` selector. **Qualification for that changed head is pending**; do not inherit the earlier green result.
- Each qualifying assertion needs an immutable source SHA, test path, invocation, positive/negative case, successful exact-head run and (for live claims) verified deployment and transaction evidence. Missing execution is `NOT RUN`.

## Foundation source / test evidence at intake

| Surface | Implemented source | Dedicated test | What it currently proves / does not prove |
| --- | --- | --- | --- |
| Typed work unit and attempt IDs | `contracts/src/compute/ComputeIds420.sol` | `contracts/test/ComputeIds420.t.sol` | Pure standard-ABI domain-separated derivation, retry distinction and shape checks. No authoritative nonce allocation, independently pinned binary fixture, registry lookup or off-chain parity. |
| Object-scoped capability query | `contracts/src/compute/ComputeAuthorization420.sol` | `contracts/test/ComputeAuthorization420.t.sol` | Shared CapabilityRegistry *read-only* scope/action query and deny cases. No on-mutation grant consumption, verified EIP-712/1271 signer, or capability enforcement by provider/node/resource mutations. |
| Policy revisions | `contracts/src/compute/ComputePolicyRegistry420.sol` | `contracts/test/ComputePolicyRegistry420.t.sol` | Immutable history, governance publication, bounded new-admission gate and exact digest. No typed interpretation, verifier execution, signed acceptance or accepted-match snapshots. |
| Provider/node/resource identity | `contracts/src/compute/ComputeProviderRegistry420.sol`, `ComputeNodeRegistry420.sol`, `ComputeResourceRegistry420.sol` | `contracts/test/ComputeIdentityRegistries420.t.sol` | Distinct chain/registry-scoped IDs, immutable parentage, current and past revisions, operator checks, administrative suspension, retirement and ancestor/expiry gating. Registration is self-asserted; governance activation is not independent stake/security verification. Node key signatures, scoped mutation grants, hardware provenance, actual capacity reservations and paid matching are not implemented. |

## Gate disposition (CMP-0.12 is normative)

- **Q01 BLOCKED:** no authorized deployed/codehash-verified CMP ProtocolRegistry entries or published deployed addresses; no fixed Genesis predeploy may be introduced. Do not confuse candidate address with active registry authority.
- **Q02 PARTIAL / BLOCKED:** Solidity ID shape, domain, ordering and negative cases exist, but independently generated versioned *expected hex/ABI bytes* and Go/TypeScript parity for IDs and EIP-712 manifests/receipts are missing. Independent parity must not be claimed from two languages calling the same unverified fixture producer.
- **Q03 PARTIAL / BLOCKED:** baseline provider/node/resource parentage and read-only capability queries exist. Mutation-time scoped grants, signed delegate/node enrollment, verified stake/security policy, external attestation, replay/expiry defense and match acceptance are missing.
- **Q04–Q08 BLOCKED:** no actual funded accepted job, isolated worker, objective verifier, payer-isolated Vault, independently authorized dispute and stake lifecycle, SDK/UI or bounded 420AI adapter are evidenced.
- **Q09 PARTIAL / BLOCKED:** initial isolated contract tests exist, but the full frozen CMP-INV-001–030 positive/adversarial executable map, property/fuzz and integration tests do not. A unit test of identity cannot prove beneficiary immutability or at-most-once economic entitlement in an absent matching/Vault implementation.
- **Q10 BLOCKED:** branch not reconciled with latest main; independently required executable consumers, application gates, deployment and funded-chain proof absent; final exact-head source/Docs/Integrated gates not yet executed.

## Invariant attribution; never promote partial coverage to full invariant PASS

- CMP-INV-002/003/004: isolated ID separation and parentage assertions in `ComputeIdentityRegistries420.t.sol`; no cross-object global allocator or completed match/offer/job identity proof. Partial only.
- CMP-INV-005: read-only action allowlist in `ComputeAuthorization420.sol` cannot grant Vault/bridge/governance by itself; missing mutation-authority integration proof. Partial only.
- CMP-INV-017/020/028/029: policy and registry revision/suspension tests prove narrow historical record continuity and new availability gating; actual accepted-match immutability, earned claims, attempted downgrade and receipt routing still untested. Partial only.
- CMP-INV-001, 006–016, 018–019, 021–027, 030: no end-to-end executable proof against the corresponding frozen invariant; mark OPEN. CMP-INV-023/024/025/026 likewise require actual market/runtime checks, not inference from absence of code.

## Required next actions before CMP-1 foundation closeout

1. Qualify `075dbe0...` and any subsequent corrections at exact source SHA; inspect dedicated Solidity shard logs rather than treating an unrelated workflow as sufficient.
2. Pin independently reproduced positive/negative ABI-byte and Keccak fixtures for work unit/attempt and three identity registries, with Solidity and a distinct Go/TypeScript implementation checking the same independently produced expected values and domain/chain/registry negative cases.
3. Resolve baseline authorization gaps: actual mutation-scoped capability checks and grant consumption where required, signed operator and delegated key enrollment, trustworthy provider/security eligibility and endpoint/attestation provenance. Keep the identity registries **non-authoritative for paid matching** until the missing gates exist and pass.
4. Reconcile the CMP branch against current `main` without changing the frozen address map; qualify all required source, Docs and Integrated workflows against the same final commit. Separate that foundation merge decision from deployment and CMP-0.12 operational release, which remain blocked.

**Closeout classification:** CMP-1.1–1.4 source and initial isolated tests exist; CMP-1.5 has begun corrective qualification. No deployed/registered marketplace, actual worker, funds, settlement, or CMP operational release is established. Keep PR #369 draft and unmerged until the foundation gate is genuinely closed.

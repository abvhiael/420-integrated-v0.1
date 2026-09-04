# 420VPN V1 Semantic Hardening Addendum

Status: **NORMATIVE FOR V1 IMPLEMENTATION**

This addendum records the semantic hardening review of the first executable 420VPN provider/node/policy/authorization foundation. It narrows implementation behavior without reopening the frozen 420VPN architecture.

## Findings and resolutions

### 1. Provider stake reference was mutable through ordinary metadata authority

Original foundation behavior allowed `ACTION_UPDATE_PROVIDER` to replace `stakeRef`. That mixed descriptive metadata authority with the security-assurance reference used by the provider identity.

**Resolution:** ordinary provider updates may change metadata only. Stake-reference rotation uses the distinct `ACTION_UPDATE_STAKE_REF` capability, requires a nonzero replacement, and is forbidden while the provider is ACTIVE. A provider must be suspended/otherwise non-ACTIVE before rotating its canonical stake reference.

### 2. Provider activation did not require a stake reference

The frozen architecture requires providers to participate with `$420` stake/security assurance, while the original foundation permitted activation with `stakeRef == 0`.

**Resolution:** transition into ACTIVE now requires a nonzero `stakeRef`. This is a reference-level foundation check only; it does not claim that a nonzero hash proves stake validity. A later staking adapter must verify the referenced stake against the canonical staking/security system before production routing or settlement depends on it.

### 3. Endpoint manifests could be zero or already expired

The architecture defines VPN endpoints as signed, expiring off-chain manifest references. The original node registry did not enforce a nonzero manifest commitment or future expiry.

**Resolution:** registration and endpoint update require a nonzero `endpointManifestHash` and `endpointExpiresAt > block.timestamp`. Activation also rechecks endpoint liveness.

### 4. Nominal ACTIVE state did not equal operational eligibility

A node could remain stored as ACTIVE after its provider became SUSPENDED/RETIRED or after its endpoint manifest expired. Cascading state mutation would create unnecessary coupling between registries.

**Resolution:** `VPNNodeRegistry420.isOperational(nodeId)` is the canonical foundation eligibility predicate. It returns true only when all three conditions hold simultaneously:

1. node state is ACTIVE;
2. provider state is ACTIVE; and
3. the node has a nonzero, unexpired endpoint manifest commitment.

Future route/session selection must use effective operational eligibility, not `nodeState == ACTIVE` alone.

## Hardened implementation assertions

- **VPN-HARD-001:** ordinary provider metadata authority cannot alter the canonical provider stake reference.
- **VPN-HARD-002:** a provider cannot enter ACTIVE without a nonzero stake reference.
- **VPN-HARD-003:** stake-reference rotation requires its own capability and cannot occur while the provider is ACTIVE.
- **VPN-HARD-004:** node registration, endpoint replacement, and activation reject missing or expired endpoint manifests.
- **VPN-HARD-005:** provider suspension/retirement immediately makes every bound node non-operational without rewriting the node's historical state.
- **VPN-HARD-006:** endpoint expiry immediately makes the node non-operational without requiring an on-chain keeper transaction.
- **VPN-HARD-007:** future routing/session modules must fail closed on `isOperational == false` and must not infer route eligibility from nominal node state alone.
- **VPN-HARD-008:** nonzero `stakeRef` is only a committed reference at this layer; production economic assurance requires a versioned staking adapter that validates the referenced stake and does not create VPN custody authority.

These rules preserve VPN-INV-008, VPN-INV-010, VPN-INV-012, VPN-INV-024, VPN-INV-027, and VPN-INV-028 and make their foundation-level enforcement explicit.

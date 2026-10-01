---
title: Generated contract and ABI reference
audience:
  - developer
category: reference
status: generated
version: current
---

# Generated contract, NatSpec and ABI reference

> GENERATED FILE - DO NOT EDIT. Regenerate with `python scripts/generate-reference-docs.py`.

Source catalogue: `developer-hub/catalogue/local.example.json`  
Catalogue SHA-256: `b45fa4da49ace6f989d4ee5b2861351cc317d750fde6ef840546657e9d592807`  
Catalogue chain ID: `420`  
Environment scope: **local example only**

This page is generated from the currently checked-in contract catalogue plus matching Solidity source. A catalogue `verified: true` flag is not sufficient by itself to publish a distributable ABI: the referenced build artifact must exist, the ABI hash must be non-placeholder and the source/provenance must remain environment-scoped.

## Identity420

- Protocol: `420Identity`
- Version: `3.0.0`
- Catalogue provenance: `genesis`
- Deployment block: `0`
- Catalogue address: `0x0000000000000000000000000000000000000436` (**local example only**)
- Solidity source: `contracts/src/apps/Identity420.sol`
- Declared artifact: `contracts/artifacts/Identity420.json` (present)
- Declared interface: `contracts/src/interfaces/genesis/IIdentityCredential420.sol` (present)
- Declared ABI SHA-256: `5ea63254c724148eba47ee720486f41105f003602558cbd0b0a43bdc346d3a6e`
- Distributable verified ABI: **YES**

### NatSpec

- Notice: Optional pseudonymous profile and credential anchor for 420 Integrated.
- Developer note: Directly implements the frozen Genesis credential read interface. Subject/type compatibility

### Public/external source surface

- `systemName() external pure returns (string memory)`
- `protocolVersion() external pure returns (uint32)`
- `createProfile(bytes32 profileId, bytes32 metadataHash) external`
- `updateProfile(bytes32 profileId, bytes32 metadataHash, bool active) external`
- `setPrimaryName(bytes32 profileId, bytes32 labelHash) external`
- `transferProfileController(bytes32 profileId, address newController) external`
- `acceptProfileController(bytes32 profileId) external`
- `setIssuer(bytes32 issuerId, address controller, bytes32 metadataHash, bool active) external onlyGovernance`
- `setIssuerTrust(bytes32 issuerId, address controller, bytes32 metadataHash, TrustClass trustClass, bool active) external onlyGovernance`
- `issueCredential(bytes32 credentialId, bytes32 issuerId, bytes32 subjectProfileId, bytes32 credentialType, bytes32 claimHash, uint64 expiresAt) external`
- `revokeCredential(bytes32 credentialId) external`
- `rejectCredential(bytes32 credentialId) external`
- `credentialValid(bytes32 credentialId) public view returns (bool)`
- `credentialMeetsTrust(bytes32 credentialId, TrustClass minimumTrust) external view returns (bool)`
- `credential(bytes32 credentialId) external view override returns (CredentialView memory view_)`
- `hasValidCredential(bytes32 subjectId, bytes32 credentialType) external view override returns (bool)`

## ProtocolRegistry

- Protocol: `420Registry`
- Version: `1.0.0`
- Catalogue provenance: `genesis`
- Deployment block: `0`
- Catalogue address: `0x0000000000000000000000000000000000000434` (**local example only**)
- Solidity source: `contracts/src/apps/ProtocolRegistry.sol`
- Declared artifact: `contracts/artifacts/ProtocolRegistry.json` (present)
- Declared interface: `contracts/src/interfaces/genesis/IProtocolRegistry420.sol` (present)
- Declared ABI SHA-256: `4f7210da15f19ac787a7e85c45c22b51bfd91e8f4460df6791dfcfacf26b7669`
- Distributable verified ABI: **YES**

### NatSpec

- Notice: Canonical discovery and version registry for 420 Integrated protocol services and Genesis components.
- Developer note: Service IDs and Genesis component IDs are intentionally independent namespaces.

### Public/external source surface

- `systemName() external pure returns (string memory)`
- `protocolVersion() external pure returns (uint32)`
- `isGenesisCanonicalServiceId(bytes32 serviceId) public pure returns (bool)`
- `approveServiceId(bytes32 serviceId, bytes32 descriptorHash) external onlyGovernance`
- `publishService(bytes32 serviceId, address implementation, bytes32 codeHash, bytes32 metadataHash, uint32 version, bool active) external onlyGovernance`
- `setService(bytes32 serviceId, address implementation, bytes32 codeHash, bytes32 metadataHash, uint32 version, bool active) external onlyGovernance`
- `publishRegisteredService(bytes32 serviceId, address implementation, bytes32 metadataHash, uint32 version, bool active, ComponentType componentType_, bytes32 manifestHash, bytes32 dependencyRoot, bytes32 interfaceHash) external onlyGovernance`
- `deprecateService(bytes32 serviceId) external onlyGovernance`
- `registerComponent(bytes32 componentId, address implementation, Types420.Version calldata version, Types420.Lifecycle lifecycle) external onlyGovernance`
- `setComponentLifecycle(bytes32 componentId, Types420.Lifecycle lifecycle) external onlyGovernance`
- `getService(bytes32 serviceId) external view returns (Service memory)`
- `getServiceVersion(bytes32 serviceId, uint32 version) external view returns (Service memory)`
- `getRegistrationProfile(bytes32 serviceId, uint32 version) external view returns (RegistrationProfile memory)`
- `currentVersion(bytes32 serviceId) external view returns (uint32)`
- `isServiceActive(bytes32 serviceId) external view returns (bool)`
- `resolveActive(bytes32 serviceId) external view returns (address implementation, uint32 version)`
- `component(bytes32 componentId) external view override returns (Types420.ContractRef memory)`
- `isActive(bytes32 componentId) external view override returns (bool)`
- `resolve(bytes32 componentId) external view override returns (address implementation)`
- `runtimeCodeHash(bytes32 componentId) external view override returns (bytes32)`
- `supportsVersion(bytes32 componentId, Types420.Version calldata requested) external view override returns (bool)`
- `currentComponentRevision(bytes32 componentId) external view returns (uint32)`
- `getComponentRevision(bytes32 componentId, uint32 revision) external view returns (Types420.ContractRef memory)`

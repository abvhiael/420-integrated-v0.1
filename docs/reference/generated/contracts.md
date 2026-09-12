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
Catalogue SHA-256: `1c99272488959f2cf08e5dac78ee214a633c9b7eea948aaddaed6df81bf8b63b`  
Catalogue chain ID: `420`  
Environment scope: **local example only**

This page is generated from the currently checked-in contract catalogue plus matching Solidity source. A catalogue `verified: true` flag is not sufficient by itself to publish a distributable ABI: the referenced build artifact must exist, the ABI hash must be non-placeholder and the source/provenance must remain environment-scoped.

## ProtocolRegistry

- Protocol: `420Registry`
- Version: `1.0.0`
- Catalogue provenance: `genesis`
- Deployment block: `0`
- Catalogue address: `0x0000000000000000000000000000000000000420` (**local example only**)
- Solidity source: `contracts/src/apps/ProtocolRegistry.sol`
- Declared artifact: `contracts/out/ProtocolRegistry.sol/ProtocolRegistry.json` (missing)
- Declared interface: `contracts/src/interfaces/IProtocolRegistry.sol` (missing)
- Declared ABI SHA-256: `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`
- Distributable verified ABI: **NO — fail closed**

### NatSpec

- Notice: Canonical discovery and version registry for 420 Integrated protocol services.
- Developer note: 420Registry records service identity, implementations and immutable version history.

### Public/external source surface

- `systemName() external pure returns (string memory)`
- `protocolVersion() external pure returns (uint32)`
- `isGenesisCanonicalServiceId(bytes32 serviceId) public pure returns (bool)`
- `approveServiceId(bytes32 serviceId, bytes32 descriptorHash) external onlyGovernance`
- `publishService(bytes32 serviceId, address implementation, bytes32 codeHash, bytes32 metadataHash, uint32 version, bool active) external onlyGovernance`
- `setService(bytes32 serviceId, address implementation, bytes32 codeHash, bytes32 metadataHash, uint32 version, bool active) external onlyGovernance`
- `publishRegisteredService(bytes32 serviceId, address implementation, bytes32 metadataHash, uint32 version, bool active, ComponentType componentType, bytes32 manifestHash, bytes32 dependencyRoot, bytes32 interfaceHash) external onlyGovernance`
- `deprecateService(bytes32 serviceId) external onlyGovernance`
- `getService(bytes32 serviceId) external view returns (Service memory)`
- `getServiceVersion(bytes32 serviceId, uint32 version) external view returns (Service memory)`
- `getRegistrationProfile(bytes32 serviceId, uint32 version) external view returns (RegistrationProfile memory)`
- `currentVersion(bytes32 serviceId) external view returns (uint32)`
- `isActive(bytes32 serviceId) external view returns (bool)`
- `resolveActive(bytes32 serviceId) external view returns (address implementation, uint32 version)`

### ABI publication status

The generated reference does not publish ABI JSON for this entry because declared build artifact is not checked in; declared ABI hash is a placeholder. This is intentional fail-closed behavior, not a missing-documentation workaround.

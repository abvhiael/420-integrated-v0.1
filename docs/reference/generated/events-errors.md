---
title: Generated events and custom errors
audience:
  - developer
category: reference
status: generated
version: current
---

# Generated events and custom errors

> GENERATED FILE - DO NOT EDIT. Regenerate with `python scripts/generate-reference-docs.py`.

Publication boundary: `developer-hub/catalogue/local.example.json`  
Catalogue SHA-256: `35cb030a1f664f1e3e38e7698421066434c2dd28d7acdbb238a81f37ca6a4ad4`  
Environment scope: **local example only**

Event topics and custom-error selectors are Ethereum Keccak-256 hashes of canonical ABI signatures. They are published only when the source declaration can be normalized unambiguously. User-defined or otherwise ambiguous parameter types are reported unresolved instead of guessed.

## Global event index

| Contract | Event | Canonical signature | Indexed parameter positions | topic0 |
| --- | --- | --- | --- | --- |
| `ProtocolRegistry` | `ServiceDeprecated` | `ServiceDeprecated(bytes32,uint32)` | 0, 1 | `0x63e20a29800a0d1cec5ae14b6dfceb2bc5cbfd523b7225bc649d3819c0f8780a` |
| `ProtocolRegistry` | `ServiceIdApproved` | `ServiceIdApproved(bytes32,bytes32)` | 0, 1 | `0x19f6f69425970f336d54db432de56d363cfd40f44016881830c65298b2c4e0c5` |
| `ProtocolRegistry` | `ServiceRegistrationProfilePublished` | `ServiceRegistrationProfilePublished(bytes32,uint32,uint8,bytes32,bytes32,bytes32)` | 0, 1 | `0x19af5a8b78ed7364ffacb8ddf22ac42f4bb67c6d9532cb2b7504781867c550d9` |
| `ProtocolRegistry` | `ServiceVersionPublished` | `ServiceVersionPublished(bytes32,uint32,address,bytes32,bytes32,bool)` | 0, 1, 2 | `0x19aa152c2c4c6794d89883e0808ea2365e3f6d5267840423debc9b08db5b3608` |

## Global custom-error index

| Contract | Error | Canonical signature | Selector |
| --- | --- | --- | --- |
| `ProtocolRegistry` | `CodeHashMismatch` | `CodeHashMismatch()` | `0x93c44ee6` |
| `ProtocolRegistry` | `ImplementationHasNoCode` | `ImplementationHasNoCode()` | `0x6f778c3a` |
| `ProtocolRegistry` | `InvalidComponentType` | `InvalidComponentType()` | `0x6a7ed65b` |
| `ProtocolRegistry` | `InvalidImplementation` | `InvalidImplementation()` | `0x68155f9a` |
| `ProtocolRegistry` | `InvalidManifest` | `InvalidManifest()` | `0xe18d5d12` |
| `ProtocolRegistry` | `InvalidServiceId` | `InvalidServiceId()` | `0xac45f7ce` |
| `ProtocolRegistry` | `InvalidVersion` | `InvalidVersion()` | `0xa9146eeb` |
| `ProtocolRegistry` | `ServiceAlreadyInactive` | `ServiceAlreadyInactive()` | `0x6770d4a9` |
| `ProtocolRegistry` | `UnapprovedServiceId` | `UnapprovedServiceId()` | `0xec12d325` |
| `ProtocolRegistry` | `UnknownService` | `UnknownService()` | `0x183f5325` |

## ProtocolRegistry

Source: `contracts/src/apps/ProtocolRegistry.sol`

### Events

- `ServiceIdApproved(bytes32 indexed serviceId, bytes32 indexed descriptorHash)`
  - canonical signature: `ServiceIdApproved(bytes32,bytes32)`
  - indexed parameter positions: 0, 1
  - topic0: `0x19f6f69425970f336d54db432de56d363cfd40f44016881830c65298b2c4e0c5`
- `ServiceVersionPublished(bytes32 indexed serviceId, uint32 indexed version, address indexed implementation, bytes32 codeHash, bytes32 metadataHash, bool active)`
  - canonical signature: `ServiceVersionPublished(bytes32,uint32,address,bytes32,bytes32,bool)`
  - indexed parameter positions: 0, 1, 2
  - topic0: `0x19aa152c2c4c6794d89883e0808ea2365e3f6d5267840423debc9b08db5b3608`
- `ServiceRegistrationProfilePublished(bytes32 indexed serviceId, uint32 indexed version, ComponentType componentType, bytes32 manifestHash, bytes32 dependencyRoot, bytes32 interfaceHash)`
  - canonical signature: `ServiceRegistrationProfilePublished(bytes32,uint32,uint8,bytes32,bytes32,bytes32)`
  - indexed parameter positions: 0, 1
  - topic0: `0x19af5a8b78ed7364ffacb8ddf22ac42f4bb67c6d9532cb2b7504781867c550d9`
- `ServiceDeprecated(bytes32 indexed serviceId, uint32 indexed version)`
  - canonical signature: `ServiceDeprecated(bytes32,uint32)`
  - indexed parameter positions: 0, 1
  - topic0: `0x63e20a29800a0d1cec5ae14b6dfceb2bc5cbfd523b7225bc649d3819c0f8780a`

### Custom errors

- `InvalidServiceId()`
  - canonical signature: `InvalidServiceId()`
  - selector: `0xac45f7ce`
- `InvalidImplementation()`
  - canonical signature: `InvalidImplementation()`
  - selector: `0x68155f9a`
- `InvalidVersion()`
  - canonical signature: `InvalidVersion()`
  - selector: `0xa9146eeb`
- `UnknownService()`
  - canonical signature: `UnknownService()`
  - selector: `0x183f5325`
- `ServiceAlreadyInactive()`
  - canonical signature: `ServiceAlreadyInactive()`
  - selector: `0x6770d4a9`
- `UnapprovedServiceId()`
  - canonical signature: `UnapprovedServiceId()`
  - selector: `0xec12d325`
- `InvalidManifest()`
  - canonical signature: `InvalidManifest()`
  - selector: `0xe18d5d12`
- `InvalidComponentType()`
  - canonical signature: `InvalidComponentType()`
  - selector: `0x6a7ed65b`
- `ImplementationHasNoCode()`
  - canonical signature: `ImplementationHasNoCode()`
  - selector: `0x6f778c3a`
- `CodeHashMismatch()`
  - canonical signature: `CodeHashMismatch()`
  - selector: `0x93c44ee6`

## Hashing self-check

The generator carries an internal Ethereum Keccak-256 implementation. Known-vector checks are enforced before output: `keccak256("") = c5d246...a470` and `transfer(address,uint256)` selector = `0xa9059cbb`.

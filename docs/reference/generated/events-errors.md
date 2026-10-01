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
Catalogue SHA-256: `b45fa4da49ace6f989d4ee5b2861351cc317d750fde6ef840546657e9d592807`  
Environment scope: **local example only**

Event topics and custom-error selectors are Ethereum Keccak-256 hashes of canonical ABI signatures. They are published only when the source declaration can be normalized unambiguously. User-defined or otherwise ambiguous parameter types are reported unresolved instead of guessed.

## Global event index

| Contract | Event | Canonical signature | Indexed parameter positions | topic0 |
| --- | --- | --- | --- | --- |
| `Identity420` | `CredentialIssued` | `CredentialIssued(bytes32,bytes32,bytes32,bytes32,bytes32,uint64)` | 0, 1, 2 | `0xc690e1c3ca2f3680c69ca87f5db37e21ae11e9d1f2b5c44c2ac9ae1e6f959593` |
| `Identity420` | `CredentialRejected` | `CredentialRejected(bytes32,bytes32)` | 0, 1 | `0x18191f5d2acf50d37befcf3c4bb0176cb6c5fb84a2685669c8f5f1781316f301` |
| `Identity420` | `CredentialRevoked` | `CredentialRevoked(bytes32,bytes32)` | 0, 1 | `0xcbb2b7dc9d31d7061fb30547fa295ccbbb1fe5df2b51b6439aef59b0d21aa626` |
| `Identity420` | `IssuerSet` | `IssuerSet(bytes32,address,bytes32,uint8,bool)` | 0, 1 | `0x5851aa8b28e85fd2dfc47f3027a2a265973648f86ac7154ce005056fd58e97d9` |
| `Identity420` | `PrimaryNameSet` | `PrimaryNameSet(bytes32,bytes32)` | 0, 1 | `0x6ede5783093f1911dacd2d3ba656d0b2afe96cec6748a1f33b24e4d88b389777` |
| `Identity420` | `ProfileControllerTransferStarted` | `ProfileControllerTransferStarted(bytes32,address,address)` | 0, 1, 2 | `0x5994c7a2db7bb56c729f4a6b3a0c05dd329c422955f0438b47a81d24a3be157e` |
| `Identity420` | `ProfileControllerTransferred` | `ProfileControllerTransferred(bytes32,address,address)` | 0, 1, 2 | `0x0f389215fba2a2e42b31236a4370a936c2e2f8b5ad6581eaf41113273e6b740c` |
| `Identity420` | `ProfileCreated` | `ProfileCreated(bytes32,address,bytes32)` | 0, 1 | `0xd973fe99a734b6a7db6e31eee99e6dc1a1930f0ed16b392b9ae6f132e38e7597` |
| `Identity420` | `ProfileUpdated` | `ProfileUpdated(bytes32,bytes32,bool)` | 0 | `0x1de75bc703686ea4f160161d6a0c68746de2d474e0b313078842dd199e17acca` |
| `ProtocolRegistry` | `ServiceDeprecated` | `ServiceDeprecated(bytes32,uint32)` | 0, 1 | `0x63e20a29800a0d1cec5ae14b6dfceb2bc5cbfd523b7225bc649d3819c0f8780a` |
| `ProtocolRegistry` | `ServiceIdApproved` | `ServiceIdApproved(bytes32,bytes32)` | 0, 1 | `0x19f6f69425970f336d54db432de56d363cfd40f44016881830c65298b2c4e0c5` |
| `ProtocolRegistry` | `ServiceRegistrationProfilePublished` | `ServiceRegistrationProfilePublished(bytes32,uint32,uint8,bytes32,bytes32,bytes32)` | 0, 1 | `0x19af5a8b78ed7364ffacb8ddf22ac42f4bb67c6d9532cb2b7504781867c550d9` |
| `ProtocolRegistry` | `ServiceVersionPublished` | `ServiceVersionPublished(bytes32,uint32,address,bytes32,bytes32,bool)` | 0, 1, 2 | `0x19aa152c2c4c6794d89883e0808ea2365e3f6d5267840423debc9b08db5b3608` |

## Global custom-error index

| Contract | Error | Canonical signature | Selector |
| --- | --- | --- | --- |
| `Identity420` | `AlreadyRevoked` | `AlreadyRevoked()` | `0x905e7107` |
| `ProtocolRegistry` | `CanonicalServiceIdImmutable` | `CanonicalServiceIdImmutable()` | `0xe020355f` |
| `ProtocolRegistry` | `CodeHashMismatch` | `CodeHashMismatch()` | `0x93c44ee6` |
| `ProtocolRegistry` | `ComponentLifecycleUnchanged` | `ComponentLifecycleUnchanged()` | `0x1f262656` |
| `Identity420` | `CredentialExists` | `CredentialExists()` | `0xaa3ea2ac` |
| `ProtocolRegistry` | `ImplementationHasNoCode` | `ImplementationHasNoCode()` | `0x6f778c3a` |
| `Identity420` | `InactiveIssuer` | `InactiveIssuer()` | `0xe700f80f` |
| `ProtocolRegistry` | `InvalidComponentId` | `InvalidComponentId()` | `0x6b5e0346` |
| `ProtocolRegistry` | `InvalidComponentType` | `InvalidComponentType()` | `0x6a7ed65b` |
| `Identity420` | `InvalidController` | `InvalidController()` | `0x6d5769be` |
| `Identity420` | `InvalidCredentialId` | `InvalidCredentialId()` | `0xe5aaacea` |
| `Identity420` | `InvalidExpiry` | `InvalidExpiry()` | `0xd36c8500` |
| `ProtocolRegistry` | `InvalidImplementation` | `InvalidImplementation()` | `0x68155f9a` |
| `Identity420` | `InvalidIssuerId` | `InvalidIssuerId()` | `0x2d717e01` |
| `ProtocolRegistry` | `InvalidLifecycle` | `InvalidLifecycle()` | `0x18781b51` |
| `ProtocolRegistry` | `InvalidManifest` | `InvalidManifest()` | `0xe18d5d12` |
| `Identity420` | `InvalidProfileId` | `InvalidProfileId()` | `0x1dc92e78` |
| `ProtocolRegistry` | `InvalidServiceId` | `InvalidServiceId()` | `0xac45f7ce` |
| `Identity420` | `InvalidTrustClass` | `InvalidTrustClass()` | `0x03f13d4c` |
| `ProtocolRegistry` | `InvalidVersion` | `InvalidVersion()` | `0xa9146eeb` |
| `Identity420` | `NotCredentialSubject` | `NotCredentialSubject()` | `0xfe4473fb` |
| `Identity420` | `NotIssuerController` | `NotIssuerController()` | `0xabc27a31` |
| `Identity420` | `NotPendingController` | `NotPendingController()` | `0x79bcdd25` |
| `Identity420` | `NotProfileController` | `NotProfileController()` | `0x1d406b77` |
| `Identity420` | `ProfileExists` | `ProfileExists()` | `0x8d2c60db` |
| `ProtocolRegistry` | `ServiceAlreadyInactive` | `ServiceAlreadyInactive()` | `0x6770d4a9` |
| `Identity420` | `TooManyCredentialCandidates` | `TooManyCredentialCandidates()` | `0x05c784b4` |
| `ProtocolRegistry` | `UnapprovedServiceId` | `UnapprovedServiceId()` | `0xec12d325` |
| `ProtocolRegistry` | `UnknownComponent` | `UnknownComponent()` | `0x1e914be6` |
| `Identity420` | `UnknownCredential` | `UnknownCredential()` | `0xfaf14f46` |
| `Identity420` | `UnknownIssuer` | `UnknownIssuer()` | `0x3264d6ca` |
| `Identity420` | `UnknownProfile` | `UnknownProfile()` | `0x738d7bc6` |
| `ProtocolRegistry` | `UnknownService` | `UnknownService()` | `0x183f5325` |

## Identity420

Source: `contracts/src/apps/Identity420.sol`

### Events

- `ProfileCreated(bytes32 indexed profileId, address indexed controller, bytes32 metadataHash)`
  - canonical signature: `ProfileCreated(bytes32,address,bytes32)`
  - indexed parameter positions: 0, 1
  - topic0: `0xd973fe99a734b6a7db6e31eee99e6dc1a1930f0ed16b392b9ae6f132e38e7597`
- `ProfileUpdated(bytes32 indexed profileId, bytes32 metadataHash, bool active)`
  - canonical signature: `ProfileUpdated(bytes32,bytes32,bool)`
  - indexed parameter positions: 0
  - topic0: `0x1de75bc703686ea4f160161d6a0c68746de2d474e0b313078842dd199e17acca`
- `PrimaryNameSet(bytes32 indexed profileId, bytes32 indexed labelHash)`
  - canonical signature: `PrimaryNameSet(bytes32,bytes32)`
  - indexed parameter positions: 0, 1
  - topic0: `0x6ede5783093f1911dacd2d3ba656d0b2afe96cec6748a1f33b24e4d88b389777`
- `ProfileControllerTransferStarted(bytes32 indexed profileId, address indexed currentController, address indexed pendingController)`
  - canonical signature: `ProfileControllerTransferStarted(bytes32,address,address)`
  - indexed parameter positions: 0, 1, 2
  - topic0: `0x5994c7a2db7bb56c729f4a6b3a0c05dd329c422955f0438b47a81d24a3be157e`
- `ProfileControllerTransferred(bytes32 indexed profileId, address indexed previousController, address indexed newController)`
  - canonical signature: `ProfileControllerTransferred(bytes32,address,address)`
  - indexed parameter positions: 0, 1, 2
  - topic0: `0x0f389215fba2a2e42b31236a4370a936c2e2f8b5ad6581eaf41113273e6b740c`
- `IssuerSet(bytes32 indexed issuerId, address indexed controller, bytes32 metadataHash, TrustClass trustClass, bool active)`
  - canonical signature: `IssuerSet(bytes32,address,bytes32,uint8,bool)`
  - indexed parameter positions: 0, 1
  - topic0: `0x5851aa8b28e85fd2dfc47f3027a2a265973648f86ac7154ce005056fd58e97d9`
- `CredentialIssued(bytes32 indexed credentialId, bytes32 indexed issuerId, bytes32 indexed subjectProfileId, bytes32 credentialType, bytes32 claimHash, uint64 expiresAt)`
  - canonical signature: `CredentialIssued(bytes32,bytes32,bytes32,bytes32,bytes32,uint64)`
  - indexed parameter positions: 0, 1, 2
  - topic0: `0xc690e1c3ca2f3680c69ca87f5db37e21ae11e9d1f2b5c44c2ac9ae1e6f959593`
- `CredentialRevoked(bytes32 indexed credentialId, bytes32 indexed issuerId)`
  - canonical signature: `CredentialRevoked(bytes32,bytes32)`
  - indexed parameter positions: 0, 1
  - topic0: `0xcbb2b7dc9d31d7061fb30547fa295ccbbb1fe5df2b51b6439aef59b0d21aa626`
- `CredentialRejected(bytes32 indexed credentialId, bytes32 indexed subjectProfileId)`
  - canonical signature: `CredentialRejected(bytes32,bytes32)`
  - indexed parameter positions: 0, 1
  - topic0: `0x18191f5d2acf50d37befcf3c4bb0176cb6c5fb84a2685669c8f5f1781316f301`

### Custom errors

- `InvalidProfileId()`
  - canonical signature: `InvalidProfileId()`
  - selector: `0x1dc92e78`
- `ProfileExists()`
  - canonical signature: `ProfileExists()`
  - selector: `0x8d2c60db`
- `UnknownProfile()`
  - canonical signature: `UnknownProfile()`
  - selector: `0x738d7bc6`
- `NotProfileController()`
  - canonical signature: `NotProfileController()`
  - selector: `0x1d406b77`
- `InvalidController()`
  - canonical signature: `InvalidController()`
  - selector: `0x6d5769be`
- `NotPendingController()`
  - canonical signature: `NotPendingController()`
  - selector: `0x79bcdd25`
- `InvalidIssuerId()`
  - canonical signature: `InvalidIssuerId()`
  - selector: `0x2d717e01`
- `UnknownIssuer()`
  - canonical signature: `UnknownIssuer()`
  - selector: `0x3264d6ca`
- `InactiveIssuer()`
  - canonical signature: `InactiveIssuer()`
  - selector: `0xe700f80f`
- `NotIssuerController()`
  - canonical signature: `NotIssuerController()`
  - selector: `0xabc27a31`
- `InvalidCredentialId()`
  - canonical signature: `InvalidCredentialId()`
  - selector: `0xe5aaacea`
- `CredentialExists()`
  - canonical signature: `CredentialExists()`
  - selector: `0xaa3ea2ac`
- `UnknownCredential()`
  - canonical signature: `UnknownCredential()`
  - selector: `0xfaf14f46`
- `AlreadyRevoked()`
  - canonical signature: `AlreadyRevoked()`
  - selector: `0x905e7107`
- `InvalidExpiry()`
  - canonical signature: `InvalidExpiry()`
  - selector: `0xd36c8500`
- `NotCredentialSubject()`
  - canonical signature: `NotCredentialSubject()`
  - selector: `0xfe4473fb`
- `InvalidTrustClass()`
  - canonical signature: `InvalidTrustClass()`
  - selector: `0x03f13d4c`
- `TooManyCredentialCandidates()`
  - canonical signature: `TooManyCredentialCandidates()`
  - selector: `0x05c784b4`

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
- `CanonicalServiceIdImmutable()`
  - canonical signature: `CanonicalServiceIdImmutable()`
  - selector: `0xe020355f`
- `InvalidComponentId()`
  - canonical signature: `InvalidComponentId()`
  - selector: `0x6b5e0346`
- `InvalidLifecycle()`
  - canonical signature: `InvalidLifecycle()`
  - selector: `0x18781b51`
- `UnknownComponent()`
  - canonical signature: `UnknownComponent()`
  - selector: `0x1e914be6`
- `ComponentLifecycleUnchanged()`
  - canonical signature: `ComponentLifecycleUnchanged()`
  - selector: `0x1f262656`

## Hashing self-check

The generator carries an internal Ethereum Keccak-256 implementation. Known-vector checks are enforced before output: `keccak256("") = c5d246...a470` and `transfer(address,uint256)` selector = `0xa9059cbb`.

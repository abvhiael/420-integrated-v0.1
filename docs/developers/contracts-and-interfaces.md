---
title: Contracts and interfaces
audience:
  - developer
category: developer
status: development
version: current
---

# Contracts and interfaces

Use canonical network and Registry information to decide **which contract, version and interface** an integration is allowed to call. Do not copy deployment addresses from screenshots, old issues, examples, Explorer labels or AppStore listings.

## Discovery order

For a security-sensitive integration:

1. select an explicit network manifest and verify the connected chain/environment;
2. resolve the intended service identity through 420 Registry / `ProtocolRegistry` when the service is registry-managed;
3. read the current active version and implementation from canonical chain state;
4. confirm the implementation contains deployed code;
5. confirm the runtime code hash and the registration-profile commitments expected by the integration;
6. load the interface/ABI that belongs to that exact service/version;
7. only then prepare reads or writes.

420Indexer, Explorer, Search, Developer Hub and AppStore may accelerate discovery, but they are not substitutes for canonical Registry and chain checks.

## Service identity versus address

An address is not a durable ecosystem identity. `ProtocolRegistry` binds a service ID to a sequential registered version, implementation address, deployed runtime code hash, metadata commitment and registration profile. A newer version may intentionally use a different implementation address.

Applications should therefore persist the service/version identity used for an operation when that provenance matters. Historical events must be decoded using the interface that belonged to the historical service/version; do not silently decode old state with the newest ABI.

## Registration profile

A registered service version can commit:

- component type;
- manifest hash;
- dependency root;
- interface hash.

These commitments let clients reject an implementation that is registered under an unexpected profile. They do not grant custody, execution permission, Wallet capability, governance power or security endorsement.

## ABI and generated-reference boundary

DOC-9 explains which interface to select and how to validate its provenance. The machine-derived ABI, selectors, events, errors, NatSpec and deployment catalogue belong to DOC-10.

Until DOC-10 exists, use qualified repository artifacts and the exact contract/version provenance established by the selected manifest and `ProtocolRegistry`. Do not manually maintain a second authoritative address/ABI list inside application code or documentation.

## Proxies and implementation identity

When a deployment uses a proxy or other indirection, treat the externally called address and implementation code as separate facts. Record the proxy address, implementation address, upgrade/admin model when applicable, and the code hashes needed by the verification workflow. A verification result for one address must not be presented as evidence for another address without an explicit relationship.

## Fail closed

Do not issue a state-changing call when any of these are unresolved:

- network/environment identity;
- service ID or intended contract identity;
- active registered version;
- implementation address;
- deployed code presence;
- expected runtime code hash/profile/interface commitment;
- ABI/version compatibility.

A convenient derived service being healthy does not justify bypassing these checks.
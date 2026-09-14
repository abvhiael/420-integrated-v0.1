---
title: SDK and CLI integration
audience:
  - developer
category: developer
status: development
version: current
---

# SDK and CLI integration

Use `@420/sdk` and the repository-native `420` CLI as typed developer-control surfaces over canonical network discovery, contract metadata, RPC and the qualified Wallet boundary. Neither tool is protocol authority.

## SDK authority boundary

`@420/sdk` binds a selected network discovery object to the verified contract catalogue and fails closed if their chain identities disagree. RPC endpoints must come from the selected network manifest. Unknown services or contracts remain unresolved rather than being guessed.

The base SDK keeps JSON-RPC transport injectable. This is deliberate: signing, Wallet authority, session/capability authorization and protocol permissions do not move into the shared SDK just because an application imports it.

## CLI boundary

The `420` CLI is a thin control surface over the same discovery and SDK layers. It may inspect network, service and contract metadata, execute declared RPC reads, expose Wallet authority-contract metadata and operate the local devnet lifecycle. It must not become a CLI-owned keystore or request private keys, seed phrases or mnemonic material.

Machine-readable CLI output is deterministic JSON so scripts and CI can consume it without scraping human text.

## Safe integration pattern

1. Load the intended environment manifest explicitly.
2. Bind the matching canonical contract catalogue.
3. Reject chain mismatch before issuing reads or constructing intents.
4. Resolve service/contract identity through declared metadata.
5. Use the SDK for typed reads and request construction.
6. Hand state-changing authorization to the qualified Wallet/Smart Account path.
7. Confirm the resulting transaction and state against canonical RPC/owning contracts.

## Versioning

Treat SDK and CLI versions as developer-tool versions, not protocol versions. A package upgrade must not silently change the selected network, canonical contract identity, Wallet authority model or finality policy. Pin tool versions in CI/reproducible builds and review release changes before upgrading production integrations.

## Do not

- hard-code a replacement RPC endpoint without validating it against the selected environment;
- infer a missing contract or service address;
- treat SDK return values as stronger authority than their underlying source;
- put user signing secrets in SDK/CLI configuration;
- let CLI convenience bypass Wallet simulation, capability checks or explicit authorization.

## Related

- [Networks and manifests](networks-and-manifests.md)
- [Contracts and interfaces](contracts-and-interfaces.md)
- [Wallet and Smart Account integration](wallet-and-smart-accounts.md)

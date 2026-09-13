---
title: Ask 420 network and version context
audience:
  - user
  - developer
  - operator
category: concepts
status: current
version: current
---

# Ask 420 network and version context

DOC-15.5 binds Ask 420 answers to DOC-13 documentation publication and release authority. The assistant may only answer as authoritative for an environment/release when DOC-13 says that documentation context is published and the retrieved evidence is valid for that context.

## Context authority

DOC-13 `docs/versioning/version-registry.json` is the authority for documentation tracks, current aliases and published releases. Ask 420 does not infer publication from repository presence, branch names, generated files, application labels or user assumptions.

The current published contexts are:

- `development/current` -> release `development`;
- `genesis/current` -> release `genesis`;
- immutable historical `genesis/genesis` -> release `genesis`.

`testnet/current` and `mainnet/current` are unavailable because those tracks have no published release.

## Resolution order

For every supported query, Ask 420 resolves documentation context before composing an answer:

1. identify the requested or active environment;
2. identify an explicit release when supplied, otherwise use that environment's published `current` alias;
3. verify the environment exists in the DOC-13 registry;
4. verify the requested release is published for that environment;
5. verify the selected Ask 420 source collection permits that environment/release;
6. retrieve only evidence eligible for the resolved context;
7. return `unavailable` rather than substituting another environment or release when any required check fails.

A user may ask a cross-environment comparison. In that case each claim remains separately bound to its own published context; the assistant must not merge development and Genesis evidence into one undifferentiated authority claim.

## Development behavior

Development documentation is mutable and may describe work that is newer than the frozen Genesis release. Development answers must be identified as development-scoped when that distinction matters.

Development evidence must not be presented as Genesis, testnet or mainnet authority. Live DOC-10 generated reference is development-scoped unless DOC-13 later publishes a release-owned snapshot for another environment.

## Genesis behavior

Genesis documentation is a published immutable documentation release. Ask 420 may answer Genesis questions from sources valid for the Genesis release.

The Genesis release manifest explicitly marks generated reference as unavailable until a frozen release-owned snapshot exists. Therefore Ask 420 must not reuse development generated reference as Genesis authority. When a Genesis question requires generated interface/deployment data that is absent from the Genesis release, the answer is `unavailable` or `partially-supported` as defined by the citation/evidence contract.

## Testnet and mainnet behavior

Testnet and mainnet tracks are currently unpublished. Ask 420 must fail closed for authoritative testnet/mainnet documentation questions.

It may state that the requested documentation context is not published and may point to neutral documentation navigation, but it must not:

- relabel development content as testnet/mainnet;
- relabel Genesis content as testnet/mainnet;
- infer network values from examples, manifests or runtime-looking files that are outside a published release;
- silently answer against a different environment.

## Historical release behavior

Historical answers require an explicit published immutable release. When the user asks about Genesis as a historical release, Ask 420 binds the answer to `genesis/genesis` and cites evidence valid for that release.

Historical queries must not silently migrate to current mutable documentation. If a requested historical release is not present and published in DOC-13, the result is unavailable.

## Ambiguity behavior

If environment/release ambiguity could materially change the answer, authority boundary, security guidance, fee semantics, deployment identity, interface availability or troubleshooting path, Ask 420 returns `needs-context` and asks for the missing environment/release.

If the question is environment-neutral and the same supported claim is valid across all eligible published contexts, the assistant may answer without forcing unnecessary clarification, while keeping citations within eligible source collections.

## Runtime-state boundary

Documentation environment is not runtime network state. Selecting `genesis` documentation does not prove that a client is connected to a Genesis network, and selecting development documentation does not prove a local/dev network is healthy or canonical.

Ask 420 cannot use documentation context to prove chain ID, deployed address, finality, balances, validator state, Wallet authorization, provider health or any other live runtime fact. Those remain owned by the relevant canonical runtime source.

## Fail-closed result

Context resolution returns one of:

- `resolved` — published environment/release and eligible evidence exist;
- `needs-context` — a material environment/release choice is missing or ambiguous;
- `unavailable` — the requested track/release is unpublished, unknown or lacks the required eligible evidence.

The assistant never converts `needs-context` or `unavailable` into an authoritative answer by switching environments, releases or source classes.

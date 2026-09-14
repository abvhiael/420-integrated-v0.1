---
title: Ask 420 retrieval corpus and source registry
audience:
  - developer
  - operator
category: concepts
status: current
version: current
---

# Ask 420 retrieval corpus and source registry

DOC-15.2 defines which documentation Ask 420 may retrieve, how sources are classified, and when retrieved material may support an authoritative answer.

## Registry authority

`docs/assistant/source-registry.json` is the machine-readable retrieval inventory for Ask 420. A repository document does not become an authoritative Ask 420 source merely because it exists or is searchable. It must fall within a registered collection whose class and active environment permit the requested use.

## Source classes

Ask 420 recognizes four source classes.

### Canonical

Canonical sources contain reviewed 420Docs architecture, chain, consensus, infrastructure, Wallet, protocol, application, developer and troubleshooting guidance. They may support authoritative documentation answers when they are valid for the requested published environment/version.

### Generated

Generated sources are DOC-10 machine-derived reference outputs. They may support authoritative interface/reference claims only inside the environment and provenance boundary defined by DOC-10 and DOC-13. The current live generated reference is development-only; it must not be reused as Genesis authority.

### Historical

Historical sources are bound to an explicitly published immutable release. They may answer questions about that release only. Historical retrieval must not silently rewrite the request onto current documentation or another environment.

### Compatibility

Compatibility sources may help navigation, migration or discovery but are not substantive ecosystem authority. DOC-14 contextual mappings are registered as navigation-only compatibility material. They may locate canonical pages but cannot independently support protocol, security, transaction, deployment or recovery claims.

## Authoritative-answer eligibility

A retrieved source may support an authoritative answer only when all of the following are true:

1. the source belongs to a registered collection;
2. the collection is authoritative for the requested use;
3. the requested environment/version is published under DOC-13;
4. the source collection allows that environment;
5. generated material satisfies its provenance/version policy;
6. historical material is bound to the requested immutable release;
7. no higher-authority runtime source is required to answer a question about live state.

Failure of any condition makes that evidence unavailable for authoritative use.

## Unpublished environments

The source registry explicitly excludes unpublished testnet and mainnet tracks. Ask 420 must return an unavailable/unsupported result for environment-specific authoritative questions about those tracks until DOC-13 publishes them.

Development material must never be relabeled as testnet, mainnet or Genesis evidence. Genesis answers may use only sources eligible under the Genesis publication contract; development-only generated reference remains unavailable there.

## Repository scope

Ask 420 does not treat arbitrary repository content as retrieval authority. Source code, tests, issues, PRs, implementation notes, generated build artifacts and unrelated files are excluded unless a future DOC-15 registry revision explicitly admits them under a governed source class.

This keeps retrieval aligned with the documentation system rather than turning repository search into an authority mechanism.

## Retrieval versus answer authority

Retrieval determines which evidence is eligible to be passed to the answer synthesizer. It does not itself prove that every retrieved passage answers the question.

The synthesizer must still:

- select evidence that directly supports the claim;
- preserve canonical-versus-derived boundaries;
- cite the supporting source;
- surface conflicts rather than averaging them;
- return unsupported when the corpus does not establish the requested fact.

## Relationship to DOC-11 and DOC-14

DOC-11 troubleshooting pages are canonical corpus sources and retain ownership of stable `TRB-*` recovery semantics.

DOC-14 contextual material is navigation-only. `CTX-*` mappings can steer retrieval toward the correct canonical task, concept, reference or troubleshooting page, but a contextual record alone cannot substantiate the final ecosystem claim.

## Deterministic validation

`scripts/validate-doc-assistant-source-registry.py` validates the source registry. It checks:

- schema and collection structure;
- unique stable source IDs;
- legal source classes and answer-use modes;
- existence of registered roots/governance files;
- consistency between authoritative flags and compatibility sources;
- DOC-13 publication alignment;
- generated-reference development-only scope;
- immutable-release requirements for historical collections;
- explicit fail-closed exclusion of unpublished testnet/mainnet tracks.

DOC-15.9 will wire this validator into the unified 420Docs CI gate.

## DOC-15.2 result

Ask 420 now has a bounded retrieval corpus. Canonical and properly scoped generated/historical documentation may support authoritative answers; contextual/compatibility material may navigate but not substantiate; unpublished tracks and ungoverned repository material are excluded; and a deterministic validator protects the registry contract.

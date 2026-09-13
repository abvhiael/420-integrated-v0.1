---
title: Ask 420 documentation assistant
audience:
  - user
  - developer
  - operator
category: concepts
status: current
version: current
---

# Ask 420 documentation assistant

Ask 420 is the documentation-assistant layer for 420Docs. It answers supported questions by retrieving canonical documentation, preserving the active documentation environment/version, and returning source-backed guidance rather than treating model output as ecosystem authority.

## Core behavior

- Ground answers in repository-controlled 420Docs sources.
- Cite the sources used for concrete ecosystem claims.
- Respect DOC-13 documentation version and environment authority.
- Use DOC-11 `TRB-*` troubleshooting entries for exact known failure conditions.
- Use DOC-14 contextual `CTX-*` targets as navigation hints where useful.
- Distinguish canonical chain/protocol/runtime state from generated, derived or explanatory documentation.
- Return an unsupported/unavailable result when the documentation corpus cannot justify an answer.
- Do not treat 420AI providers, models or inference output as chain, protocol, Wallet, Registry, governance, deployment or finality authority.

## Retrieval corpus

Ask 420 retrieves only from governed documentation collections registered in `source-registry.json`. Canonical documentation may substantiate answers, generated reference is provenance/environment scoped, historical evidence is immutable-release scoped, and compatibility/contextual material is navigation-only.

See [retrieval corpus and source registry](retrieval-corpus-contract.md).

## Phase roadmap

See [DOC-15 roadmap](DOC-15-ROADMAP.md).

## Related documentation

- [Contextual documentation](../contextual/index.md)
- [Documentation versioning](../versioning/index.md)
- [Troubleshooting](../troubleshooting/index.md)
- [Generated reference](../reference/index.md)
- [Developer documentation](../developers/index.md)

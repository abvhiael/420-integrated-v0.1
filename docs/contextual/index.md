---
title: Contextual documentation
audience:
  - user
  - developer
  - operator
category: concepts
status: current
version: current
---

# Contextual documentation

Contextual documentation lets 420 Wallet, Genesis applications and supported runtime surfaces link users directly to the canonical 420Docs task, concept, reference or troubleshooting material that explains the state currently on screen.

These links are navigation hints, not protocol authority. Applications must not embed a separate copy of canonical recovery, signing, value-movement or security guidance and must not use a contextual link to imply support for an unpublished environment or release.

## Core rules

- Prefer stable contextual-link IDs rather than hard-coded site paths inside application logic.
- Resolve targets against the active documentation environment/version defined by DOC-13.
- Use stable DOC-11 `TRB-*` anchors for error and recovery help.
- Fail closed when a target is unknown, unpublished, retired or incompatible with the active environment.
- Do not silently fall back across environments or releases.
- Do not expose development documentation as Genesis, testnet or mainnet authority.
- Keep private user state, secrets and sensitive payloads out of contextual-help URLs.

## Target classes

DOC-14 supports four canonical target classes:

1. **task** — a user/developer/operator procedure for completing an action safely;
2. **concept** — explanatory material for a state, permission, protocol or architectural boundary;
3. **reference** — machine-oriented generated or curated technical reference;
4. **troubleshooting** — a stable DOC-11 troubleshooting entry or support workflow.

## Phase roadmap

See [DOC-14 roadmap](DOC-14-ROADMAP.md).

## Related documentation

- [Documentation versioning](../versioning/index.md)
- [Troubleshooting and support workflow](../troubleshooting/search-diagnostics-support.md)
- [Wallet documentation](../users/index.md)
- [Developer documentation](../developers/index.md)
- [Generated reference](../reference/index.md)

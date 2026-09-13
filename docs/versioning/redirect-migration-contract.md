---
title: Documentation Migration Contract
category: contributing
status: active
version: current
---

# Documentation Migration Contract

DOC-13.8 defines compatibility rules for old and version-qualified documentation routes.

## Rules

- Missing pages do not fall through to `current` automatically.
- Immutable historical routes remain preserved by default.
- Cross-environment route mappings are not allowed.
- Legacy flat URLs remain compatibility-only.
- Page moves inside a mutable context require an explicitly equivalent destination.
- Historical snapshots are not rewritten merely to adopt newer path layouts.
- Stable anchors remain stable when their meaning is unchanged.
- `TRB-<DOMAIN>-<NNN>` identifiers remain attached to the same troubleshooting meaning.
- When no equivalent destination exists, the old route is recorded as retired rather than guessed.

## Legacy migration

The flat corpus is not automatically mapped into Genesis, testnet, or mainnet routes. Future mappings require an explicit policy entry and equivalent content in the destination context.

## Fail-closed behavior

Duplicate sources, route loops, unknown targets, cross-environment mappings, and conflicts between active mappings and retired routes fail qualification.

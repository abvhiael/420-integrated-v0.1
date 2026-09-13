---
title: DOC-13.10 versioning coverage audit and closeout
audience:
  - developer
  - operator
category: contributing
status: active
version: current
---

# DOC-13.10 — Coverage audit and closeout

This audit verifies the final DOC-13 publication model across development, Genesis, testnet and mainnet before the monolithic phase is reconciled and merged.

## Environment coverage matrix

| Environment | Registry state | Current alias | Immutable release route | Generated reference | Network/deployment authority | Audit result |
| --- | --- | --- | --- | --- | --- | --- |
| development | published | `development/current -> development` | none; mutable development must not masquerade as immutable | live development-scoped DOC-10 output | false / false | PASS |
| genesis | published | `genesis/current -> genesis` | `genesis/genesis` | unavailable until a release-owned frozen snapshot with provenance hashes exists | false / false | PASS, deliberately fail-closed for generated reference |
| testnet | unpublished | none | none | none authoritative | none | PASS, must remain unadvertised and unresolved |
| mainnet | unpublished | none | none | none authoritative | none | PASS, must remain unadvertised and unresolved |

## Current and historical behavior

- Development documentation is mutable repository-head documentation and may move forward in place.
- Genesis is an immutable release identity. Its release-qualified documentation must not be silently rewritten as development advances.
- A track-local `current` alias is convenience routing only; it does not replace immutable release identity.
- Unknown releases, unpublished tracks, cross-environment requests and missing version-qualified pages fail closed.
- Legacy flat documentation URLs remain compatibility-only and do not inherit Genesis, testnet or mainnet authority.
- Historical/deprecated release identity is retained by immutable release-qualified identity or an explicit tombstone; there is no silent fallback to current.

## Generated-reference audit

Development binds the checked-in DOC-10 generated reference as `live`, development-scoped output. It explicitly carries no canonical network or deployment authority.

Genesis deliberately declares generated reference `unavailable`. Development-generated material must not be reused as Genesis authority. A future Genesis generated-reference publication requires a release-owned immutable snapshot and provenance hashes that pass the DOC-13.7 validator.

Testnet and mainnet currently expose no generated-reference authority because neither track is published.

## Navigation and renderer audit

The renderer derives advertised tracks and releases from the canonical version registry. The version selector exposes only registry-backed current aliases and immutable published releases. Same-page switching remains inventory-gated, and unavailable targets are disabled rather than guessed.

DOC-13.9 validates the built `version-context.json`, injected selector choices and version-qualified rendered links against the registry. The final Pages site qualification also invokes this publication-safety check before artifact upload.

## Compatibility exceptions

The following states are deliberate rather than missing implementation:

1. Flat pre-versioned URLs remain compatibility surfaces until a safe explicit migration mapping exists.
2. No automatic legacy-to-current, cross-environment or cross-release fallback is permitted.
3. Genesis generated reference remains unavailable until a frozen release-owned snapshot exists.
4. Testnet and mainnet remain unpublished and therefore have no current alias, immutable release route or authoritative generated reference.
5. Development has no immutable route because the development release identity is intentionally mutable.

## Closeout checklist

- [x] Audit development semantics.
- [x] Audit Genesis semantics.
- [x] Audit unpublished testnet semantics.
- [x] Audit unpublished mainnet semantics.
- [x] Verify current/historical fail-closed behavior from DOC-13 contracts and validators.
- [x] Verify generated-reference authority boundaries.
- [x] Record deliberate compatibility exceptions and unsupported historical states.
- [ ] Confirm DOC-13.9 exact-head 420Docs qualification with the new publication-safety stage enabled.
- [ ] Reconcile PR #232 with current `main`.
- [ ] Run exact-head 420Docs Qualification after reconciliation.
- [ ] Run exact-head 420 Integrated Qualification after reconciliation.
- [ ] Confirm PR mergeability and complete the single DOC-13 merge.

DOC-13.10 remains open until the reconciliation and exact-head qualification items above are complete.

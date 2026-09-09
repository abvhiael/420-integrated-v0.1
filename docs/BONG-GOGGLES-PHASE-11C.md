# Bong Goggles Phase 11C — Passkey / Session-Key Production UX Boundary

Phase 11C connects the previously merged `BongGogglesSessionPolicy420` classification surface to the live `SmartAccount420` authorization model qualified in Wallet W12.3.

## Goals

- use scoped SmartAccount session keys for routine zero-value Bong Goggles social actions
- escalate sensitive social actions to owner/passkey authority
- fail closed on unknown calls and any native-value transfer
- invalidate stale device/session state automatically when `authorizationEpoch` changes
- verify the exact target + selector capability grant before a client treats a routine action as session-authorized
- reuse the existing Phase 11 device-binding digest rather than create a competing device identity format

## Architecture

`BongGogglesSessionAccess420` is a read-only bridge. It never creates keys, grants capabilities, revokes keys, signs operations, executes transactions or moves value.

The authority chain remains:

1. `BongGogglesSessionPolicy420` classifies a target + selector as routine, owner-confirm-required or denied.
2. `SmartAccount420` remains authoritative for `authorizationEpoch`, session-key epoch, component identity and canonical target + selector scope.
3. `CapabilityRegistry420` remains authoritative for the active `SESSION_EXECUTE` grant.
4. Sensitive actions route to the wallet owner/passkey path instead of receiving a routine session grant.

## Phase 11C invariants

- **BG-INV-11C-001 — Zero-value routine sessions:** no Bong Goggles routine session path accepts native `$420` value.
- **BG-INV-11C-002 — Exact call scope:** a session is authorized only for the exact current-epoch SmartAccount target + selector scope.
- **BG-INV-11C-003 — Epoch invalidation:** recovery, revoke-all, credential replacement or any other authorization-epoch change invalidates stale session/device state.
- **BG-INV-11C-004 — Sensitive escalation:** block, unblock, destructive deletion and other owner-confirm-required actions cannot use the routine session path.
- **BG-INV-11C-005 — Unknown-call default deny:** unknown targets/selectors do not silently escalate into an executable wallet path.
- **BG-INV-11C-006 — Capability registry authority:** a nonzero active `SESSION_EXECUTE` grant and a positive canonical authorization check are both required.
- **BG-INV-11C-007 — Device-binding continuity:** Phase 11C reuses the existing Bong Goggles session-device digest domain.

## Current boundary

This phase establishes the production authorization/readiness boundary consumed by the Bong Goggles client. Browser onboarding, device/session presentation and passkey ceremony orchestration remain wallet/client responsibilities and must consume these canonical policy results rather than recreate authorization logic locally.

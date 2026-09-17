---
title: APPSTORE-10 Qualification and Closeout
audience: [developer, operator, security]
category: application
status: development
version: current
---
# APPSTORE-10 — qualification and closeout

APPSTORE-10 closes the Genesis implementation phase for 420AppStore. The phase does not add new canonical authority. It verifies that the implementation delivered in APPSTORE-0 through APPSTORE-9 still satisfies the frozen Genesis trust boundary after integration with the latest `main` branch.

## Closeout contract

The final phase requires all thirteen AppStore invariants (`APP-INV-001` through `APP-INV-013`) to remain present and enforceable, the catalogue to remain deterministically rebuildable from canonical Registry/chain inputs, the AppStore to remain non-canonical and contract-free, Wallet/Smart Accounts to remain the authorization boundary, private content and launch history to remain outside the public catalogue, and alternative catalogue clients to remain possible.

## Deterministic rebuild qualification

`appstore/closeout/closeout_test.go` rebuilds the same Registry snapshot from different source orderings and requires identical catalogue documents. This prevents source enumeration order from becoming hidden catalogue state.

## Readiness evidence

`testnet/public-services/appstore/readiness.json` records code qualification separately from public-testnet deployment. Backend and frontend URLs intentionally remain deployment placeholders until a real public-testnet endpoint exists; APPSTORE-10 must not fabricate deployment evidence.

The readiness record also enumerates all thirteen Genesis invariants and preserves the required backend, frontend, Wallet safety, curation and privacy checks.

## Main reconciliation

The long-lived APPSTORE branch must be reconciled with the latest `main` immediately before final qualification. A green pull-request merge simulation is useful evidence but does not replace updating the feature branch itself. After reconciliation, the exact resulting head must pass both 420Docs Qualification and 420 Integrated Qualification before the phase is merged.

## Merge gate

APPSTORE-10 is complete only when:

1. closeout invariant and rebuild tests pass;
2. readiness evidence is internally consistent and does not claim undeployed public URLs;
3. the feature branch contains latest `main`;
4. the exact reconciled head passes 420Docs Qualification;
5. the exact reconciled head passes 420 Integrated Qualification; and
6. PR #305 is merged once, at phase end.

Until those conditions are met, the phase remains in closeout rather than being treated as merged Genesis state.

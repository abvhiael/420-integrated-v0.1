---
title: 420 AppStore - APPSTORE-0 Architecture Baseline
audience: [developer, auditor]
category: application
status: development
version: current
---
# APPSTORE-0 architecture baseline

420AppStore is a contract-free Genesis application/service identified as `420/service/appstore/v1`. It is a catalogue and launch surface, not a canonical application registry and not an authorization system.

## Canonical sources

Canonical application/service identity, version and implementation provenance come from 420Registry / ProtocolRegistry and public chain state. 420Search, 420Explorer, 420Verify, public Identity records and public trust/security signals may contribute replaceable discovery or evidence projections, but none of those presentation sources may silently rewrite Registry or chain facts.

## Catalogue boundary

The AppStore database is non-canonical and rebuildable. Categories, ranking, featured placement, ratings, reviews, screenshots, descriptions and sponsored placement are catalogue presentation metadata. Sponsored placement must be labeled. Listing or delisting an application has no effect on canonical Registry state.

## Wallet boundary

AppStore may construct launch/deep-link context containing application and network identity. It cannot sign transactions, grant Smart Account capabilities, approve spending or bypass Wallet confirmation. 420Wallet and Smart Accounts remain the authorization boundary.

## Security meaning

A listing is not protocol endorsement, investment approval, audit certification or proof of safety. Verification/audit/deprecation/security evidence must retain source provenance. Catalogue opinion and sourced security facts must remain distinguishable.

## Privacy

Private Messenger or Commons payloads, encrypted Resource payloads, private Identity fields and raw Attention telemetry are excluded. Installation and launch history are not public by default.

## Availability and replaceability

AppStore outage, delisting or censorship must not block direct Wallet, Registry, Explorer, RPC or contract interaction with an otherwise reachable application. Alternative AppStore clients and catalogue operators may coexist while deriving canonical identity/version truth from Registry and chain state.

## APP invariants

APP-INV-001 through APP-INV-013 from `contracts/config/420appstore-genesis.json` are the qualification contract for GEN-10.6. The APPSTORE-0 architecture package encodes the core authority split, canonical/non-canonical field classes, privacy defaults and Wallet handoff restriction as executable tests.

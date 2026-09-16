---
title: APPSTORE-6 Wallet handoff and authorization boundary
audience: [developer, operator, auditor]
category: application
status: development
version: current
---
# APPSTORE-6 Wallet handoff and authorization boundary

APPSTORE-6 defines how 420AppStore launches a registered application into 420Wallet without acquiring wallet authority.

The AppStore may construct a deep link containing the canonical chain ID, service identity, application URL and optional requested action. Before handoff it presents requested wallet permissions, capability scopes and high-risk actions. Presentation order is deterministic so clients and tests see stable output.

Any handoff that requests an action requires explicit wallet confirmation. AppStore-generated handoffs cannot contain signatures, private keys, capability grants, token-spend approvals or auto-confirm directives. Attempts to include those fields fail closed.

The generated handoff uses the `420wallet://open` scheme and carries only launch context. 420Wallet and Smart Accounts remain the authorization boundary: they decide whether to connect, grant capabilities, approve token spending or sign transactions.

High-risk permissions and capability scopes are surfaced separately in the handoff presentation. This disclosure is informational and does not imply approval, endorsement or safety.

APPSTORE-6 therefore preserves APP-INV-007 and APP-INV-008: the catalogue can describe requested authority, but cannot exercise or pre-authorize it.

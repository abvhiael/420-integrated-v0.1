---
title: Troubleshooting
category: troubleshooting
status: active
version: current
---

# 420 Integrated troubleshooting

This section is the ecosystem-wide entry point for diagnosing failures, degraded behavior and recovery conditions across 420 Integrated.

DOC-11 organizes troubleshooting around two ways people actually arrive here:

1. **By symptom** — what the user, developer or operator can observe.
2. **By stable troubleshooting ID** — a durable documentation identifier that can be linked from Wallet, dApps, developer tooling, support material and later contextual help.

## Start here

- [Troubleshooting registry contract](registry-contract.md) — stable ID, severity, authority, retry and secret-safety rules.
- [Troubleshooting entry template](entry-template.md) — required shape for every registry entry.
- [Wallet, account and authorization registry](wallet-account-authorization.md) — `TRB-WALLET-001` through `TRB-WALLET-011` covering connection, network mismatch, SmartAccount420 discovery, capabilities/sessions, passkeys, signing/simulation, recovery, transaction outcomes, stale presentation and compromise response.

## Safety rules

- Never disclose or request private keys, seed phrases, passkeys, recovery secrets, signer material or authentication secrets.
- Confirm environment and chain identity before acting on addresses, contracts or service endpoints.
- Prefer canonical chain/protocol evidence over derived indexes, caches, dashboards or application presentation state.
- Treat retries of state-changing or value-changing actions as unsafe until transaction identity, canonical state and idempotency implications are understood.
- Stop and escalate when evidence is ambiguous, authority cannot be established, or a recovery step could increase loss or state divergence.

## Phase status

DOC-11.1 and DOC-11.2 are complete. The implementation roadmap is in [`DOC-11-ROADMAP.md`](DOC-11-ROADMAP.md).

Remaining domain registries will be added incrementally within the same DOC-11 branch/PR and merged only after the final ecosystem-wide troubleshooting audit and exact-head qualification.

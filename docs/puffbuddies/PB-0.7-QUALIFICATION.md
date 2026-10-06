# PB-0.7 qualification evidence

## Step

**PB-0.7 — Threat/trust model**

## Qualification level

**Level 1 — per-roadmap-step fast qualification**

## Canonical definition

PB-0.7 defines protected assets, actor classes, trust boundaries, abuse cases, authority-ownership rules, fail-closed assumptions, security-control expectations, and residual-risk acceptance criteria.

## Implementation summary

PB-0.7 adds:

- PB-THREAT-001 through PB-THREAT-040;
- protected-asset inventory;
- ordinary/malicious/Sybil/compromised-user, operator, service, client, integration, public-chain, network, breach, and bot actors;
- client/server and ecosystem trust boundaries;
- canonical abuse cases for location, graph/wallet correlation, block/eligibility bypass, post-revocation messaging, scraping, impersonation, moderation abuse, insider misuse, metadata leakage, deletion remanence, credential compromise, rate abuse, dependency compromise, and replay;
- authority-ownership/fail-closed principles;
- later security-control expectations and risk-acceptance rule.

No runtime security control, service integration, contract, fixed address, service ID, deployment, or live infrastructure is introduced by PB-0.7.

## Files changed

- `docs/puffbuddies/PB-0.7-THREAT-TRUST-MODEL.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `scripts/verify-puffbuddies-pb0.py`
- `docs/puffbuddies/PB-0.7-QUALIFICATION.md`

## Requirements satisfied

- PB-THREAT-001 through PB-THREAT-040 exist exactly once and in sequence;
- protected assets are explicitly identified;
- actor classes include ordinary/malicious/Sybil/compromised users, operators, services, clients, integrations, public-chain/network observers, breach adversaries, and bots;
- trust boundaries are defined for clients, operators, 420Identity, 420Messenger, 420Notifications, 420Pay, public chain, Search/Indexer/Explorer, and private data;
- canonical abuse cases cover location triangulation, relationship-graph reconstruction, wallet correlation, block/ban bypass, post-revocation messaging, eligibility bypass, scraping/enumeration, impersonation, moderation abuse, insider misuse, metadata leakage, deletion remanence, credential compromise, rate/resource abuse, dependency compromise, and replay/stale state;
- one canonical authority owner per decision class is required;
- safety/consent/eligibility uncertainty fails closed;
- external dependencies are capability-limited;
- later security-control expectations and residual-risk acceptance criteria are documented;
- no runtime security implementation, contract, fixed address, service ID, deployment, or live integration is claimed.

## Implementation SHA

`1c281449650694393a78b448074b6225581ad824`

## Current main/base SHA

Current `main`: `b5703dd932f28129a7898fafc579e084e5619b2f`

PR #526 remains on historical base and requires later accumulated-branch reconciliation. Current-main changes inspected before PB-0.7 were unrelated compute/global qualification changes and do not alter PuffBuddies PB-0.7 dependencies.

## CI evidence

Workflow: **PuffBuddies PB-0 Qualification**

Exact-head push qualification:
- run: `37283701536` — **PASS**
- job: `111677481109` (`pb0-fast`) — **PASS**
- exact-head checkout — **PASS**
- exact-head SHA verification — **PASS**
- cumulative PB-0 verifier — **PASS**
- accidental PuffBuddies runtime/contract implementation rejection — **PASS**

Exact-head pull-request qualification:
- run: `37283706089` — **PASS**
- job: `111677496643` (`pb0-fast`) — **PASS**

## Security/adversarial/invariant scope

The verifier must reject missing/duplicate/reordered PB-THREAT IDs and must preserve actor, boundary, abuse-case, authority-owner, fail-closed, and no-false-implementation requirements.

## Milestone status

PB-0.7 is not a Level 2 integration milestone. It defines the threat/trust model but introduces no executable shared integration.

## Intentionally deferred checks

Level 2 retained PuffBuddies integration is not required for PB-0.7.

Level 3 comprehensive repository qualification and current-main merge-candidate reconciliation remain deferred to the applicable phase boundary.

## Limitations

PB-0.7 defines threat assumptions and required control classes. Exact implementations, vendors, cryptography, rate thresholds, monitoring, incident response, moderation tooling, and infrastructure hardening remain later roadmap work.

## Blockers

None for PB-0.7.

## Completion state

**PB-0.7 — COMPLETE**

All canonical PB-0.7 exit criteria are satisfied on exact implementation SHA `1c281449650694393a78b448074b6225581ad824`.

## Next canonical roadmap step

**PB-0.8 — Ecosystem dependencies**

# 420Town security hardening

TOWN-AUDIT-9 records the focused pre-Level-3 security hardening baseline for 420Town.

## Qualified security surfaces

The security suite covers:

- membership and role privilege escalation;
- community-scope isolation;
- unauthorized moderation and alternate-path moderation bypass;
- visibility leakage;
- replay/conflicting duplicate writes;
- bounded API request and idempotency inputs;
- spam, Sybil, vote and aggregate-community rate abuse;
- public Search poisoning;
- Storage object/pointer/digest substitution;
- Messenger authorization, malformed-envelope rejection and plaintext-surface absence;
- wallet chain/target/value pinning;
- reference-only treasury behavior with no Town value custody.

The machine-readable inventory is `config/420town-security-v1.json`.

## Explicit non-applicable cases

These roadmap checks are not silently skipped:

- signed-action domain separation/nonces: no signed-action surface exists in Town;
- treasury/accounting conservation: Town stores only an external treasury authority/address reference and has no balance or custody ledger;
- reentrancy/external-call value movement: TownAuthority420 has no payable/value-moving application path;
- webhook replay: Town webhooks remain disabled, and the API contract requires signed replay protection before enablement.

If any of those surfaces is later introduced, its NOT_APPLICABLE classification becomes invalid and TOWN-AUDIT-9 security qualification must be extended.

## Accepted design risks

Accepted design risks are distinct from unresolved vulnerabilities.

1. Repository API authentication is dependency-injected. `StaticTokenAuthenticator` is suitable for tests/local wiring, but production authentication infrastructure remains a testnet/production deployment requirement.
2. Messenger transport is replaceable. Transport acceptance currently precedes canonical envelope commit, so production retry/idempotency behavior must prevent duplicate user-visible delivery if the canonical commit fails after transport acceptance.
3. Repository web configuration intentionally leaves live chain and TownAuthority420 bindings unmaterialized and fails closed until testnet deployment supplies them.

No unresolved repository-side vulnerability is accepted by this baseline. Live deployment risks remain subject to TOWN-AUDIT-11 and TOWN-AUDIT-12.

## Qualification model

TOWN-AUDIT-9 is an app security milestone: Level 1 focused qualification is mandatory and Level 2 is appropriate because the checks cross authority, content, moderation, API, integrations and browser transaction safety. Repository-wide Level 3 remains deferred to TOWN-AUDIT-10.

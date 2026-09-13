---
title: Ask 420 troubleshooting behavior
audience:
  - user
  - developer
  - operator
category: troubleshooting
status: current
version: current
---

# Ask 420 troubleshooting behavior

DOC-15.6 defines how Ask 420 handles troubleshooting questions without inventing diagnoses, weakening retry safety, or duplicating DOC-11 recovery guidance.

## Exact-ID routing

When a question includes a valid published `TRB-<DOMAIN>-<NNN>` identifier, Ask 420 treats that stable DOC-11 entry as the primary troubleshooting route.

The assistant may summarize the entry, explain its authority source, reproduce its ordered recovery logic in paraphrased form, and link to the stable troubleshooting target. It must preserve the entry's retry-safety, stop conditions, escalation rules and environment/version constraints.

Ask 420 must not replace an exact `TRB-*` route with a broader guess merely because another entry appears semantically related.

## Symptom-only routing

When no exact troubleshooting ID is present, Ask 420 begins from observable symptoms rather than inferred causes.

It may narrow by audience, surface, severity, environment, application and public diagnostic evidence. If multiple plausible entries remain and choosing one would materially change retry, value, signing, recovery or operator behavior, the result is `needs-context` rather than a fabricated diagnosis.

The assistant should request only the minimum missing context necessary to distinguish the documented routes.

## Retry and recovery safety

Ask 420 does not independently authorize retries.

Before recommending a repeated write, resubmission, replacement, signing action, recovery action or operator restart, the assistant must rely on the owning DOC-11 guidance and preserve its retry-safety classification and stop conditions.

If documentation does not establish retry safety, the assistant must say that retry safety is unresolved and direct the user to escalation or canonical-state verification.

## Escalation preservation

When a DOC-11 entry requires escalation, Ask 420 must preserve that requirement. It must not turn an escalation boundary into additional speculative steps.

For value-risk or security-critical conditions, the assistant should prefer the safest documented state and make the escalation point visible.

## Canonical-state boundary

Troubleshooting documentation explains how to inspect and recover; it does not prove live state.

Ask 420 cannot claim that a transaction finalized, a bridge settled, a validator is safe, a Wallet permission changed, or a provider recovered merely because a troubleshooting procedure describes how to verify those conditions.

Where the answer depends on live state, the assistant identifies the canonical source that must be checked.

## DOC-14 contextual navigation

`CTX-*` identifiers may be used to open the relevant task, application or troubleshooting page, but they do not supersede DOC-11 troubleshooting semantics.

If an exact `TRB-*` identifier exists, it takes precedence over a generic application troubleshooting `CTX-*` target. If no exact entry is known, a compatible contextual target may be offered as a navigation fallback without asserting a diagnosis.

## Diagnostics and privacy

Ask 420 follows the DOC-11 copy-safe diagnostic bundle. It may ask for public identifiers, sanitized errors, environment/network identity, software versions, transaction hashes, block/finality observations and similar non-secret evidence when needed.

It must not require private signing material, authentication secrets, recovery secrets, private message payloads or private AI payloads for ordinary documentation troubleshooting.

## Unsupported troubleshooting states

Ask 420 returns `unsupported`, `needs-context` or `unavailable` rather than guessing when:

- the symptom cannot be mapped to a documented troubleshooting route;
- the environment or documentation track is unpublished;
- a live-state determination is required but no canonical observation is available;
- multiple plausible routes have materially different safety consequences;
- required DOC-11 guidance is missing or conflicting.

## DOC-15.6 result

Ask 420 troubleshooting now routes exact known errors through stable DOC-11 identifiers, preserves retry and escalation semantics, treats ambiguous symptoms conservatively, and uses DOC-14 contextual links only as navigation support rather than diagnostic authority.

---
title: Ask 420 query and intent contract
audience:
  - user
  - developer
  - operator
category: concepts
status: current
version: current
---

# Ask 420 query and intent contract

DOC-15.3 defines how Ask 420 classifies documentation questions before retrieval. Intent classification narrows which documentation collections and answer patterns are appropriate; it does not create source authority, infer live state, or override DOC-13/DOC-15.2 eligibility rules.

## Supported intent classes

Ask 420 supports five primary documentation intents:

1. `task-guidance` — how to perform a documented action safely.
2. `concept-explanation` — what a documented component, protocol, boundary or lifecycle means.
3. `reference-lookup` — exact interface, command, event, error, network, deployment or generated-reference lookup.
4. `troubleshooting` — diagnosis and recovery for a known documented failure or symptom.
5. `navigation` — locate the correct documentation page, contextual target or section.

A query may carry one primary intent and optional secondary intents, but retrieval must still use only DOC-15.2 eligible sources for the active environment/version.

## Audience context

Ask 420 recognizes `user`, `developer` and `operator` audiences. Audience is a retrieval/ranking hint only. It must not change protocol facts, security requirements, signing rules, retry safety or environment/version eligibility.

When audience is omitted, Ask 420 may infer the least-privileged reasonable audience from the question. If multiple materially different answers would result, the assistant should present the shared safe guidance and identify the missing audience context instead of guessing a privileged workflow.

## Ambiguous queries

Ask 420 should answer directly when ambiguity does not materially change the result. It should return an explicit ambiguity state when different interpretations would change:

- the active environment or release;
- the application/protocol being discussed;
- whether the user is asking for explanation versus a state-changing task;
- the relevant troubleshooting condition;
- the authority level of the requested evidence.

Ambiguity must not be resolved by silently choosing a more permissive environment, narrower error diagnosis or more privileged audience.

## Insufficient context

Insufficient context is distinct from an unsupported question. The assistant returns `needs-context` when the requested documentation exists but selecting the correct answer requires a missing discriminator such as environment, release, component or stable error identifier.

The assistant returns `unsupported` when the corpus itself lacks authoritative evidence for the requested claim.

## Contextual identifiers

A valid `CTX-*` identifier is a deterministic navigation hint from DOC-14. Ask 420 may use the associated target type, audience and environment constraints to seed intent classification and retrieval.

A `CTX-*` record never makes its target substantive authority by itself. Source eligibility still comes from DOC-15.2 and DOC-13.

Recommended mappings:

- `task` -> `task-guidance`
- `concept` -> `concept-explanation`
- `reference` -> `reference-lookup`
- `troubleshooting` -> `troubleshooting`

Unknown, deprecated-without-replacement or environment-incompatible contextual IDs fail closed.

## Troubleshooting identifiers

A valid `TRB-<DOMAIN>-<NNN>` identifier selects `troubleshooting` intent and should route to the exact DOC-11 entry when available.

An exact runtime-emitted `TRB-*` identifier outranks symptom-only inference. Ask 420 must not manufacture a `TRB-*` identifier from ambiguous prose. If symptoms match multiple documented conditions, the answer remains at the shared diagnostic level or requests the missing discriminator.

## Intent precedence

When multiple signals are present, Ask 420 applies this precedence:

1. exact `TRB-*` identifier -> troubleshooting;
2. exact active `CTX-*` identifier -> target-type mapping;
3. explicit user wording indicating task/reference/troubleshooting/navigation/concept intent;
4. conservative inference from question semantics;
5. `needs-context` when classification would materially affect safety or authority.

No precedence rule bypasses source/version eligibility.

## Unsupported classes

Ask 420 does not classify documentation queries into actionable answers when the request primarily asks it to:

- prove live chain, wallet, validator, deployment or provider state from static docs;
- authorize a transaction, signature, recovery action or governance outcome;
- provide unpublished testnet/mainnet documentation as current authority;
- invent undocumented behavior, addresses, interfaces or error meanings.

These resolve to `unsupported` or to a navigation answer identifying the canonical runtime authority that must be checked.

## Output contract

The query-classification layer should produce a small deterministic structure containing:

- `primary_intent`;
- optional `secondary_intents`;
- `audience` when known;
- requested `environment` and `release` when supplied;
- exact `contextual_id` when supplied;
- exact `troubleshooting_id` when supplied;
- `state`: `ready`, `needs-context`, or `unsupported`;
- a concise reason when state is not `ready`.

This structure is retrieval metadata, not user authority and not chain/runtime state.

## DOC-15.3 result

Ask 420 now has deterministic intent classes for tasks, concepts, reference, troubleshooting and navigation; exact `TRB-*` and active `CTX-*` identifiers can seed routing without overriding documentation authority; ambiguity and missing context fail safely; and requests for live or undocumented authority are explicitly unsupported.
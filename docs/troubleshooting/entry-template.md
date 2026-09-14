---
title: Troubleshooting entry template
audience:
  - contributor
  - developer
  - operator
category: troubleshooting
status: current
version: current
---

# Troubleshooting entry template

Use this template for DOC-11 troubleshooting entries. Replace every placeholder. Do not publish an entry without an authority source, retry classification, safe diagnostics, recovery steps and escalation boundary.

```md
---
title: <plain-language title>
audience:
  - <user|developer|operator>
category: troubleshooting
status: current
version: current
troubleshooting_id: TRB-<DOMAIN>-<NNN>
surface: <surface>
severity: <info|degraded|blocked|value-risk|security-critical>
retry_safety: <safe|conditional|unsafe|not-applicable>
---

# TRB-<DOMAIN>-<NNN> — <title>

## What you see

<Observable symptom.>

## What this usually means

<Short bounded interpretation. Do not claim certainty unless the evidence establishes it.>

## Authority to check

<Canonical or highest relevant authority source. Explain derived-service limits where relevant.>

## Before you retry

<State whether retry is safe and what must be checked first. A timeout is not proof a write failed.>

## Safe diagnostics

- <non-secret evidence>
- <non-secret evidence>

Never provide seed phrases, private keys, passkey secrets, recovery secrets, bearer tokens, session credentials or unredacted authentication headers.

## Likely causes

1. <cause>
2. <cause>

## Recovery steps

1. <ordered recovery step>
2. <ordered recovery step>
3. <verification step>

## Stop and escalate when

<Clear stop conditions and what safe context to provide.>

## Related documentation

- <canonical task/how-to link>
- <architecture/authority link>
- <generated-reference link when useful>
- <related TRB entry>
```

## Authoring rules

- Start from an observable symptom, not an internal implementation guess.
- Keep one stable troubleshooting condition per ID.
- Prefer one authority source and state fallback limitations explicitly.
- Separate diagnosis from recovery.
- Put retry guidance before recovery steps for any state-changing action.
- State value risk and finality assumptions explicitly.
- Link to canonical task guidance instead of copying long procedures.
- Link to DOC-10 for exact machine-derived selectors, methods, events or errors.
- Keep support diagnostics copy-safe and redact credentials.
- Never use lower-authority UI or derived data to overwrite canonical state merely to make surfaces agree.

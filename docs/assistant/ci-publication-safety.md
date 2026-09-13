---
title: Ask 420 CI and publication safety
audience:
  - developer
  - operator
category: contributing
status: current
version: current
---

# Ask 420 CI and publication safety

DOC-15.9 makes Ask 420 configuration part of the unified 420Docs qualification gate.

## Qualification stages

The documentation runner executes dedicated checks for:

- source-registry integrity;
- query/intent routing;
- citation and evidence policy;
- network/version coupling;
- troubleshooting behavior;
- privacy/data boundaries;
- 420AI integration;
- cross-policy publication safety.

These stages run before the normal link, coverage, generated-reference, publication, workflow and MkDocs checks.

## Publication blockers

Ask 420 configuration must fail qualification when a required policy or validator is missing, malformed or inconsistent with the currently published documentation environments.

Detailed semantic checks remain owned by the individual DOC-15 validators. The publication-safety validator provides a final cross-policy presence and schema gate so a partially configured assistant cannot reach publication.

## Workflow trigger contract

Changes under `docs/**` already trigger 420Docs qualification. In addition, every `scripts/validate-doc-assistant-*.py` change is explicitly covered by both pull-request and `main` push triggers.

The workflow contract validator confirms the required Ask 420 runner stages and trigger surface remain present.

## Environment safety

DOC-13 remains the publication authority. At the current repository state, development and Genesis are published documentation tracks; testnet and mainnet remain unpublished and therefore unavailable to authoritative Ask 420 answers.

Publishing a new environment requires an intentional DOC-13 publication change plus corresponding Ask 420 policy updates. The assistant must not infer publication from the existence of source files alone.

## CI invariants

- No Ask 420 policy change may bypass the unified documentation runner.
- No assistant validator change may bypass the documentation workflow trigger set.
- Missing policy surfaces fail qualification.
- Unpublished environments remain unavailable.
- Individual DOC-15 validators remain the authority for their own schema and semantic contracts.
- A green assistant gate does not promote AI output or documentation into chain/runtime authority.

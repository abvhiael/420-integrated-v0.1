---
title: DOC-15 Ask 420 documentation assistant roadmap
audience:
  - developer
  - operator
category: contributing
status: active
version: current
---

# DOC-15 — Ask 420 documentation assistant roadmap

DOC-15 defines the documentation-assistant layer for 420Docs. Ask 420 answers ecosystem questions from canonical documentation, identifies the active documentation environment/version, cites the sources used, and fails closed when the available documentation cannot support a reliable answer.

DOC-15 is monolithic: DOC-15.1 through DOC-15.10 remain on one branch/PR and merge only after final audit, reconciliation with current `main`, exact-head 420Docs Qualification and exact-head 420 Integrated Qualification are green.

## DOC-15.1 — Grounding and authority contract

- [ ] Define Ask 420 authority and non-authority boundaries.
- [ ] Require answers to be grounded in canonical 420Docs sources.
- [ ] Define citation requirements and unsupported-answer behavior.
- [ ] Preserve chain/protocol/runtime authority over documentation and assistant output.
- [ ] Define relationship to 420AI without granting AI provider or model authority.

## DOC-15.2 — Retrieval corpus and source registry

- [ ] Define machine-readable source inventory for assistant retrieval.
- [ ] Classify canonical, generated, historical and compatibility-only sources.
- [ ] Exclude unpublished or non-authoritative material from authoritative answers.
- [ ] Add deterministic source-registry validation.

## DOC-15.3 — Query and intent contract

- [ ] Define supported user, developer and operator question classes.
- [ ] Distinguish task guidance, concepts, reference lookup, troubleshooting and navigation.
- [ ] Define ambiguous-query and insufficient-context behavior.
- [ ] Map contextual `CTX-*` and troubleshooting `TRB-*` identifiers into assistant intent.

## DOC-15.4 — Citation and evidence model

- [ ] Define source citation format and minimum evidence requirements.
- [ ] Require citations for concrete ecosystem claims.
- [ ] Preserve generated-reference provenance and canonical-versus-derived boundaries.
- [ ] Define answer confidence/coverage semantics without inventing authority scores.

## DOC-15.5 — Network and version context

- [ ] Couple answers to DOC-13 publication/version authority.
- [ ] Use development/Genesis context only when actually published and applicable.
- [ ] Fail closed for unpublished testnet/mainnet documentation tracks.
- [ ] Preserve immutable historical release behavior.

## DOC-15.6 — Troubleshooting assistant behavior

- [ ] Route exact known errors through stable DOC-11 `TRB-*` entries.
- [ ] Preserve retry-safety, escalation and canonical-source checks.
- [ ] Prevent the assistant from fabricating narrower diagnoses from ambiguous symptoms.
- [ ] Integrate DOC-14 contextual targets as navigation hints.

## DOC-15.7 — Privacy, safety and prompt/data boundaries

- [ ] Define allowed question/session metadata.
- [ ] Prevent secrets or sensitive payloads from being required for documentation help.
- [ ] Define retention/minimization expectations for assistant telemetry.
- [ ] Preserve Wallet, Identity, Messenger, Attention and 420AI privacy boundaries.

## DOC-15.8 — 420AI integration contract

- [ ] Define provider-neutral Ask 420 inference jobs through 420AI.
- [ ] Separate retrieval authority from model/provider execution.
- [ ] Define bounded context packages, citation payloads and result validation.
- [ ] Define provider failure, timeout and unavailable-model behavior.

## DOC-15.9 — Assistant CI and publication safety

- [ ] Validate source registry, version coupling, citations and unsupported-state policies.
- [ ] Detect stale/missing assistant corpus entries.
- [ ] Integrate Ask 420 validation into unified 420Docs qualification.
- [ ] Audit workflow triggers for all DOC-15 policy and registry surfaces.

## DOC-15.10 — Coverage audit and closeout

- [ ] Audit user, developer, operator, troubleshooting, generated-reference and historical-answer flows.
- [ ] Verify citations and environment/version behavior.
- [ ] Record deliberate unsupported question classes and unavailable environments.
- [ ] Reconcile branch with current `main`.
- [ ] Run exact-head 420Docs Qualification.
- [ ] Run exact-head 420 Integrated Qualification.
- [ ] Merge DOC-15 only when the monolithic phase is fully green.

## Exit condition

Ask 420 can answer supported documentation questions from canonical 420Docs evidence with explicit source citations and correct environment/version context; it never promotes model output, providers, derived services or documentation into chain/protocol authority; unsupported or unpublished states fail closed; and CI prevents stale or ungrounded assistant configuration from reaching publication.

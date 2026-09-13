---
title: DOC-15 Ask 420 documentation assistant roadmap
audience:
  - developer
  - operator
category: contributing
status: complete
version: current
---

# DOC-15 — Ask 420 documentation assistant roadmap

DOC-15 defines Ask 420 as a grounded 420Docs assistant. The phase is monolithic on PR #234 and may merge only after the final branch head is reconciled with current `main` and exact-head 420Docs plus 420 Integrated qualification are green.

## DOC-15.1 — Grounding and authority contract — COMPLETE

- [x] Canonical 420Docs grounding and citations.
- [x] Chain/protocol/runtime authority remains external to assistant output.
- [x] 420AI/model/provider output is non-authoritative.

Deliverable: `grounding-authority-contract.md`.

## DOC-15.2 — Retrieval corpus and source registry — COMPLETE

- [x] Machine-readable governed corpus.
- [x] Canonical, generated, historical and compatibility classes.
- [x] Unpublished/non-authoritative material excluded from authoritative answers.
- [x] Deterministic registry validation.

Deliverables: `source-registry.json`, `retrieval-corpus-contract.md`, `scripts/validate-doc-assistant-source-registry.py`.

## DOC-15.3 — Query and intent contract — COMPLETE

- [x] User/developer/operator query classes.
- [x] Task, concept, reference, troubleshooting and navigation intents.
- [x] `needs-context` and `unsupported` behavior.
- [x] `CTX-*` and `TRB-*` routing.

Deliverables: `query-intent-contract.md`, `intent-map.json`, `scripts/validate-doc-assistant-intents.py`.

## DOC-15.4 — Citation and evidence model — COMPLETE

- [x] Claim-level citation payload and minimum evidence rules.
- [x] Generated-reference provenance and historical-release evidence boundaries.
- [x] Discrete coverage states without invented numeric authority scores.

Deliverables: `citation-evidence-contract.md`, `citation-evidence-schema.json`, `scripts/validate-doc-assistant-citations.py`.

## DOC-15.5 — Network and version context — COMPLETE

- [x] DOC-13 publication/version authority coupling.
- [x] Development and Genesis current contexts only where published.
- [x] Testnet/mainnet fail closed while unpublished.
- [x] Immutable historical Genesis behavior.

Deliverables: `network-version-context.md`, `network-version-policy.json`, `scripts/validate-doc-assistant-network-version.py`.

## DOC-15.6 — Troubleshooting assistant behavior — COMPLETE

- [x] Exact `TRB-*` routing and DOC-11 retry/escalation semantics.
- [x] Ambiguous symptoms do not become fabricated diagnoses.
- [x] DOC-14 `CTX-*` targets remain navigation hints only.

Deliverables: `troubleshooting-behavior.md`, `troubleshooting-policy.json`, `scripts/validate-doc-assistant-troubleshooting.py`.

## DOC-15.7 — Privacy, safety and prompt/data boundaries — COMPLETE

- [x] Minimum question/session metadata.
- [x] Secrets and unrelated private payloads prohibited.
- [x] Telemetry minimization and default non-retention boundaries.
- [x] Wallet, Identity, Messenger, Attention and 420AI privacy boundaries preserved.

Deliverables: `privacy-data-boundaries.md`, `privacy-policy.json`, `scripts/validate-doc-assistant-privacy.py`.

## DOC-15.8 — 420AI integration contract — COMPLETE

- [x] Provider-neutral 420AI inference contract.
- [x] Retrieval authority separated from execution providers/models.
- [x] Bounded context/citation packages and result validation.
- [x] Failure, timeout and reroute behavior fails closed.

Deliverables: `420ai-integration-contract.md`, `420ai-integration-policy.json`, `scripts/validate-doc-assistant-420ai.py`.

## DOC-15.9 — Assistant CI and publication safety — COMPLETE

- [x] All DOC-15 validators wired into unified 420Docs qualification.
- [x] Assistant publication-safety gate added.
- [x] Workflow policy and GitHub Actions path triggers audited.
- [x] Stale/missing corpus and unsupported publication states fail qualification.

Deliverables: `ci-publication-safety.md`, `scripts/validate-doc-assistant-publication.py`, updated unified runner/workflow policy/workflow.

## DOC-15.10 — Coverage audit and closeout — COMPLETE

- [x] User, developer, operator, troubleshooting, generated-reference and historical flows audited.
- [x] Citation and environment/version behavior verified.
- [x] Deliberate unsupported/unavailable states recorded.
- [x] Branch checked against current `main`; no newer main commit exists at closeout.
- [x] Final exact-head qualification is the merge gate.

Deliverables: `coverage-audit.json`, `DOC-15.10-CLOSEOUT.md`.

## Exit condition

Ask 420 answers supported documentation questions from registered 420Docs evidence with citations and correct environment/version context. It never promotes model/provider output or documentation into chain/protocol authority. Unsupported, unpublished or insufficiently evidenced states fail closed. DOC-15 merges only when the final exact head is green.

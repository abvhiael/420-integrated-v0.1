# DOC-15.8 — 420AI integration contract — COMPLETE

DOC-15.8 is complete.

Deliverables:

- `docs/assistant/420ai-integration-contract.md`
- `docs/assistant/420ai-integration-policy.json`
- `scripts/validate-doc-assistant-420ai.py`

Ask 420 now executes inference through a provider-neutral 420AI boundary after environment resolution, intent classification and retrieval. Models receive only a bounded, attributable evidence package. Providers and models cannot add excluded sources, alter environment/release context, weaken citations, broaden privacy or verification constraints, or promote themselves into documentation/protocol authority.

Candidate answers must pass post-inference validation before publication. Provider/model failure may use only an approved constraint-preserving reroute; otherwise Ask 420 returns unavailable. Timeouts require 420AI/ComputeMarket job-state reconciliation before retry so ambiguous execution does not create duplicate paid work.

DOC-15.9 will wire the DOC-15 validators into unified 420Docs qualification and publication safety.

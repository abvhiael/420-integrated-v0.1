---
title: DOC-15.6 troubleshooting assistant closeout
audience:
  - developer
  - operator
category: contributing
status: complete
version: current
---

# DOC-15.6 — Troubleshooting assistant behavior — COMPLETE

DOC-15.6 is complete.

Delivered:

- `docs/assistant/troubleshooting-behavior.md`
- `docs/assistant/troubleshooting-policy.json`
- `scripts/validate-doc-assistant-troubleshooting.py`

Ask 420 now gives exact published `TRB-*` identifiers precedence, preserves DOC-11 retry-safety and escalation semantics, treats ambiguous symptom routing as `needs-context`, keeps live-state claims subordinate to canonical observations, and uses DOC-14 `CTX-*` targets only as navigation fallback rather than diagnostic authority.

DOC-15.9 will wire the troubleshooting validator into unified 420Docs qualification.

# ANALYTICS-4.3 — cohorts and rankings

ANALYTICS-4.3 adds deterministic, rebuildable cohort and ranking derivation to 420Analytics without creating protocol authority, identity authority, staking authority or eligibility authority.

## Contract

- Inputs must carry qualified `420Indexer` provenance.
- Cohort definitions are explicitly versioned and documented.
- Entity identifiers and cohort keys are normalized before grouping.
- A single entity may appear at most once in one build.
- Scores must be finite numeric text.
- Rankings are ordered by score descending.
- Equal scores are resolved by normalized entity ID ascending, producing deterministic tie-breaking.
- Cohort keys are emitted in lexical order.
- Cohorts below the configured privacy threshold are not exposed. Only the aggregate count of suppressed cohorts is returned.
- The default privacy threshold is five members; callers may raise it, and explicit thresholds below two are rejected.
- Results are content-addressed from definition, provenance, exposed cohorts, rankings and suppression count.
- Results are always `canonical=false` and `rebuildable=true`.

## Privacy boundary

This phase does not admit private Messenger content, private Commons content, private Identity fields, encrypted Resource payloads or raw Attention telemetry. Small cohorts are withheld to reduce disclosure risk. ANALYTICS-6.1 will add broader admission-policy enforcement across all Analytics inputs.

## Qualification

Tests cover deterministic score ordering and tie-breaking, privacy-threshold suppression, duplicate-entity rejection, qualified provenance enforcement, stable result identity independent of input order, and rejection of canonical outputs.

ANALYTICS-4.3 remains derived presentation data only. Cohort membership and rank do not grant rights, permissions, governance weight, validator status, rewards, eligibility or protocol execution authority.

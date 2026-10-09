# CMP S-02 — Read-only ingestion client boundaries

Implementation scoped to the canonical S-02 roadmap; `compute/ingestion` is an isolated off-chain module with no signer, contract write path or reward authority.

Features: injected read-only HTTP transport and DNS verification, exact HTTPS origin/path, explicit source enablement plus permission approval, disabled Folding@home and BOINC profiles, bounded response/timeout/poll interval, failed-source rate backoff, schema-limited aggregate parsing, source digest/cursor and redacted non-authoritative observations.

**Not a live connector:** no upstream provider endpoint used, no provider approval proven, and no actual ingestion persistence or authenticated contribution proof exists. DNS validation is performed before injected HTTP fetch but does not pin the transport connection to that DNS set; do not approve deployment until resolved with trusted transport. The regex-limited parsers are fixture profile validators, not assertions about current upstream data formats. Real BOINC projects require per-project endpoints, XML compression handling and their own terms. Real Folding@home bulk format requires source verified schema. Unsupported or changed formats fail closed.

[Level-1 implementation qualification and blockers](CMP-S02-QUALIFICATION-EVIDENCE.md).

S-02 exit remains **BLOCKED** for real provider endpoint qualification; actual sanctioned source responses must be preserved before moving to S-03 as fully qualified.

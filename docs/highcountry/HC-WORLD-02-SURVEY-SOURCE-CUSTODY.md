# HC-WORLD-02 — Real-world geographic certification custody gate

## Source audit (2026-10-27)

The merged repository contains 31,260 **synthetic** reservation rectangles, 45 settlement descriptions, and 64 **draft** heritage buffers. It does not include three complete approved regional terrain-source files, measured road corridors, verified easement instruments or signed official owner decisions for 31,260 actual mapped properties. **The geographic certification milestone remains BLOCKED; parcels must stay unissued.** Never substitute the deterministic draft atlas for a real terrain overlay.

## Implemented independent admission boundary

`scripts/highcountry/hc-world-02-survey-custody.mjs` requires actual raw terrain-source bytes for **each** of three regions. It checks SHA-256 against each submitted region's committed terrain hash; checks a trusted Ed25519 public key and signature over domain-separated regional ID, source-byte hash, survey-payload hash, and key ID; and then invokes the exhaustive 31,260-title geometry/road/heritage validator. The source bytes and approval records are deliberately external inputs, not self-proving JSON. `verifySurveyBundleFiles()` accepts the three terrain file paths, signed approval JSON, trusted keyring JSON, and full-world survey JSON. A source hash-shaped string or `OWNER_APPROVED` field alone no longer satisfies this custody path.

Signing scope is the canonical `JSON.stringify` of the regional object after removing `status` and `approvalEvidence`; full-world geometry validation remains mandatory. Treat approvedKeys as a **separately trusted, governance-controlled keyring**, never as an untrusted attribute of the uploaded survey. A compromised key or incorrect owner approval process is outside cryptographic proof and requires governance controls.

This is a prerequisite for release certification, not a grant of ownership or map authority. The older geometry-only verifier remains useful for unit testing but MUST NOT be used for admission without signed source custody.

## Still required for actual full certification

1. Owner supplies authoritative source terrain data, definitive world coordinates/masks, measured exclusion polygons and 64 preserved heritage sites; independently record source file hashes.
2. Produce 10,420 nonoverlapping geographically placed, correctly classified parcels **per region** (31,260 total), physically connected roads and individually proved frontage or registered easement; all region land budgets must be measured, not assumed from synthetic strips.
3. Separately approve each region with trusted signing key and retained evidence. Run `verifySurveyBundleFiles` on those exact files, pin all source and approval hashes plus the result SHA; perform bounded Level 1 and Level 2 checks.
4. Preserve 31,260 `RESERVED_UNISSUED` titles until complete qualified certification and a separate issuance/governance decision.

No claim that physical surveying or owner signatures already exist is made by these changes.

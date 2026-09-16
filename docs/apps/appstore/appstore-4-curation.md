---
title: APPSTORE-4 Curation and Presentation Metadata
audience: [developer, auditor]
category: application
status: development
version: current
---
# APPSTORE-4 — curation and presentation metadata

APPSTORE-4 defines the non-canonical curation layer that sits above the canonical Registry projection built in APPSTORE-2 and persisted in APPSTORE-3.

## Boundary

Curation may add categories, descriptions, screenshots, featured placement, sponsorship labels, ratings, review counts and other presentation-only attributes. It may not rewrite service identity, version, implementation, code hash, metadata hash, component type, manifest hash, dependency root, interface hash, active status, block provenance, chain/network identity, publisher/owner identity or verification provenance.

Every composed listing retains the exact canonical `registry.VersionRecord` separately from curation metadata. A service-ID mismatch between the canonical record and curation metadata fails closed.

## Sponsorship

Sponsored placement must carry an explicit non-empty label. Unsponsored placement may not carry a sponsorship label. Sponsorship affects presentation/ranking only and cannot alter canonical provenance or imply protocol endorsement.

## Ratings and reviews

Ratings and review counts are presentation metadata. Ratings are constrained to the 0–5 range and a non-zero average requires at least one rating. These values are not Registry facts, audit results, security proofs or trust attestations.

## Ranking

The baseline ranking helper sorts by featured status, then sponsorship, then rating, then service ID for deterministic output. This ranking is non-canonical and replaceable by other catalogue clients.

## Safety statement

Every composed listing carries a disclaimer that catalogue placement, ratings, reviews, featured status and sponsorship do not constitute protocol endorsement, audit certification or proof of safety.

APPSTORE-4 directly enforces APP-INV-002, APP-INV-003, APP-INV-004, APP-INV-005 and APP-INV-006.

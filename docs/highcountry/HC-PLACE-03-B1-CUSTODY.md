# HC-PLACE-03-B.1 — Canonical custody records

**Scope:** Level 1 custody foundation within PR #887. Independent of HC-PLACE-03-B.2 placement reservations and B.3 marketplace wiring.

The new `custody-records.js` models canonical units as deterministic SHA-256 identifiers derived from `[highcountry-custody-v1, receiptId, zero-based unitIndex]`. Each unit stores receipt ID, unit index, owner, canonical asset ID, custody state, exclusive reservation ID (null while available), and monotonically initialized revision. Permitted custody states are `available`, `listed`, `placed`, `other_reserved`.

`PostgresBudsStore` serializes `custodyUnits`, `custodyReceipts`, and `custodyReservations` in its existing namespace-level SERIALIZABLE / FOR UPDATE transaction. Receipt issuance accepts only verified authoritative issuer input, rejects duplicate source receipts already recognized by the market, and updates the existing assets balance atomically. No client-provided ownership proof or fixture grants are accepted by the production-facing API.

`auditCustody` detects missing/invalid source units, orphan and duplicate reservations, and aggregate divergence. Strict aggregate reconciliation is optional until B.2/B.3 close the legacy escrow paths, where it MUST become mandatory. Existing aggregate inventory is **not** automatically grandfathered into source-backed units. Mixed source provenance is rejected pending a verifiable lineage migration.

**Critical limits:** B.1 deliberately introduces no public reserve/release or placement/marketplace custody allocation. Existing market operations remain unchanged and cannot yet be claimed to enforce individual-unit exclusivity. Full across-module custody guarantees are HC-PLACE-03-B.2/B.3/B.4 and PostgreSQL cross-service Level 2 is B.5. The software remains unexposed to gameplay writes.

Exact SHA test evidence and branch reconciliation are required for a qualified B.1; untriggered or queued tests are not evidence.

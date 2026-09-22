# GEN-SVC-2 / PR #368 — Vancouver parks raw-export acquisition gate

**Status: BLOCKED; not source-onboarded.** Official parks dataset catalogue: https://opendata.vancouver.ca/explore/dataset/parks/ . Proposed official full-export endpoint: `https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/parks/exports/json` (endpoint must be independently checked against the live portal). As of 2026-09-21, a direct attempted download from the implementation environment failed with DNS resolution error `Could not resolve host: opendata.vancouver.ca`. The catalogue's rendered page did not expose field-level JSON schema or a count in the available retrieval path. **Do not claim an actual export has been captured, a schema verified, a municipality coverage verified, or normalized records retained.** Existing `vancouver_parks.go` accepts a *mapped* intake schema only; it is not a raw City export parser and synthetic tests do not qualify source data.

## Required evidence and reproducible acquisition

1. From a networked operator environment, verify the City portal's currently advertised full-export URL and acceptable method and use; capture an unfiltered, complete parks dataset export as a byte-for-byte file in private, durable source storage. Do not use a filtered API search page, partial page of results, sample or third-party mirror as the full export. Record acquisition URL, retrieval UTC, response status, content type, byte length, HTTP ETag/Last-Modified if present, SHA-256 of unmodified bytes and the portal's contemporaneous total count. Preserve the exact raw bytes and source rights/licence evidence; never commit credentials or unpublished personal information to Git.
2. Inspect the *actual bytes* and the current official metadata to record exact field names, types, identifier stability (including leading zeros), geometry/coordinate reference, null/duplicate behaviour, raw count, distinct source ID count, and mismatches. Compare export count to the official count at the same acquisition time; document the discrepancy rather than silently dropping rows. Compare geometry against the City of Vancouver municipal boundary with a documented boundary dataset/version; bounding-box checks alone **do not prove municipal coverage**. Identify records with missing/out-of-bound coordinates for quarantine, not silent omission.
3. Only after step 2, implement a versioned raw-to-`VancouverParksBatch` mapper against the observed schema, plus raw-schema fixtures and drift tests. Require an explicit source-manifest ID bound to actual raw SHA-256 and acquisition metadata; preserve provider identifiers, normalized private payloads, raw-to-normalized row mapping and digests in durable private storage. Prevent partial failure from triggering deletion, approval, canonical write or publication.
4. Exercise the full actual export through a restricted **pending-review only** import and verify counts, duplicate/alias policy, audit checkpoint, idempotency and restart retention; record a signed operator-reviewed qualification result. Keep event onboarding and public HTTP/Travel integration separate. Nothing in the open-data licence itself creates a deployment source grant.

## Operator acquisition example (not evidence that it ran)

```sh
set -eu
mkdir -p private-source/parks
curl --fail --location --show-error --retry 2 --output private-source/parks/parks-raw.json \
  'https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/parks/exports/json'
sha256sum private-source/parks/parks-raw.json
wc -c private-source/parks/parks-raw.json
```

The exact URL, exported format and metadata need confirmation against the live official portal before the captured file can be qualified. Never infer schema, record count or completeness from the example command. Source licence/attribution requirements remain documented in the 368.2 qualification record; real export and downstream compliance review remain pending.

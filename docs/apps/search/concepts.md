# Search concepts

## Exact resolution vs ranked discovery
Exact identifiers should resolve deterministically when possible. Free-text discovery may use ranking, but ranking has no protocol authority.

## Source provenance
Every meaningful result should identify its originating chain/protocol source. Enrichment never replaces raw canonical identifiers.

## Public indexing boundary
Search indexes only data that is intentionally public/indexable. A public hash, commitment or ciphertext reference does not authorize indexing of protected payloads.

## Rebuildability
Search indexes and caches may be deleted and rebuilt from qualified sources without changing protocol state.

## Freshness
Results should expose indexed/finalized height or equivalent source freshness so clients can detect lag.

# Registry API and reads

Prefer direct canonical contract reads for security-sensitive discovery. Indexer/Explorer/Search APIs may expose convenient projections, but clients must preserve chain ID, service ID, version and active-state provenance.

Cache only with an invalidation strategy. A cached service can become deprecated or superseded without changing its stable service ID.
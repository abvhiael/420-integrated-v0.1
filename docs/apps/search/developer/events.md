# Search events and reorg behavior

Search does not define canonical events. It consumes indexed events and public protocol projections.

Pre-finality source events can be removed/replaced by reorgs, so derived search documents must be updated or removed when the Indexer repairs canonical history. Registered service/version changes should be reflected according to their effective Registry history.

Search-index update notifications, if exposed, are operational events only and must not be confused with protocol finality.

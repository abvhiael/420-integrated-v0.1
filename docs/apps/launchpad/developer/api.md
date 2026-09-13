# Launchpad API integration

Read integrations should resolve project, sale and allocation state from the canonical contracts or a provenance-preserving indexer projection. Write integrations must submit exact contract calls through Wallet authorization and must not auto-sign or silently broaden approvals.

Clients should carry explicit network and contract identity, preserve transaction hashes, expose revert/error data safely and fail closed when required configuration cannot be verified.

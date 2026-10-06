# PB-1.10 — Privacy & Leakage Hardening

PB-1.10 establishes a deny-by-default public and derived disclosure boundary. PuffBuddies canonical persistence remains private/off-chain, and derived Search/Indexer/Analytics/cache material cannot become a public or canonical profile surface.

Wallet/address lookup cannot reveal PB membership. PUBLIC_EXPLICIT is not a blanket publication switch: membership, relationship/match/block state, moderation/safety state, eligibility, lifecycle, precise location, cannabis state, wallet/profile linkage, and identity material remain protected. Derived payloads are screened against protected dimensions.

Aggregate disclosure is restricted to a minimal metric/bucket/count schema and rejects singleton cohorts or identifying dimensions. PB-1.9 generation/change/surface control metadata can remain privacy-minimal without carrying profile payload.

This step introduces no public profile endpoint, membership directory, chain contract/state, Registry/Names publication, Search/Explorer exposure, analytics identity export, worker, API, deployment, or live integration.

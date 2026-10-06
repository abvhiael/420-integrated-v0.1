# PB-1.9 — Derived-State Invalidation

PB-1.9 makes derived PuffBuddies state explicitly disposable and nonauthoritative. Discovery, matching, messaging authorization, visibility projections, caches, indexes, and analytics all carry the current canonical subject generation from PB-1.8. A stale generation, wrong subject, or completed deletion makes derived material unusable.

Deletion, block, lifecycle, safety, and eligibility changes invalidate all derived surfaces. Unmatch invalidates matching and messaging authorization. Visibility changes invalidate discovery and disclosure projections. Profile, preference, location, and cannabis compatibility changes invalidate the discovery/matching projections that depend on them.

Invalidation records contain only subject identifier, generation, canonical change class, and affected surface scope. This foundation does not introduce a production event bus, queue, worker, Search/Indexer/Analytics/Messenger integration, API, deployment, or external service.

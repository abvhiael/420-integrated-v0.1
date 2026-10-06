# PB-1.6 — Transition Audit Evidence

PB-1.6 provides protected, privacy-minimized evidence for security-sensitive state transitions. It is accountability evidence, not a new source of lifecycle, relationship, consent, moderation, or deletion authority.

Evidence is accepted only after the corresponding PB-1.2 canonical state-machine transition succeeds. It records a transition class, protected non-public subject reference, source and target state, canonical authority, bounded reason code, and monotonic/order sequence.

The evidence payload deliberately excludes raw profile identifiers, wallet linkage, profile content, messages, location, cannabis data, raw identity evidence, moderation notes/evidence blobs, and unnecessary counterpart identifiers. This prevents the audit layer from becoming a shadow relationship graph or sensitive-content archive.

PB-1.6 does not introduce a production audit store, external logger, API, migration, worker, contract, deployment, service ID, or live integration.

# PB-1.2 — State Machines

PB-1.2 implements the first executable lifecycle and relationship transition policy from PB-0.12/PB-0.13 while retaining PB-0 authority, privacy, consent, deletion, and safety boundaries.

The lifecycle machine contains the 14 canonical PB-0.12 states. Transitions are allowlisted by source, destination, and canonical authority; anything else fails closed. DELETE_REQUESTED and later deletion states never authorize ordinary participation, DELETION_COMPLETE has no direct restoration path, and APPEAL_REVIEW does not restore access.

The relationship machine permits unilateral like/pass, requires reciprocal-user authority for MATCHED, permits unilateral unmatch, and gives block state supremacy with no automatic unblock/rematch path. Algorithm, administrator, payment, dependency, client, cache, and projection authority cannot manufacture positive interpersonal consent.

PB-1.2 creates no persistence schema, migration, API, worker, contract, address, service ID, deployment, or live integration.

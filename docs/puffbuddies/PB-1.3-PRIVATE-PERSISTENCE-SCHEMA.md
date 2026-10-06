# PB-1.3 — Private Persistence Schema

PB-1.3 establishes the storage-neutral logical schema for PuffBuddies canonical private state. It does not select a database engine or implement migrations, repositories, APIs, workers, contracts, addresses, service IDs, deployments, or live integrations.

The schema covers profile, minimum-disclosure eligibility projection, discovery preferences, field visibility, relationship state, protected safety state, lifecycle state, private location references/coarse discovery material, cannabis compatibility, and version-linked matching inputs. Every canonical table is PuffBuddies-owned and private; there are no public or externally authoritative tables.

Raw identity evidence, date of birth, government-document material, wallet secrets, public wallet/profile linkage, raw GPS history, public precise coordinates, public match graphs, public cannabis identity, recommendation scores, Search profiles, and analytics shadow profiles are prohibited from canonical persistence.

Ordinary private state is classified for deletion. Safety state is the bounded exception: purpose-limited retention requires an explicit retention reason. Version material is carried so later repository/invalidation work can reject stale derived authority.

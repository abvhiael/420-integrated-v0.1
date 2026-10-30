# HC-PLACE-03-A — transaction authority and revision binding

Status: **Implementation committed; bounded Level 1/Level 2 qualification evidence pending**.

Every placement mutation requires an authenticated registered principal, authorization to act on the target parcel, qualified world evidence carrying a monotonic world revision and evidence ID, and a server-pinned geometry qualification. Inside the *same* `PostgresBudsStore.transact` SERIALIZABLE row-locked callback that changes inventory, objects and scene revisions, the transaction checks the persisted parcel authority revision and immutable evidence/qualification identities. An additional mandatory synchronous `authority.verifyAtCommit` assertion can verify current parcel ACL and policy against the locked state. Async verification is rejected to avoid escaped lock lifetimes. Absent authority provisioning fails closed.

**Operational boundary:** trusted provisioning of `placementAuthorityRevisions` and authoritative ACL/geometry registry revision changes must use the *same* serialized economy namespace; external issuer changes without mirrored revocation cannot be detected by this store. Existing production adapters must implement `verifyAtCommit` to bind principal/parcel/ownership and authoritative policy. Nothing exposes browser placement writes. This requirement remains gating for server transport and 03-F.

Level 1 covers denial on changed/missing world evidence and revoked geometry with zero inventory mutation. Dedicated Level 2 tests run against a real PostgreSQL 16 row-locked store and verify stale authority rollback, competing writers, and persisted replay after creating a fresh engine instance. These bounded tests do **not** replace subsequent 03-B inventory lineage, 03-D multi-worker concurrency, 03-E process crash and disaster-recovery, or HC-PLACE-04 detailed world collision qualification.

Do not mark 03-A qualified until the exact current SHA reports passing both dedicated checks.

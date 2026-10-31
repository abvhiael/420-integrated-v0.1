# HC-ECON-04 — Creator Studio technical intake

Implementation scope: versioned art upload validation, reproducible source bytes, isometric template selection, geometry anchors and logical footprints, immutable art storage and revision history. Canonical HC-ECON-00 traceability E07/E09; human certification, payments and brand publication are later owners.

## Authoritative technical boundary
- `services/highcountry-economy/src/creator-studio.js`: five reviewed placement-surface templates; PNG RGBA8 technical inspection, CRC and chunk ordering, bounded decompression, nonempty alpha transparency, pixel bounds, versioned HC-PLACE-02 geometry, independent render anchors and tile footprint.
- Geometry has a logical 64-pixel grid. Pixel dimensions/alpha outline do not confer extra occupied tiles. All accepted assets carry SHA-256 of the original PNG and of the exact metadata for reproducible version identity.
- `CreatorStudio`: authenticated principal and rechecked revocation inside the serializable transaction, immutable positive revision history, creator-bound ownership and rights declarations, idempotent identical submissions and rejection of overwritten original bytes. Technical intake never directly grants marketplace, publishing, placement, intellectual property or item issuance rights.
- `ImmutableArtBlobs`: operator-provisioned immutable SHA-256-addressed PNG directory. Atomic exclusive create, readback digest verification, no user-controlled destination paths. Deployments must supply persistent backed-up volume and authenticated service storage permissions.
- `PostgresBudsStore`: serializes `econCreatorAssets` alongside the existing namespaced state without altering other ledger balances.
- Style attestation only confirms that creator requests isometric review. Automated code cannot reliably determine matching hand-drawn style and originality. Submitted revisions remain `unpublished` with `human-review-required` state. Signed review, asset rights/trademark adjudication and publication require the later approval system; a user-supplied style flag cannot approve an asset.

## Source preservation, revocation and publication
Metadata and bytes are immutable per `[assetId,revision]`. New versions must be sequential, creator-owned, authenticated and independently revalidated. Publication is not enabled by this module, so every asset it admits is technically validated and unapproved. An operator must not expose it as a publisher without the signed certification gate required by HC-ECON-00. Existing artist/artwork branches and HC-PLACE physical placement services are not modified.

## Focused qualification
`node --test services/highcountry-economy/test/creator-studio.test.js services/highcountry-economy/test/postgres-store.test.js`
Negative cases: malformed signature/chunks/CRC/truncation/deflate, absent transparency, mismatched pixel geometry, disallowed templates, invalid anchors, spoofed creator, immutable revision override, version skipping, revoked session, corrupted blobs, and path traversal.

## External activation
Production uploader UI, moderation-backed artistic style review, signed certification, actual HTTP route authentication, provenance/rights adjudication, and backed-up mounted volume configuration must be integrated and separately qualified before live creator publication. This package intentionally cannot activate public publishing, and no testnet or production release is represented as completed.

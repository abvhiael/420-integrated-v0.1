# HC-SEED-10 — Qualification, reconciliation and merge

## Release scope

This is the single bounded Level 3 implementation closeout of HC-SEED-01–10, based on main `7acca59af7670e1027ffed5b85ec301ffa2fd792`. The immutable historical catalogue/research/reference inputs remain unchanged. Source reconciliation joins 65 canonical identities (23 common, 26 rare, 16 Original Sixteen), attributed source histories, 23 versioned common genomes, all 26 precommitted canonical breeding plans, four exact seed pools and 146 cosmetic assets. `seed-closeout-release.v1.json` records all retained qualified SHAs/run IDs and the three earlier merge commits.

Implementation qualification and live activation are separate exits. Common manifests intentionally remain `REGISTRATION_READY_NOT_REGISTERED`; rare plans remain `PLANNED_NOT_REGISTERED`, with no manufactured entropy, offspring loci or live receipts. Founder identity is not a fabricated live genome ID. The closeout report preserves those boundaries. Disposition: code/manifest/asset integration can close; live registration and production activation remain blocked until the requirements below are met.

## Reconciliation and corrections

The uploaded common/rare illustrations, 65 harvest-card bases, nine badges and four pack designs were present but catalogue art was still marked pending. The canonical asset manifest now links every illustration and card by immutable cultivar ID and preserves actual repository filenames. The approved three earned-seal overlays are added from the existing export bytes. This creates no new artwork, scientific appearance assertion or breeding provenance.

All 146 PNGs have pinned Git blob identities and byte lengths. The 130 matched approved export files also retain their original SHA-256 digests and canvas sizes. The sixteen earlier heritage plates are pinned to their existing repository blobs; mandatory CI computes their SHA-256 and geometry, verifies genuine RGBA transparency and consistent heritage canvases, and records those values in the final evidence ledger. All assets are independently fetched through their built canonical HTTP URLs and matched byte-for-byte. No checksum assertion is disabled or lowered.

The catalogue displays approved illustrations and unearned card previews. The earned overlay is rendered only from authenticated collection records with successful-harvest provenance and the expected personal/cosmetic card shape. A client `harvested` flag, artwork file, payment, owned seed or discovery alone cannot award it. Canonical same-origin filename checks reject remote, remapped and traversal artwork URLs. The XSS test now distinguishes the 65 legitimate illustrations from injected markup and still rejects injected image/event-handler attributes.

Adversarial closeout found that a cancellation getter/event with malformed otherwise-unused fields was not rejected. The native reader now requires the actual cancelled receipt's zero commitment/pool and empty event data before releasing capacity. The regression test proves malformed cancellation retains all pack/genome holds. Other tests cover different checkouts racing for the last eligible capacity and tampered reserved genotype snapshots without changing any odds or registration rules.

## Bounded qualification

Dedicated workflow: `.github/workflows/highcountry-seed-closeout.yml`. All jobs check out the exact implementation head, not an unstated moving ref.

1. **Source/genome/art reconciliation:** catalogue and research boundaries, existing Python reference/lifecycle checks, inspected engine source digests, exact 23/26 reference-plan reproduction, full canonical asset coverage, approved byte identity, PNG dimensions/alpha and one source/lineage digest ledger. This does not re-query current Leafly pages or overwrite their reviewed historical snapshots.
2. **Runtime integration/adversarial:** affected seed, signed session, authority, payment, opening, persistence and browser component checks; actual PostgreSQL 16 collection/starter/opening/purchase concurrency, independent restart, restricted roles and RLS; production build and immutable pool parity; all 146 canonical image URLs; actual Chromium catalogue, mobile layout and both-currency checkout through authenticated seed delivery/history.
3. **Canonical lifecycle:** one bounded 52-case suite: nine common genome, eight rare breeding, seven lot-registration, fourteen opening, eleven payment and three new combined lifecycle tests. The combined test uses actual payment, router/profile/route/result registries, Genesis/GenomeRegistry, SeedRegistry and authorization/emergency contracts. It traces paid native checkout to a canonical selected common reference and an exact authorized three-seed lot; verifies registration capability cannot be bypassed; and delivers the same paid entitlement after a delayed original proof. Capability grants and cryptographic signature providers are explicit disposable fixtures, not production authority or a unique-output VRF claim. Separate rare evidence verifies all 728 loci and all 49 test-registered common/rare genomes.

The new combined test intentionally chooses a common fixture root using its explicitly test-only signature provider to cover common delivery. This is not an assertion that production operators may choose entropy. Production continues to require the reviewed unique-output VRF route frozen by HC-SEED-08.

Final implementation SHA, exact passing run/job IDs, artifact IDs/digests, all 146 asset SHA-256 records and retained prior evidence are recorded in `deployments/highcountry/seed-closeout-evidence.v1.json` after CI. An evidence-only descendant may inherit qualification only when its diff contains that ledger/documentation and no runtime, contract, asset or policy changes. The final merge SHA is recorded in the closeout PR metadata and merge result; the ledger pins the qualified implementation rather than claiming its own self-referential commit hash.

## Retained evidence and separate audit

HC-SEED-01–07 were merged through PR #838 (`d8f16751691f32bd0821c1ff9f9394960e43da7f`); HC-SEED-08 through #854 (`a853df9ccfae8ce0b4bd965dd3999cc140f54d2f`); HC-SEED-09 through #858 (`7acca59af7670e1027ffed5b85ec301ffa2fd792`). Their exact original qualified heads and runs are preserved in the release manifest. No unrelated global or Docs suite is manually relaunched. This closeout does not claim full 221-asset Original Sixteen A06 qualification. The historical 48-versus-32 deferred-art count discrepancy was independently corrected on concurrent main `6a13f2cfea2842f102e6ecc33f4f4b2185e619c3`, preserving the per-file SHA-256 checks. That correction and the concurrent regional memorabilia/build additions are retained unchanged; seed closeout independently verifies its exact 146 canonical assets.

## Live activation gate — remains open

- Resolve actual reviewed deployments and code hashes, finalized Genesis, registered game/identity and the production database namespace with TLS/least privilege/RLS.
- Provision exact operator capabilities and the reviewed native treasury/EOA quote signer. Keep player keys outside the service.
- Establish the independently reviewed unique-output VRF provider/profile/verifier and persistent router/opening deployment. Test signatures do not satisfy this requirement.
- Execute authorized common registration and actual proof-bound rare breeding/finalization; preserve confirmed transactions and independently audit all 49 registered records and canonical Original Sixteen founding mappings.
- Qualify production-equivalent testnet payment, provider availability, finality, recovery, privacy and operational monitoring. Keep existing unresolved runtime templates fail-closed until actual evidence exists.

Merge of this closeout does not activate purchases, issue real seeds, declare live registration, expand the museum, alter 60/30/10 odds or convert BUDS into redeemable currency.

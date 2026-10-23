# High Country — A06 scoped Original Sixteen integration (partial)

**Decision:** Deliver A01–A03 integration first. A04 (32 Archive Edition packet faces) and A05 (16 bud portraits + 16 botanical heritage plates) are **64 explicitly deferred files** until nearer public release. The approved 221-asset roadmap and canonical inventory are NOT reduced or replaced.

- Immediate scope: 13 A01 shared masters, 64 A02 founder visuals and 80 A03 discovery/revelation visuals = **157 paths**.
- Deferred scope: `hc-f01` through `hc-f16`, each with `archive-front`, `archive-back`, `bud-illustration`, and `botanical-plate` = **64 paths**, each individually enumerated in the scoped generated manifest.
- Canonical location: `assets/highcountry/original-sixteen/`. The scoped validator does not silently accept the noncanonical `founders-front/back` aliases.
- `node services/highcountry-archive/scripts/scoped-a06-report.mjs . scoped-a06-manifest.json` enumerates all **221** paths, reports actual presence, sizes, SHA-256 and PNG dimensions where applicable, and produces a read-only machine manifest. Missing files are reported as missing, NEVER as delivered. An invalid supplied asset causes a nonzero exit.
- `resolveOriginalSixteenArt(manifest,path)` returns a URL ONLY for listed immediate-scope verified assets, otherwise `null` so UI callers can display an existing fallback. It cannot return a deferred art URL.
- Production asset authentication, browser wiring, upload completion and complete UI/entitlement consumer integration are **not** established by this path auditor alone. No deploy claim.

**Rewards remain independent of artwork.** Do not alter `ArchiveDiscoveryService` entitlements: four trusted discoveries unlock the founder revelation, cosmetic Archive Edition, nontransferable Founder Seal and museum entry; all sixteen grant the master title, seal and exhibition. Do not charge $420, block collection completion on art presence, grant genetic advantages or alter opaque loci.

**Qualification boundary:** new scoped A06 Level 1 only; no full **221/221** closeout, Level 2 or Level 3, and no redundant Foundry/Genesis/global workflow replay. Final A06 requires verified artwork, checksum/catalogue/gallery/display and actual entitlement consumer integration and will occur nearer release.

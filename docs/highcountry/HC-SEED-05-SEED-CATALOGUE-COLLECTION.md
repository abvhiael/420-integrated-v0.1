# HC-SEED-05 — Seed Catalogue and harvest collection

## Delivered behavior

`/seeds` browses all 65 canonical cultivars (23 common, 26 rare, 16 Original Sixteen). Search, region, rarity and personal discovery/ownership/harvest filters share canonical IDs. Detail views present attributed common ancestry, unresolved source uncertainty, characteristics and Leafly links; fictional rare crosses link to their canonical parents. Founders expose public heritage only. Browsing does not grant discovery. Artwork uses explicit placeholders pending the art step.

The public build is generated from the reviewed catalog, research, parent pairs and founder archive using the same projection as the server. It excludes genome loci, private collection records and archive revelation material. Reference characteristics do not alter canonical engine traits.

Signed-in collections use the existing signed runtime session, registered principal and current wallet binding. Seed ownership reads current lot owners and remaining quantities from code-pinned contracts at one finalized block. Historical incoming lots establish persistent discovery; transfer or planting reduces current ownership without erasing discovery. Unlinked accounts see ownership as unverified, never a fabricated zero. Unknown noncatalogued hybrids remain unclassified.

A harvest-card request accepts only a decimal uint64 plant ID. The server verifies a successful canonical harvest, matching plant and grower wallet, quality/yield/grade and genome identity. Cards are personal cosmetic records, one per cultivar, with a globally unique canonical harvest source to prevent replay after account relinking. Claims never issue seeds, tokens, currency or transferable assets. Caller-supplied cultivar, owner, reward and quantity are rejected.

## Authoritative reader

All calls and code reads use the same finalized EIP-1898 block hash and require canonicality. Dependency addresses are checked against contract getters. Common genomes match all 28 opaque loci and registered metadata; rare genomes additionally require the actual consumed randomness request, fulfilled router result/proof, matching breeding event and recomputed canonical offspring; Original Sixteen use the registry's reserved founding-line mapping. No fixture breeding provenance becomes production evidence.

Ownership log scans start at the reviewed deployment block, verify canonical log anchors, use bounded chunks and reject incomplete or oversized indexing. Default maximum range is 200,000 blocks (hard cap 1,000,000); maximum 500 candidate lots per wallet. Exceeding bounds fails closed and requires a reviewed indexed-reader extension, never an empty-balance fallback. Current implementation is suitable only while those explicit bounds cover the deployment history.

## Runtime integration

Optional `seedCatalogue` runtime configuration requires `version: HC.SEED.CATALOGUE.V1`, an actual `deploymentBlock`, and optionally `maxScanBlocks` and `logChunk`. Canonical input files load from `deployments/highcountry`; breeding event IDs are parsed losslessly as decimal strings. The existing signed authority RPC must include reviewed address/codeHash pins for `seeds`, `genomes`, `plants`, `harvest`, `cultivation`, `breeding`, `breedingRandomness`, and `randomRouter`. No signer or mock provider is silently created.

HTTP routes retain the configured origin and request-size checks:

| Route | Body | Authority |
| --- | --- | --- |
| POST /seeds/catalogue | `{ "filters": { "search": "", "region": "", "tier": "" } }` | Public projection |
| POST /seeds/collection | `{}` | Bearer signed session |
| POST /seeds/harvest-card | `{ "plantId": "7" }` | Bearer session plus finalized grower harvest |

Discovery, cards and claim-source maps persist in the existing PostgreSQL JSON state and serializable row transaction. Old schema-1 state loads with empty maps. Existing restricted-role namespace RLS remains in force; no database migration or new privilege is required. Sessions and wallet binding are rechecked inside the transaction after external reads.

## Qualification and limits

Scoped workflow: `.github/workflows/highcountry-seed-catalogue.yml`. L1 covers public projection, filters, signed-session isolation, revocation, concurrent claims, transfer discovery, failure/reorg/code mismatch rejection, all 26 JavaScript/Python breeding crosschecks, HTTP and DOM flows. L2 uses a disposable PostgreSQL 16 database with a restricted RLS role, independent service restart and durable replay checks; actual Chromium exercises the built `/seeds` deep link, filters, ancestry navigation, desktop/mobile overflow and page errors. Screenshots are workflow artifacts. These are disposable transport/database/browser tests, not live-chain registration claims.

HC-SEED-01–03 inputs and qualified HC-SEED-04 breeding lifecycle are unchanged. The HC-SEED-04 live deployment blocker remains: reviewed manifests do not establish deployed chain/address pins or a production registration authority. Public catalog browsing is usable offline; live personal ownership and card awards must remain disabled until those real dependencies exist. Seed-pack purchasing/odds and final cultivar art belong to subsequent roadmap steps. Keep draft PR #838 unmerged until the overall seed work is complete.

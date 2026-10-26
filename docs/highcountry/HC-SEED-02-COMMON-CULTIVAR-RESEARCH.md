# HC-SEED-02 — Common cultivar research

## Result and research policy

Leafly coverage was verified for all 23 canonical common cultivars. The structured result is `deployments/highcountry/common-cultivar-research.v1.json`: 23 inspected profiles, two supplementary Leafly features, no missing profile and 24 explicitly resolved knowledge gaps. Review date: October 25, 2026, America/Regina. All accepted factual accounts come from a single editorial publisher, Leafly. Source URLs, inspected sections, review dates, source titles and per-field source references are retained. Entries are concise paraphrases; no article bodies, reader reviews or photographs are redistributed.

Source coverage does not mean biological certainty. Each ancestry account is typed as reported-cross, partial, uncertain, legend, conflicting-reports, regional-population or unknown. No pedigree is marked biologically verified. No maternal/paternal direction, cross order, allele fraction, growth statistic or engine locus is inferred. Named ancestors outside the 23 commons are retained as source labels, not silently introduced as registered game cultivars.

The source characteristic panels record classification, three reported flavors, three profile terpenes and three reader-reported effects. These are profile observations, not uniform chemical assays or guaranteed inherited behavior. Morphology is paraphrased only where described. Missing morphology and geographic origin are explicit nulls with gap resolutions. Consumer potency, medical-use assertions and dosage are excluded. Canonical regional distribution remains owner metadata rather than a historical-geography assertion.

## Review decisions resolving coverage gaps

- All 23 profiles were successfully opened and their descriptive introductions and characteristic panels inspected. No fallback publisher is required.
- GSC is mapped to the canonical Girl Scout Cookies ID. Its account uses an OG subtype and F1 Durban; F1 Durban is not silently replaced with Durban Poison.
- The source at `/strains/zkittlez` now displays The Original Z. This is a source-name mapping to the approved Zkittlez ID, not a new identity or a change in collection tier. Its undisclosed parent stays undisclosed.
- Blueberry's profile and the supplementary Leafly feature provide different pedigree detail. Both are stored with candidate-specific citations. Contradictory release-era wording in the feature is not resolved into a manufactured exact date.
- Granddaddy Purple's two candidate pedigrees are preserved. The supplementary Ken Estes interview is identified as an attributed personal account, not independent proof of either pedigree.
- Alaskan Thunder Fuck's ancestry remains a legend. A ruderalis reference alone does not authorize an autoflowering rule.
- Bubba Kush's unidentified indica is not replaced with Northern Lights. OG Kush's qualified component list does not define a four-way mating sequence. Strawberry Cough and Purple Haze retain their uncertain lineage wording.
- Acapulco Gold, Afghan Kush, Chemdawg and Durban Poison do not receive invented named parent pairs. Geographic populations and bag-seed stories are not equivalent to pedigrees. Generic Afghani and Hindu Kush ancestor labels are not aliases for the canonical Afghan Kush reference.
- Pineapple Express retains both the panel and narrative terpene lists because they differ. The 2008 film association is not treated as a breeding date.
- Sour Diesel's separately labeled AI review summary is excluded as evidence. Profile-label versus narrative differences for Alaskan Thunder Fuck, Northern Lights and Trainwreck remain explicit qualifications, not genotype percentages.
- Missing breeder, origin or date information stays unspecified. A research record is complete when the source claim and its limits are accurately represented, not when every unknown has been replaced by a value.

## Qualification and continuity

Commands:

```
node scripts/highcountry/common-cultivar-research.mjs
node --test scripts/highcountry/common-cultivar-research.test.mjs
```

25 scoped Level 1 checks cover complete canonical coverage, exact profile mapping, field-level citations, resolved gaps, contested pedigrees, source-name mapping, intermediary-parent distinctions, terpene disagreements and rejection of identity drift, unsupported certainty or genome-admission claims. These checks validate data integrity and reviewed decisions; they do not independently prove the publisher's historical or biological claims. The dedicated workflow is `.github/workflows/highcountry-seed-research.yml`.

HC-SEED-01 evidence remains at `2c97a9454f9a51cee10ed57a6c98ec21d1b01bda`, run https://github.com/abvhiael/420-integrated-v0.1/actions/runs/40265740974. This step adds research data, validator, tests, documentation and its scoped workflow without editing the identity catalog, founding archive or contracts. Retain that unaffected evidence; no global or Solidity rerun is required. Exact-SHA HC-SEED-02 CI evidence is reconciled in PR #838 after publishing.

The research digest printed by the validator is SHA-256 of JSON.stringify(parsed research), not a hash of the external webpages. It binds the reviewed research payload used by this qualification, without pretending a live webpage is immutable.

HC-SEED-03 is next: define a documented translation from this attributed research into the actual canonical simulation genetics. Genome registration and rare breeding remain HC-SEED-04 and are not attested by this research completion. Keep PR #838 as a draft until the agreed roadmap closeout.

## Source coverage index

| Canonical cultivar | Profile | Ancestry account | Explicit gaps |
|---|---|---|---:|
| Acapulco Gold | [Acapulco Gold strain](https://www.leafly.com/strains/acapulco-gold) | unknown | 1 |
| Afghan Kush | [Afghan Kush strain](https://www.leafly.com/strains/afghan-kush) | regional-population | 1 |
| Alaskan Thunder Fuck | [Alaskan Thunder Fuck strain](https://www.leafly.com/strains/alaskan-thunder-fuck) | legend | 1 |
| Blue Dream | [Blue Dream strain](https://www.leafly.com/strains/blue-dream) | reported-cross | 1 |
| Blueberry | [Blueberry strain](https://www.leafly.com/strains/blueberry) | conflicting-reports | 2 |
| Bubba Kush | [Bubba Kush strain](https://www.leafly.com/strains/bubba-kush) | uncertain | 1 |
| Chemdawg | [Chemdawg strain](https://www.leafly.com/strains/chemdawg) | unknown | 2 |
| Durban Poison | [Durban Poison strain](https://www.leafly.com/strains/durban-poison) | regional-population | 1 |
| Gelato | [Gelato strain](https://www.leafly.com/strains/gelato) | reported-cross | 1 |
| Girl Scout Cookies | [GSC strain](https://www.leafly.com/strains/gsc) | reported-cross | 0 |
| Granddaddy Purple | [Granddaddy Purple strain](https://www.leafly.com/strains/granddaddy-purple) | conflicting-reports | 1 |
| Green Crack | [Green Crack strain](https://www.leafly.com/strains/green-crack) | partial | 2 |
| Jack Herer | [Jack Herer strain](https://www.leafly.com/strains/jack-herer) | reported-cross | 0 |
| Northern Lights | [Northern Lights strain](https://www.leafly.com/strains/northern-lights) | reported-cross | 0 |
| OG Kush | [OG Kush strain](https://www.leafly.com/strains/og-kush) | uncertain | 1 |
| Pineapple Express | [Pineapple Express strain](https://www.leafly.com/strains/pineapple-express) | reported-cross | 1 |
| Purple Haze | [Purple Haze strain](https://www.leafly.com/strains/purple-haze) | uncertain | 2 |
| Sour Diesel | [Sour Diesel strain](https://www.leafly.com/strains/sour-diesel) | reported-cross | 1 |
| Strawberry Cough | [Strawberry Cough strain](https://www.leafly.com/strains/strawberry-cough) | uncertain | 2 |
| Super Silver Haze | [Super Silver Haze strain](https://www.leafly.com/strains/super-silver-haze) | reported-cross | 1 |
| Trainwreck | [Trainwreck strain](https://www.leafly.com/strains/trainwreck) | reported-cross | 0 |
| White Widow | [White Widow strain](https://www.leafly.com/strains/white-widow) | reported-cross | 0 |
| Zkittlez | [The Original Z strain](https://www.leafly.com/strains/zkittlez) | partial | 2 |

Supplementary Leafly accounts:

- [New Blueberry weed strains are about to make a wave](https://www.leafly.com/news/strains-products/blueberry-weed-strain-trend)
- [Meet the daddy of Granddaddy Purple](https://www.leafly.com/news/strains-products/ken-estes-granddaddy-purple-interview)

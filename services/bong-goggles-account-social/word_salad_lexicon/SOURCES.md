# Word Salad dictionary sources

English: ENABLE, https://github.com/dolph/dictionary/blob/694bf9529e986f9175dcbf5fe5875d111941b708/enable1.txt (public-domain word list), normalized to 172,823 entries.

Cannabis: 24,467 unique candidate keys, including 592 project-authored baseline terms and cultivar names extracted from the sources below. Only the name fields are imported, never descriptions, prices or cultivation instructions.

| Source | Input rows | New unique keys |
| --- | ---: | ---: |
| [Cannabis Intelligence Database by Shannon Goddard](https://github.com/Shannon-Goddard/ci-strains-pro/blob/80fbe5d40fac8dda5120f50b946f069c4961f253/raw-data.csv) | 21,210 | 11,510 |
| [Cannabis Intelligence Database legacy snapshot](https://github.com/Shannon-Goddard/cannabis-intelligence-database/blob/main/data/Cannabis_Intelligence_Database_15768_Strains_Final.csv) | 15,740 | 6,069 |
| [Kushy cannabis dataset](https://github.com/kushyapp/cannabis-dataset/blob/master/Dataset/Strains/strains-kushy_api.2017-11-14.csv) | 9,524 | 5,750 |
| [Loyal9 grow_data strain names](https://github.com/Loyal9-Elements/grow_data/tree/main/Resources/csv) | 2,793 | 546 |

Cannabis Intelligence Database by Shannon Goddard, https://github.com/Shannon-Goddard/ci-strains-pro, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Adaptation: name-only extraction, normalization, filtering and deduplication. Other sources retain their upstream notices; individual data provenance and commercial redistribution review are not implied by source-code licenses.

Normalize only names composed of ASCII letters, whitespace, hyphens and straight/curly apostrophes; strip separators, uppercase, reject digits and remaining punctuation, enforce 2–42 letters, deduplicate and sort. Display names and single alias fields from the current Goddard source; strain_name from legacy; name from Kushy; strain from Loyal9. Do not split names into independent words or synthesize combinations. This is a dataset-backed candidate corpus, not a claim of manual approval of every name. Source records can contain merchandising noise or inaccurate aliases. No midmatch updates.

## R4 authoritative integrity policy

The 24,467-entry candidate snapshot is retained in Git at cd8f2dfb8afe53067909b69b282753cd38288b42. R4 excludes 533 keys and retains 23,934 cannabis keys. English remains 172,823 keys. No acquisition or new derived words.

Reject exact repetitive placeholders AAA, III, PPP, XXX and keys matching the following conservative catalogue-noise expression (uppercase, substring matching):

    TSHIRT|STICKERBUNDLE|GIFTCARD|CREWNECK|HOODIE|KEYCHAIN|TUMBLER|PHONECASE|BULKPACK|SHIP(S|PING)?(EARLY|LATE|MID|IN|NOW|FREE)|STRAINFEMPHOTO|STRAINAUTOFEM|STRAINSEEDS|SEEDPACK|PACKOF|SOLDOUT|PREORDER|ADDTOCART|FREESHIPPING|DISCOUNTCODE|SUBSCRIBE|COPYRIGHT|HTTPS|WWW

Examples removed: CULTIVATEFREEDOMTSHIRT, FARMFRIENDSSTICKERBUNDLE, MEPHISTOGENETICSGIFTCARD, BEACHTRUFFLEFSHIPSEARLYAPRIL and ATLASSEEDBLUEDREAMSTRAINFEMPHOTO. Ordinary cultivar names, including ACAPULCOGOLD, and domain terms remain. This is conservative automated noise filtering, not an assertion that every retained candidate is semantically correct. No substring membership or inferred variants are allowed. The two corpora intentionally may overlap: overlap means one cannabis bonus, not two dictionary hits.

Exact UTF-8 ASCII/LF byte hashes (including final LF):
- English: 77a8b7729436793e0094b68243ffb3ff0825332ceec5f427880138971d6135c4
- Cannabis: dc75d44b8e612e2900d6d7c55c1f2c6c6c139e8ff610875fad1b1c0984c2a0a1

Runtime startup validates pinned hashes, counts, strict ascending order, unique uppercase A–Z keys of 2–42 letters and cannabis exclusions. Any change requires explicit reviewed pin updates and a new rules identity. A historical session with a mismatched identity fails closed rather than being reinterpreted; recovery of such sessions requires the original pinned adapter. The prior bytes remain recoverable from Git. Public Play remains gated.

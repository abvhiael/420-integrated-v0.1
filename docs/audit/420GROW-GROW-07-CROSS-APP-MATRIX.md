# GROW-07 — Cross-app qualification matrix

Canonical step: GROW-07 — Cross-app qualification. Integrate only GROW-01/02-approved public, non-authoritative Place discovery. No new service ID, ABI, wallet permissions, or private coordinate entitlement.

| Dependency | Positive behavior | Negative / authorization / network behavior | Test |
|---|---|---|---|
| GEN-SVC-2 / 420Location SDK | `sdk.Client.Places` v1 returns public Places; `grow.Read` filters FARM/BUSINESS and preserves public precision | malformed, empty mismatch, duplicated, invalid category/kind, private area coordinates, unsupported v1/error → fail closed | `grow/location/consumer_test.go`, `genesis/svc2/sdk` tests |
| Grow HTTP service | `service.New` consumes validated public SDK; GET category, search, pagination and provenance | no write method; bad query rejected; upstream error sanitized; no arbitrary reader injection | `grow/service/handler_test.go` |
| Registry references | expose upstream `registryRecordId` as opaque provenance | never label it a valid attestation, claim ownership or convert to service Registry admission | Grow consumer tests; GROW-02/06 guards |
| 420Verify | show independent verification only with separately verified data (none in approved MVP) | no credential/status synthesis from source or Registry reference | `grow/web/test/ui.test.js` |
| Wallet manifest / Genesis Registry | none: anonymous browsing without wallet, no Grow service ID | no alias to Location ID, Wallet execution, false manifest, or new frozen entry | `verify-grow-02.py`, `verify-grow-06.py`, `verify-grow-07.py` |
| Chain / wrong-network | no chain-dependent status or signing in approved UI/API | refuse to invent chainId, verified source network, wallet transaction or bypass wrong-network gates; upstream chain-derived future claims require a separate source-chain match | `verify-grow-07.py`, existing wallet manifest policy |
| Web discovery | real HTTPS public endpoint, visible error/empty and safe text/provenance rendering | malformed JSON, invalid version, approximate location pin, unsanctioned endpoint or silent fixtures reject | `grow/web/test/ui.test.js` |
| Cross-app out-of-scope | no 420Swap, token, claim, Pay, Indexer, Search, RPC or contract integration required for anonymous public listing | forbidden to assert unapproved integration as live or verified | GROW-01/02/06 contract/identity guards |

**Level 2 milestone:** GROW-03–07 accumulated integration checkpoint: run retained 420Grow web build/negative tests, Grow Go service/location, affected GEN-SVC-2 and Location Go suites, canonical product/identity/contracts/integration guards on the SAME exact implementation SHA. Not a full Solidity/Genesis/Docs inventory.

**Limitations:** Service offset pagination is snapshot-local within a 500-item upstream projection, not a stable global cursor. The static web currently calls the shared `/v1/places` API directly; the Grow service `/v1/grow/places` endpoint is not automatically browser-wired. Live source DNS/TLS/end-to-end deployment and manual mobile/accessibility testing remain GROW-10, not claimed by fixture tests.

**Next canonical step:** GROW-08 — Repository qualification.

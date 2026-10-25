# HC-NEXT-5.3 — Original Sixteen activity integration
**Authority:** existing frozen `deployments/highcountry/original-sixteen-discovery-journeys.v1.json`; sixteen founders, four independent fragments each, 64 primary activities and 64 equivalent accessible archival routes. No paid founder acquisition gate.
## Implemented
- Authenticated registered-player `/discovery/snapshot` and `/discovery/ingest`.
- Exploration and landmark inspection, record research, preservation/restoration milestone, historical evidence reconstruction and accessible public-archive research are matched against objective IDs, sites and permitted event classifications from the approved journey map.
- Independent Ed25519 `HC.MISSION.EVIDENCE.V1` signatures with the discovery schema version and exact objective ID and event type. The trusted issuer signs facts; client-supplied text is never sufficient.
- SERIALIZABLE PostgreSQL state shares durable game account/session epochs. All 64 fragments, 16 revelations, and one master title are one-time nontransferable ordinary entitlements; no chain mint, BUDS burn, paid proof or gameplay fairness advantage.
- Accessible objectives satisfy the same fragment, revelation and master reward, never a secondary or inferior edition.
- Server-only mutation and public read view through `/discovery`. Guest archive preview remains free.
## Runtime acceptance
Operator must provision `config.discovery.catalogVersion` matching the approved journey schema and trusted `evidencePublicKey`/`evidenceIssuer`. The mission verifier is separately configured; keys remain outside browser assets. If disabled, discovery endpoints fail closed.
## Qualification
Scoped Level 1: `cd services/highcountry-economy && node --test test/discovery-integration.test.js`.
Affected economic Level 2: `cd services/highcountry-economy && npm test`.
Retained browser E2E and PostgreSQL checks should be used only where relevant. Existing Archive Level 1 evidence may be retained for unchanged journeys and catalogue SHA. No global Genesis rerun.
**Deployment gate:** real signed exploration, archival research, preservation and reconstruction event producers and live PostgreSQL concurrency/restart closeout must be evidenced before public production acceptance.

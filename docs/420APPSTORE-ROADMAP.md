# 420AppStore — GEN-10.6 implementation roadmap

420AppStore is the contract-free Genesis catalogue for discovering, evaluating and launching registered 420 Integrated applications while preserving 420Registry, chain state and 420Wallet as the canonical identity, execution and authorization boundaries.

The catalogue is intentionally non-canonical. It may curate, rank, feature, review and warn, but it cannot create Registry legitimacy, revoke Registry state, grant Wallet capabilities or make a listed application safe by assertion.

## APPSTORE-0 — architecture and qualification baseline

- Freeze service identity `420/service/appstore/v1` and the contract-free trust boundary.
- Encode APP-INV-001 through APP-INV-013 as machine-testable expectations.
- Define canonical sources, non-canonical catalogue fields, privacy exclusions and Wallet authority boundaries.
- Establish the long-lived `feature/gen10-6-420appstore-v1` branch and exact-head qualification contract.

## APPSTORE-1 — service/runtime scaffold

- Add the `appstore/` Go service tree and runtime entrypoint.
- Configure chain/network identity, Registry source, catalogue store and public API listener.
- Fail closed on wrong network identity or unavailable Registry source for canonical fields.
- Expose health/readiness without claiming canonical protocol authority.

## APPSTORE-2 — canonical Registry ingestion

- Resolve service/application identity, version and implementation provenance through 420Registry / ProtocolRegistry.
- Preserve chain ID, network identity and contract references exactly.
- Track Registry lifecycle state including active, deprecated and superseded versions.
- Make catalogue projections rebuildable from canonical Registry and public chain sources.

## APPSTORE-3 — catalogue projection and persistence

- Add a non-canonical rebuildable catalogue store keyed by canonical application/service identity and version.
- Separate canonical provenance fields from operator-controlled presentation metadata.
- Preserve deterministic rebuild and restart behavior.
- Add history for catalogue presentation changes without rewriting canonical facts.

## APPSTORE-4 — listing metadata and curation

- Add categories, descriptions, screenshots, featured placement, ratings/reviews and editorial metadata as explicitly non-canonical fields.
- Add sponsored placement with mandatory disclosure.
- Ensure listing/delisting/featuring/ranking cannot mutate Registry legitimacy or chain state.
- Support alternative catalogue operators and client-specific curation policies.

## APPSTORE-5 — security and provenance context

- Integrate 420Verify evidence, Explorer contract references, publisher public Identity provenance and published audit/security evidence.
- Preserve source provenance for verification, audit, trust, deprecation and incident warnings.
- Distinguish sourced facts from catalogue opinion/editorial warnings.
- Never convert verification, audit or listing state into a claim of safety or endorsement.

## APPSTORE-6 — permissions and Wallet handoff

- Model requested Wallet permissions, capability scopes and high-risk actions.
- Expose permission/security context before launch where metadata is available.
- Implement Open in 420Wallet deep-link/handoff context carrying app/network identity only.
- Prove AppStore cannot sign, grant capabilities, approve spending or bypass Wallet/Smart Account confirmation.

## APPSTORE-7 — discovery API and application views

- Add browse/categories, search, application-detail, publisher/provenance, contracts/versions, permissions, security evidence and warnings APIs/view models.
- Keep discovery/ranking outputs explicitly non-canonical.
- Preserve direct links to Registry, Explorer, Verify and Wallet context.
- Ensure AppStore outage does not block direct application interaction.

## APPSTORE-8 — privacy, abuse resistance and failure recovery

- Exclude private Messenger/Commons content, encrypted Resource payloads, private Identity fields and raw Attention telemetry.
- Keep installation/launch history private by default.
- Harden malformed metadata, oversized media references, ranking manipulation, review abuse, spoofed provenance and malicious deep links.
- Test Registry/RPC/search/Verify/store outages and degraded operation.

## APPSTORE-9 — frontend Genesis experience

- Implement the required Genesis views: browse/categories, search, application detail, publisher provenance, contracts/versions, permissions/scopes, security evidence, warnings and Open in 420Wallet.
- Clearly label sponsored/featured/editorial content.
- Show canonical-vs-catalogue provenance and network identity in user-facing detail views.
- Preserve accessibility and no-JavaScript/degraded navigation where practical.

## APPSTORE-10 — testnet qualification, reconciliation and phase closeout

- Exercise APP-INV-001 through APP-INV-013 against the exact branch head.
- Demonstrate deterministic catalogue rebuild from Registry/public sources.
- Complete backend/frontend readiness, security, privacy and Wallet-handoff checks.
- Reconcile latest `main`, re-run exact-head qualification and retain evidence.
- Merge GEN-10.6 once all required checks are green, then hand off to GEN-10.7 / 420Notifications.

## Merge policy

APPSTORE-0 through APPSTORE-10 stack on one long-lived feature branch. Do not merge subphases independently. At phase closeout, reconcile latest `main`, qualify the exact final head, then merge once.

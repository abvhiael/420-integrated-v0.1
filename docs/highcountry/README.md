# High Country

High Country is the browser-first cultivation/genetics game defined in the root README. The repository currently contains HC-1..HC-6 contract foundations, HC-PA progressive-access policy, HC-GP Gaming Protocol adapters and a framework-neutral access client. It does not yet contain a playable browser game, harvest/product economy or a deployable persistent game service.

- [Adopted gameplay specification and HC-7/economy baseline](GAMEPLAY-SPECIFICATION.md)
- [Deployment authority, trust and recovery policy](DEPLOYMENT-AND-TRUST.md)
- [Migration consent, authority and recovery boundaries](MIGRATION-BOUNDARIES.md)
- [Canonical types, units and compatibility](TYPES-AND-UNITS.md)
- [Architecture, state authority, permissions and dependency map](ARCHITECTURE-AND-AUTHORITY.md)
- [Approved full social economy launch scope and all 65 requirement assignments](RELEASE-SCOPE.md)
- [Repository audit, requirement matrix, security findings and remediation roadmap](REPOSITORY-AUDIT-20261009.md)
- [Comprehensive reconciliation and buildout roadmap](RECONCILIATION-AND-BUILDOUT-ROADMAP.md)
- [Foundation developer/operator guide](BUILD-AND-OPERATIONS.md)
- [File and immediate dependency inventory](FILE-INVENTORY-20261009.json)
- [Progressive access and state authority](HC-PA-PROGRESSIVE-ACCESS.md)
- [Shared Gaming Protocol integration](HC-GAMING-PROTOCOL-REFERENCE.md)
- [Session policy](HC-GP-4-SESSION-CAPABILITY.md)
- [Shared-claim migration](HC-GP-5-GUEST-MIGRATION.md)
- [Optional event gate](HC-GP-6-OPTIONAL-COMPETITION-ACCESS.md)
- [Scoped cross-game attestations](HC-GP-7-CROSS-GAME-ATTESTATIONS.md)
- [Access client policy](HC-GP-8-CLIENT-ACCESS-UX.md)
- [Deterministic policy qualification scope](HC-GP-9-E2E-QUALIFICATION.md)

Core play must remain available without registration or a wallet. Wallet linking expands optional ownership/interoperability/content; it may not improve protected gameplay statistics. The shared Gaming Protocol is a Genesis component; the entire High Country game is listed as a first-year application. Test results and readiness must preserve that distinction.

- [R01 milestone review and retained delivery decisions](R01-MILESTONE-REVIEW.md)

- [R02.1 real CapabilityRegistry wiring and five-fix qualification](R02.1-CAPABILITY-WIRING.md)

- [R02.2 nonperiodic capability policy](R02.2-CAPABILITY-BUDGET-POLICY.md)

R02.3 links PublicCultivationAccess reservations and allocations to PlantRegistry private/public admission and terminal release. One-time capability-authorized reciprocal binding is required before use; active allocations cannot release. See [capacity policy](R02.3-PUBLIC-PLANT-CAPACITY.md). Source consumption, harvest and production services remain later work.

R02.4 requires explicit seed/clone owner approval for the plant/parcel/plot and atomic scoped resource consumption. Source-less admission rejects; PlantRegistry now requires both resource registries in its constructor and all three reciprocal bindings before admission. Transfer invalidates approvals; termination never refunds the resource. See [source policy](R02.4-PLANT-SOURCE-CONSUMPTION.md). Clone cutting issuance and fabricated lineage/phenotype prevention remain R02.5/R02.6.

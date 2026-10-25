# NHL fantasy: approved V1 product rules

## Status — 2026-10-25

The user completed the salary-cap/captain, season-long and initial pick'em product-policy approval sequence. The records below preserve each decision and explicit exceptions. Earlier pending/draft wording inside those chronological records is superseded by later approvals in the same record. Their final approved sections govern.

| Format | Approved record | Implementation boundary |
| --- | --- | --- |
| Multi-game salary cap and single-game captain | [Salary/captain V1](BET-FANTASY-SALARY-CAPTAIN-DECISIONS-V1.md) | Implement historical salary publisher and reconcile roster, snapshots, exact arithmetic, events and shared daily funding/disputes in funded hosts and clients. |
| Season-long total points, H2H points, H2H categories and roto | [Season V1](BET-FANTASY-SEASON-DECISIONS-V1.md) | Implement approved category fields, draft confidentiality/randomness, feasibility/fallback, ranked waivers, trade review, weekly lifecycle and season escrow/disputes. |
| Peer and house-backed player-stat pick'em | [Pick'em V1](BET-FANTASY-PICKEM-DECISIONS-V1.md) | Implement frozen boards, eligibility/voids, peer win-fraction rankings/refunds, house 3x/5x payouts plus fees/reserves, whitelist and affected-result finality. |

Same-game pick'em is allowed only when the frozen official schedule has fewer than three NHL games on the slate's New York calendar date. Only different-athlete skater shots/blocks may share a game. Goals, assists and goalie saves require a game not shared by another leg. Qualify allowed pairs and triples before enabling them. A platform-curated slate cannot manufacture eligibility for this exception.

Playoff pools remain a separate future format to define nearer their start. They do not change the approved regular-season leagues.

## Approval is separate from qualification

The approved implementations now have separate publisher, source, client/custodian and canonical funded contract paths. Earlier draft modules and their evidence remain retained for their original scope. See [implementation and executable qualification](BET-FANTASY-APPROVED-IMPLEMENTATION-V1.md). Product approval alone does not establish a test pass: funded local acceptance requires a clean-SHA certificate from the executable Level 2 runner. Neither the implementation nor a local certificate activates production.

Official deployments, real authorities, prospective live reports and finalized funded receipts remain TN-FAN-01–05 in the [testnet roadmap](../420BET-TESTNET-WORK-ROADMAP.md). Independent economic/risk/security acceptance and phase-boundary Level 3 remain separate requirements. No tests were executed merely to record these documentation approvals; no new pass, merge or production activation is asserted.

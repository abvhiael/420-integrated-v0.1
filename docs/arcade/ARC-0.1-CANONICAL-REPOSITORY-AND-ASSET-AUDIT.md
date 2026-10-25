# ARC-0.1 — Canonical repository and asset audit

Status: DISCOVERY RECORDED — LEVEL 1 QUALIFICATION PENDING
Qualification classification: ordinary roadmap step (Level 1)
Repository snapshot: `abvhiael/420-integrated-v0.1` main `3b170bbbaa6e9291d331be78dd6c0a5e9b1b8c3b`
Related character-source repository: `abvhiael/420-integrated` main `11aad7b9be008c57d70f7f6b1fd1094c48fff03b`

## Scope and authority

This is a source-discovery deliverable for the proposed 420Arcade Genesis collection, **not** authorization to amend the frozen Genesis roster. The eleven planning titles are Kush Crush, 420Colouring Book, 420Buddy, Bong Breaker, Baked Invaders, Puff-Man, Grasshopper, Roach Run, High Climb, Where's Dave?, and Mad Bud Delivery. The proposed roadmap currently resides in project planning discussion; no pre-existing canonical ARC-0.1 implementation or roadmap was located in the inspected main-tree snapshot. Consequently, **do not claim the conversational step number is already canonical**. ARC-0.3 must obtain the required formal Genesis decision before an application registration is made.

Discovery method: inspect complete non-truncated GitHub Git Trees for the two named repositories; inspect relevant canonical files and CI workflow definitions at the recorded main revisions. Tree path presence establishes inventory only, not passing tests or run-time behavior.

## Inventory and ownership

| Boundary | Existing authoritative source | ARC-0.1 finding / rule |
| --- | --- | --- |
| Genesis decision | `config/genesis-applications.json` (`GENESIS_APPLICATION_DECISION_1`, status `FROZEN`) | 420 Gaming Protocol is included; 420Arcade is not established as an authorized Genesis app. No silent roster modification. |
| Gaming contracts | `contracts/src/gaming/{GamingAuthorization420,GameRegistry420,GameIdentity420,GameEntitlements420,GameClaims420,CrossGameRegistry420,GamingIds420}.sol` | Six contract roles plus IDs already exist; arcade must not duplicate them. |
| Gaming reference tests | `contracts/test/GamingProtocol420.t.sol`, `GamingProtocol420AuthorityIsolation.t.sol`, `GamingProtocol420Hardening.t.sol` | Preserve canonical protocol test ownership; not part of a documentation-only ARC-0.1 run. |
| SDK | `packages/420-gaming-sdk/src/{client,access-state,index,contracts,transports,abi-bindings}.js` | Reuse scoped `createGamingClient420({ gameId, adapters })`; verify exact capability by adapter rather than assuming additional game APIs exist. |
| SDK tests | `packages/420-gaming-sdk/test/{sdk,contracts,highcountry-compat,r05-8-transports}.test.js` | SDK tests owned by existing SDK suite. |
| Developer onboarding | `developer-hub/src/gaming-*.mjs`, `docs/gaming/420GP-17-DEVELOPER-PORTAL-GAME-ONBOARDING.md`, `docs/developers/gaming-onboarding.md` | GP-17 is documented complete; use onboarding manifest, registry profile, progressive access, devnet rehearsal and testnet evidence interfaces. |
| Gaming reference games | `docs/gaming/420GP-{11,12,13}-*.md`, `docs/gaming/TGR-0-ARCHITECTURE.md` | The Green Road, High Country, Budtender and Smoke & Chrome provide reference patterns; no game-specific state should be shared by default. |
| Protocol testnet | `docs/gaming/420GP-15-LIVE-TESTNET.md` | Deployment runtime is documented unresolved; mock/devnet qualification does not prove live testnet acceptance. |
| Existing scoped CI | `.github/workflows/gaming-{sdk,runtime,query,client-hardening,cross-game-qualification,four-game-e2e,security-hardening,live-testnet}.yml` | Reuse relevant owner jobs only after changes justify them; `gaming-sdk.yml` path filters do not include arcade docs. |
| Mad Buds source repository | `abvhiael/420-integrated`, path `mad-buds/` | Separate Unity/C# project, not an embedded production asset library in `420-integrated-v0.1`. |
| Character canon | `mad-buds/Docs/CHARACTER_BIBLE.md` | Ten locked source identities: Kush Krusher, Sativa Steve, Terpene Tina, Hash Gordon, Dabby, Purple Haze, Roach, The Edible, Bongwater Bob, Northern Lights. Distinct silhouette, abilities, animation and collision expectations. |
| Art inventory | `mad-buds/Art/README.md` and full source tree | Art folder currently contains README only in the inspected tree; **no approved character image frames found there**. Do not fabricate sprites or claim export-ready source assets. |
| Mad Buds runtime | `mad-buds/Game/Assets/MadBuds/` | Unity assemblies for gameplay, launcher physics, infrastructure, presentation, networking, save and tests. Web arcade is a separate runtime; asset reuse requires an approved export/derivative pipeline. |
| Mad Buds integration policy | `mad-buds/Docs/420_INTEGRATION_CONTRACT.md` | Core play offline with `NullBlockchainProvider`; integration optional, no private keys in client, no pay-to-win, no direct gameplay calls to chain. |
| Mad Buds test owner | `.github/workflows/mad-buds-ci.yml` in source repo | Preserve source game CI; no reason to run it for this documentation-only audit. |

## Gap / requirements-to-evidence matrix

| Requirement | Evidence at inspected revisions | Status / next owner |
| --- | --- | --- |
| Resolve active main SHA, source snapshots | Both main tree SHAs recorded above; full trees returned `truncated=false` | DISCOVERED; reconfirm before actual merge. |
| Locate authoritative 420Arcade roadmap and original exit criteria | No arcade/420Arcade path in the 10,949-entry target main tree and no ARC-0.1 path; user planning scope exists outside repository | GAP: require formal canonical roadmap ratification at ARC-0.2/0.3; cannot claim an existing file was audited. |
| Locate current arcade code, assets, tests and workflows | No path matching arcade or Mad Buds in target tree | NOT PRESENT in inspected target main; do not invent baseline or prior qualification. |
| Identify existing protocol/services | Listed paths and onboarding guidance above | SATISFIED for source discovery; functional compatibility requires future code and tests. |
| Identify source character identities and provenance | Separate `abvhiael/420-integrated` repo character bible and art README | IDENTIFIED; approved source PNG/vector files not present in source art tree. |
| Define source-art export and licensing/provenance check | No validated arcade-ready sprite/portrait exports shown in inspected source tree | BLOCKER to asset production, **not** grounds to waive ARC-2 validation. |
| Identify CI owner and constraints | Existing gaming SDK and protocol workflow paths, path-filtered SDK workflow | DISCOVERED; no purpose-built ARC-0.1 Level 1 workflow exists in inspected main. |
| Confirm testnet dependencies | GP-15 documented live deployment unresolved; GP-17 requires real live evidence | DEFER live observations to existing canonical testnet process; do not defer locally executable adapter tests. |
| Check active PRs, last qualified arcade SHA | Arcade branch search returned no named branches; no arcade artifacts located in main; no prior arcade qualification evidenced | NO ARC BASELINE ESTABLISHED. Full PR and branch review required before merge, especially if new ARC work appears. |
| Inventory actual asset pixel formats, dimensions, rights and approvals | No production image files in inspected Mad Buds Art tree | UNVERIFIED / BLOCKED pending source delivery. |
| Qualify ARC-0.1 at exact implementation SHA | No scoped CI run or durable certificate recorded yet | PENDING. Do not label PASS. |

## Architectural constraints for ARC-0.2

1. Keep guest/registered/wallet-linked tiers independent and core gameplay wallet-free.
2. Pin exact game namespace and fail closed on missing high-risk adapters.
3. Never elevate an indexer, arcade client, or developer portal to chain authority.
4. Separate Mad Buds Unity gameplay code from browser implementation; treat character-bible identity and licensed approved source assets as canonical, not generated facsimiles.
5. Use a repeatable asset export with immutable character IDs, frame data, source checksums, license/approval metadata and derivative hashes.
6. Enforce game-by-game saves, scores, input validation and no cross-game profile enumeration.
7. Keep live authorization/rewards/registration disabled until real-network evidence is established.
8. Do not alter frozen Genesis inputs as part of the audit.

## Required Level 1 closeout

- Recheck target main SHA, branch divergence, and any relevant newly opened arcade PRs.
- Confirm this audit references existing files and reflects exact repository contents.
- Execute directly applicable documentation/inventory checks, not global Foundry/Genesis/Integrated/Docs jobs.
- Record actual check/run identifiers, tested implementation SHA, evidence SHA, reconciliation base and any missing required jobs.
- Commit durable PASS certificate **only** after exact-SHA proof. Otherwise remain PENDING.
- Proceed to ARC-0.2 only after original ARC-0.1 exit criteria are ratified and verified.

## Source references

- [Genesis application decision](https://github.com/abvhiael/420-integrated-v0.1/blob/main/config/genesis-applications.json)
- [Gaming Protocol integration](../developers/gaming-protocol-integration.md)
- [Game onboarding](../developers/gaming-onboarding.md)
- [Shared SDK](https://github.com/abvhiael/420-integrated-v0.1/blob/main/packages/420-gaming-sdk/README.md)
- [GP-17](../gaming/420GP-17-DEVELOPER-PORTAL-GAME-ONBOARDING.md)
- [GP-15](../gaming/420GP-15-LIVE-TESTNET.md)
- [Mad Buds character bible](https://github.com/abvhiael/420-integrated/blob/main/mad-buds/Docs/CHARACTER_BIBLE.md)
- [Mad Buds artwork directory](https://github.com/abvhiael/420-integrated/tree/main/mad-buds/Art)
- [Mad Buds integration contract](https://github.com/abvhiael/420-integrated/blob/main/mad-buds/Docs/420_INTEGRATION_CONTRACT.md)

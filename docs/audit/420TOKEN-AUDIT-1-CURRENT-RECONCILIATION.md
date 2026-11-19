# TOKEN-AUDIT-1 — Current repository reconciliation

Date: 2026-11-19. Audited main: `f7268738b5b5c8984d00a10dae750d58d12f2039`. Classification: inventory and evidence reconciliation, not fresh executable or live qualification. Original October baseline and TOKEN-AUDIT-1–9 numbering remain immutable history.

## Authority and scope

The authoritative application decision v10 (blob `73a24bfe46787f3c2af043adc1de12eea1f456ab`) includes 420 Token as GENESIS_PROTOCOL_AND_USER_APP, contracts required, self-service frozen ERC templates for exactly 42 native 420. The six-contract map agrees with token Genesis config (blob `c4167fc57fad9f17fdcf7f81a9a818d1114974d0`). All eight profiles remain: ERC20_FIXED, ERC20_MINTABLE, ERC20_CAPPED, ERC20_BURNABLE, ERC20_PERMIT, ERC20_VOTES, ERC721_COLLECTION, ERC1155_MULTI. Factory deployment charges exactly 42 native 420, forwarded atomically and in full to `420/treasury/vault/token-creation-community-revenue/v1`; no Development Compensation Vault routing, factory custody, arbitrary bytecode or post-deployment factory mint authority. No native issuance, automatic endorsement or downstream eligibility.

Permanent FROZEN_V3 commitment: `0x94321abcd7016ec0494a2c616fdf55bf4e8815dcc0f92d03933b335630e25d6d`; commitment file blob `e01538725780ab81c3667374e8c9bcdb3592c674`. Its app and namespace input Git blob hashes agree with observed files (namespace `d9c40056db30513c0445f0c341d261b63dc6a1a5`); system-addresses blob independently read as 50c8d7c860ff48d52f41874bc55ee092cc9c5b6d. GovernanceTimelock 0x0000000000000000000000000000000000000429 and ProtocolRegistry 0x0000000000000000000000000000000000000434 remain discovery authorities. TokenFactory420 is Registry-resolved, no fixed Genesis address; 0x0455 is retired. V3 resident manifest `contracts/artifacts/genesis-residents/v3/manifest.json` (blob d0d5cc6f1bc2d84bf1fb4192e8072cab024a3998) does not materialize a TokenFactory predeploy. This is not a defect. The existing Token release materialization is a deployment-order specification, not a V3 executable deployment package; reconcile artifacts, actual constructor commitments, local deploy rehearsal and runtime identity in TOKEN-AUDIT-4. Do not modify frozen V3 inputs.

## Retained evidence and exact blob comparison

Original audit PR #521 merged as b338b9c9c140957b0ea8619b0b20bfed415f2c6d. October report records qualified implementation f0c3cf1d922bf7279f001cf1934b3c62e4509859 and final reconciliation c0a82e5a7d281d5922b7d69baebd5ed57eea29af. Historical passing workflow numbers (as recorded, not newly retrieved run IDs): Token #32, Solidity #4813 (four shards), Integrated #6420, Docs #5314, Genesis address #1519, Wallet Web #1608. Connector workflow lookup returned no PR-triggered runs for the historical implementation or current main; preserve retained evidence, do not claim new workflow passes. GitHub compare returned 11,165 commits ahead and 300 files (limited response); do not infer unchanged dependencies from that truncated compare.

The following 23 files were fetched individually at both the historical implementation and current main; equal Git blob SHA proves byte identity, not a new test run:

| Path | Git blob SHA (both refs) |
| --- | --- |
| `contracts/src/token/TokenIds420.sol` | `7312e29e7a46481c99de75ae0c12505e8f84c39d` |
| `contracts/src/token/TokenFactory420.sol` | `81ee6a926a59540cc29ac15d81182be777dc26c6` |
| `contracts/src/token/TokenTemplateRegistry420.sol` | `595629cd42629d72b2a518ab1c8733305b8dce9e` |
| `contracts/src/token/ERC20Template420.sol` | `44a7040ce96006f153f1f81d07ee3bc49485c590` |
| `contracts/src/token/ERC721Template420.sol` | `e2cd734ba8186d54c57c7f63e6dc7a9ca776de96` |
| `contracts/src/token/ERC1155Template420.sol` | `5f393ebde4a28cc221d5c1c2a903cb85923c2cd1` |
| `contracts/src/system/SystemAccess.sol` | `7d9224b629d5d7049810966743eed43df675f64d` |
| `contracts/src/interfaces/I420System.sol` | `5a2edcdc707a3736db47ae8207292bbc32798d48` |
| `contracts/src/vault/AssetVault420.sol` | `c4dbcc6c60588c8487de53c9203b887a04852f89` |
| `contracts/src/vault/VaultRegistry420.sol` | `f483023a4876930a7dc3f5506809fcb3f6411ca8` |
| `contracts/src/vault/VaultAuthorization420.sol` | `51c0351202053e6116f6e7bd33242930fa0717d4` |
| `contracts/src/vault/VaultPolicyRegistry420.sol` | `b3316826fbd09fcf1da37dc4c845e02ecdf4ad4d` |
| `contracts/src/vault/VaultAccounting420.sol` | `a2ca1174ba2852a75e73d6fd0ffa343ffb0a3e12` |
| `contracts/src/vault/VaultIds420.sol` | `b84888c16088381002f4fc9e0014b97c5fbef2ce` |
| `contracts/src/apps/ProtocolRegistry.sol` | `9ab3d53a68b6533978f41e0202e5268f1d615c19` |
| `contracts/src/libraries/ServiceIds420.sol` | `dd00c073fe17f7095a0bccb5db2678ff9cc8e8bd` |
| `contracts/test/TokenGenesis420.t.sol` | `93755b6c17c0faa07257caf24de91f38ffd217a9` |
| `contracts/test/TokenAudit420.t.sol` | `b1f9cc48150545e3272514995603f4852c497326` |
| `contracts/test/TokenVaultIntegration420.t.sol` | `01e16213c387b66898cc55831ba73af7f281ec33` |
| `contracts/test/TokenDeploymentBinding420.t.sol` | `008836a44a1b7fefe170cdf8575d3fa84f3e262d` |
| `wallet/web/core/token-runtime.js` | `6c5106d5dd390836ea836a59521f55dd72473526` |
| `wallet/web/core/token-handoff.js` | `6f77604b3b7367c2857ae613d4165e4cdcb2a779` |
| `wallet/web/test/token-runtime.test.js` | `c3de80d77f3b65eca802fe3c8c3d4f6f8c0abc1a` |

Wallet execution.js differs: old 5b7b3cd37dc3635e9113ec5cf8f078fdea1bb2a7; current b59838e285dd71ed447851e710cf69c24d8aa232. Its imports now include transaction-lifecycle.js; expected chain check is optional absent an expectedChainId. Token handoff does not forward runtime.chainId. Current shared Wallet ABI (01e895ff305c0b8a691ff59db644e6e0cda4eade), lifecycle, accounts, and execution require integration requalification, not inherited proof.

## Dependency and entry-point inventory

TokenIds is a library; TemplateRegistry inherits SystemAccess and I420System; Factory imports I420System, IDs, registry and all three template implementations. The three templates are self-contained (receiver interfaces defined in NFT/multi-token sources). Constructor/runtime dependencies: governance timelock -> template registry; canonical community AssetVault -> VaultRegistry, VaultAuthorization, VaultAccounting, VaultPolicyRegistry, VaultIds, ICapabilityRegistry420 (current blob 266f4003c86fafb74e7bcbc869bed1df39f28cfb). The real-Vault test uses a capability mock; deployed capability/authorization and Vault registration need same-release verification. ProtocolRegistry -> SystemAccess, I420System, IProtocolRegistry420 (0bf0a597fa2c6956b48acb0891beb4d0f57d25db), Types420 (b9c4578b0fd0029c913dcd890b8d498c4ee357db), ServiceIds420. Component 420/component/token/v1 and service 420/service/token/v1 must resolve to the same qualified factory; dependency root binds templates and Vault.

Wallet catalogue -> core/apps.js (9ca6558910fafcf9e7b2c529a3d1d880294c39b2) -> apps-page.js (c8098ec7118112fda7e6f9d53f0b6dfe65608488) loads verified manifest and links; core/config.js (cddb2a11d542a6f78a2320314e7c405da7dd3d78) provides service catalogue. Shared genesis-wallet-integration420.js (423623221ad1d1bbe90e18a6fadf43155af521ee) provides Registry discovery and active service verification; Token-specific runtime helper only validates provided address/hash formats and distinctness. Token handoff -> shared SmartAccount execution -> simulation/estimation and Wallet authority. Default-branch code searches for prepareTokenDeploymentHandoff420 returned only definition and test; createERC20 returned Solidity/test/docs, not a production form. No production Token-specific creation entry point established. A standalone URL/backend/database is not required by frozen config; do not invent one. AppStore discovery, Explorer/Indexer/Search/Analytics derived views, and Pay/Swap/Exchange/Bridge/Launchpad independent eligibility are integration boundaries, not Token authorities. No fresh end-to-end proof for these paths. Relevant historical branches returned by Token branch search: audit/420token-complete-20261004, feature/420token-genesis-v1, audit/bridge-token-routes-20261115 (separate Bridge owner). Open PR search for 420Token returned no matches; this is a search result not an exhaustive repository tree/PR proof.

## Current CI ownership

- Token-owned .github/workflows/420token-audit.yml (3b69874a267c86338c9f03263a1cc81bfd5a29e7): exact PR head checkout, PR profile build/format, Token verifier, shared address verifiers, Wallet Token runtime tests; security job hardening plus Slither. Both jobs currently auto-trigger on Token source, test, docs and readiness changes, and workflow_dispatch. The broad forge match test/Token*.t.sol can include independent bridge TokenGateway tests despite narrow trigger exclusions. Preserve all test inventories; isolate documentation/evidence and independent bridge owners and separate scoped checks from explicitly dispatched phase hardening at TOKEN-AUDIT-7.
- CI-GUARD-02 retained verifier distinguishes nine manual-only heavy inventories, scoped EXP-1.9 main regression and retired HighCountry. Do not rerun global Solidity, Genesis-address, Integrated or unrelated bridge qualification for this inventory. EXP-1.9 is scoped Indexer/Explorer main regression, not Token ownership. Universal policy requires exact-head, uniquely named candidate manifest, scope and only appropriate qualification. Actual universal guard workflow at audited ref has workflow_dispatch only (blob 8569a6cb41d57af1d0b740a3097a98289b3b66c5); policy's prose about automatic universal PR protection is not proof of installed enforcement. Enforceable repository ruleset remains unverified.
- Wallet Web Verification is scoped to wallet and shared configuration; 420Docs Qualification has broad docs path triggers. The legacy Token workflow would automatically queue hardening if this evidence/roadmap/readiness-only branch were opened as a PR. No new code changed; no heavyweight runs dispatched or claimed for this reconciliation. Do not use this record as a security certificate.

## Remediation ledger (existing roadmap IDs only)

| Finding | Owner | Disposition |
| --- | --- | --- |
| TOK-01 immutable permit domain across chain-ID change | TOKEN-AUDIT-2 | open, local |
| TOK-02 ERC721 public getApproved mapping returns zero for nonexistent/burned ID | TOKEN-AUDIT-2 | open, local |
| TOK-03 ERC1155 advertises metadata interface but uri() does not implement required uri(uint256) | TOKEN-AUDIT-2 | open, local |
| TOK-04 expand template interoperability, negative, fuzz and invariant coverage | TOKEN-AUDIT-2 | open, local |
| Canonical Vault identity stronger than same-ID check; all-template economic and failure-path integration | TOKEN-AUDIT-3 | open, local qualification; live identity proof remains 8 |
| V3 executable release artifacts, deployment order/commitment binding and local rehearsal | TOKEN-AUDIT-4 | open, local |
| TOK-05 production template selection/configuration/confirmation/management entry point not established | TOKEN-AUDIT-5 | open, local |
| TOK-06 supplied runtime hashes not independently resolved/checked by Token helper | TOKEN-AUDIT-5 | open, local |
| TOK-07 expectedChainId not forwarded to Wallet execution | TOKEN-AUDIT-5 | open, local |
| Derived services, downstream eligibility, documentation and application integration | TOKEN-AUDIT-6 | open, local |
| Legacy Token trigger ownership, current-head qualification and evidence | TOKEN-AUDIT-7 | open, local |
| Same-deployment official testnet evidence | TOKEN-AUDIT-8 | blocked by official testnet |
| Final Genesis/production gate | TOKEN-AUDIT-9 | blocked by 8 |

## Inventory verification

Twelve cross-file authority assertions evaluated successfully via the GitHub-read reconciliation operation: FROZEN_V3 status/hash, app and namespace input blob identities, application class, six-contract map, eight templates, exact fee, Vault ID, Registry-resolved address model, standalone URL rule, live-not-qualified. The source-identity comparisons above were separately executed through GitHub reads. No Solidity, Wallet, Slither, or live tests were executed; this is an inventory-only change and does not invalidate earlier passing implementation evidence. Requalification is needed before testnet readiness can be restored.

Current next step: TOKEN-AUDIT-2. No testnet needed for steps 2–7. Keep previous October report unchanged as historical evidence.

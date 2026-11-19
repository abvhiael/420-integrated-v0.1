# 420Pay application roadmap — PAY-APP

Owner-approved product scope, 2026-11-17. Normative product decision: [PAY-APP-0](PAY-APP-0-PRODUCT-SPECIFICATION.md). Existing PAY-AUDIT-1–8 numbering and historical results remain unchanged. All steps are unqualified unless exact-head evidence is retained. PAY-APP-0 records product approval, catalogue promotion, resident qualification, discovery and documentation. PAY-APP-1–18 track planned standalone development and deployment. Steps 0–17 are repository-side, including configuration transition; only real external/device/provider blockers may be deferred. Step 18 requires the live public testnet. Independent security review remains PAY-AUDIT-8.

## PAY-APP-0 — Genesis catalogue amendment and product specification

**Status:** COMPLETE. Product approval, V10 catalogue promotion under V3, and resident artifact qualification are recorded below. **Testnet required:** No.

Exit criteria: Promote approved v10 candidate only with explicit configuration version transition, rematerialization of all affected residents, catalogue/docs/discovery/verifier reconciliation and exact-head evidence. Retain reproducible scoped qualification at exact implementation SHA.

### PAY-APP-0.2 — Dependency-aware regression discovery

Qualified at `c3fb2cf48b3429a9d7e8da96b2e204d7c452863d`. The independent inventory examined 627 tracked owners and selected 46. Of those, 33 passed in retained evidence and 13 passed in the full CI profile. All 138 retained source SHA-256 identities matched. Six discovery tests and 23 Indexer tests passed.

| Workflow | Run ID |
|---|---:|
| Full Pay regression | [44370481682](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44370481682) |
| PAY-AUDIT-7 | 44370481289 |
| 420Indexer | 44370482225 |
| CI-GUARD-02 | 44370481232 |
| 420Stake | 44370481363 |
| 420Explorer | 44370481580 |
| 420Registry | 44370481450 |
| 420Docs | 44370481391 |
| Native V3 candidate rehearsal | 44370481372 |

Retained artifacts are independent inventory `14457823388`, full regression `14458074983`, and derived runtime identities `14458808233`. The earlier regression archive `14447571280` belongs to run `44342384413` at `fa8cc74c0d5529ecd9032eba6afbe0f4b9247041`. The historical passes for `BetVideoPokerPaytable54.t.sol` and `ComputeJobPayerCustody420.t.sol` are retained outside the dedicated Pay coverage count.

### PAY-APP-0.3 — Permanent V3 Genesis configuration integration

The active configuration is `FROZEN_V3`, domain `420/GENESIS/CONFIG/V3`, with commitment `0x94321abcd7016ec0494a2c616fdf55bf4e8815dcc0f92d03933b335630e25d6d`. Independent Keccak-256 derivation also reproduced the historical V1 and V2 commitments. Git blob verification matched all six authority inputs. The only changed input was the approved V10 catalogue, blob `73a24bfe46787f3c2af043adc1de12eea1f456ab`.

The initial permanent V3 integration passed exact-head native rehearsal and Pay audit at `5b5560c0db4fe80710ae349f987b11aaf2713b35`. Native rehearsal reproduced 9 Pay and 4 Swap constructor runtimes and the disabled Bridge gateway. The Bridge package contained 113 compiler artifacts, and all 20 planner tests and 7 rehearsal checks passed across 11 core deployments. The configuration-sensitive Pay deployment, publication and wiring test passed under the full CI profile. The PAY-APP-0.2 evidence applies to the other unchanged Pay owners.

| Qualification | Run | Artifact |
|---|---:|---:|
| Committed V3 native rehearsal | [44378671347](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44378671347) | 14462148293 |
| Configuration-sensitive Pay regression | [44378671219](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44378671219) | 14462745884 |
| SWAP-AUDIT-6 materialized head | [44378671289](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44378671289) | See run |

Retained historical commitment blobs are V1 `c8537f6c984ba7d4965e8b51aaefc26c6e2e1cd5` and V2 `b69b140df641975f57f05c42e45d48ee93c0c1e0`. The historical Bridge qualification verifies against `95f6a94b7c313a14a6689fe754806a88e9bdc95d`. The V3 Swap deployment binding derives its four runtime identities from the committed predeploy states and remains subject to SWAP-AUDIT-8 live qualification.

### PAY-APP-0.4 — Native artifact reconciliation

**Status:** COMPLETE for frozen V3. **Testnet required:** No.

The resident manifest at `contracts/artifacts/genesis-residents/v3/manifest.json` records the nine Registry-resolved Pay residents, the four frozen Swap predeploys, and the disabled VerifiedGateway420 predeploy. Its compressed JSON bundle retains the compiler ABIs, creation and runtime bytecode, immutable references, storage layouts, and constructor inputs and outputs. The Pay settlement adapter's executor is a Registry-resolved deployment input. The address and storage word in its rehearsal record come from the local constructor run.

The source inventory found 28 global-commitment constructor consumers. Five are frozen predeploys and nine are covered Registry-resolved Pay residents. The remaining 14 are deployment-time dependencies. These include ten Bridge cores, three non-predeploy Swap components, and ReplayProtectionConsumer420. Candidate reservations convey no deployment authority. Stake's separate commitment is outside this inventory.

The retained [native rehearsal](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44385260069), artifact `14464554916`, ran at `032f1bfa59e97436d6083b1f638a68eb00c7cc21` with Solidity 0.8.24, Cancun, optimizer 200 and via IR. The repository preserves the retrieved archive byte for byte. Its SHA-256, originating commit, source identities, and 13 Pay and Swap compiler artifact digests are checked during reproduction. Fresh construction compares all 14 runtime identities and checks storage, the exact Registry and timelock bindings, empty initial registrations, and gateway verifier state. Unauthorized factory and settlement-adapter configuration calls revert. The pinned timelock also fails closed when the required Registry authority is missing.

Run the pinned native build and verifier from the repository root with Foundry and the Bridge Python requirements installed.

```sh
(cd contracts && FOUNDRY_PROFILE=pr forge build src/pay src/swap --extra-output storageLayout)
solc="$HOME/.svm/0.8.24/solc-0.8.24"
python scripts/bridge-audit-12/package.py build --solc "$solc" --output /tmp/genesis-bridge
python scripts/bridge-audit-12/materialize_residents.py --check \
  --bridge-package /tmp/genesis-bridge --anvil "$(command -v anvil)" \
  --output /tmp/genesis-resident-evidence
```

The verifier selects the output directory from the active commitment domain. Use `--write` to regenerate the retained records from a qualified compiler build and fresh Anvil constructors. The V3 native workflow invokes `--check` and retains the rehearsal results.

### PAY-APP-0.5 — Genesis application catalogue reconciliation

**Status:** COMPLETE. **Testnet required:** No.

The V3-committed V10 inventory has 22 entries. Pay is a Genesis protocol and user application under `420/service/pay/v1`. The dependency map, documentation matrix, Explorer requirements and acceptance references, Registry discovery guidance, and contextual help now use the same classification. Pay has six development and Genesis documentation routes. Deployment identity and readiness still require separate PAY-AUDIT-7 and Pay application evidence. Gaming remains protocol-only, Arcade remains deferred, and Faucet remains testnet-only.

### PAY-APP-0.6 — 420Wallet application discovery integration

Wallet lists the approved Pay service as `420/service/pay/v1` with
`https://pay.420integrated.org` as its proposed production origin. The web
catalogue offers connection help while Pay is unavailable. Extension navigation
requires a release-approved testnet or production entry, the corresponding
chain's active ProtocolRegistry record and matching runtime, and a reachable
approved endpoint. Navigation grants no account access or spending permission.

Local qualification covers catalogue visibility, manifest-only bypass attempts,
release and chain mismatches, unresolved and disabled records, endpoint failure,
and Wallet authorization regressions. Live launch depends on a published
release and active Registry binding.

### PAY-APP-0.7 — 420AppStore catalogue integration

The AppStore Payments catalogue exposes the approved scope under
`420/service/pay/v1`. Consumer payments, merchant dashboard, physical retail
POS, hosted checkout, Android, iOS, and developer integrations are each
listed as planned. Search and category browsing lead to the Genesis Pay user
guide and the Registry-backed detail view. Curated metadata carries no
contract binding, settlement authority, or launch target.

### PAY-APP-0.8 — Ecosystem dependency requalification

The requalification uses the frozen V3 commitment and V10 catalogue. The
resident manifest accounts for 28 constructor consumers. Registry and Bridge
qualification run each selected Solidity test from an isolated tracked import
closure. The full-tree Foundry scan otherwise resolves unrelated CADC test
fixtures before executing the selected tests. Production compiler settings,
constructor inputs, bytecode and the dedicated CADC qualification are unchanged.

| Component | Retained or reproduced evidence |
|---|---|
| Pay settlement, lifecycle and accounting | [Full Pay archive](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44342384413) and [dependency-aware extension](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44370481682). Verified the two archive digests and compared all 46 current owners against their tracked import closures. 45 qualify by source equivalence. |
| Pay deployment and ReplayProtection | The sole changed owner, `PayAudit6DeploymentPackage420.t.sol`, has the [V3 CI-profile pass](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44378671219). Its source, imports and compiler profile match the current tree. The canonical Pay deployment verifier reproduces nine V3 resident identities. |
| Swap, Bridge and deployment tooling | [Swap materialization](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44378671289) and [V3 native qualification](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44389872079). Verified six commitment inputs, checked historical V2 package integrity, compared 14 fresh constructor runtimes, and reproduced 20 Bridge planner tests and seven checks across 11 local deployments. |
| Registry | The Registry API, invariants and retained tests use the same selectors and profiles with isolated sources. The Registry descriptor provenance and integration verifiers passed. |
| Wallet and AppStore | [Wallet Web](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44396503563), [Extension](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44396503572), [Chromium](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44396503742), [Mobile](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44396503497) and [AppStore](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44401682196). The AppStore evidence is from the PAY-APP-0.7 dependency branch. Pay remains a discovery entry with launch gated separately. |
| Indexer and Explorer | [Indexer](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44392690643) and [Explorer](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44392690788). Go suites, TS Pay and Registry descriptors, and Explorer application inventory and descriptor provenance checks passed. |
| Stake | [Retained Stake qualification](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44370481363). Runtime sources and deployment inputs match the historical qualification. The separate Stake commitment, four frozen predeploys and Indexer/Explorer evidence bindings verify. |
| 420Docs | Verified 22 frozen application rows, 38 contract-map surfaces and 114 published contextual routes. |
| Additional consumers | Verified Arcade deferral, Doobr authority, shared consumer-service restrictions, Identity predeploy and Randomness audit. The affected Exchange release qualification passed six tests. [AI custody and deployment qualification](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44392690795) remains applicable to unchanged sources. |

To reproduce Pay evidence selection, obtain archives `14447571280` and
`14458074983` from their linked runs. Run
`scripts/qualify-pay-regression.py --profile ci --inventory-only --baseline-archive ZIP --baseline-sha256 SHA --output DIR`
once per archive and take the union of the two `baseline.reusable` arrays.
The digests respectively are
`357b189af9a6571c982fc71356e337478be09c75558847be834394fec6013777` and
`8b8f2a7b88badfed8fcaff39734bae0e709ffa8a06483475bd0ece589b9d46b9`.
Use the V3 configuration-sensitive run for the owner outside that union.

Public network deployment receipts still belong to PAY-AUDIT-7 and
PAY-APP-18. Repository qualification does not supply live deployment evidence.

Final requalification at `ae10c2f17b3b5fe5d5929c4d55e88b43cc55475b`
passed [Bridge](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44410706202)
with 275 cases across 30 test owners,
[Registry API](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44410706136),
[Registry invariants](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44410706121),
[Indexer and Explorer](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44410706091)
and [420Docs](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44410705980).

### PAY-APP-0.9 — Documentation and product roadmap closeout

The [approved product specification](PAY-APP-0-PRODUCT-SPECIFICATION.md)
maps consumer and merchant acceptance to the 18 delivery steps below.
The [Genesis inventory](../../GENESIS-DAPPS.md), [Wallet guide](../../users/wallet/dapp-connections.md),
[AppStore guide](../appstore/user-guide.md) and [deployment runbook](deployment-operations.md)
record the approved scope, discovery boundaries and frozen V3 artifact evidence.
PAY-APP-1 is the next implementation step.

## PAY-APP-1 — Shared application architecture and payment SDK

**Status:** Repository implementation complete. **Testnet required:** No.

Exit criteria: Inventory reusable clients, ABI bindings, domain types, validation, private persistence, projection/HTTP boundaries; pin architecture and test contracts. Retain reproducible scoped qualification at exact implementation SHA.


The shared TypeScript package is `packages/420-pay-sdk` (`@420/pay-sdk`).
It supplies read-only invoice and payment bindings, typed domain records, the
frozen quote lifetime check, a private draft read port and an authorized
payment-status response shape. It is environment-neutral and has no runtime
dependency on a web or native framework.

| Boundary | Reused repository authority and application contract |
| --- | --- |
| Network and transport | Reuse the network and JSON-RPC conventions in `packages/420-sdk/src/index.ts`. The Pay read port accepts a component identity, chain ID, block hash and ABI calldata. The adapter must use the same canonical block for Registry resolution, runtime verification and the call. Unknown or reorged snapshots fail closed. PAY-APP-2 owns the production adapter and Wallet connection. |
| ABI and domain | Use the frozen V3 compiler bundle and the PAY-AUDIT-6 deployment package. The SDK's two typed read bindings pin the Solidity selectors, tuple order, widths and enum values. Amounts and timestamps use `bigint`. An all-zero record represents a missing entry. Invoice `active` is the stored struct field. Checkout must separately verify closure, expiry, eligibility and Wallet authorization. |
| Signing and transactions | Reuse `packages/420-sdk/src/wallet.ts` and the Wallet-origin, chain, session and confirmation boundaries. Router, refund and settlement writes remain with their owning contracts and Wallet-approved actions. The shared read SDK exposes no transaction builder or signer. |
| Private persistence | The server derives authenticated merchant scope from chain and canonical merchant identity before opening any private draft read. The storage port takes that scope as a trusted input. Drafts and memos remain private off-chain state. Merchant onboarding, database implementation and report access belong to the merchant steps. Draft state cannot supply contract addresses or payout authority. |
| Projections and HTTP | Reuse canonical Pay events via `420-indexer/src/abi-manifest.ts`, `lifecycle-reducer.ts` and `pay-accounting-export.ts`. HTTP handlers authorize access before returning a projection. The SDK's allowlist status DTO carries chain and block provenance, without payer or draft data. A submitted, included, certified or finalized status must retain its meaning. Settlement requires its own canonical evidence. HTTP handlers, replay, checkpointing and compensation belong to the downstream steps. |

Run `npm ci --prefix packages/420-pay-sdk` and
`npm test --prefix packages/420-pay-sdk`. Tests pin the ABI and source-level
identifiers to retained authorities, check exact snapshot propagation and
lossless decoding, reject malformed and impossible records, and verify the
status response and 42-second boundary. The scoped SDK workflow checks the
implementation revision before building and running these tests.

## PAY-APP-2 — Registry, Wallet, Names and Identity integration

**Status:** Repository implementation complete. **Testnet required:** No.

Exit criteria: Verified chain/service/code/origin resolution, account selection, exact Wallet simulation/confirmation and scoped revocation; reject wrong network and spoofed identities. Retain reproducible scoped qualification at exact implementation SHA.

The shared SDK's `createPayRegistry` takes the verified deployment's chain,
ProtocolRegistry address and runtime hash, approved Pay origin, and pinned
service records for Pay, Names and Identity. Load these bindings from the
approved deployment manifest. The Pay origin and metadata hash must come from
the same approved service entry. Resolve active Pay components on-chain and
compare the registered and live bytecode hashes to the retained deployment
bindings. Registry, bytecode and view reads use the same canonical block hash.
An RPC endpoint must support EIP-1898 canonical block selectors.

Use `createPayReader(registry.transport, snapshot)` for Pay reads. The name
resolver uses that same snapshot for the forward .420 record and its optional
Identity420 profile. The record must be unexpired. A named profile must be
active, point back to the same name and have the resolved recipient as its
controller. Identity is presentation evidence. Canonical payment recipients
and authority still come from the payment contracts and Wallet review.

`createPayWallet` uses the selected 420 Wallet provider on the approved
application origin. Connect explicitly and require exactly one Wallet-selected
account on the configured chain. The SDK resolves the PaymentRouter420 target
and forwards the exact chain, account, calldata and value to Wallet.
Wallet simulates the exact call from its execution account and prompts for
approval before submitting. The resulting hash records submission.
Disconnect uses Wallet's origin-scoped `eth_accounts` revocation.

Run `npm ci --prefix packages/420-pay-sdk` and
`npm test --prefix packages/420-pay-sdk`. The SDK qualification covers the
canonical snapshot and service bindings, name/profile mismatches, and exact
Wallet requests. The existing Wallet extension popup qualification checks
that a wrong-chain request is rejected before approval.


## PAY-APP-3 — Consumer web dashboard and account management

**Status:** Repository implementation complete. **Testnet required:** No.

Exit criteria: Responsive personal account UI, derived balances, history, receipts, settings, accessibility and explicit fixture mode. Retain reproducible scoped qualification at exact implementation SHA.

The consumer web application is in `pay/web`. It connects through 420 Wallet
and displays native and approved token balances of the selected address.
It pages canonical PaymentRegistry events in 128-block intervals and reads the
corresponding payment records at the same snapshot. It verifies event block
provenance and displays records where the selected address is payer or
merchant. Refresh loads a new snapshot. A Wallet account, network or connection
change clears the current dashboard and invalidates pending results.

The downloadable JSON receipt includes chain, block, payment and invoice
identifiers, the canonical status and receipt commitment, and exact base-unit
amounts. It rechecks the current account and payment before export. Refund
accounting is labelled as the authorized refund amount. The amount visibility
setting is stored locally. Fixture mode requires an explicit action, labels
sample data and downloads, and is available only when deployment configuration
is explicitly null.

Build the shared SDK and consumer application with `npm ci` and
`npm run build` in `packages/420-pay-sdk` and then `pay/web`. Serve
`pay/web/dist` as static files. The checked-in `deployment.json` is null.
For an approved deployment, serve the PAY-APP-2 bindings at that same-origin
path with `chainId` as a decimal string, the verified HTTPS `rpcUrl`, and an
optional `tokens` array containing `address`, `codeHash`, `symbol` and
`decimals` for approved ERC-20 assets. The endpoint must serve canonical
EIP-1898 calls and PaymentRegistry logs to the approved origin. See
[deployment requirements](deployment-operations.md) for publication gates.

Run the SDK and dashboard `npm test` commands and `npm run browser` in
`pay/web` with Playwright Chromium installed. The scoped browser workflow
verifies fixture and configured Wallet flows, responsive layout, keyboard
navigation targets and automated accessibility checks at the exact revision.

## PAY-APP-4 — Send, request, QR codes and payment links

**Status:** Repository implementation complete. **Testnet required:** No.

Exit criteria: Validate recipients, invoice and address QR distinction, links, expiry, sharing, retries and duplicate protection. Retain reproducible scoped qualification at exact implementation SHA.

The consumer dashboard supports direct native 420 sends to an address or a
verified .420 name. It revalidates the Wallet account, chain, recipient and
request terms before asking Wallet to simulate, review and approve the transfer.
A returned hash records submission. Direct transfers use Wallet transaction
history. Invoice settlement and hosted checkout are owned by PAY-APP-5.

Receiving-address links carry a destination. Amount requests add a fixed value,
an expiry and an opaque request ID. Invoice links carry only the canonical
invoice ID and load the merchant, amount, currency, expiry and closed state
from the Registry. In all cases, the Pay link is bound to its origin and chain.
The dashboard generates QR images locally, can read QR images from files, and
offers link copying and QR downloads. Fixture mode previews the flow with
sample data and never requests Wallet submission.

An origin-local submission record and browser lock protect against accidental
repeats across tabs and reloads. Explicit Wallet refusals before submission
allow a retry. Ambiguous outcomes are held for Wallet activity review. Open
the dashboard in a secure context for browser locking and clipboard access.

The scoped SDK and dashboard workflows exercise recipient and expiry checks,
invoice reads, exact Wallet requests, QR round-tripping and duplicate
protection at the implementation revision.

## PAY-APP-5 — Hosted checkout, quotes and payment confirmation

**Status:** Native hosted checkout and canonical conversion contract candidates implemented. **Testnet required:** No.

Exit criteria: Canonical prices, 42-second quote and fees, asset/settlement choices, explicit Wallet handoff, atomic failure and status. Retain reproducible scoped qualification at exact implementation SHA.

Hosted review reads the active invoice, merchant controller and current payout
at one canonical snapshot. The approved deployment can supply the runtime
hash for `420/APP/420PAY/MERCHANT_REGISTRY` in the existing component map.
Payment confirmation checks the invoice and selected Wallet account against
the canonical PaymentRegistry record and reports the exact status.

The native 420 checkout candidate adds a Registry-resolved
`CanonicalPayQuote420` source and `PaymentRouter420.payNativeInvoice`. For a
native-denominated invoice with the approved native asset commitment and
single-recipient terms, the quote binds the payer, nonce, invoice terms, exact
amount and active payout version to a 42-second window bounded by invoice expiry.
The native fee quote reports zero protocol and conversion fees. Wallet estimates
transaction gas separately. Delivery, invoice accounting, replay state and the
settled payment record commit together or revert together.

The native source uses its own Registry component so existing Swap fee
bindings stay available. The candidate changes three Pay resident runtimes.
Any deployment must qualify the new runtimes and publish the native source as
`420/APP/420PAY/NATIVE_QUOTE_SOURCE`, using the approved native asset policy
commitment as its constructor input. The retained frozen deployment artifacts
remain historical evidence. Hosted native checkout displays the canonical quote and hands the exact call to
420 Wallet. Expired or changed quotes require a new review. Confirmation checks
the selected account and invoice in canonical payment state. FINALIZED invoices
use the finalized snapshot. HIGH_VALUE also uses finalized state and requires
healthy canonical pricing and settlement under Decision 4. For direct native
checkout, the verified invoice supplies the fixed native price, and the quote
and payment contracts enforce native asset health before execution.

For conversion, the invoice commits to an eligible input/settlement pair and
canonical market. The quote reads the active pool price and fee, enforces asset
and market health, binds the pool runtime and spend/receive bounds, and expires
after 42 seconds or at invoice expiry. The invoice receives its outstanding
amount as credit. The payout receives the disclosed pool output. Any mismatch
during execution reverts the payout, accounting and replay state together.
The hosted screen currently submits native invoices. Conversion is available
through the qualified contract entry point for eligible ERC-20 pairs.


## PAY-APP-6 — Merchant registration and business dashboard

**Status:** Repository implementation complete. **Testnet required:** No.

Exit criteria: Controller-bound onboarding, credential status, tenant isolation, authorized roles/locations/cashiers and reports. Retain reproducible scoped qualification at exact implementation SHA.

Business dashboard registration carries the selected controller explicitly in
the Wallet call. MerchantRegistry rejects execution by a different account.
Credential status comes from the canonical Registry and changes only through
its existing governance authority.

An active controller manages opaque location IDs and grants or revokes a
tenant-wide Reporter role or a location-scoped Location Manager or Cashier
role. Deactivating a location or merchant invalidates its existing grants,
including after reactivation. The dashboard clears its scope when Wallet
changes. Controllers and current reporters can view finalized payment report
intervals. Reports match both the canonical controller and the invoice's
merchant ID, including when several merchants share a controller. Location
roles expose their own scope and confer no signing or funds authority.

The MerchantRegistry candidate adds methods and storage. Deployments must
publish its reviewed runtime hash before enabling the business dashboard.
PAY-APP-7 owns invoice creation and PAY-APP-10 owns cashier checkout sessions.

## PAY-APP-7 — Invoice builder and merchant payment management

**Status:** Repository implementation complete. **Testnet required:** No.

Exit criteria: Online merchant acceptance, offline drafts, modes/tips/expiry, sharing, outstanding balances and canonical lifecycle. Retain reproducible scoped qualification at exact implementation SHA.

The Business dashboard saves form drafts in the current browser, scoped by
chain, selected Wallet account and merchant. Draft saving works offline while
the dashboard is open. Publication needs online Registry reads and Wallet
approval. The InvoiceRegistry publication entry point independently checks the
active merchant controller before committing the invoice. Duplicate IDs revert.

The builder accepts single-use, multiple-use and explicitly partial modes,
canonical acceptance modes, base-unit amounts, expiry, refund window and an
optional tip policy commitment. A blank native asset commitment resolves to
the canonical native checkout policy. The builder records tip policy terms.
Tip payout and refund execution are owned by PAY-APP-8.

Inspecting a finalized invoice verifies both tenant and controller, reads
credited amounts and closure state, and exposes the outstanding amount for
the current mode. For a reusable invoice this is the amount required for
another use. The dashboard shares only finalized open or partially paid
invoices and submits closure through Wallet. A return hash records submission.

Live deployment must publish the reviewed InvoiceRegistry runtime hash.

## PAY-APP-8 — Split settlement, refunds and tips

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Canonical split limits/rounding, actual refund asset delivery vs evidence, authorization and replay protections. Retain reproducible scoped qualification at exact implementation SHA.

Native invoice policy checkout uses `splitCommitment` for the ordered
recipients, basis points and primary index, and `tipCommitment` for the tip
recipient and cap. Publish the split commitment with the merchant payout and
copy it into the invoice. Quote the exact selected tip with
`quoteNativePolicy`, then submit the same policy and quote ID with
`payNativeInvoiceWithPolicy` and send principal plus tip. Split amounts round
down and the primary payout receives the remainder. Invoice credit is principal
only. A failed recipient transfer reverts every delivery and the invoice,
payment and replay writes.

`RefundManager420.payMerchantRefund` takes funds from the active merchant
controller within the invoice refund window and sends the original settlement
asset to the canonical payer. For native refunds send the exact amount as
transaction value. For ERC-20 refunds approve the Registry-resolved refund
manager to pull the amount. The amount is subject to the payment's cumulative
refund cap. `refundedByPayment` includes recorded evidence.
`fundedRefundExecuted(refundId)` identifies asset delivery for a refund ID and
`deliveredByPayment` totals executed deliveries.

The hosted checkout and SDK still use the single-payout quote entry points.
Native policy checkout and merchant-funded refunds can be exercised directly
through the contracts. The conversion split router remains a separate
settlement entry point.

## PAY-APP-9 — Accounting, reports and reconciliation

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Exact frozen 15-field export, private metadata/reporting, reconciliation, CSV/JSON and printable report. Retain reproducible scoped qualification at exact implementation SHA.

The merchant report reads a finalized snapshot and pages by block interval.
The merchant controller or merchant-wide Reporter role is required. The
dashboard rechecks current access before downloads and printing. Exports use the
frozen Indexer serializer and exclude payer identifiers and private invoice
details. JSON and CSV contain reconciled rows from the displayed interval.
The printable report also shows rows with unresolved evidence.

Network fees use gas used multiplied by effective gas price from the receipt
containing the canonical settlement event. Refund authorization and delivered
settlement assets are displayed separately. Only verified delivery counts
toward `refund_total`. Configure the Registry-verified
`420/APP/420PAY/REFUND_MANAGER` runtime binding to reconcile payments with refund
authorization. A report row without the settlement receipt, the reviewed
conversion economics, or a verified tax-summary commitment where metadata is
committed stays visible for reconciliation and is omitted from the export.
The invoice metadata content hash alone does not identify a tax summary.


## PAY-APP-10 — Merchant POS and customer-facing display

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Quick pay, retail cart/tax/tip, cashier session, QR and verified settlement; offline draft only. Retain reproducible scoped qualification at exact implementation SHA.

Open the merchant dashboard with an active location ID. The merchant controller,
Location Manager or Cashier can create single-use native 420 POS invoices.
The draft cart and item names stay in the browser. The canonical invoice
credits subtotal plus tax and settles the disclosed tip separately. A
scheduled payout change invalidates the affected checkout before delivery.

The customer display offers a QR invoice link only after finalized publication.
Refresh the display to check canonical settlement. Wallet submission alone
does not update the display to settled. A browser with no network connection can
save draft cart values locally. Publishing an invoice and checking payment both
require canonical online reads and Wallet authorization for publication.

Deployment needs approved Invoice Registry, native quote and Payment Registry
runtime bindings for this revision. POS inherits the existing native checkout
asset and merchant payout policy and does not set a conversion rate.


## PAY-APP-11 — Developer APIs, webhooks and checkout integrations

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Versioned SDK/API, scoped credentials, hosted/embedded checkout, authenticated idempotent delivery and compensating reorg events; no signing. Retain reproducible scoped qualification at exact implementation SHA.

See [Developer integration operations](developer-integrations.md) for v1 routes, checkout handoff and webhook verification.


## PAY-APP-12 — Progressive Web App

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Installability, offline safe cache, camera/share support, authenticated navigation and stale-state protections. Retain reproducible scoped qualification at exact implementation SHA.

Serve the Pay web build over HTTPS. The manifest and icons support standalone
installation and the build emits a revisioned service worker. Serve the worker
script with revalidation and the manifest as `application/manifest+json`.
The worker precaches the public dashboard shell, code, styling and icons.
Deployment configuration, RPC, Wallet grants and all financial records remain
network-only. Use the browser install prompt or its home-screen command.

The payment form offers camera QR scanning when the browser grants permission.
The file picker remains available and shared links use the platform share sheet
where supported. QR and deep-link inputs still require canonical review and
Wallet approval. Camera data stays in the browser and the stream stops on
decode, cancellation, backgrounding or Wallet session changes.

On loss of connectivity the dashboard clears balances, receipts, reports and
quotes. Existing cart or invoice drafts can still be saved locally. A cached
launch starts disconnected. Continuing a connected session after reconnection
requires revalidating the Wallet account and network. Private sections cannot
be opened through navigation until a Wallet session is available.


## PAY-APP-13 — Android application

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Shared SDK with native QR, verified Wallet links, secure sessions, notification privacy, build and device tests. Retain reproducible scoped qualification at exact implementation SHA.

See [Android build and deployment](android.md) for qualification, App Links and Wallet transport dependencies.


## PAY-APP-14 — iOS application

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Same domain parity, verified universal links, native QR/share, session security, build and device tests. Retain reproducible scoped qualification at exact implementation SHA.

See [iOS build and deployment](ios.md) for simulator qualification and Universal Link binding.


## PAY-APP-15 — Ecosystem integration and downstream consumers

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Reconcile Wallet/Swap/Registry/Indexer/Oracle/Commerce/Market and other authorized consumers; verify canonical state and recovery; no duplicate ledger. Retain reproducible scoped qualification at exact implementation SHA.

See [Ecosystem integration](ecosystem.md) for authority and recovery boundaries.


## PAY-APP-16 — Security, privacy, accessibility and adversarial qualification

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Static/adversarial and local-EVM tests; injection, authorization, replay, cross-tenant, stale quote, reorg, restart and device/accessible journeys. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-17 — Documentation, deployment preparation and local closeout

**Status:** PLANNED. **Testnet required:** No.

Exit criteria: Operator/user/developer manuals; deterministic packages, exact-SHA CI, release gates, security review preparation, merge only qualified candidate. Retain reproducible scoped qualification at exact implementation SHA.

## PAY-APP-18 — Public testnet deployment and live acceptance

**Status:** PLANNED. **Testnet required:** Yes.

Exit criteria: Bind deployed Pay/Wallet/Registry/Indexer; real receipts, runtime and recovery evidence, live web/mobile/POS flows; coordinate PAY-AUDIT-7 and -8 without duplicating authority. Retain reproducible scoped qualification at exact implementation SHA.

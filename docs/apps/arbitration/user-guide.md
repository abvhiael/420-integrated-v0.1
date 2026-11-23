# 420 Arbitration — Wallet-integrated user guide

420Arbitration is a **Wallet-integrated Genesis app**, accessed through the **420 Arbitration** section of 420Wallet; no separate website or signing system is required. The app remains disabled until the Wallet has a connected EIP-1193 account, a chain-specific approved Arbitration release, a matching RPC network/genesis, and independently verified ProtocolRegistry / Router / Case / Policy / Ruling runtime identities. No arbitrary dApp-provided `verified` flag authorizes transactions.

## Dashboard and navigation

The Arbitration navigation offers **Dashboard, Open case, Case details, Resolver workspace, Case history**. Use **Verify Arbitration** after connecting the Wallet through its normal Connect button; do not enter a seed phrase or export any private key.

- Dashboard lists active and finalized cases, claimant/respondent/resolver role, the current state and relevant deadlines. **Refresh cases** reloads from the canonical chain. **Load earlier cases** pages backward through verified `CaseOpened` event logs. Counts reflect the currently loaded on-chain pages; they are not an unverified network-wide total.
- Select a row, or enter a 32-byte case ID in **Case details**. The detail view displays claimant/respondent, domain, originating protocol/component and object, the policy snapshot, current round and deadlines, ruling commitments, per-round ruling history, and account-specific action eligibility.
- **Case history** displays event provenance (case opened, evidence committed, ruled, appealed, ruling submitted/finalized and case finalized). Only hashes and public on-chain information are shown. Private evidence remains off-chain.
- The **Resolver workspace** lists assigned cases discovered in the loaded on-chain pages. Only the exact active round's snapshotted resolver is permitted to submit a ruling.

## Open a case

Select an **active governance-configured domain**, enter the respondent address, origin component ID, origin object/transaction ID, a claim commitment and a requested-remedy commitment. All commitments are 32-byte hashes. Never paste raw private evidence or personal documents into these fields.

Press **Simulate and review opening case**. Wallet independently verifies the Registry and originating contract addresses, checks the active domain policy, simulates the exact calldata and estimates network gas. Review account, target, chain, zero contract transfer value, protocol fee (0 wei), estimated gas units/price/cost and calldata. **Confirm review and request Wallet approval** requires a separate explicit confirmation plus approval through the connected Wallet. The transaction is *pending* until a canonical receipt is independently checked.

The contract-generated case ID is discovered from canonical `CaseOpened` logs after confirmation. Opening a case does not guarantee an external remedy or create a separate custody authority.

## Evidence, rulings and appeals

- **Submit evidence** appears only for claimant/respondent when a case is OPEN and the evidence deadline has not passed. Enter a nonzero evidence commitment, review and approve the Wallet transaction. A duplicate commitment in the same case/round is rejected on-chain.
- **Submit ruling** appears only for the current round's on-chain resolver while the round is OPEN. Enter a positive outcome code, nonzero ruling/reasoning and remedy hashes, and optionally a panel commitment. Review and approve the transaction. Rulings express commitments; they do not transfer tokens or compel an external service.
- **Appeal ruling** appears only for claimant/respondent while the ruling is RULED, the appeal deadline has not passed and the snapshot appeal limit has not been exhausted. The original policy snapshot remains binding across later governance changes. The active resolver switches to the snapshotted appeal resolver for the next round.
- **Finalize ruling** appears only after the latest ruling's appeal deadline has passed. Finalization is permissionless once the window closes; it permanently ends the case. The previous rounds and their ruling commitments remain readable.

## Receipt tracking, recovery and errors

- The application reports **submitted/pending** separately from **canonically confirmed**. A rejected Wallet request, reverted transaction, reorganized receipt or RPC failure never displays a successful case mutation.
- Use **Check canonical receipt** to inspect an actual transaction hash. A pending hash can be recovered after refresh/reconnection from local browser storage, but its sender, target, selector and network are validated again against the real RPC transaction and current canonical Registry. Browser storage never establishes case authority.
- On network/account change, the previous session's unsubmitted reviews are invalidated; use **Reverify Wallet / resume**. A failed/uncertain send is never automatically retried. First check Wallet activity and the canonical transaction receipt before preparing another action.
- If the Registry is inactive/deprecated, a code hash/immutable graph changes, an allowed domain is unavailable or the chain differs, all mutation paths fail closed. Ask the operator to publish a qualified release rather than using manually supplied addresses.

## Accessibility and privacy

The app uses keyboard-reachable buttons, labeled form fields, visible focus states, assistive-technology status messages and a responsive layout for desktop and mobile. Data displayed from RPC/events is rendered as text, not HTML. Private evidence payloads are neither uploaded nor inferred by this Wallet app. Browser-stored pending receipt metadata does not include private evidence.

## Local-EVM acceptance

The dedicated `420Arbitration ARB-PRE-04 browser and local EVM` workflow must compile the canonical contracts, deploy to deterministic local Anvil, verify the Registry graph, then exercise a real browser/Wallet transaction flow from opening a case through evidence, ruling, appeal, appeal ruling and finalization. Passing that workflow proves repository-local user-flow qualification only, **not** public testnet deployment, external origin-protocol remedy execution, or production security approval.

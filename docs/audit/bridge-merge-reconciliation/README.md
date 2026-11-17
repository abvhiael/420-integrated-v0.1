# Bridge audit merge reconciliation

Base: `77f4b1d97e71517a4117f4bdda4fc58b8e7a6a93`, containing audits 10 and 11 (#1183/#1184). The reconciliation commit has this first parent and all seven legacy heads in inventory.json as additional parents. This preserves their commits and evidence while resolving their conflicting snapshots against current main.

The 78-file #463 inventory and six dependent qualification inventories are recorded in inventory.json. Unique Exchange read/presentation and Indexer ABI/binding work is ported to current interfaces. Other old production, deployment, trigger, roadmap and qualification snapshots remain available through ancestry; they do not overwrite current main. The only qualification-only additions beyond #463 are audit-1 and audit-6 CI trigger notes. No production Solidity, production configuration or workflows change. No route gains economic admission. Older Level 1/2/3 escalation instructions are not reinstated.

## Executable behavior

The eleven-contract descriptor manifest contains 37 current ABI events, including verifier registry and custody, generated from the 38-source compiler closure. Identical event topics on separate bound emitters work; ambiguous registrations and noncanonical ABI booleans fail closed. The real ProtocolRegistry deployment test includes all eleven components and proves publication grants no economic approval.

Exchange GET /v13/bridge is display-only and requires RPC availability. Actual transfer lifecycle events determine settlement state. Proof acceptance alone cannot indicate settlement. Removed completion evidence cannot remain completed after reorganization. Partial history preserves an unknown route. Wallet readiness or display metadata cannot authorize execution; the canonical SDK/controller review remains required. Completion requires active, canonical, finalized evidence.

## Qualification

108 distinct focused tests passed: 33 Exchange, 73 Indexer/decoder consumers and two Solidity deployment cases. Logs retain initial failures and corrections rather than rewriting evidence. Initial fixture-loading failures came from an incorrect working directory; only failed files were rerun. One Exchange negative fixture needed the explicit non-authoritative provenance field; its affected test and a new authority-rejection case passed. The separate partial-history case passed.

An unrelated existing Stake static source-presence check still fails because current main does not contain indexer/api/stake.go. It does not execute the decoder; all five relevant Stake decoder cases passed. No Stake assertion/source was edited or suppressed, and no full-suite pass is claimed.

Indexer TypeScript build, Exchange qualification artifact build/import smoke, read-service pre10 check, app syntax and Exchange static qualification passed. The initial static failure was a sparse-checkout deployment fixture; materializing the tracked file resolved it. ABI descriptor regeneration/check passed. Existing audit-11 evidence verification passed (14 attack families, 196 attack entries, 399 retained pass records, including the recorded 160-case/12,500-fuzz/512-invariant/32,768-call graph). Original evidence and SHAs are preserved; those suites were not rerun.

Solidity deployment compilation used official solc 0.8.24, optimizer 200, viaIR, Cancun. deployment.inputs.json records exact inputs. SHA256SUMS records reconciliation executable/test input and evidence hashes. No redundant CI is requested; commit messages use existing [skip ci] behavior. No live/testnet execution is claimed. Next work remains the existing deployment/testnet qualification roadmap with its original prerequisites; no BRIDGE-AUDIT-12 is invented or begun.

---
title: Value movement and economics troubleshooting registry
audience:
  - user
  - developer
  - operator
category: troubleshooting
status: current
version: current
---

# Value movement and economics troubleshooting registry

This registry covers user-visible and operator-visible failures involving payments, tokens, swaps, bridging, staking, rewards and fee interpretation. These entries translate canonical protocol/application behavior into safe recovery guidance without replacing the underlying 420Pay, 420 Token, 420 Swap, 420 Bridge or 420 Stake documentation.

Value-moving retries are high risk. A timeout, stale UI, delayed derived index or missing notification is never proof that a payment, swap, bridge operation or staking transaction failed. Before retrying, identify the original operation and inspect canonical state.

## 420Pay

### TRB-PAY-001 — Payment submission outcome is unclear

- **Audience:** user, developer
- **Surface:** 420Pay payment submission
- **Symptom:** the payer signed or submitted a payment, but the UI timed out, disconnected or did not show a final result.
- **Severity:** value-risk
- **Authority source:** canonical transaction receipt plus 420Pay invoice/payment state.
- **Likely causes:** RPC timeout after submission; delayed Wallet/Explorer/Indexer presentation; receipt not yet final; frontend state loss after the write.
- **Retry safety:** unsafe.
- **Safe diagnostics:** transaction hash, payer address, invoice/payment identifier, chain ID, canonical receipt/finality state.
- **Recovery:** locate the original transaction or protocol payment state first; if submitted, wait for the required acceptance/finality condition; only create or submit a new payment after establishing that the original operation did not settle.
- **Stop/escalate when:** the original write cannot be identified, canonical state is unavailable, or duplicate payment risk cannot be ruled out.

### TRB-PAY-002 — Invoice expired or quote became invalid

- **Audience:** user, developer
- **Surface:** 420Pay invoices and swap-assisted quotes
- **Symptom:** a payment that previously appeared valid is now rejected because its invoice, quote or deadline expired.
- **Severity:** blocked
- **Authority source:** canonical 420Pay invoice state and active quote/deadline state.
- **Likely causes:** invoice expiry; quote lifetime elapsed; stale client; asset/slippage conditions changed.
- **Retry safety:** conditional.
- **Safe diagnostics:** invoice ID, expiry/deadline, asset, amount, quote identifier, current canonical invoice status.
- **Recovery:** do not reuse an expired quote; request a fresh invoice/quote through the canonical payment flow; re-review amount, asset, route and minimum output before signing.
- **Stop/escalate when:** the application asks the payer to override an expired canonical invoice/quote locally.

### TRB-PAY-003 — Duplicate or already-used payment is rejected

- **Audience:** user, developer
- **Surface:** 420Pay replay/single-use protections
- **Symptom:** a repeated payment attempt is rejected as already used, consumed or duplicated.
- **Severity:** value-risk
- **Authority source:** canonical payment/invoice replay state.
- **Likely causes:** the original payment already settled; the same payment ID/invoice was submitted twice; the client retried after an ambiguous response.
- **Retry safety:** unsafe.
- **Safe diagnostics:** original transaction hash, invoice/payment ID, receipt and settlement state.
- **Recovery:** verify whether the original payment settled and whether downstream state reflects it; do not generate a new payment simply to bypass duplicate protection unless the merchant/application explicitly creates a new valid invoice.
- **Stop/escalate when:** the payer and merchant disagree about settlement despite canonical payment state.

### TRB-PAY-004 — Refund is pending, rejected or differs from expectation

- **Audience:** user, developer
- **Surface:** 420Pay refund flow
- **Symptom:** a refund has not appeared, is rejected, or does not match the requested amount.
- **Severity:** value-risk
- **Authority source:** canonical refund/payment settlement state and transaction receipts.
- **Likely causes:** refund not yet submitted; refund transaction pending/not final; amount exceeds refundable balance; prior refund already consumed part of the refundable amount; frontend derived state stale.
- **Retry safety:** conditional.
- **Safe diagnostics:** payment ID, refund ID if present, refund transaction hash, original amount, already-refunded amount, finality state.
- **Recovery:** verify canonical refundable balance and existing refund state before any second refund attempt; wait for canonical receipt/finality where a refund write already exists.
- **Stop/escalate when:** another refund could exceed remaining refundable value.

### TRB-PAY-005 — Split settlement or recipient amount looks wrong

- **Audience:** user, developer, operator
- **Surface:** 420Pay split settlement
- **Symptom:** one or more recipients appear to have received an unexpected amount.
- **Severity:** value-risk
- **Authority source:** canonical settlement transaction and 420Pay split/accounting state.
- **Likely causes:** UI rounding/display issue; stale derived data; route/fee parameters differ from assumptions; settlement reverted atomically rather than partially completing.
- **Retry safety:** unsafe.
- **Safe diagnostics:** settlement transaction hash, invoice/payment ID, configured split parameters, canonical recipient transfers/events.
- **Recovery:** reconcile the entire canonical settlement before issuing any compensating payment; never rely on a partial UI view to infer partial canonical settlement.
- **Stop/escalate when:** accounting conservation cannot be demonstrated from canonical evidence.

## 420 Token

### TRB-TOKEN-001 — Token deployment/registration appears incomplete

- **Audience:** developer, operator
- **Surface:** 420 Token deployment/application flow
- **Symptom:** a token contract appears deployed but is not discoverable/verified where expected, or the UI reports incomplete setup.
- **Severity:** blocked
- **Authority source:** canonical deployment receipt/runtime code plus approved Registry/verification state for the environment.
- **Likely causes:** deployment confirmed but verification/registration incomplete; wrong network; noncanonical planned/example address; stale derived catalogue.
- **Retry safety:** unsafe for redeployment; safe for read-only verification checks.
- **Safe diagnostics:** chain ID, deployment transaction hash, deployed address, runtime code presence/hash, verification and Registry state.
- **Recovery:** prove whether the deployment already exists before deploying again; complete verification/registration using the canonical environment workflow rather than replacing a valid deployment.
- **Stop/escalate when:** the deployed address or environment cannot be established unambiguously.

### TRB-TOKEN-002 — Token balance/transfer view disagrees across applications

- **Audience:** user, developer
- **Surface:** token balances/transfers
- **Symptom:** Wallet, Explorer, Search or Analytics display different balances or transfer history.
- **Severity:** degraded
- **Authority source:** canonical token contract state and canonical transaction receipts.
- **Likely causes:** Indexer/Explorer lag; reorg; stale cache; different block/finality views.
- **Retry safety:** not-applicable for diagnosis.
- **Safe diagnostics:** token address, holder address, chain ID, block/finality reference, relevant transaction hashes.
- **Recovery:** reconcile canonical contract state at a known block/finality level; treat derived services as presentation layers and allow them to catch up/rebuild.
- **Stop/escalate when:** canonical endpoints themselves disagree after confirming chain identity.

## 420 Swap / Exchange

### TRB-SWAP-001 — Quote or route expired before execution

- **Audience:** user, developer
- **Surface:** 420 Swap/Exchange routing
- **Symptom:** execution rejects a route/quote that was valid moments earlier.
- **Severity:** blocked
- **Authority source:** current canonical pool/route state and quote constraints.
- **Likely causes:** deadline expired; reserves/prices changed; minimum-output constraint no longer satisfiable; route became unavailable.
- **Retry safety:** conditional.
- **Safe diagnostics:** route/quote ID, input asset/amount, minimum output, deadline, current route state.
- **Recovery:** request a new quote and re-review route, fees, price impact and minimum output before signing; do not widen slippage solely to force execution.
- **Stop/escalate when:** the application cannot explain the new route or requests unsafe slippage.

### TRB-SWAP-002 — Swap submitted but result is unclear

- **Audience:** user, developer
- **Surface:** swap execution
- **Symptom:** the signed swap timed out or the UI does not show whether settlement occurred.
- **Severity:** value-risk
- **Authority source:** canonical transaction receipt and canonical swap/pool state.
- **Likely causes:** RPC timeout; delayed derived view; transaction pending; receipt not final.
- **Retry safety:** unsafe.
- **Safe diagnostics:** transaction hash, sender, input/output assets, amount, nonce, receipt/finality state.
- **Recovery:** identify the original transaction and its canonical outcome before signing another swap; if pending, follow transaction replacement rules rather than submitting an unrelated duplicate.
- **Stop/escalate when:** original transaction identity cannot be established.

### TRB-SWAP-003 — Swap reverted or minimum output was not met

- **Audience:** user, developer
- **Surface:** swap execution safeguards
- **Symptom:** transaction is included but failed, often around deadline, route or minimum-output conditions.
- **Severity:** value-risk
- **Authority source:** canonical receipt/revert plus current swap state.
- **Likely causes:** minimum output not met; route changed; deadline expired; authorization/balance insufficient; state changed between simulation and inclusion.
- **Retry safety:** conditional.
- **Safe diagnostics:** receipt, revert/error, route, minimum output, deadline, balance/allowance/capability state.
- **Recovery:** treat the failed transaction as gas-consuming but not successful settlement; request a fresh quote and resimulate before any retry.
- **Stop/escalate when:** the UI suggests bypassing minimum-output or route protections.

### TRB-SWAP-004 — Expected output/fees differ from the preview

- **Audience:** user, developer
- **Surface:** swap fees and execution output
- **Symptom:** preview and final settled output differ more than expected.
- **Severity:** value-risk
- **Authority source:** canonical transaction execution, route parameters and protocol fee accounting.
- **Likely causes:** preview at an earlier state; price movement within allowed constraints; fee/gas presentation confusion; derived UI rounding.
- **Retry safety:** not-applicable after settlement.
- **Safe diagnostics:** signed minimum output, actual output, route, fee parameters, execution block.
- **Recovery:** compare settled output against the signed constraints rather than a stale UI estimate; if canonical output violates signed constraints, escalate with transaction evidence.
- **Stop/escalate when:** settled result cannot be reconciled with signed constraints.

## 420 Bridge

### TRB-BRIDGE-001 — Bridge transfer is waiting for source-chain finality

- **Audience:** user, developer
- **Surface:** bridge source confirmation/finality
- **Symptom:** source transaction exists but the destination side has not progressed.
- **Severity:** info or degraded
- **Authority source:** verified source-chain transaction and the bridge route's required source finality.
- **Likely causes:** source confirmations/finality not yet sufficient; source reorg risk; proof not yet eligible for relay.
- **Retry safety:** unsafe for a second transfer.
- **Safe diagnostics:** route ID, source chain/asset, source transaction hash, source finality/confirmation status, bridge message ID.
- **Recovery:** wait for the route's required finality; do not create a duplicate bridge transfer merely because the destination UI is quiet.
- **Stop/escalate when:** required finality has been satisfied but the canonical bridge message state does not advance.

### TRB-BRIDGE-002 — Bridge proof/attestation is rejected

- **Audience:** developer, operator
- **Surface:** cross-chain proof verification
- **Symptom:** a relay/mint/release step rejects the supplied proof, attestation or message.
- **Severity:** blocked
- **Authority source:** canonical bridge verifier/message state and approved chain/route registry.
- **Likely causes:** wrong route or chain identity; stale proof; source block not sufficiently final; malformed/invalid proof; verifier/route version mismatch.
- **Retry safety:** conditional.
- **Safe diagnostics:** message ID, source/destination chain IDs, source tx/block, route/version, verifier result, proof identifier/hash where public.
- **Recovery:** regenerate/obtain proof only after confirming the canonical source event and route/version; never weaken verification or accept an unqualified attestation to force progress.
- **Stop/escalate when:** route/verifier identity is ambiguous or proof verification repeatedly fails for a finalized canonical source event.

### TRB-BRIDGE-003 — Bridge message is already consumed/replayed

- **Audience:** user, developer, operator
- **Surface:** bridge replay protection
- **Symptom:** destination execution rejects a message as already processed/consumed.
- **Severity:** value-risk
- **Authority source:** canonical destination bridge message-consumption state.
- **Likely causes:** original relay already succeeded; duplicate relay attempt; delayed UI/indexer did not reflect completion.
- **Retry safety:** unsafe.
- **Safe diagnostics:** bridge message ID, original destination transaction hash if known, canonical consumed state.
- **Recovery:** locate the original destination settlement; do not generate a new message or bypass replay protection to make the UI match.
- **Stop/escalate when:** canonical destination state says consumed but expected asset settlement cannot be found.

### TRB-BRIDGE-004 — Destination assets have not appeared after relay

- **Audience:** user, developer
- **Surface:** bridge destination settlement
- **Symptom:** bridge relay appears successful but destination balance is missing or stale.
- **Severity:** value-risk
- **Authority source:** canonical destination bridge settlement and destination asset contract state.
- **Likely causes:** destination tx pending/not final; token/balance view stale; wrong destination asset/address; relay failed despite frontend status.
- **Retry safety:** unsafe until canonical destination state is known.
- **Safe diagnostics:** message ID, destination transaction hash, recipient, destination asset address, receipt/finality, canonical balance/state.
- **Recovery:** inspect destination canonical settlement first; if settled, troubleshoot the presentation/indexing layer rather than relaying again.
- **Stop/escalate when:** canonical settlement succeeded but asset accounting does not reconcile.

### TRB-BRIDGE-005 — Route/asset/chain pair is unsupported or paused

- **Audience:** user, developer
- **Surface:** bridge route registry/risk controls
- **Symptom:** the desired source/destination chain or asset cannot be selected or execution is blocked.
- **Severity:** blocked
- **Authority source:** approved canonical bridge chain/asset/route registry and emergency/pause state.
- **Likely causes:** route not approved; asset not supported; route paused/deprecated; environment mismatch.
- **Retry safety:** not-applicable until route becomes valid.
- **Safe diagnostics:** source/destination chain IDs, asset identity, canonical route status/version.
- **Recovery:** use only an approved active route; do not substitute an address or route from an example, old deployment or unverified frontend.
- **Stop/escalate when:** applications disagree about route identity/status.

## 420 Stake, rewards and fees

### TRB-STAKE-001 — Stake/bond action does not become active immediately

- **Audience:** user, operator
- **Surface:** validator stake/bond lifecycle
- **Symptom:** stake/bond transaction succeeded but validator eligibility/activation has not changed yet.
- **Severity:** info or degraded
- **Authority source:** canonical staking/validator lifecycle state and consensus activation rules.
- **Likely causes:** activation/epoch boundary not reached; eligibility conditions unmet; derived UI lag.
- **Retry safety:** unsafe for duplicate staking writes.
- **Safe diagnostics:** staking transaction hash, validator identity, canonical stake/bond state, current epoch/lifecycle state.
- **Recovery:** verify the canonical lifecycle state and wait for the required transition; do not submit another bond solely because an Explorer/Status page is stale.
- **Stop/escalate when:** canonical stake state and validator lifecycle rules cannot explain the delay.

### TRB-STAKE-002 — Reward amount differs from expectation

- **Audience:** user, operator
- **Surface:** validator rewards
- **Symptom:** credited rewards are lower/higher than a local estimate or dashboard value.
- **Severity:** degraded
- **Authority source:** canonical reward accounting/settlement state.
- **Likely causes:** participation/proposer share differences; missed participation; epoch/accounting boundary; stale derived analytics; estimate assumed incorrect active set.
- **Retry safety:** not-applicable.
- **Safe diagnostics:** validator identity, epoch, canonical reward events/state, participation/proposer evidence, finalized block range.
- **Recovery:** reconcile against canonical reward rules and finalized state; treat dashboards as derived estimates unless they reproduce canonical accounting.
- **Stop/escalate when:** canonical reward conservation/accounting cannot be reproduced.

### TRB-STAKE-003 — Exit/withdrawal remains pending

- **Audience:** user, operator
- **Surface:** validator exit/cooldown/withdrawal
- **Symptom:** exit was requested but stake or validator status has not reached the expected terminal state.
- **Severity:** blocked
- **Authority source:** canonical validator lifecycle and staking/cooldown state.
- **Likely causes:** exit/cooldown not complete; finality/epoch transition pending; stale derived UI; unresolved validator obligations.
- **Retry safety:** unsafe for duplicate lifecycle requests unless explicitly idempotent.
- **Safe diagnostics:** validator identity, exit transaction/object ID, epoch, canonical lifecycle/cooldown state.
- **Recovery:** follow the canonical lifecycle through exit/cooldown; do not attempt a second exit solely to force the UI to advance.
- **Stop/escalate when:** the canonical lifecycle is stuck beyond its defined transition conditions.

### TRB-TX-008 — Fee or gas cost looks unexpectedly high

- **Audience:** user, developer
- **Surface:** native `$420` gas/fee accounting
- **Symptom:** estimated or realized transaction fee is materially higher than expected.
- **Severity:** value-risk
- **Authority source:** signed transaction fee fields, canonical receipt gas usage and chain fee rules.
- **Likely causes:** high base/priority fee; gas estimate changed; complex execution path; failed transaction consumed gas; UI conflated transfer value and gas.
- **Retry safety:** conditional.
- **Safe diagnostics:** transaction hash or unsigned transaction parameters, gas limit/used, fee fields, execution status.
- **Recovery:** distinguish value from fee; if the transaction failed, do not assume gas is refundable; before retrying, resimulate/re-estimate and inspect the underlying failure.
- **Stop/escalate when:** canonical receipt accounting cannot explain the charged fee.

## Cross-domain value-safety rules

1. A timeout is not proof of failure.
2. A stale Explorer/Indexer/Wallet view is not proof that canonical value state changed or did not change.
3. Never repeat a payment, swap, bridge message, refund, staking write or other value-moving operation until the original operation is identified and canonical state checked.
4. Reorg/finality requirements matter before treating settlement as durable.
5. Replay protection is a safety control; do not bypass it to reconcile an inconsistent UI.
6. Route, asset, token and contract identity must come from approved canonical environment sources, not examples or copied addresses.
7. Compensating/manual payments are a last resort and require full canonical accounting of the original operation first.

## Related documentation

- [Troubleshooting registry contract](registry-contract.md)
- [Chain, RPC and transaction troubleshooting](chain-rpc-transactions.md)
- [420 applications](../apps/index.md)
- [420 Swap](../apps/swap/index.md)
- [420 Bridge](../apps/bridge/index.md)
- [420 Token](../apps/token/index.md)
- [420 Stake](../apps/stake/index.md)
- [Core value-movement architecture](../architecture/protocols/value-movement.md)
- [Generated reference](../reference/index.md)

# BRIDGE-AUDIT-6 — Bitcoin and UTXO Bridge Completion

Local implementation qualified against main `50ad3c49bd323b9eddca42f100fe6ca43e79f730`. Exact published commit and integration status are recorded in the associated PR. Bitcoin remains `APPROVED_INACTIVE_PENDING_PRODUCTION_VERIFIER_AND_GATEWAY`; this audit creates no production approval or deployed custody authority.

## Requirement reconciliation

| Requirement | Implemented boundary and qualification |
| --- | --- |
| Reconcile adapters | `BitcoinBridgeAdapter420` is the sole canonical BTC adapter. Legacy `BTCLightClientAdapter` retains its different ID and explicit inbound/outbound rejection; tombstone regression passes. |
| Header-chain/light-client integration | Reuse `BitcoinFinalityVerifier420` and `BitcoinHeaderChain420`, with genesis-anchored SHA256d, target/difficulty/MTP, cumulative work and best-known canonical ancestry. No second consensus implementation. |
| Inclusion, source identity and confirmations | Existing authenticated transaction parser/Merkle verifier and six-confirmation deposit policy retained. Canonical outpoint replay identity survives alternate message IDs and verifier rotation. New payout verifier reuses the same authenticated header state and Merkle routine, with at least six canonical confirmations. |
| Recipient encoding | Exact P2PKH/P2SH/P2WPKH/P2WSH/P2TR programs (20/20/20/32/32 bytes) produce canonical scriptPubKeys. Unsupported type/length and amounts above Bitcoin MAX_MONEY are rejected before nonce consumption. |
| Custody/signing/withdrawal | Typed immutable outbound request lookup, public transaction signing authorization, qualified backing interface, globally reserved custody inputs, conflict-only replacement, authenticated payout observation and current-tip receipt. No keys or signing function in EVM contracts. |
| Failed/replaced/reorganized source transactions | Unincluded, malformed, insufficiently confirmed and wrong-inclusion transactions cannot produce a receipt. Authorized conflicting replacement skeletons retain identical ordered funding; an older authorized transaction may win confirmation. A canonical conflicting block at the recorded height invalidates an orphaned payout. No RPC failure assertion releases a reservation or authorizes a refund. |
| No unbacked representation | Existing inbound authenticated deposit/router/risk/replay path is unchanged. The custody coordinator cannot mint, credit, burn, complete a bridge transfer or issue EVM settlement evidence. Actual burn/escrow backing and owned unspent custody UTXOs must be authenticated by the production backing verifier before signing authorization. No production implementation of that external authority is approved. |
| Remain inactive | Coordinator defaults inactive; enabling requires current existing governance qualification and outbound route admission. Source configuration, native adapter/verifier and qualification replacement invalidate authorization. All BTC production profiles and approval inventories stay inactive/empty. |

## Signing and custody interface

`IBitcoinWithdrawal420.Request` binds source chain/router/adapter, message/route/asset, sender, raw recipient program, script type, satoshi amount and nonce. Existing outbound message-ID construction is preserved. `outboundScript` is a canonical Bitcoin output encoding, not an EVM address. Txids in funding metadata use the SHA256d internal/wire digest byte order, not a reversed explorer display string.

`BitcoinCustody420.authorizeSigning(requestId, unsignedTransaction, funding, backingEvidence, expectedPrevious)` validates the exact request domain, current canonical router/asset/route/accounting/safety admission and current verifier qualification. The unsigned transaction parser supports legacy and Segwit framing, canonical CompactSize, exact trailing-byte rejection and duplicate-input rejection. Its bounded custody policy allows at most 128 inputs and two or three outputs, within one megabyte. These are supported wallet policy limits, not new Bitcoin consensus rules. Outputs must be exactly the requested recipient/value, a zero-value OP_RETURN PUSH32 request marker, and optionally positive change to the approved custody script. Input/output sums obey MAX_MONEY; an immutable fee cap applies. Each supplied funding input must match the unsigned transaction and configured custody script.

The signing commitment is:

```
keccak256(abi.encode("420/BTC/SIGNING/V1", block.chainid,
    address(custody), descriptorHash, approvalId, requestId,
    skeletonHash, fundingHash, generation))
```

`fundingHash` folds `keccak256(abi.encode(previousHash, FundingInput))` in input order. Skeleton serialization strips all scriptSig and witness data. `IBitcoinCustodyBacking420.verifyBacking` must authenticate both finalized representation burn/escrow backing and actual custody input amount/script/ownership/unspentness for the complete commitment. Caller metadata or an RPC success flag does not supply that authority. The test implementation is explicitly controlled and cannot qualify deployment.

Input reservations are global across requests and persist through rotation, suspension, failed broadcasts and reorganization. Replacement uses compare-and-swap and identical ordered funding/input identities, so independently payable replacements are rejected. Authorization captures the exact current qualification approval ID; fresh approval cannot revive an earlier authorization. Changing the backing verifier disables the coordinator. Signers must recheck `signingAuthorization` immediately before signing and independently validate their wallet descriptor, actual UTXOs/unspentness, complete PSBT, network, recipient, values, change, fees, sequence/locktime and SIGHASH policy. This contract does not verify custody private-key ownership or execute Bitcoin script.

The new router `requireOutboundSigningAdmission` is read-only and uses existing operational, asset, route, accounting and qualification guards. It consumes no risk budget, creates no transfer and grants no mint/burn/payment authority. Existing router execution bodies are unchanged.

## Payment observation and emergency behavior

`BitcoinWithdrawalProof420` verifies canonical six-confirmation inclusion through the existing header chain and Merkle verifier and returns the actual txid, unsigned skeleton/input identities, block, height and best-known tip. `observeSettlement` accepts only an already authorized skeleton for the request and funding set. Actual payment facts may be appended during suspension; this cannot authorize signing or settlement. The typed `confirmedWithdrawal` receipt requires live qualification, the original authorization's current approval and an unchanged observed best tip. Any tip change requires fresh inclusion observation. `invalidateForReorg` requires an authenticated canonical block at the same height, rather than an unsupported RPC claim.

Best-known-work SPV does not prove global tip freshness, complete script execution or current UTXO unspentness. Those existing source assumptions remain explicit. Native full-node custody checks and authenticated backing are prerequisites. Governed recovery retains reservations/history; replacing the coordinator requires qualified migration/reconciliation of pending authorizations and reserved inputs. No cancellation/refund shortcut or inherited approval is provided.

## Actual qualification evidence

Machine record: [RESULTS.json](bitcoin-completion-qualification/RESULTS.json). Source manifests pin every compiled import. Current affected qualification passes **41 distinct cases, 5,000 fuzz inputs, 128 invariant runs / 8,192 calls with zero reverts**, including concrete BTC deposit→canonical router integration. Three independently calculated Python serialization vectors cover unsigned, legacy and Segwit txid/skeleton/witness behavior; two Solidity cases compare the production parser to them. These vectors contain synthetic scriptSig/witness bytes and are not valid signatures or genuine mined payouts. Custody integration tests inject controlled headers and use a controlled backing verifier; they do not establish live custody, signing-key ownership or funded historical gateway qualification.

An actual stale-approval inheritance regression was reproduced and fixed by recording/checking exact approval identity. All 19 affected custody/adversarial cases then passed. The earlier 14-case pass is retained only as interim evidence, not added to final counts. A separate safety case initially toggled an unused mock-health flag; the trace identified the canonical asset lifecycle check. Only that failed method was corrected and rerun; the other four unchanged passing cases and their exact source snapshot are retained. Compilation/setup diagnostics are preserved. No production assertion was weakened.

Current runtimes: custody 15,782 bytes; payout proof 7,382; router 16,897. The complete reconciled inventory checks 98 compiled bridge artifacts, maximum 22,063 bytes, below EIP-170. Existing 12 native verifier graphs and historical corpus are unchanged. Original BTC source SHA `b5f09dfcb794bbc820bcae6ab23df9c099499644` and passing CI `43563876850` / `43563876854` at `5f58baf6dc861939a21119a0fce645060a067518` remain original evidence, not new-head CI. No historical consensus rerun or redundant GitHub Actions run is required by these unchanged components.

Reproduction uses `scripts/qualify-bridge-final.py` with the exact owner/filter commands in each `.inputs.json`, pinned Forge 1.9.0, solc 0.8.24, Cancun, IR/optimizer 200 and seed 0x42022. Run `python3 scripts/verify-bitcoin-withdrawal-vectors.py` and `python3 scripts/verify-final-verifier-inventory.py` for independent vector and source/evidence reconciliation. `bitcoin-completion-qualification/SHA256SUMS` binds the new implementation and evidence; immutable earlier manifests/logs remain unchanged. CI run IDs for this extension: none; evidence is local and explicitly reported as such.

## External closure

Locally executable implementation is complete. Production custody/backing authorization, owned wallet descriptor/HSM and full-node services, live source synchronization, funded gateway deposits/withdrawals and source-network finality/reorg/recovery qualification remain genuinely external. They are tracked in the [existing 420Bridge testnet work roadmap](420BRIDGE-TESTNET-WORK-ROADMAP.md). A running destination testnet alone does not supply these dependencies. Bitcoin stays inactive until their existing qualification and governance admission requirements pass. The next available canonical action is that existing testnet custody/network qualification; no new audit step is introduced or started here.

# Treasury release executor and receipt reconciliation

## Authority and deployment

The adopted decision remains 420/TREASURY/VAULT_RELEASE_COMMITMENT/V1, AUTHORIZED_EXECUTOR_COMMITMENT_ONLY. The existing registry accepts any nonzero commitment from an exact authorized executor; it does not verify a receipt. REC-4 designates `TreasuryReleaseExecutor420` as the general noncustodial production **candidate**, not a live deployment or new frozen predeploy. REC-8 owns packaging/deployment rehearsal and AUDIT-8 owns public-chain activation and receipt correlation. The five existing Treasury contracts and the Router service ID are unchanged. No automatic grants or broad transfer allowance are created.

Deploy with the trusted canonical ProtocolRegistry address (the approved Genesis address in production) and reviewed operator account. Record actual executor address and runtime code hash, Registry identity, chain and genesis identity, approved Vault instance/runtime identity, and authorized operator. The operator may be a smart account. The contract has no payable method, wallet custody, token allowance, arbitrary calls or governance privilege. The two component authorities must grant the executor contract independently:
- Treasury component/action with scope `keccak256(abi.encode(disbursementId))` and bounded amount.
- Vault component/withdrawal action with scope `keccak256(abi.encode(vaultId, asset, recipient, ACTION_WITHDRAW))` and bounded amount.

Governance must review the real AssetVault420 deployment and its runtime identity; Vault registration/getter consistency alone is not proof of audited implementation bytecode. Do not approve generic or spoofed registered instances. Both current grants are required by the executor; the underlying Vault and Treasury separately enforce their rules. Disable or revoke unneeded direct execution grants. Rotating operator uses a new reviewed executor deployment and revocation of the old grants, not an owner backdoor.

The retained HighCountry gateway is a separate application-specific commitment consumer/submitter with organization permission checks; it still accepts a caller-supplied commitment and is not a Vault release verifier. Its fixture is not a funded release. Do not give it simultaneous general executor authority for the same spending intent. Its separate application activation requires actual correlated evidence. Grants PAID and Indexer/Explorer/Analytics EXECUTED remain projections of Treasury completion, not independent proof of payment.

## Review and commitment derivation

Read `preview(disbursementId) -> (bytes evidence, bytes32 commitment)` using the designated executor and trusted chain. Check the reviewed fields against the Civic action, budget and scheduled disbursement, exact registered active Vault and approved runtime, recipient, asset/amount in exact smallest units, service versions, operator and executor. Save the plan durably **before** submission with these JSON keys (no secrets): chainId (integer string/hex), registry, executor, executorCodeHash (reviewed deployed runtime keccak256), disbursementId, evidence (returned ABI hex), commitment. Review addresses and chain/genesis against release configuration; never derive trust solely from a receipt or user-supplied plan. Retain the planned start block for recovery. The executor is not an onchain receipt verifier.

`operationId = keccak256(abi.encode(keccak256("420/TREASURY/VAULT_RELEASE_OPERATION/V1"), chainId, disbursementRegistry, disbursementId))` is deterministic across operator/executor rotations for the same chain and registry. The withdrawal replay marker is per Vault, and Treasury terminal state independently prevents a second settlement.

`commitment = keccak256(abi.encode(keccak256("420/TREASURY/VAULT_RELEASE_COMMITMENT/V1"), ReleaseEvidence))`.

The static ABI tuple in exact order is:
| Type | Field |
| --- | --- |
| uint256 | chainId |
| address | protocolRegistry |
| address | treasuryRouter |
| uint32 | treasuryVersion |
| address | vaultRouter |
| uint32 | vaultVersion |
| address | disbursementRegistry |
| address | budgetRegistry |
| address | vaultAccounting |
| bytes32 | disbursementId |
| bytes32 | budgetId |
| bytes32 | vaultId |
| address | vault |
| bytes32 | vaultCodeHash |
| address | asset |
| address | recipient |
| uint128 | amount |
| bytes32 | civicActionHash |
| bytes32 | purposeHash |
| address | executor |
| address | operator |
| bytes32 | operationId |

All fields are derived from current canonical state or immutable configuration. The operator supplies the reviewed expected commitment to `execute(id, expectedCommitment)`; mismatch denies execution before withdrawal. The release target and capability checks run before the actual Vault call. The executor checks the exact recorded withdrawal delta and consumed operation, confirms service identities and Vault route authorization still hold after callbacks, and invokes the canonical registry `markExecuted`. Any revert, including settlement rejection after a successful Vault call, reverts the entire transfer, debit, operation flag, callback changes and Treasury settlement. Neither the hash nor the preview proves that a transaction has occurred. A transaction hash or receipt hash cannot be included in a commitment generated inside that same transaction; actual transaction/receipt provenance is correlated afterward.

## Receipt and interruption recovery

Install the existing locked ethers dependency with `npm ci --prefix 420-indexer`. Use the read-only utility from the repository root:
```sh
TREASURY_RPC_URL=https://trusted-rpc.example node scripts/treasury/verify-release-receipt.mjs reviewed-plan.json 0xTRANSACTION_HASH
TREASURY_RPC_URL=https://trusted-rpc.example node scripts/treasury/verify-release-receipt.mjs reviewed-plan.json 0xFROM_BLOCK 0xTO_BLOCK
```
Use actual hexadecimal hashes and bounded block numbers. The utility does not sign, submit or retry financial transactions. Verify the RPC and reviewed plan independently. Receipt must be successful and in the currently canonical block/transaction position. It checks historical executor and Vault code hashes, executor Registry/operator, exact budget/disbursement/asset/recipient/amount/Civic/purpose/operation state, and one ordered set of logs in the same receipt:
1. VaultAccounting420.WithdrawalRecorded
2. AssetVault420.Withdrawal (operationId, asset, recipient, amount)
3. TreasuryBudgetRegistry420.BudgetCommitmentChanged
4. TreasuryDisbursementRegistry420.DisbursementExecuted
5. TreasuryReleaseExecutor420.VaultReleaseCommitted

Retain the plan, transaction hash, block identity and log indices; confirm finality according to the actual chain's policy and repeat correlation after reorg or provider divergence. A current canonical RPC result is not a cryptographic receipt-trie proof or irreversible finality certification. A direct submission must match the operator and exact execute calldata; nested smart-account transactions rely on the reviewed executor's operator check and event. The utility rejects missing/failed/unrelated receipts, mismatched fields, duplicate logs and changed block identity.

If a client loses a transaction result, search the explicit reviewed block range for the exact executor/disbursement/operation event, then verify the actual receipt. No matching event is **not** proof that no pending or earlier transaction exists or that a retry is authorized. Review pending transaction/nonce and chain history; only retry the exact reviewed intent after checking canonical state and authority. A reverted atomic transaction has neither release nor settlement. A completed one cannot be repeated even if the receipt is lost. No persistent split between withdrawal and settlement exists on this candidate path.

If a pre-existing/legacy split withdrawal consumed the canonical operation but Treasury is still scheduled, the executor refuses to withdraw again. The utility reports MANUAL_RECONCILIATION_REQUIRED rather than auto-settling. If the old independent path used a different operation ID, the candidate cannot infer that payment from the new deterministic ID. Before migrating a historical scheduled disbursement, operators must reconcile all old withdrawal evidence, not simply submit the new executor transaction. Preserve the evidence, suspend further execution, and use the existing separately authorized governance/executor commitment-only reconciliation procedure only after independent review of original receipt, exact fields and remaining policy/expiry/capacity. Do not resubmit funds after expiry, cancellation, uncertain history or mismatch. Prior nonzero commitments cannot be retroactively transformed into independently verified receipts. No new recovery bypass or automatic clawback is introduced.

The local qualification uses actual Anvil transactions and real Treasury/Vault/Registry/Capability contracts (test token/recipient fixtures only). Public testnet work is limited to actual deployed identity and grants, live-chain transaction/receipt finality, RPC/reorg correlation and funded operational drills. The compromised authorized executor trust assumption remains; a direct authorized caller can still record an arbitrary nonzero hash. The receipt utility must reject that as uncorrelated, and downstream consumers must not present it as proven payment.

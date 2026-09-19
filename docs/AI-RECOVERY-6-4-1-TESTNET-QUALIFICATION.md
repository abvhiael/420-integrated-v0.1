# AI-RECOVERY-6.4.1 — read-only Vault testnet qualification

Status: **runner implemented; no verified live testnet result supplied or claimed**. The adversarial unit suite for the RPC evidence reader is separate from testnet qualification. This command does not deploy contracts, sign transactions, approve manifests, submit funding or settlement, or establish consensus finality independently of its configured RPC.

## Prerequisites

An operator/security reviewer must independently approve and retain a **testnet-specific** deployment manifest that binds the expected chain ID, Vault ID, correct AIJobEscrow/AssetVault420/VaultAccounting420 addresses, runtime bytecode hashes, and earliest relevant deployment block. Supply a trusted HTTPS RPC endpoint with a documented finality policy. Use a completed, consenting **testnet-only** job with its real job/payer/provider/beneficiary/fundingRef, asset, exact amount in smallest units, obligation ID, and (only when proving actual payment) settlementRef and claim operation ID. Do not commit RPC credentials, private keys, personally identifying input payloads or live spending authority to this repository. Approving these fixture fields by merely reading them from the same RPC is not independent verification.

## Run

From `420-ai-provider/`:

```sh
npm ci --ignore-scripts
npm test
AI_VAULT_TESTNET_RPC_URL="https://approved-testnet-rpc.example" node dist/src/qualify-vault-testnet.js /secure/path/approved-fixture.json
```

The fixture is JSON with decimal **strings** for chainId and amount420, numeric `confirmations` and `fromBlock`, and hashes/identities with 32-byte hex encoding. The addresses and code hashes below are **nonfunctional placeholders**; replace every value with independently approved testnet deployment and consenting test-job evidence before executing:

```json
{
  "deployment": {
    "chainId": "420",
    "confirmations": 12,
    "fromBlock": 1,
    "vaultRef": "0x1111111111111111111111111111111111111111111111111111111111111111",
    "escrowAddress": "0x1111111111111111111111111111111111111111",
    "vaultAddress": "0x2222222222222222222222222222222222222222",
    "accountingAddress": "0x3333333333333333333333333333333333333333",
    "escrowCodeHash": "0x4444444444444444444444444444444444444444444444444444444444444444",
    "vaultCodeHash": "0x5555555555555555555555555555555555555555555555555555555555555555",
    "accountingCodeHash": "0x6666666666666666666666666666666666666666666666666666666666"
  },
  "funding": {
    "jobId": "0x7777777777777777777777777777777777777777777777777777777777777777",
    "payer": "0x4444444444444444444444444444444444444444",
    "beneficiary": "0x5555555555555555555555555555555555555555",
    "providerId": "0x8888888888888888888888888888888888888888888888888888888888888888",
    "vaultRef": "0x1111111111111111111111111111111111111111111111111111111111111111",
    "fundingRef": "0x9999999999999999999999999999999999999999999999999999999999999999",
    "fundingObligationId": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "amount420": "42",
    "asset": "0x0000000000000000000000000000000000000000"
  }
}
```

For a separately verified real provider **claim**, optionally add `"settlement": {"settlementRef":"0x<32-byte-real-reference>","operationId":"0x<32-byte-real-operation>","kind":"release"}`. No settlement object means the command reports `payoutVerified:false` even on successful funding verification. `refund` is not yet an approved settlement route: the current immutable beneficiary obligation cannot prove return to the payer, and the runner will fail rather than certify a refund without corresponding matching evidence. An exited-zero funding-only run does not prove that the deposit was user approved or came from the payer.

## Evidence to retain before closing 6.4.1

Record the externally approved deployment manifest and its approver, a known-independent chain/explorer checkpoint for the pinned block, RPC endpoint identity and finality policy, command output and pinned block hash, transaction receipts and relevant event/index provenance, the observed recipient balance change, and independently confirmed job/funding/obligation/settlement identities. A single potentially malicious RPC is not a consensus proof. Repeat against a second independently operated RPC; compare the pinned block hashes and receipts. Cover absent/failed/reverted/duplicate/wrong-recipient/wrong-asset and reorg cases on a controlled testnet. Do not enable paid AI flows or mark this phase production-qualified merely because this runner passes.

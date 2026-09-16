# 420Verify VERIFY-2 — canonical deployment evidence acquisition

VERIFY-2 binds every verification target to canonical chain evidence before any source/build comparison occurs.

## Evidence acquired

For a requested contract address, 420Verify records:

- configured and observed chain ID;
- canonical deployed runtime bytecode;
- runtime code hash from `eth_getProof`;
- the observation block number/hash;
- the first block at which runtime code is present;
- top-level contract-creation transaction, receipt block hash and creation bytecode when recoverable;
- an explicit missing-context reason when creation provenance cannot be recovered through standard RPC.

The stable verification binding is `chain ID + address + deployed runtime code hash`. Verification evidence must never be reused across a different network, address or runtime code identity.

## Creation recovery

420Verify uses standard canonical JSON-RPC only. It binary-searches historical `eth_getCode` observations to locate the first block where code exists, then examines top-level contract-creation transactions in that block and their receipts.

This recovers ordinary top-level `CREATE` deployments without requiring a proprietary explorer or trace service. Genesis/system predeploys are marked `GENESIS_OR_PREDEPLOY`. Deployments created internally by another contract, or otherwise not recoverable from standard top-level transaction/receipt data, are marked `CREATION_TRANSACTION_NOT_RECOVERABLE` rather than guessed.

Later verification stages may use optional trace/indexer evidence to enrich missing creation context, but such evidence must retain its provenance and cannot replace canonical deployed runtime bytecode as the verification target.

## Trust boundary

420Verify remains non-canonical. RPC chain state supplies canonical deployed code and block identity; 420Verify merely records and reproduces evidence. Missing context cannot be silently fabricated or treated as a match.

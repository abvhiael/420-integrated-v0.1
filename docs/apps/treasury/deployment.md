# Treasury release materialization and governed deployment (REC-8)

This tooling prepares the six deployable Treasury contracts, including the designated noncustodial executor candidate. TreasuryIds420 and TreasuryVaultBinding420 are internal libraries, not service deployments. CapabilityRegistry420 is a dependency, not a Treasury predeploy. Its candidate reservation is not evidence of deployment. The frozen GovernanceTimelock and ProtocolRegistry addresses and materialized runtime hashes are read from canonical artifacts. No fixed Treasury address, CREATE2 salt, authority change, asset policy, budget, payment grant or production operator is introduced.

## Reproduce release inputs

From the repository root, with Foundry and Node 22:

```sh
python3 scripts/treasury/materialize-deployment-closure.py /tmp/treasury-release
forge build --root /tmp/treasury-release --extra-output storageLayout
npm ci --prefix scripts/treasury
node scripts/treasury/deployment.mjs materialize /tmp/treasury-release treasury-bundle.json
```

The generated bundle contains exact ABIs, constructor bytecode, runtime templates, immutable references, storage layouts, compiler metadata, SHA-256 artifact identities and Keccak-256 bytecode/ABI commitments. The metadata and release-payload hashes are Keccak-256 of sorted-key canonical JSON encoded as UTF-8; the interface commitment hashes the complete Router ABI by the same rule. The published dependency root retains the existing Wallet-compatible ABI encoding of CapabilityRegistry, Authorization, Policy, Budget, Disbursement, Router addresses, followed by the five Treasury runtime code hashes. Keep the bundle and its digest under independent release review; self-consistent hashes alone are not a signature or approval. Qualification builds the same closure twice and compares exact release bytes.

## Reviewed deployment plan

Provide a reviewed JSON input containing chainId (420 for the official chain, 31337 only for isolated rehearsal), genesisHash, deployer, startNonce, startBlock, actual verified capabilityRegistry, reviewed immutable operator, capabilityAuthority, previousVersion (0 at Genesis) and previousRouter for corrective redeployment. Obtain CapabilityRegistry code and registrar/authority evidence from its owning deployment; do not assume the candidate reservation has code. Deployer nonce must be reserved for these six ordinary CREATE transactions, with governance using separate accounts. No nonce may be consumed by unrelated transactions.

```sh
node scripts/treasury/deployment.mjs plan treasury-bundle.json reviewed-input.json treasury-plan.json
printf '{}\n' > treasury-journal.json
export TREASURY_RPC_URL='https://approved-chain-rpc.example'
node scripts/treasury/deployment.mjs next treasury-bundle.json treasury-plan.json treasury-journal.json
```

The plan prints predicted ordinary CREATE addresses and exact creation calldata, not deployed addresses. Each invocation rechecks plan digest, chain/genesis, canonical anchor code, actual CapabilityRegistry runtime, nonce/pending state, previous canonical receipts and constructor bindings. For DEPLOY, an external reviewed signer signs the exact returned transaction, with reviewed fee and gas parameters. Submit raw signed bytes:

```sh
node scripts/treasury/deployment.mjs submit treasury-bundle.json treasury-plan.json treasury-journal.json signed-transaction.txt
```

Retain the returned tx hash keyed by contract name in the journal and await inclusion. SUBMITTED_NOT_QUALIFIED is not completion. Never commit keys, signed pending transactions, or a live journal to the repository. If submission or receipt persistence is interrupted, do not guess a fresh nonce or retry automatically. Use the bounded recovery query (inclusive block numbers, maximum span 2048):

```sh
node scripts/treasury/deployment.mjs recover treasury-bundle.json treasury-plan.json TreasuryAuthorization420 FROM_BLOCK TO_BLOCK
```

Only an exact canonical successful CREATE receipt, sender/nonce/input/address and runtime/dependency match permits resuming. Missing, pending, reverted, substituted or orphaned transactions fail closed. A failed/incorrect consumed nonce requires reviewed corrective planning, not automatic replacement.

## Governed initialization and activation

Follow next's returned stage. INITIALIZE_CONTROLLER must be executed by GovernanceTimelock/Civic after the first four deployments and before Router. Review exact target, value and calldata. Use the current governance mechanism: approved Civic proposal batch after Civic activation, bootstrap schedule only while that authority remains valid. Observe actual class delay and execution receipt; re-run next immediately before executing mature governance operations and again after. Never impersonate governance outside isolated local rehearsal. A wrong nonzero controller is irreversible; abandon the affected graph and prepare a new reviewed deployment. Never try to overwrite controller.

After Router, deploy the designated executor with canonical ProtocolRegistry and reviewed operator. No grants are automatically created. REGISTER_CAPABILITY_COMPONENT, if needed, is performed by the actual CapabilityRegistry registrar, separately from Timelock unless they are the same verified authority. An existing managed component must match the reviewed authority. The tool requires all six successful deployment receipts before REGISTER_ROUTER_COMPONENT; verify exact component code and version before PUBLISH_SERVICE. Only governance can publish. Re-run next before each action; never publish placeholders or manually substituted addresses. The consumer verifies service and component together; interruption after component registration leaves service unpublished. Registry is a generic governance registry, not an on-chain Treasury-specific release validator: governance must use this procedure and not bypass it by directly publishing arbitrary graphs.

Retain actual schedule/proposal, execution and registration receipts with block hashes and confirm canonical inclusion/finality under the target network's policy. The tool verifies canonical inclusion at the checked block, not finality. COMPLETE is derived verification at one block, not a production readiness or Vault-release assertion. It prints registry commitments, deployment receipts and Indexer binding (use chain 420 only in the Go production Indexer), plus executor runtime and operator for independent Wallet configuration review. Execution remains separately authorized.

## Corrective redeployment

Do not migrate or abandon active Treasury budgets or pending disbursements implicitly. Governance must reconcile ongoing liabilities, old grants, release commitments and Vault accounting, then explicitly deprecate the old service and pause/deprecate its component before a replacement plan, pinning exact previous router/revision. Review new graph and nonce, retain all old history and repeat the procedure; publication advances the service revision, preserves semantic component version and never rewrites old Treasury state. For an incorrect unactivated partial graph with consumed nonces, review abandonment and start a fresh plan with current nonce and appropriate previous service state; do not reuse old addresses or controller. No automatic migration, rollback of finalized transactions, revocation, or override of governance is implemented or authorized.

Official testnet addresses, transactions, receipts and network qualification remain unpopulated until actually observed in AUDIT-8. REC-5 security closeout and AUDIT-9 external review remain separate.

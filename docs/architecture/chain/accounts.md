---
title: Accounts
component: chain
audience:
  - developer
  - operator
  - architect
category: architecture
status: development
version: current
---

# Accounts

420 Integrated follows the EVM account model while adding ecosystem-level smart-account, Wallet, identity, and protocol integrations around it. The execution layer remains authoritative for EVM-visible account state; Wallet, Identity, Names, Registry, and application metadata do not replace that authority.

## Account classes

At the execution layer, accounts fall into two broad classes:

1. **Externally owned accounts (EOAs)** — addresses controlled by private-key signatures.
2. **Contract accounts** — addresses whose behavior is defined by deployed EVM bytecode and persistent storage.

420 Integrated also uses **smart accounts** and capability/session-key patterns at higher layers. Smart accounts are still contract accounts from the execution layer's perspective; their richer authorization semantics come from contract code and protocol policy rather than from a third execution-account class.

## EOA state

An EOA has canonical execution state including:

- an address;
- a native `$420` balance;
- a transaction nonce;
- no deployed contract bytecode;
- no contract storage owned by the EOA address itself.

The private key is not stored on-chain. The execution layer validates signatures and transaction semantics; custody of the private key belongs to the user's Wallet/account security model.

## Contract-account state

A contract account may have:

- an address;
- a native `$420` balance;
- deployed bytecode;
- persistent EVM storage;
- protocol-specific state encoded in that storage;
- call behavior defined by its bytecode and the current chain state.

Contract authority is determined by code and state. A UI, SDK, indexer, or Registry label cannot grant a contract authority that its deployed code and protocol state do not actually possess.

## Smart accounts

420 Wallet and smart-account flows add programmable authorization above the base EVM account model.

A smart account may support capabilities such as:

- multiple controllers or recovery authorities;
- session keys;
- scoped capabilities;
- spending or call restrictions;
- time-bounded authorization;
- application-specific permissions;
- account-abstraction transaction flows where supported.

These features do not move signing authority into the dApp or SDK by default. Applications may request actions, but the smart-account policy must independently authorize them.

## Address identity

An EVM address is a 20-byte account identifier in execution state. Addresses identify execution accounts; they do not, by themselves, prove a human identity, application identity, protocol identity, or trusted role.

420 Integrated layers additional systems over raw addresses:

- **420Names** may associate human-readable names with addresses or protocol objects;
- **420Identity** may associate identity-related state with addresses;
- **420Registry** may identify canonical protocol/application deployments;
- **420Verify** may provide deployment or authenticity evidence;
- Wallet and applications may attach local labels or contacts.

Those layers aid discovery and trust decisions, but they do not change the canonical address stored in execution state.

## Balance

Each execution account may hold native `$420`.

Native balance changes only through canonical execution transitions, such as:

- value-bearing transactions;
- contract calls that transfer value;
- contract creation with value;
- protocol-defined execution effects;
- genesis allocation;
- other consensus/execution-authorized state transitions.

Wallet displays, Explorer, Indexer, Analytics, and application databases are projections of this balance. If a projection disagrees with canonical execution state, the execution state wins.

Token balances held through contracts are distinct from native account balance. ERC-style assets, wrapped bridge assets, application currencies, NFTs, and other contract-managed assets are represented by contract state rather than by the native balance field.

## Nonce

For EOAs, the account nonce provides transaction ordering and replay protection within the chain's transaction rules.

A valid transaction generally consumes the sender's next expected nonce. Reusing a consumed nonce does not create a second valid execution of the same transaction.

Contract accounts also have account-level nonce semantics used by the EVM for contract-creation address derivation and related execution behavior. Protocol-level replay protection may add separate nonces, identifiers, deadlines, domains, epochs, or one-time-consumption rules on top of the base account nonce.

## Code and storage

The execution account model distinguishes:

- **balance** — native `$420` held by the account;
- **nonce** — execution-level sequence/account state;
- **code** — deployed EVM bytecode for a contract account;
- **storage** — persistent key/value state owned by contract code.

A contract's application or protocol meaning is encoded through its code and storage, not inferred from a front-end label.

## Account creation

EOA addresses derive from key material under standard Ethereum-compatible cryptography.

Contract accounts are created through EVM contract-creation operations. Their resulting address depends on the applicable creation mechanism, such as the creator/nonce path or CREATE2-style deterministic deployment.

Canonical protocol deployments should be discovered through verified deployment metadata and Registry/Verify surfaces rather than guessed from an address alone.

## Genesis accounts

The execution genesis may pre-allocate native `$420` balances to specified addresses. Those allocations become part of the initial canonical execution state when the network initializes from the accepted genesis configuration.

A genesis allocation does not automatically grant protocol administration, validator authority, governance authority, or application roles. Those privileges require their own explicit protocol state and authorization.

## Account authority boundaries

| Concern | Canonical authority |
| --- | --- |
| native `$420` balance | execution state |
| EOA transaction nonce | execution state |
| contract bytecode | execution state |
| contract storage | execution state |
| private-key custody | user/Wallet security boundary |
| smart-account permissions | smart-account contract/policy state |
| human-readable name | 420Names protocol where applicable |
| identity/reputation state | 420Identity and relevant protocols |
| canonical app/protocol deployment identity | 420Registry / verification surfaces |
| UI labels and contacts | local application/Wallet metadata |

## Account lifecycle and failure behavior

Account-related operations should fail closed when security-sensitive inputs are invalid or ambiguous.

Examples:

- invalid signature: transaction rejected;
- wrong chain/domain: authorization rejected;
- unexpected nonce: transaction rejected or remains non-executable until ordering requirements are satisfied;
- revoked smart-account capability: requested action rejected;
- unknown/non-canonical protocol address: Wallet/application should refuse privileged integration or require explicit verification;
- stale indexer balance: refresh or verify against canonical execution state before a security-sensitive action.

## Account invariants

- **ACC-001** — execution state is authoritative for native balance, nonce, code, and contract storage.
- **ACC-002** — an address alone does not imply trusted identity, protocol legitimacy, or administrative authority.
- **ACC-003** — private keys must not be inferred, reconstructed, or stored in canonical chain state.
- **ACC-004** — smart-account convenience must not silently delegate signing authority to applications or SDKs.
- **ACC-005** — consumed transaction nonces must not permit ambiguous replay under normal transaction rules.
- **ACC-006** — Registry/Names/Identity metadata may describe an account but must not rewrite execution-account state.
- **ACC-007** — derived balance or account views must yield to canonical execution state on disagreement.
- **ACC-008** — genesis funding does not imply unrelated protocol privileges.

## Relationship to transactions

Accounts supply the sender state, authorization, nonce, and balance that transactions consume. [Transactions](transactions.md) documents how signed transactions move from construction through validation, inclusion, execution, receipt generation, and failure handling.

## Non-responsibilities

This page does not define Wallet recovery UX, specific smart-account contract APIs, identity schemas, Registry entry formats, token-contract standards, validator keys, or governance roles. Those belong to Wallet, protocol, consensus, developer, and reference documentation.

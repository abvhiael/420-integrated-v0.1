# Getting started with 420 Governance

## For Wallet users

Open 420Wallet and use the Governance view. The Wallet resolves the Governance service and Civic components through the canonical ProtocolRegistry and verifies chain identity, deployed code, contract identity/version and the Civic module graph before presenting authoritative actions.

A proposal detail view exposes its class, state, vote window, committed actions hash, frozen constitutional revision, required houses, electorate roots/weights, thresholds and current derived tallies.

To vote:

1. connect the intended account on the expected 420 network;
2. select COMMUNITY or VALIDATOR when that house is required;
3. check eligibility against the frozen electorate snapshot;
4. choose AGAINST, FOR or ABSTAIN;
5. review the Wallet transaction;
6. submit once.

A ballot is immutable once cast for an account/house/proposal.

## For developers

Canonical reads come directly from the Civic contracts or from 420Indexer projections that remain non-authoritative. Discovery must begin from ProtocolRegistry; do not hard-code registry-resolved Civic module addresses.

The fixed system addresses are:

- ProtocolRegistry: `0x0434`;
- GovernanceTimelock: `0x0429`;
- Governance420 compatibility/bootstrap: `0x0437`.

Registry-resolved Civic contracts do not have frozen addresses in the repository.

## For operators

Use [Operator guide](operator-guide.md). The source of truth for compiler pins, runtime hashes, constructor graph, initialization order, service/component IDs and recovery rules is `contracts/config/governance-deployment-v1.json`.

Never deploy from guessed addresses or an unretained artifact set.

# EXP-2.3 — Address, contract, and asset data-service qualification

EXP-2.3 qualifies the remaining repository service/API slice of EXP-2 core Explorer data: address transaction history, indexed contract deployment/runtime-code facts, and native/token transfer activity.

## Repository guarantees

- Address history is normalized, bounded to 250 records, snapshot-pinned, chain-checked, membership-checked, and rejects any Indexer canonical-authority claim.
- Contract detail requires valid EVM addressing, the required chain, deployment transaction/block provenance, and well-formed runtime bytecode.
- Asset activity preserves exact requested filter provenance, bounded reads, snapshot provenance, nonnegative decimal amounts, valid log positioning, transaction/asset provenance, address membership, and non-authoritative semantics.
- Explorer’s Indexer client independently rejects canonical-authority overclaims on address, contract, and asset routes.
- Contract creation provenance is cross-linked between transaction receipt and contract deployment records.
- Representative ERC-20, ERC-721, and ERC-1155 projection identities survive Explorer presentation unchanged.

## Deferred boundaries

This does not qualify deployed UI navigation/filter controls, live testnet witnesses, verified-source/compiler provenance, live Registry publication, token decoder correctness, or Genesis readiness. Those remain with EXP-3/4/7/8 as mapped by the audit.

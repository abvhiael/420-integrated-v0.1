# 420Token — Genesis V1

420Token is the audited-template token deployment service for 420 Integrated. It removes the need to write custom Solidity for common fungible, NFT and multi-token launches while deliberately refusing arbitrary bytecode generation.

## Genesis templates
ERC-20 Fixed Supply, Mintable, Capped, Burnable, Permit, Votes; ERC-721 Collection; ERC-1155 Multi-Token.

Each deployment costs exactly **42 native 420**. The transaction is atomic: if the token cannot be deployed or the configured protocol fee receiver cannot receive the fee, the whole transaction reverts. 420Token does not retain the fee or custody user assets.

The factory records the creator, deployed address, immutable template ID/version and configuration hash. Factory provenance can therefore be surfaced by 420Registry, 420Explorer, 420Search, 420Analytics, 420Launchpad and 420Swap without treating deployment as endorsement.

V1 template IDs are frozen. Governance may disable a template in an emergency but cannot silently replace its implementation under the same template/version. New executable template families require a new protocol version and qualification cycle.

Creator authority is explicit. Mintable/capped ERC-20 templates assign mint authority to the creator; fixed supply does not. NFT and ERC-1155 collection mint authority belongs to the creator and can be transferred. The factory has no post-deployment mint, transfer or seizure authority.

Repository qualification/hardening validates these templates; this does not represent an independent third-party security audit unless one is separately completed and published.

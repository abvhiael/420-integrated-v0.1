# 420Token — Genesis V1

420Token is the hardened-template token deployment service for 420 Integrated. It removes the need to write custom Solidity for common fungible, NFT and multi-token launches while deliberately refusing arbitrary bytecode generation.

## Genesis templates
ERC-20 Fixed Supply, Mintable, Capped, Burnable, Permit, Votes; ERC-721 Collection; ERC-1155 Multi-Token.

Each deployment costs exactly **42 native 420**. The transaction is atomic: if the token cannot be deployed or the Treasury deposit cannot complete, the whole transaction reverts.

The fee does not go to the factory operator or an arbitrary receiver. Genesis binds TokenFactory420 to the canonical community Treasury vault ID `420/treasury/vault/token-creation-community-revenue/v1`. The full 42 native 420 is deposited through the 420Vault native-deposit path so it enters canonical Vault accounting. TokenFactory420 retains no fee balance and cannot redirect individual creation fees after deployment.

The community Treasury revenue is intended for Civic-controlled ecosystem development, such as developer grants, security work, public infrastructure, SDKs/documentation, onboarding support and other community-approved uses. Allocation remains a Treasury/Civic decision rather than permanent percentage splits embedded in TokenFactory420.

The factory records the creator, deployed address, immutable template ID/version and configuration hash. Factory provenance can therefore be surfaced by 420Registry, 420Explorer, 420Search, 420Analytics, 420Launchpad and 420Swap without treating deployment as endorsement.

V1 template IDs are frozen. Governance may disable a template in an emergency but cannot silently replace its implementation under the same template/version. New executable template families require a new protocol version and qualification cycle.

Creator authority is explicit. Mintable/capped ERC-20 templates assign mint authority to the creator; fixed supply does not. NFT and ERC-1155 collection mint authority belongs to the creator and can be transferred. The factory has no post-deployment mint, transfer or seizure authority.

Repository qualification/hardening validates these templates; this does not represent an independent third-party security audit unless one is separately completed and published.

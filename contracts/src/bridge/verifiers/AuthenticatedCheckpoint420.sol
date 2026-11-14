// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../../system/SystemAccess.sol";
import "./BridgeCrypto420.sol";

/// @notice Explicitly trusted, signed checkpoint track. NOT a consensus light client.
/// Governance chooses the signer and genesis anchor; consumers must separately qualify
/// this trust model for their chain. Rotation invalidates the usable checkpoint until
/// a fresh signed advance; old entries remain immutable historical evidence.
contract AuthenticatedCheckpoint420 is SystemAccess {
    error InvalidCheckpoint();
    error StaleCheckpoint();
    error InvalidAuthority();

    bytes32 public constant TYPEHASH=keccak256("Checkpoint(uint256 chainId,address registry,bytes32 network,uint256 epoch,uint64 height,bytes32 blockHash,bytes32 stateRoot,bytes32 predecessor)");
    bytes32 public immutable network;
    address public authority;
    uint256 public epoch=1;
    struct Checkpoint {uint64 height; bytes32 blockHash; bytes32 stateRoot; uint256 authorityEpoch;}
    Checkpoint public latest;
    mapping(uint64=>Checkpoint) public history;
    event Advanced(uint64 indexed height,bytes32 blockHash,bytes32 stateRoot,uint256 epoch);
    event AuthorityChanged(address indexed authority,uint256 epoch);

    constructor(address governance,bytes32 network_,address signer,uint64 height,bytes32 blockHash,bytes32 root)
        SystemAccess(governance)
    {
        if(network_==0 || blockHash==0 || root==0) revert InvalidCheckpoint();
        if(signer==address(0)) revert InvalidAuthority();
        network=network_;
        authority=signer;
        latest=Checkpoint(height,blockHash,root,epoch);
        history[height]=latest;
        emit Advanced(height,blockHash,root,epoch);
    }
    function rotate(address signer) external onlyGovernance {
        if(signer==address(0)) revert InvalidAuthority();
        authority=signer;
        ++epoch;
        emit AuthorityChanged(signer,epoch);
    }
    function digest(uint64 height,bytes32 blockHash,bytes32 root) public view returns(bytes32) {
        return keccak256(abi.encode(TYPEHASH,block.chainid,address(this),network,epoch,height,blockHash,root,latest.blockHash));
    }
    function advance(uint64 height,bytes32 blockHash,bytes32 root,bytes calldata signature) external {
        if(height<=latest.height) revert StaleCheckpoint();
        if(blockHash==0 || root==0 || blockHash==latest.blockHash) revert InvalidCheckpoint();
        BridgeCrypto420.requireSignature(digest(height,blockHash,root),signature,authority);
        latest=Checkpoint(height,blockHash,root,epoch);
        history[height]=latest;
        emit Advanced(height,blockHash,root,epoch);
    }
    function current() external view returns(Checkpoint memory) {
        if(latest.authorityEpoch!=epoch) revert StaleCheckpoint();
        return latest;
    }
}

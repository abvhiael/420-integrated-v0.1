// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Immutable-by-version registry of cryptographic verification programs.
/// @dev Permissionless read/proof use; initial versions must be registered by the
///      governance address, never upgraded in place. Registration does NOT imply
///      proof soundness or independent security review.
contract PokerVerifierVersions420 {
    address public immutable governance;
    bytes32 public constant VERSION_DOMAIN=keccak256("420.BET.POKER.VERIFIER.VERSION.V1");
    struct Version {
        address verifier;
        bytes32 verifierCodeHash;
        bytes32 verifyingKeyHash;
        bytes32 circuitHash;
        bytes32 publicInputSchemaHash;
        bool exists;
    }
    mapping(bytes32=>Version) private versions;
    error Unauthorized();error InvalidVersion();error AlreadyRegistered();
    event VersionRegistered(bytes32 indexed id,address indexed verifier,bytes32 codeHash,
        bytes32 keyHash,bytes32 circuitHash,bytes32 schemaHash);
    constructor(address governance_) {
        if(governance_==address(0))revert InvalidVersion();
        governance=governance_;
    }
    function get(bytes32 id) external view returns(Version memory){return versions[id];}
    function register(bytes32 id,address verifier,bytes32 keyHash,bytes32 circuitHash,
        bytes32 schemaHash) external {
        if(msg.sender!=governance)revert Unauthorized();
        if(versions[id].exists)revert AlreadyRegistered();
        if(id==bytes32(0)||verifier==address(0)||verifier.code.length==0||
            keyHash==bytes32(0)||circuitHash==bytes32(0)||schemaHash==bytes32(0))
            revert InvalidVersion();
        bytes32 codeHash=verifier.codehash;
        if(codeHash==bytes32(0))revert InvalidVersion();
        versions[id]=Version(verifier,codeHash,keyHash,circuitHash,schemaHash,true);
        emit VersionRegistered(id,verifier,codeHash,keyHash,circuitHash,schemaHash);
    }
    function matches(bytes32 id,address verifier,bytes32 keyHash,bytes32 circuitHash,
        bytes32 schemaHash) external view returns(bool){
        Version memory v=versions[id];
        return v.exists && v.verifier==verifier && verifier.codehash==v.verifierCodeHash &&
            v.verifyingKeyHash==keyHash && v.circuitHash==circuitHash &&
            v.publicInputSchemaHash==schemaHash;
    }
}

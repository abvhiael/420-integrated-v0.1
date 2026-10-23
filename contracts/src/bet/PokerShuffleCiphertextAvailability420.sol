// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Complete ciphertext publication with the same six-level domain-separated
/// MiMC Merkle tree used by gnark ciphertext_merkle.go.
/// @dev Deploy with the 110 BN254 constants exported by the EXACT pinned gnark-crypto
/// version. The verifier-version governance process MUST attest their hash. Every
/// publication emits the full 52 ciphertext pairs; the contract recomputes the root
/// from canonical field elements rather than trusting an uploader's assertion.
contract PokerShuffleCiphertextAvailability420 {
    uint256 internal constant FR =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 internal constant LEAF_DOMAIN = 4204201;
    uint256 internal constant NODE_DOMAIN = 4204202;
    uint256[] private roundConstants;
    bytes32 public immutable roundConstantsHash;
    struct Publication {address publisher; bytes32 calldataHash; uint64 timestamp;}
    mapping(uint256 => mapping(bytes32 => Publication)) public publications;
    error InvalidConstants();
    error InvalidCiphertext();
    error AlreadyPublished();
    event CiphertextDeckPublished(uint256 indexed handScope,bytes32 indexed root,address indexed publisher,
        uint256[208] ciphertextCoordinates,bytes32 calldataHash);

    constructor(uint256[] memory constants_,bytes32 vettedHash) {
        if(constants_.length != 110 || vettedHash == bytes32(0)
           || keccak256(abi.encode(constants_)) != vettedHash) revert InvalidConstants();
        for(uint256 i; i<110; ++i) if(constants_[i] >= FR) revert InvalidConstants();
        roundConstants = constants_;
        roundConstantsHash = vettedHash;
    }
    function _encrypt(uint256 message,uint256 key) private view returns(uint256 output) {
        output=message;
        for(uint256 i; i<110; ++i) {
            uint256 x=addmod(addmod(output,key,FR),roundConstants[i],FR);
            uint256 x2=mulmod(x,x,FR);
            output=mulmod(mulmod(x2,x2,FR),x,FR);
        }
        output=addmod(output,key,FR);
    }
    function _sponge(uint256[] memory words) private view returns(uint256 state) {
        for(uint256 i; i<words.length; ++i)
            state=addmod(addmod(_encrypt(words[i],state),words[i],FR),state,FR);
    }
    function computeRoot(uint256 handScope,uint256[208] calldata coordinates)
        public view returns(bytes32 root) {
        if(handScope == 0 || handScope >= FR) revert InvalidCiphertext();
        uint256[64] memory nodes;
        for(uint256 i; i<52; ++i) {
            uint256[] memory leaf=new uint256[](7);
            leaf[0]=LEAF_DOMAIN;leaf[1]=handScope;leaf[2]=i;
            for(uint256 j; j<4; ++j) {
                uint256 value=coordinates[4*i+j];
                if(value >= FR) revert InvalidCiphertext();
                leaf[3+j]=value;
            }
            nodes[i]=_sponge(leaf);
        }
        uint256 width=64;
        for(uint256 depth;depth<6;++depth) {
            for(uint256 i;i<width/2;++i) {
                uint256[] memory node=new uint256[](4);
                node[0]=NODE_DOMAIN;node[1]=depth;
                node[2]=nodes[2*i];node[3]=nodes[2*i+1];
                nodes[i]=_sponge(node);
            }
            width/=2;
        }
        root=bytes32(nodes[0]);
    }
    function publish(uint256 handScope,uint256[208] calldata coordinates)
        external returns(bytes32 root) {
        root=computeRoot(handScope,coordinates);
        if(root==bytes32(0)) revert InvalidCiphertext();
        if(publications[handScope][root].publisher!=address(0)) revert AlreadyPublished();
        bytes32 digest=keccak256(abi.encode(coordinates));
        publications[handScope][root]=Publication(msg.sender,digest,uint64(block.timestamp));
        emit CiphertextDeckPublished(handScope,root,msg.sender,coordinates,digest);
    }
    function isAvailable(uint256 scope,bytes32 root) external view returns(bool) {
        return scope!=0 && root!=bytes32(0) &&
            publications[scope][root].publisher!=address(0);
    }
}

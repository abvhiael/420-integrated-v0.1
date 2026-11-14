// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library EthereumSSZ420 {
    error InvalidSSZProof();
    struct BeaconHeader {uint64 slot; uint64 proposerIndex; bytes32 parentRoot; bytes32 stateRoot; bytes32 bodyRoot;}
    function uint64Root(uint64 value) internal pure returns(bytes32 out){
        uint256 n;for(uint256 i;i<8;++i)n|=uint256(uint8(value>>(8*i)))<<(248-8*i);out=bytes32(n);
    }
    function beaconRoot(BeaconHeader memory h) internal pure returns(bytes32){
        bytes32 a=sha256(abi.encodePacked(uint64Root(h.slot),uint64Root(h.proposerIndex)));
        bytes32 b=sha256(abi.encodePacked(h.parentRoot,h.stateRoot));
        bytes32 c=sha256(abi.encodePacked(h.bodyRoot,bytes32(0)));
        bytes32 d=sha256(abi.encodePacked(bytes32(0),bytes32(0)));
        return sha256(abi.encodePacked(sha256(abi.encodePacked(a,b)),sha256(abi.encodePacked(c,d))));
    }
    function verify(bytes32 leaf,bytes32 root,uint256 gindex,bytes32[] memory branch) internal pure {
        if(gindex<2 || branch.length>32)revert InvalidSSZProof();
        for(uint256 i;i<branch.length;++i){leaf=(gindex&1)==0?sha256(abi.encodePacked(leaf,branch[i])):sha256(abi.encodePacked(branch[i],leaf));gindex>>=1;}
        if(gindex!=1 || leaf!=root)revert InvalidSSZProof();
    }
    /// @dev Consensus-spec execution block_hash generalized indices, Bellatrix/Capella and Deneb+.
    /// Fulu preserves Deneb's execution payload header layout. Gloas is not active on mainnet.
    function executionHashIndex(uint64 slot) internal pure returns(uint256){
        uint256 epoch=uint256(slot)/32;if(epoch<144896)revert InvalidSSZProof();
        return epoch<269568?412:812;
    }
}

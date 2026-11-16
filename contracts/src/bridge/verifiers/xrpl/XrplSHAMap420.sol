// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./XrplSHA512Half420.sol";
import "./XrplBinary420.sol";

/// @notice Native transaction-with-metadata SHAMap v1, with key-directed 16-way paths.
library XrplSHAMap420 {
    error InvalidPath();
    function verify(XrplSHA512Half420 hash,bytes memory tx_,bytes memory metadata,bytes32[16][] memory nodes,bytes32 root)
        internal view returns(bytes32 key)
    {
        if(nodes.length==0||nodes.length>64||tx_.length>16384||metadata.length>65536)revert InvalidPath();
        key=hash.half(abi.encodePacked(bytes4(0x54584e00),tx_));
        bytes32 child=hash.half(abi.encodePacked(bytes4(0x534e4400),XrplBinary420.variable(tx_),XrplBinary420.variable(metadata),key));
        for(uint256 i=nodes.length;i>0;--i){
            uint256 depth=i-1;uint256 nibble=(uint256(key)>>(252-depth*4))&15;
            if(nodes[depth][nibble]!=child)revert InvalidPath();
            child=hash.half(abi.encodePacked(bytes4(0x4d494e00),nodes[depth]));
        }
        if(child!=root)revert InvalidPath();
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library ObjectId420 {
    function derive(
        bytes32 objectType,
        uint256 chainId,
        uint32 protocolVersion,
        bytes32 canonicalPayloadHash
    ) internal pure returns(bytes32) {
        return keccak256(abi.encode(
            keccak256("420/APP/OBJECT"),
            objectType,
            chainId,
            protocolVersion,
            canonicalPayloadHash
        ));
    }
}

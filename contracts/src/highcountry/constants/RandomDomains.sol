// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library RandomDomains {
    bytes32 internal constant BREEDING = keccak256("HC.RANDOM.BREEDING.V1");
    bytes32 internal constant COMPETITION = keccak256("HC.RANDOM.COMPETITION.V1");
    bytes32 internal constant GLOBAL_420_CUP = keccak256("HC.RANDOM.GLOBAL_420_CUP.V1");
    bytes32 internal constant GENESIS_CEREMONY = keccak256("HC.RANDOM.GENESIS_CEREMONY.V1");
}

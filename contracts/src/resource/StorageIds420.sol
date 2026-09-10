// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library StorageIds420 {
    bytes32 internal constant ACTION_CONFIGURE_STORAGE_CAPACITY = keccak256("420/STORAGE/ACTION/CONFIGURE_CAPACITY/V1");
    bytes32 internal constant ACTION_RESERVE_STORAGE_CAPACITY = keccak256("420/STORAGE/ACTION/RESERVE_CAPACITY/V1");

    bytes32 internal constant RESERVATION_DOMAIN = keccak256("420/STORAGE/CAPACITY_RESERVATION/V1");
}

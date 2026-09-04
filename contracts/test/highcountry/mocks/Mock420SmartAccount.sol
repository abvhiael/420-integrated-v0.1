// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

contract Mock420SmartAccount {
    address public immutable owner;

    constructor(address owner_) {
        owner = owner_;
    }

    function callAsAccount(address target, bytes calldata data) external returns (bytes memory result) {
        require(msg.sender == owner, "owner only");
        (bool ok, bytes memory returnedData) = target.call(data);
        require(ok, "account call failed");
        return returnedData;
    }
}

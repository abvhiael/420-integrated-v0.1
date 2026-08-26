// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./SystemAccess.sol";

abstract contract ProtocolTreasury is SystemAccess {
    event TreasuryTransfer(address indexed to, uint256 amount, bytes32 indexed reason);

    constructor(address timelock_) SystemAccess(timelock_) {}

    receive() external payable virtual {}

    function treasuryTransfer(address payable to, uint256 amount, bytes32 reason)
        external
        virtual
        onlyGovernance
    {
        require(to != address(0), "zero destination");
        require(amount <= address(this).balance, "insufficient");
        (bool ok,) = to.call{value: amount}("");
        require(ok, "transfer failed");
        emit TreasuryTransfer(to, amount, reason);
    }
}

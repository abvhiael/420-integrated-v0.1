// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/treasury/TreasuryReleaseExecutor420.sol";
import "../src/system/CapabilityRegistry420.sol";
import { TreasurySixDecimalToken420 } from "./TreasuryNativeVaultIntegration420.t.sol";

/// Test-only recipient: demonstrates a real successful transfer followed by Treasury
/// authorization failure (revocation rolls back along with the native transfer).
contract TreasuryReleaseRevokingRecipient420 {
    CapabilityRegistry420 immutable caps;
    bytes32 public grantId;
    bool public revokeOnReceive;
    address immutable controller;

    constructor(address caps_) {
        caps = CapabilityRegistry420(caps_);
        controller = msg.sender;
    }

    function configure(bytes32 grantId_, bool revoke_) external {
        require(msg.sender == controller, "fixture controller");
        grantId = grantId_;
        revokeOnReceive = revoke_;
    }

    receive() external payable {
        if (revokeOnReceive) caps.revokeGrant(grantId);
    }
}

contract TreasuryReleaseRejectingRecipient420 {
    receive() external payable { revert("reject native release"); }
}

contract TreasuryReleaseSixDecimalToken420 is TreasurySixDecimalToken420 {}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../system/SystemAccess.sol";

contract ArbitrationPolicyRegistry420 is I420System, SystemAccess {
    struct Policy {
        address resolver;
        address appealResolver;
        uint64 evidenceWindow;
        uint64 appealWindow;
        uint8 maxAppeals;
        bool active;
        bool exists;
    }

    mapping(bytes32 => Policy) private _policies;

    error InvalidPolicy();
    error UnknownPolicy();
    event PolicySet(bytes32 indexed domainId, address indexed resolver, address indexed appealResolver, uint64 evidenceWindow, uint64 appealWindow, uint8 maxAppeals, bool active);

    constructor(address timelock_) SystemAccess(timelock_) {}
    function systemName() external pure returns (string memory) { return "ArbitrationPolicyRegistry420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function setPolicy(bytes32 domainId, address resolver, address appealResolver, uint64 evidenceWindow, uint64 appealWindow, uint8 maxAppeals, bool active) external onlyGovernance {
        if (domainId == bytes32(0) || resolver == address(0) || evidenceWindow == 0 || appealWindow == 0 || maxAppeals > 3) revert InvalidPolicy();
        if (maxAppeals > 0 && appealResolver == address(0)) revert InvalidPolicy();
        _policies[domainId] = Policy(resolver, appealResolver, evidenceWindow, appealWindow, maxAppeals, active, true);
        emit PolicySet(domainId, resolver, appealResolver, evidenceWindow, appealWindow, maxAppeals, active);
    }

    function getPolicy(bytes32 domainId) external view returns (Policy memory p) {
        p = _policies[domainId];
        if (!p.exists) revert UnknownPolicy();
    }
}

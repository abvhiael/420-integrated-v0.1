
// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./ProtocolTreasury.sol";
import "../interfaces/I420System.sol";

contract CommunityValidatorReserve is ProtocolTreasury, I420System {
    uint256 public constant GENESIS_RESERVE = 6_300_000 ether;

    mapping(bytes32 => uint256) public assignedCredit;
    uint256 public totalAssigned;

    event CreditAssigned(bytes32 indexed validatorId, uint256 amount);
    event CreditReleased(bytes32 indexed validatorId, uint256 amount);

    constructor(address timelock_) ProtocolTreasury(timelock_) {}

    function systemName() external pure returns (string memory) { return "CommunityValidatorReserve"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function assignCredit(bytes32 validatorId, uint256 amount) external onlyGovernance {
        require(amount <= 21_000 ether, "per-validator cap");
        require(assignedCredit[validatorId] == 0, "already assigned");
        assignedCredit[validatorId] = amount;
        totalAssigned += amount;
        emit CreditAssigned(validatorId, amount);
    }

    function releaseCredit(bytes32 validatorId) external onlyGovernance {
        uint256 amount = assignedCredit[validatorId];
        assignedCredit[validatorId] = 0;
        totalAssigned -= amount;
        emit CreditReleased(validatorId, amount);
    }
}

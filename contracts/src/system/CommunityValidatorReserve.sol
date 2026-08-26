// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./ProtocolTreasury.sol";
import "../interfaces/I420System.sol";

interface IValidatorCreditReceiver420 {
    function receiveProtocolCredit(bytes32 validatorId, address beneficiary) external payable;
    function returnPendingProtocolCredit(bytes32 validatorId) external;
}

contract CommunityValidatorReserve is ProtocolTreasury, I420System {
    uint256 public constant GENESIS_RESERVE = 6_300_000 ether;
    uint256 public constant MAX_CREDIT_PER_VALIDATOR = 21_000 ether;

    address public validatorRegistry;
    bool public validatorRegistryBound;

    mapping(bytes32 => uint256) public assignedCredit;
    mapping(bytes32 => uint256) public fundedCredit;
    mapping(bytes32 => address) public creditBeneficiary;
    uint256 public totalAssigned;
    uint256 public totalFunded;

    event ValidatorRegistryBound(address indexed validatorRegistry);
    event CreditAssigned(bytes32 indexed validatorId, address indexed beneficiary, uint256 amount);
    event CreditFunded(bytes32 indexed validatorId, address indexed beneficiary, uint256 amount);
    event CreditReturned(bytes32 indexed validatorId, uint256 amount);
    event CreditReleased(bytes32 indexed validatorId, uint256 amount);

    error AlreadyBound();
    error InvalidCredit();
    error CreditNotAssigned();
    error CreditAlreadyFunded();
    error FundedCreditLocked();
    error NotValidatorRegistry();
    error ReservedCollateral();

    constructor(address timelock_) ProtocolTreasury(timelock_) {}

    function systemName() external pure returns (string memory) { return "CommunityValidatorReserve"; }
    function protocolVersion() external pure returns (uint32) { return 2; }

    function bindValidatorRegistry(address validatorRegistry_) external onlyGovernance {
        if (validatorRegistryBound) revert AlreadyBound();
        if (validatorRegistry_ == address(0)) revert ZeroAddress();
        validatorRegistry = validatorRegistry_;
        validatorRegistryBound = true;
        emit ValidatorRegistryBound(validatorRegistry_);
    }

    function assignCredit(bytes32 validatorId, address beneficiary, uint256 amount) external onlyGovernance {
        if (validatorId == bytes32(0) || beneficiary == address(0) || amount == 0 || amount > MAX_CREDIT_PER_VALIDATOR) revert InvalidCredit();
        if (assignedCredit[validatorId] != 0 || fundedCredit[validatorId] != 0) revert InvalidCredit();
        if (amount > unencumberedBalance()) revert ReservedCollateral();
        assignedCredit[validatorId] = amount;
        creditBeneficiary[validatorId] = beneficiary;
        totalAssigned += amount;
        emit CreditAssigned(validatorId, beneficiary, amount);
    }

    function fundCredit(bytes32 validatorId) external onlyGovernance {
        if (!validatorRegistryBound) revert NotValidatorRegistry();
        uint256 amount = assignedCredit[validatorId];
        address beneficiary = creditBeneficiary[validatorId];
        if (amount == 0 || beneficiary == address(0)) revert CreditNotAssigned();
        if (fundedCredit[validatorId] != 0) revert CreditAlreadyFunded();
        if (amount > address(this).balance) revert ReservedCollateral();
        fundedCredit[validatorId] = amount;
        totalFunded += amount;
        IValidatorCreditReceiver420(validatorRegistry).receiveProtocolCredit{value: amount}(validatorId, beneficiary);
        emit CreditFunded(validatorId, beneficiary, amount);
    }

    function reclaimUnregisteredCredit(bytes32 validatorId) external onlyGovernance {
        if (!validatorRegistryBound) revert NotValidatorRegistry();
        if (fundedCredit[validatorId] == 0) revert CreditNotAssigned();
        IValidatorCreditReceiver420(validatorRegistry).returnPendingProtocolCredit(validatorId);
    }

    function returnCredit(bytes32 validatorId) external payable {
        if (msg.sender != validatorRegistry || !validatorRegistryBound) revert NotValidatorRegistry();
        uint256 funded = fundedCredit[validatorId];
        if (msg.value == 0 || msg.value > funded) revert InvalidCredit();
        fundedCredit[validatorId] = funded - msg.value;
        totalFunded -= msg.value;
        assignedCredit[validatorId] -= msg.value;
        totalAssigned -= msg.value;
        if (assignedCredit[validatorId] == 0) creditBeneficiary[validatorId] = address(0);
        emit CreditReturned(validatorId, msg.value);
    }

    function releaseCredit(bytes32 validatorId) external onlyGovernance {
        if (fundedCredit[validatorId] != 0) revert FundedCreditLocked();
        uint256 amount = assignedCredit[validatorId];
        if (amount == 0) revert CreditNotAssigned();
        assignedCredit[validatorId] = 0;
        creditBeneficiary[validatorId] = address(0);
        totalAssigned -= amount;
        emit CreditReleased(validatorId, amount);
    }

    function unencumberedBalance() public view returns (uint256) {
        uint256 reservedUnfunded = totalAssigned - totalFunded;
        uint256 bal = address(this).balance;
        return bal > reservedUnfunded ? bal - reservedUnfunded : 0;
    }

    function reserveInvariant() external view returns (bool) {
        return totalFunded <= totalAssigned && address(this).balance >= totalAssigned - totalFunded;
    }

    function treasuryTransfer(address payable to, uint256 amount, bytes32 reason) external override onlyGovernance {
        if (to == address(0)) revert ZeroAddress();
        if (amount > unencumberedBalance()) revert ReservedCollateral();
        (bool ok,) = to.call{value: amount}("");
        require(ok, "transfer failed");
        emit TreasuryTransfer(to, amount, reason);
    }
}

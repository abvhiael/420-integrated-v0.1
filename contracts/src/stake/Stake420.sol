// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./IStake420.sol";
import "../system/GenesisResidentAccess420.sol";

/// @notice Genesis-resident custody contract for validator principal and validator reward balances.
/// @dev Validator selection is consensus-owned. This contract owns only economic custody/accounting.
contract Stake420 is IStake420, GenesisResidentAccess420 {
    uint256 public constant VALIDATOR_BOND = 42_000 ether;

    bytes32 public constant ACTION_BIND_VALIDATOR = keccak256("420/STAKE/BIND_VALIDATOR");

    address public override validatorRegistry;
    bool public validatorRegistryBound;

    mapping(uint64 => ValidatorBond) private _bonds;

    uint256 public totalBonded;
    uint256 public totalRewards;
    uint256 public totalSlashed;
    uint256 public totalWithdrawn;

    event ValidatorRegistryBound(address indexed validatorRegistry);
    event ValidatorBondLocked(uint64 indexed validatorId, address indexed owner, uint256 amount);
    event ValidatorRewardCredited(uint64 indexed validatorId, uint256 amount);
    event ValidatorUnbondStarted(uint64 indexed validatorId, uint256 amount, uint64 withdrawalBlock);
    event ValidatorBondSlashed(uint64 indexed validatorId, uint256 amount, address indexed receiver);
    event ValidatorPrincipalWithdrawn(uint64 indexed validatorId, address indexed owner, uint256 amount);
    event ValidatorRewardsClaimed(uint64 indexed validatorId, address indexed owner, uint256 amount);

    error NotValidatorRegistry();
    error AlreadyBound();
    error InvalidBond();
    error UnknownValidator();
    error AlreadyBonded();
    error InvalidWithdrawalBlock();
    error WithdrawalNotReady();
    error NothingToWithdraw();
    error TransferFailed();

    constructor(address timelock_, address registry_, bytes32 genesisConfigHash_)
        GenesisResidentAccess420(timelock_, registry_, genesisConfigHash_)
    {}

    receive() external payable {}

    function componentId() public pure override returns (bytes32) {
        return keccak256("420/APP/STAKE");
    }

    modifier onlyValidatorRegistry() {
        if (msg.sender != validatorRegistry || !validatorRegistryBound) revert NotValidatorRegistry();
        _;
    }

    function bindValidatorRegistry(address validatorRegistry_) external {
        _requireGenesisGovernance(ACTION_BIND_VALIDATOR);
        if (validatorRegistryBound) revert AlreadyBound();
        if (validatorRegistry_ == address(0)) revert ZeroAddress();
        validatorRegistry = validatorRegistry_;
        validatorRegistryBound = true;
        emit ValidatorRegistryBound(validatorRegistry_);
    }

    function bond(uint64 validatorId) external view override returns (ValidatorBond memory) {
        return _bonds[validatorId];
    }

    function effectiveBond(uint64 validatorId) external view override returns (uint256) {
        return _bonds[validatorId].bonded;
    }

    function isFullyBonded(uint64 validatorId) external view override returns (bool) {
        return _bonds[validatorId].bonded >= VALIDATOR_BOND;
    }

    function lockValidatorBond(uint64 validatorId, address owner) external payable override onlyValidatorRegistry {
        _requireResidentActive();
        if (owner == address(0)) revert ZeroAddress();
        if (msg.value != VALIDATOR_BOND) revert InvalidBond();
        ValidatorBond storage b = _bonds[validatorId];
        if (b.exists) revert AlreadyBonded();

        b.owner = owner;
        b.bonded = msg.value;
        b.exists = true;
        totalBonded += msg.value;
        emit ValidatorBondLocked(validatorId, owner, msg.value);
    }

    function creditValidatorReward(uint64 validatorId) external payable override onlyValidatorRegistry {
        _requireResidentActive();
        ValidatorBond storage b = _bonds[validatorId];
        if (!b.exists) revert UnknownValidator();
        if (msg.value == 0) revert InvalidBond();
        b.rewards += msg.value;
        totalRewards += msg.value;
        emit ValidatorRewardCredited(validatorId, msg.value);
    }

    function beginValidatorUnbond(uint64 validatorId, uint64 withdrawalBlock) external override onlyValidatorRegistry {
        _requireResidentActive();
        ValidatorBond storage b = _bonds[validatorId];
        if (!b.exists) revert UnknownValidator();
        if (withdrawalBlock <= block.number) revert InvalidWithdrawalBlock();
        b.pendingWithdrawal = b.bonded;
        b.withdrawalBlock = withdrawalBlock;
        emit ValidatorUnbondStarted(validatorId, b.pendingWithdrawal, withdrawalBlock);
    }

    function slashValidatorBond(uint64 validatorId, uint256 amount, address receiver)
        external
        override
        onlyValidatorRegistry
        returns (uint256 slashed)
    {
        _requireResidentActive();
        ValidatorBond storage b = _bonds[validatorId];
        if (!b.exists) revert UnknownValidator();
        if (receiver == address(0)) revert ZeroAddress();
        slashed = amount > b.bonded ? b.bonded : amount;
        if (slashed == 0) return 0;

        b.bonded -= slashed;
        if (b.pendingWithdrawal > b.bonded) b.pendingWithdrawal = b.bonded;
        totalBonded -= slashed;
        totalSlashed += slashed;

        (bool ok,) = payable(receiver).call{value: slashed}("");
        if (!ok) revert TransferFailed();
        emit ValidatorBondSlashed(validatorId, slashed, receiver);
    }

    function withdrawValidatorPrincipal(uint64 validatorId) external returns (uint256 amount) {
        _requireResidentActive();
        ValidatorBond storage b = _bonds[validatorId];
        if (!b.exists) revert UnknownValidator();
        if (msg.sender != b.owner) revert Unauthorized();
        if (b.withdrawalBlock == 0 || block.number < b.withdrawalBlock) revert WithdrawalNotReady();
        amount = b.pendingWithdrawal;
        if (amount == 0) revert NothingToWithdraw();

        b.pendingWithdrawal = 0;
        b.bonded -= amount;
        totalBonded -= amount;
        totalWithdrawn += amount;

        (bool ok,) = payable(b.owner).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit ValidatorPrincipalWithdrawn(validatorId, b.owner, amount);
    }

    function claimValidatorRewards(uint64 validatorId) external returns (uint256 amount) {
        _requireResidentActive();
        ValidatorBond storage b = _bonds[validatorId];
        if (!b.exists) revert UnknownValidator();
        if (msg.sender != b.owner) revert Unauthorized();
        amount = b.rewards;
        if (amount == 0) revert NothingToWithdraw();
        b.rewards = 0;
        totalRewards -= amount;

        (bool ok,) = payable(b.owner).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit ValidatorRewardsClaimed(validatorId, b.owner, amount);
    }
}

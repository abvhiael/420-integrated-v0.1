// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetAuthorization420.sol";
import "./BetIds420.sol";
import "./BetOperatorRegistry420.sol";
import "./BetTypes420.sol";

interface IERC20BetEconomics420 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract BetEconomics420 is I420System {
    enum ClaimKind { NONE, REWARD, PROMOTION }

    struct FeeSchedule {
        bytes32 scheduleId;
        bytes32 gameVersionId;
        uint16 protocolFeeBps;
        uint16 operatorFeeBps;
        address protocolRecipient;
        bytes32 manifestHash;
        bool exists;
    }

    struct WagerFeeBinding {
        bytes32 wagerId;
        bytes32 gameVersionId;
        bytes32 operatorId;
        bytes32 scheduleId;
        address protocolRecipient;
        address operatorRecipient;
        uint256 protocolFee;
        uint256 operatorFee;
        bool finalized;
        bool charged;
    }

    struct Claim {
        bytes32 claimId;
        ClaimKind kind;
        address beneficiary;
        uint256 amount;
        uint64 expiresAt;
        uint64 epoch;
        bytes32 sourceId;
        bool claimed;
        bool reclaimed;
    }

    BetAuthorization420 public immutable authorization;
    BetOperatorRegistry420 public immutable operators;
    address public immutable asset;

    mapping(bytes32 => FeeSchedule) private _feeSchedules;
    mapping(bytes32 => bytes32) public feeScheduleForGameVersion;
    mapping(bytes32 => WagerFeeBinding) private _wagerFees;
    mapping(address => uint256) public feeClaimable;
    mapping(bytes32 => Claim) private _claims;

    uint256 public feeAvailable;
    uint256 public feeReserved;
    uint256 public feeClaimableTotal;
    uint256 public rewardAvailable;
    uint256 public rewardReserved;
    uint256 public promotionAvailable;
    uint256 public promotionReserved;
    uint256 private _entered;

    error ZeroAddress();
    error InvalidId();
    error InvalidConfiguration();
    error AlreadyExists();
    error NotFound();
    error Unauthorized();
    error InsufficientFunding();
    error InvalidValue();
    error TransferFailed();
    error InvalidState();
    error NotExpired();
    error Expired();
    error Reentrancy();

    event FeeScheduleConfigured(bytes32 indexed scheduleId, bytes32 indexed gameVersionId, uint16 protocolFeeBps, uint16 operatorFeeBps, address protocolRecipient, bytes32 manifestHash);
    event EconomicsFunded(uint8 indexed domain, address indexed funder, uint256 amount);
    event WagerFeesBound(bytes32 indexed wagerId, bytes32 indexed scheduleId, bytes32 indexed operatorId, uint256 protocolFee, uint256 operatorFee);
    event WagerFeesFinalized(bytes32 indexed wagerId, bool charged, uint256 protocolFee, uint256 operatorFee);
    event FeeClaimed(address indexed recipient, uint256 amount);
    event ClaimAccrued(bytes32 indexed claimId, ClaimKind indexed kind, address indexed beneficiary, uint256 amount, uint64 expiresAt, uint64 epoch, bytes32 sourceId);
    event ClaimPaid(bytes32 indexed claimId, ClaimKind indexed kind, address indexed beneficiary, uint256 amount);
    event ClaimReclaimed(bytes32 indexed claimId, ClaimKind indexed kind, uint256 amount);

    constructor(address authorization_, address operators_, address asset_) {
        if (authorization_ == address(0) || operators_ == address(0)) revert ZeroAddress();
        authorization = BetAuthorization420(authorization_);
        operators = BetOperatorRegistry420(operators_);
        asset = asset_;
    }

    modifier nonReentrant() {
        if (_entered != 0) revert Reentrancy();
        _entered = 1;
        _;
        _entered = 0;
    }

    function systemName() external pure returns (string memory) { return "BetEconomics420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function configureFeeSchedule(FeeSchedule calldata input) external {
        if (input.scheduleId == bytes32(0) || input.gameVersionId == bytes32(0) || input.manifestHash == bytes32(0)) revert InvalidId();
        if (_feeSchedules[input.scheduleId].exists || feeScheduleForGameVersion[input.gameVersionId] != bytes32(0)) revert AlreadyExists();
        if (uint256(input.protocolFeeBps) + uint256(input.operatorFeeBps) > BetTypes420.BPS) revert InvalidConfiguration();
        if (input.protocolFeeBps != 0 && input.protocolRecipient == address(0)) revert ZeroAddress();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_ECONOMICS_CONFIGURE, authorization.scopeForGameVersion(input.gameVersionId), 0)) revert Unauthorized();
        FeeSchedule memory copy = input;
        copy.exists = true;
        _feeSchedules[input.scheduleId] = copy;
        feeScheduleForGameVersion[input.gameVersionId] = input.scheduleId;
        emit FeeScheduleConfigured(copy.scheduleId, copy.gameVersionId, copy.protocolFeeBps, copy.operatorFeeBps, copy.protocolRecipient, copy.manifestHash);
    }

    function fundFees(uint256 amount) external payable nonReentrant { _fund(1, amount); feeAvailable += amount; }
    function fundRewards(uint256 amount) external payable nonReentrant { _fund(2, amount); rewardAvailable += amount; }
    function fundPromotions(uint256 amount) external payable nonReentrant { _fund(3, amount); promotionAvailable += amount; }

    function bindWager(bytes32 wagerId, bytes32 gameVersionId, bytes32 operatorId, uint256 stake) external {
        if (wagerId == bytes32(0) || gameVersionId == bytes32(0) || operatorId == bytes32(0) || stake == 0) revert InvalidId();
        if (_wagerFees[wagerId].wagerId != bytes32(0)) revert AlreadyExists();
        bytes32 scheduleId = feeScheduleForGameVersion[gameVersionId];
        if (scheduleId == bytes32(0)) revert NotFound();
        FeeSchedule storage schedule = _feeSchedules[scheduleId];
        uint256 protocolFee = stake * schedule.protocolFeeBps / BetTypes420.BPS;
        uint256 operatorFee = stake * schedule.operatorFeeBps / BetTypes420.BPS;
        uint256 total = protocolFee + operatorFee;
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_ECONOMICS_BIND, authorization.scopeForGameVersion(gameVersionId), total)) revert Unauthorized();
        if (feeAvailable < total) revert InsufficientFunding();
        BetOperatorRegistry420.Operator memory operator = operators.getOperator(operatorId);
        feeAvailable -= total;
        feeReserved += total;
        _wagerFees[wagerId] = WagerFeeBinding({
            wagerId: wagerId,
            gameVersionId: gameVersionId,
            operatorId: operatorId,
            scheduleId: scheduleId,
            protocolRecipient: schedule.protocolRecipient,
            operatorRecipient: operator.operatorAccount,
            protocolFee: protocolFee,
            operatorFee: operatorFee,
            finalized: false,
            charged: false
        });
        emit WagerFeesBound(wagerId, scheduleId, operatorId, protocolFee, operatorFee);
    }

    function finalizeWagerFees(bytes32 wagerId, BetTypes420.TerminalOutcome outcome) external {
        WagerFeeBinding storage binding = _wagerFees[wagerId];
        if (binding.wagerId == bytes32(0)) revert NotFound();
        if (binding.finalized) revert InvalidState();
        uint256 total = binding.protocolFee + binding.operatorFee;
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_ECONOMICS_FINALIZE, authorization.scopeForGameVersion(binding.gameVersionId), total)) revert Unauthorized();
        binding.finalized = true;
        feeReserved -= total;
        bool charge = outcome == BetTypes420.TerminalOutcome.WIN || outcome == BetTypes420.TerminalOutcome.LOSS;
        binding.charged = charge;
        if (charge) {
            if (binding.protocolFee != 0) feeClaimable[binding.protocolRecipient] += binding.protocolFee;
            if (binding.operatorFee != 0) feeClaimable[binding.operatorRecipient] += binding.operatorFee;
            feeClaimableTotal += total;
        } else {
            feeAvailable += total;
        }
        emit WagerFeesFinalized(wagerId, charge, binding.protocolFee, binding.operatorFee);
    }

    function claimFees(uint256 amount) external nonReentrant {
        if (amount == 0 || feeClaimable[msg.sender] < amount) revert InvalidValue();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_CLAIM_FEE, authorization.scopeForPlayer(msg.sender), amount)) revert Unauthorized();
        feeClaimable[msg.sender] -= amount;
        feeClaimableTotal -= amount;
        _pay(msg.sender, amount);
        emit FeeClaimed(msg.sender, amount);
    }

    function accrueReward(bytes32 claimId, address beneficiary, uint256 amount, uint64 expiresAt, uint64 epoch, bytes32 sourceId) external {
        _accrue(claimId, ClaimKind.REWARD, beneficiary, amount, expiresAt, epoch, sourceId);
    }

    function grantPromotion(bytes32 claimId, address beneficiary, uint256 amount, uint64 expiresAt, uint64 epoch, bytes32 sourceId) external {
        _accrue(claimId, ClaimKind.PROMOTION, beneficiary, amount, expiresAt, epoch, sourceId);
    }

    function claim(bytes32 claimId) external nonReentrant {
        Claim storage c = _claims[claimId];
        if (c.claimId == bytes32(0)) revert NotFound();
        if (c.claimed || c.reclaimed) revert InvalidState();
        if (block.timestamp >= c.expiresAt) revert Expired();
        bytes32 action = c.kind == ClaimKind.REWARD ? BetIds420.ACTION_CLAIM_REWARD : BetIds420.ACTION_CLAIM_PROMOTION;
        if (msg.sender != c.beneficiary && !authorization.isAuthorized(msg.sender, action, authorization.scopeForPlayer(c.beneficiary), c.amount)) revert Unauthorized();
        c.claimed = true;
        if (c.kind == ClaimKind.REWARD) rewardReserved -= c.amount;
        else promotionReserved -= c.amount;
        _pay(c.beneficiary, c.amount);
        emit ClaimPaid(claimId, c.kind, c.beneficiary, c.amount);
    }

    function reclaimExpired(bytes32 claimId) external {
        Claim storage c = _claims[claimId];
        if (c.claimId == bytes32(0)) revert NotFound();
        if (c.claimed || c.reclaimed) revert InvalidState();
        if (block.timestamp < c.expiresAt) revert NotExpired();
        c.reclaimed = true;
        if (c.kind == ClaimKind.REWARD) {
            rewardReserved -= c.amount;
            rewardAvailable += c.amount;
        } else {
            promotionReserved -= c.amount;
            promotionAvailable += c.amount;
        }
        emit ClaimReclaimed(claimId, c.kind, c.amount);
    }

    function getFeeSchedule(bytes32 scheduleId) external view returns (FeeSchedule memory schedule) {
        schedule = _feeSchedules[scheduleId];
        if (!schedule.exists) revert NotFound();
    }

    function getWagerFee(bytes32 wagerId) external view returns (WagerFeeBinding memory binding) {
        binding = _wagerFees[wagerId];
        if (binding.wagerId == bytes32(0)) revert NotFound();
    }

    function getClaim(bytes32 claimId) external view returns (Claim memory c) {
        c = _claims[claimId];
        if (c.claimId == bytes32(0)) revert NotFound();
    }

    function accountedBalance() external view returns (uint256) {
        return feeAvailable + feeReserved + feeClaimableTotal + rewardAvailable + rewardReserved + promotionAvailable + promotionReserved;
    }

    function _accrue(bytes32 claimId, ClaimKind kind, address beneficiary, uint256 amount, uint64 expiresAt, uint64 epoch, bytes32 sourceId) private {
        if (claimId == bytes32(0) || sourceId == bytes32(0) || beneficiary == address(0) || amount == 0) revert InvalidId();
        if (expiresAt <= block.timestamp || kind == ClaimKind.NONE) revert InvalidConfiguration();
        if (_claims[claimId].claimId != bytes32(0)) revert AlreadyExists();
        bytes32 action = kind == ClaimKind.REWARD ? BetIds420.ACTION_REWARD_ACCRUE : BetIds420.ACTION_PROMOTION_GRANT;
        if (!authorization.isAuthorized(msg.sender, action, authorization.scopeGlobal(), amount)) revert Unauthorized();
        if (kind == ClaimKind.REWARD) {
            if (rewardAvailable < amount) revert InsufficientFunding();
            rewardAvailable -= amount;
            rewardReserved += amount;
        } else {
            if (promotionAvailable < amount) revert InsufficientFunding();
            promotionAvailable -= amount;
            promotionReserved += amount;
        }
        _claims[claimId] = Claim(claimId, kind, beneficiary, amount, expiresAt, epoch, sourceId, false, false);
        emit ClaimAccrued(claimId, kind, beneficiary, amount, expiresAt, epoch, sourceId);
    }

    function _fund(uint8 domain, uint256 amount) private {
        if (amount == 0) revert InvalidValue();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_ECONOMICS_FUND, authorization.scopeForAsset(asset), amount)) revert Unauthorized();
        if (asset == address(0)) {
            if (msg.value != amount) revert InvalidValue();
        } else {
            if (msg.value != 0) revert InvalidValue();
            if (!IERC20BetEconomics420(asset).transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        }
        emit EconomicsFunded(domain, msg.sender, amount);
    }

    function _pay(address to, uint256 amount) private {
        if (asset == address(0)) {
            (bool ok,) = payable(to).call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else if (!IERC20BetEconomics420(asset).transfer(to, amount)) {
            revert TransferFailed();
        }
    }

    receive() external payable { revert InvalidValue(); }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetAuthorization420.sol";
import "./BetIds420.sol";
import "./BetProfileRegistry420.sol";
import "./VaultAccounting420.sol";

contract RiskManager420 is I420System {
    bytes32 public constant RISK_PROFILE_TYPE = keccak256("RISK");

    struct RiskProfile {
        bytes32 profileId;
        uint256 maxStakePerWager;
        uint256 maxGrossPayoutPerWager;
        uint256 maxReservedLiabilityPerWager;
        uint256 maxReservedLiabilityPerGame;
        uint256 maxReservedLiabilityPerVault;
        uint256 maxReservedLiabilityPerCorrelationKey;
        bytes32 manifestHash;
        bool exists;
    }

    struct ExposureReservation {
        bytes32 wagerId;
        bytes32 vaultId;
        bytes32 gameVersionId;
        bytes32 riskProfileId;
        bytes32 correlationKey;
        uint256 stake;
        uint256 grossPayout;
        uint256 reservedLiability;
        bool active;
    }

    BetAuthorization420 public immutable authorization;
    BetProfileRegistry420 public immutable profileRegistry;
    VaultAccounting420 public immutable accounting;

    mapping(bytes32 => RiskProfile) private _profiles;
    mapping(bytes32 => ExposureReservation) private _reservations;
    mapping(bytes32 => uint256) public reservedByVault;
    mapping(bytes32 => mapping(bytes32 => uint256)) public reservedByGame;
    mapping(bytes32 => mapping(bytes32 => uint256)) public reservedByCorrelationKey;

    error ZeroAddress();
    error InvalidId();
    error InvalidConfiguration();
    error AlreadyExists();
    error NotFound();
    error Unauthorized();
    error ProfileInactive();
    error LimitExceeded();
    error AlreadyReserved();
    error ReservationInactive();

    event RiskProfileConfigured(bytes32 indexed profileId, bytes32 manifestHash);
    event ExposureReserved(
        bytes32 indexed wagerId,
        bytes32 indexed vaultId,
        bytes32 indexed gameVersionId,
        bytes32 riskProfileId,
        bytes32 correlationKey,
        uint256 stake,
        uint256 grossPayout,
        uint256 reservedLiability
    );
    event ExposureReleased(bytes32 indexed wagerId, bytes32 indexed vaultId, uint256 reservedLiability);

    constructor(address authorization_, address profileRegistry_, address accounting_) {
        if (authorization_ == address(0) || profileRegistry_ == address(0) || accounting_ == address(0)) revert ZeroAddress();
        authorization = BetAuthorization420(authorization_);
        profileRegistry = BetProfileRegistry420(profileRegistry_);
        accounting = VaultAccounting420(accounting_);
    }

    function systemName() external pure returns (string memory) { return "RiskManager420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function configureProfile(RiskProfile calldata input) external {
        if (input.profileId == bytes32(0)) revert InvalidId();
        if (_profiles[input.profileId].exists) revert AlreadyExists();
        if (!profileRegistry.isActiveOfType(input.profileId, RISK_PROFILE_TYPE)) revert ProfileInactive();
        if (
            input.maxStakePerWager == 0 || input.maxGrossPayoutPerWager == 0
                || input.maxReservedLiabilityPerWager == 0 || input.maxReservedLiabilityPerVault == 0
        ) revert InvalidConfiguration();
        _requireProfileAuth(input.profileId, BetIds420.ACTION_RISK_CONFIGURE, 0);
        RiskProfile memory copy = input;
        copy.exists = true;
        _profiles[input.profileId] = copy;
        emit RiskProfileConfigured(input.profileId, input.manifestHash);
    }

    function reserveExposure(
        bytes32 wagerId,
        bytes32 vaultId,
        bytes32 gameVersionId,
        bytes32 riskProfileId,
        uint256 stake,
        uint256 grossPayout,
        bytes32 correlationKey
    ) external returns (uint256 reservedLiability) {
        if (wagerId == bytes32(0) || vaultId == bytes32(0) || gameVersionId == bytes32(0)) revert InvalidId();
        if (_reservations[wagerId].wagerId != bytes32(0)) revert AlreadyReserved();
        RiskProfile storage p = _getProfile(riskProfileId);
        if (!profileRegistry.isActiveOfType(riskProfileId, RISK_PROFILE_TYPE)) revert ProfileInactive();
        if (stake == 0 || stake > p.maxStakePerWager || grossPayout > p.maxGrossPayoutPerWager) revert LimitExceeded();

        reservedLiability = grossPayout > stake ? grossPayout - stake : 0;
        if (reservedLiability > p.maxReservedLiabilityPerWager) revert LimitExceeded();
        _requireVaultAuth(vaultId, BetIds420.ACTION_RISK_RESERVE, reservedLiability);

        uint256 nextVault = reservedByVault[vaultId] + reservedLiability;
        if (nextVault > p.maxReservedLiabilityPerVault) revert LimitExceeded();
        uint256 nextGame = reservedByGame[vaultId][gameVersionId] + reservedLiability;
        if (p.maxReservedLiabilityPerGame != 0 && nextGame > p.maxReservedLiabilityPerGame) revert LimitExceeded();
        uint256 nextCorrelation;
        if (correlationKey != bytes32(0)) {
            nextCorrelation = reservedByCorrelationKey[vaultId][correlationKey] + reservedLiability;
            if (
                p.maxReservedLiabilityPerCorrelationKey != 0
                    && nextCorrelation > p.maxReservedLiabilityPerCorrelationKey
            ) revert LimitExceeded();
        }

        if (reservedLiability != 0) accounting.reserveLiability(vaultId, wagerId, reservedLiability);
        reservedByVault[vaultId] = nextVault;
        reservedByGame[vaultId][gameVersionId] = nextGame;
        if (correlationKey != bytes32(0)) reservedByCorrelationKey[vaultId][correlationKey] = nextCorrelation;
        _reservations[wagerId] = ExposureReservation(
            wagerId,
            vaultId,
            gameVersionId,
            riskProfileId,
            correlationKey,
            stake,
            grossPayout,
            reservedLiability,
            true
        );
        emit ExposureReserved(
            wagerId,
            vaultId,
            gameVersionId,
            riskProfileId,
            correlationKey,
            stake,
            grossPayout,
            reservedLiability
        );
    }

    function releaseExposure(bytes32 wagerId) external returns (uint256 reservedLiability) {
        ExposureReservation storage r = _reservations[wagerId];
        if (r.wagerId == bytes32(0)) revert NotFound();
        if (!r.active) revert ReservationInactive();
        _requireVaultAuth(r.vaultId, BetIds420.ACTION_RISK_RELEASE, r.reservedLiability);
        reservedLiability = r.reservedLiability;
        r.active = false;
        reservedByVault[r.vaultId] -= reservedLiability;
        reservedByGame[r.vaultId][r.gameVersionId] -= reservedLiability;
        if (r.correlationKey != bytes32(0)) reservedByCorrelationKey[r.vaultId][r.correlationKey] -= reservedLiability;
        if (reservedLiability != 0) accounting.releaseLiability(r.vaultId, wagerId);
        emit ExposureReleased(wagerId, r.vaultId, reservedLiability);
    }

    function getProfile(bytes32 profileId) external view returns (RiskProfile memory) { return _getProfile(profileId); }
    function getReservation(bytes32 wagerId) external view returns (ExposureReservation memory) {
        ExposureReservation storage r = _reservations[wagerId];
        if (r.wagerId == bytes32(0)) revert NotFound();
        return r;
    }

    function previewReservedLiability(uint256 stake, uint256 grossPayout) external pure returns (uint256) {
        return grossPayout > stake ? grossPayout - stake : 0;
    }

    function _getProfile(bytes32 profileId) private view returns (RiskProfile storage p) {
        p = _profiles[profileId];
        if (!p.exists) revert NotFound();
    }

    function _requireProfileAuth(bytes32 profileId, bytes32 action, uint256 amount) private view {
        if (!authorization.isAuthorized(msg.sender, action, authorization.scopeForProfile(profileId), amount)) revert Unauthorized();
    }

    function _requireVaultAuth(bytes32 vaultId, bytes32 action, uint256 amount) private view {
        if (!authorization.isAuthorized(msg.sender, action, authorization.scopeForVault(vaultId), amount)) revert Unauthorized();
    }
}

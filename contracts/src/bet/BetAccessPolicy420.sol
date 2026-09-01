// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetAuthorization420.sol";
import "./BetIds420.sol";
import "./BetProfileRegistry420.sol";

interface IBetCredentialVerifier420 {
    function isCredentialValid(address subject, bytes32 credentialId) external view returns (bool);
}

contract BetAccessPolicy420 is I420System {
    bytes32 public constant ACCESS_PROFILE_TYPE = keccak256("ACCESS");
    uint256 public constant MAX_CREDENTIAL_REQUIREMENTS = 8;

    struct Policy {
        bytes32 profileId;
        address asset;
        address credentialVerifier;
        uint256 maxStakePerWager;
        uint256 maxStakePerPeriod;
        uint64 periodSeconds;
        bytes32 manifestHash;
        bool exists;
    }

    struct PlayerLimits {
        uint256 maxStakePerWager;
        uint256 maxStakePerPeriod;
        uint64 periodSeconds;
        bool exists;
    }

    struct Usage {
        uint64 periodStart;
        uint256 stakeUsed;
    }

    BetAuthorization420 public immutable authorization;
    BetProfileRegistry420 public immutable profileRegistry;

    mapping(bytes32 => Policy) private _policies;
    mapping(bytes32 => bytes32[]) private _requirements;
    mapping(address => mapping(address => PlayerLimits)) private _playerLimits;
    mapping(address => uint64) public selfExcludedUntil;
    mapping(address => uint64) public coolOffUntil;
    mapping(bytes32 => mapping(address => Usage)) private _policyUsage;
    mapping(address => mapping(address => Usage)) private _playerUsage;

    error ZeroAddress();
    error InvalidId();
    error InvalidConfiguration();
    error AlreadyExists();
    error NotFound();
    error Unauthorized();
    error InactiveProfile();
    error WrongAsset();
    error MissingCredential(bytes32 credentialId);
    error SelfExcluded(uint64 until);
    error CoolingOff(uint64 until);
    error StakeLimitExceeded();
    error PeriodLimitExceeded();
    error LimitCanOnlyTighten();
    error CannotShortenProtection();

    event PolicyConfigured(
        bytes32 indexed profileId,
        address indexed asset,
        address indexed credentialVerifier,
        uint256 maxStakePerWager,
        uint256 maxStakePerPeriod,
        uint64 periodSeconds,
        bytes32 manifestHash
    );
    event PlayerLimitsSet(
        address indexed player,
        address indexed asset,
        uint256 maxStakePerWager,
        uint256 maxStakePerPeriod,
        uint64 periodSeconds
    );
    event PlayerSelfExcluded(address indexed player, uint64 until);
    event PlayerCoolOffSet(address indexed player, uint64 until);
    event AccessConsumed(bytes32 indexed profileId, address indexed player, address indexed asset, uint256 stake);

    constructor(address authorization_, address profileRegistry_) {
        if (authorization_ == address(0) || profileRegistry_ == address(0)) revert ZeroAddress();
        authorization = BetAuthorization420(authorization_);
        profileRegistry = BetProfileRegistry420(profileRegistry_);
    }

    function systemName() external pure returns (string memory) { return "BetAccessPolicy420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function configurePolicy(
        bytes32 profileId,
        address asset,
        address credentialVerifier,
        bytes32[] calldata credentialRequirements,
        uint256 maxStakePerWager,
        uint256 maxStakePerPeriod,
        uint64 periodSeconds,
        bytes32 manifestHash
    ) external {
        if (profileId == bytes32(0) || manifestHash == bytes32(0)) revert InvalidId();
        if (_policies[profileId].exists) revert AlreadyExists();
        if (!profileRegistry.isActiveOfType(profileId, ACCESS_PROFILE_TYPE)) revert InactiveProfile();
        if (credentialRequirements.length > MAX_CREDENTIAL_REQUIREMENTS) revert InvalidConfiguration();
        if (credentialRequirements.length != 0) {
            if (credentialVerifier == address(0) || credentialVerifier.code.length == 0) revert InvalidConfiguration();
            for (uint256 i = 0; i < credentialRequirements.length; ++i) {
                if (credentialRequirements[i] == bytes32(0)) revert InvalidConfiguration();
                for (uint256 j = 0; j < i; ++j) {
                    if (credentialRequirements[i] == credentialRequirements[j]) revert InvalidConfiguration();
                }
            }
        } else if (credentialVerifier != address(0)) {
            revert InvalidConfiguration();
        }
        if (maxStakePerPeriod != 0 && periodSeconds == 0) revert InvalidConfiguration();
        if (maxStakePerPeriod == 0 && periodSeconds != 0) revert InvalidConfiguration();
        if (
            !authorization.isAuthorized(
                msg.sender,
                BetIds420.ACTION_ACCESS_CONFIGURE,
                authorization.scopeForProfile(profileId),
                0
            )
        ) revert Unauthorized();

        _policies[profileId] = Policy({
            profileId: profileId,
            asset: asset,
            credentialVerifier: credentialVerifier,
            maxStakePerWager: maxStakePerWager,
            maxStakePerPeriod: maxStakePerPeriod,
            periodSeconds: periodSeconds,
            manifestHash: manifestHash,
            exists: true
        });
        for (uint256 i = 0; i < credentialRequirements.length; ++i) {
            _requirements[profileId].push(credentialRequirements[i]);
        }
        emit PolicyConfigured(
            profileId,
            asset,
            credentialVerifier,
            maxStakePerWager,
            maxStakePerPeriod,
            periodSeconds,
            manifestHash
        );
    }

    /// @notice Set or tighten player-selected limits for one stake asset.
    /// @dev Limits are intentionally monotonic: once set they can only be tightened on-chain.
    function setPlayerLimits(address asset, uint256 maxStakePerWager, uint256 maxStakePerPeriod, uint64 periodSeconds) external {
        if (maxStakePerPeriod != 0 && periodSeconds == 0) revert InvalidConfiguration();
        if (maxStakePerPeriod == 0 && periodSeconds != 0) revert InvalidConfiguration();

        PlayerLimits storage current = _playerLimits[msg.sender][asset];
        if (current.exists) {
            if (!_tightens(current.maxStakePerWager, maxStakePerWager)) revert LimitCanOnlyTighten();
            if (!_tightens(current.maxStakePerPeriod, maxStakePerPeriod)) revert LimitCanOnlyTighten();
            if (current.maxStakePerPeriod != 0 && periodSeconds != current.periodSeconds) revert LimitCanOnlyTighten();
        }
        if (!current.exists && maxStakePerWager == 0 && maxStakePerPeriod == 0) revert InvalidConfiguration();

        _playerLimits[msg.sender][asset] = PlayerLimits(maxStakePerWager, maxStakePerPeriod, periodSeconds, true);
        emit PlayerLimitsSet(msg.sender, asset, maxStakePerWager, maxStakePerPeriod, periodSeconds);
    }

    function selfExclude(uint64 until) external {
        if (until <= block.timestamp || until <= selfExcludedUntil[msg.sender]) revert CannotShortenProtection();
        selfExcludedUntil[msg.sender] = until;
        emit PlayerSelfExcluded(msg.sender, until);
    }

    function coolOff(uint64 until) external {
        if (until <= block.timestamp || until <= coolOffUntil[msg.sender]) revert CannotShortenProtection();
        coolOffUntil[msg.sender] = until;
        emit PlayerCoolOffSet(msg.sender, until);
    }

    function validateAndRecord(bytes32 profileId, address player, address asset, uint256 stake) external {
        if (player == address(0) || stake == 0) revert InvalidConfiguration();
        Policy storage policy = _getPolicy(profileId);
        if (!profileRegistry.isActiveOfType(profileId, ACCESS_PROFILE_TYPE)) revert InactiveProfile();
        if (policy.asset != asset) revert WrongAsset();
        if (
            !authorization.isAuthorized(
                msg.sender,
                BetIds420.ACTION_ACCESS_RECORD,
                authorization.scopeForProfile(profileId),
                stake
            )
        ) revert Unauthorized();

        uint64 excludedUntil = selfExcludedUntil[player];
        if (block.timestamp < excludedUntil) revert SelfExcluded(excludedUntil);
        uint64 coolingUntil = coolOffUntil[player];
        if (block.timestamp < coolingUntil) revert CoolingOff(coolingUntil);

        _requireCredentials(policy, player);
        if (policy.maxStakePerWager != 0 && stake > policy.maxStakePerWager) revert StakeLimitExceeded();
        _consumePolicy(profileId, player, stake, policy.maxStakePerPeriod, policy.periodSeconds);

        PlayerLimits storage limits = _playerLimits[player][asset];
        if (limits.exists) {
            if (limits.maxStakePerWager != 0 && stake > limits.maxStakePerWager) revert StakeLimitExceeded();
            _consumePlayer(player, asset, stake, limits.maxStakePerPeriod, limits.periodSeconds);
        }

        emit AccessConsumed(profileId, player, asset, stake);
    }

    function getPolicy(bytes32 profileId) external view returns (Policy memory) { return _getPolicy(profileId); }
    function credentialRequirements(bytes32 profileId) external view returns (bytes32[] memory) {
        if (!_policies[profileId].exists) revert NotFound();
        return _requirements[profileId];
    }
    function playerLimits(address player, address asset) external view returns (PlayerLimits memory) {
        return _playerLimits[player][asset];
    }
    function policyUsage(bytes32 profileId, address player) external view returns (Usage memory) {
        return _policyUsage[profileId][player];
    }
    function playerUsage(address player, address asset) external view returns (Usage memory) {
        return _playerUsage[player][asset];
    }

    function _requireCredentials(Policy storage policy, address player) private view {
        bytes32[] storage requirements = _requirements[policy.profileId];
        if (requirements.length == 0) return;
        IBetCredentialVerifier420 verifier = IBetCredentialVerifier420(policy.credentialVerifier);
        for (uint256 i = 0; i < requirements.length; ++i) {
            bool ok;
            try verifier.isCredentialValid(player, requirements[i]) returns (bool valid) {
                ok = valid;
            } catch {
                ok = false;
            }
            if (!ok) revert MissingCredential(requirements[i]);
        }
    }

    function _consumePolicy(
        bytes32 profileId,
        address player,
        uint256 stake,
        uint256 maxStakePerPeriod,
        uint64 periodSeconds
    ) private {
        if (maxStakePerPeriod == 0) return;
        Usage storage usage = _policyUsage[profileId][player];
        _rollUsage(usage, periodSeconds);
        if (usage.stakeUsed + stake > maxStakePerPeriod) revert PeriodLimitExceeded();
        usage.stakeUsed += stake;
    }

    function _consumePlayer(
        address player,
        address asset,
        uint256 stake,
        uint256 maxStakePerPeriod,
        uint64 periodSeconds
    ) private {
        if (maxStakePerPeriod == 0) return;
        Usage storage usage = _playerUsage[player][asset];
        _rollUsage(usage, periodSeconds);
        if (usage.stakeUsed + stake > maxStakePerPeriod) revert PeriodLimitExceeded();
        usage.stakeUsed += stake;
    }

    function _rollUsage(Usage storage usage, uint64 periodSeconds) private {
        if (usage.periodStart == 0 || block.timestamp >= uint256(usage.periodStart) + periodSeconds) {
            usage.periodStart = uint64(block.timestamp);
            usage.stakeUsed = 0;
        }
    }

    function _tightens(uint256 current, uint256 next) private pure returns (bool) {
        if (current == 0) return true;
        return next != 0 && next <= current;
    }

    function _getPolicy(bytes32 profileId) private view returns (Policy storage policy) {
        policy = _policies[profileId];
        if (!policy.exists) revert NotFound();
    }
}

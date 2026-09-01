// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BankrollVault420.sol";
import "./BetAccessPolicy420.sol";
import "./BetAuthorization420.sol";
import "./BetEmergencyState420.sol";
import "./BetGameRegistry420.sol";
import "./BetIds420.sol";
import "./BetModuleRegistry420.sol";
import "./BetOperatorRegistry420.sol";
import "./BetProfileRegistry420.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./RiskManager420.sol";

contract WagerRouter420 is I420System {
    struct AcceptanceRequest {
        bytes32 operatorId;
        bytes32 gameVersionId;
        uint256 stake;
        uint256 maxGrossPayout;
        bytes32 paramsHash;
        bytes32 correlationKey;
        uint64 deadline;
    }

    BetAuthorization420 public immutable authorization;
    BetGameRegistry420 public immutable games;
    BetModuleRegistry420 public immutable modules;
    BetOperatorRegistry420 public immutable operators;
    BetProfileRegistry420 public immutable profiles;
    BetAccessPolicy420 public immutable accessPolicy;
    RiskManager420 public immutable riskManager;
    BetRegistry420 public immutable betRegistry;
    BankrollVault420 public immutable vault;
    bytes32 public immutable vaultId;
    address public immutable asset;
    BetEmergencyState420 public emergencyState;

    mapping(address => uint256) public nextNonce;
    uint256 private _entered;

    error ZeroAddress();
    error InvalidRequest();
    error Unauthorized();
    error InactiveGame();
    error InactiveModule();
    error InactiveOperator();
    error InactiveProfile();
    error WrongValue();
    error InvalidLiability();
    error Reentrancy();
    error EmergencyAlreadyBound();
    error EmergencyHalted(BetTypes420.EmergencyDomain domain, bytes32 subject);

    event WagerAcceptanceCompleted(
        bytes32 indexed wagerId,
        address indexed player,
        bytes32 indexed gameVersionId,
        bytes32 vaultId,
        uint256 stake,
        uint256 maxGrossPayout,
        uint256 reservedLiability,
        uint256 nonce
    );
    event EmergencyStateBound(address indexed emergencyState);

    constructor(
        address authorization_,
        address games_,
        address modules_,
        address operators_,
        address profiles_,
        address accessPolicy_,
        address riskManager_,
        address betRegistry_,
        address vault_
    ) {
        if (
            authorization_ == address(0) || games_ == address(0) || modules_ == address(0)
                || operators_ == address(0) || profiles_ == address(0) || accessPolicy_ == address(0)
                || riskManager_ == address(0) || betRegistry_ == address(0) || vault_ == address(0)
        ) revert ZeroAddress();
        authorization = BetAuthorization420(authorization_);
        games = BetGameRegistry420(games_);
        modules = BetModuleRegistry420(modules_);
        operators = BetOperatorRegistry420(operators_);
        profiles = BetProfileRegistry420(profiles_);
        accessPolicy = BetAccessPolicy420(accessPolicy_);
        riskManager = RiskManager420(riskManager_);
        betRegistry = BetRegistry420(betRegistry_);
        vault = BankrollVault420(payable(vault_));
        vaultId = BankrollVault420(payable(vault_)).vaultId();
        asset = BankrollVault420(payable(vault_)).asset();
    }

    modifier nonReentrant() {
        if (_entered != 0) revert Reentrancy();
        _entered = 1;
        _;
        _entered = 0;
    }

    function systemName() external pure returns (string memory) { return "WagerRouter420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    /// @notice One-time binding of the canonical emergency-state contract.
    /// @dev Binding itself is capability-scoped. Once installed it cannot be replaced or removed.
    function bindEmergencyState(address emergencyState_) external {
        if (emergencyState_ == address(0)) revert ZeroAddress();
        if (address(emergencyState) != address(0)) revert EmergencyAlreadyBound();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_EMERGENCY_SET, authorization.scopeGlobal(), 0)) {
            revert Unauthorized();
        }
        emergencyState = BetEmergencyState420(emergencyState_);
        emit EmergencyStateBound(emergencyState_);
    }

    function placeWager(AcceptanceRequest calldata request)
        external
        payable
        nonReentrant
        returns (bytes32 wagerId, uint256 reservedLiability)
    {
        if (
            request.operatorId == bytes32(0) || request.gameVersionId == bytes32(0) || request.stake == 0
                || request.maxGrossPayout < request.stake || request.deadline <= block.timestamp
        ) revert InvalidRequest();

        BetGameRegistry420.GameVersion memory game = games.getGame(request.gameVersionId);
        if (game.status != BetGameRegistry420.GameStatus.ACTIVE) revert InactiveGame();
        if (!modules.isApproved(game.moduleVersionId)) revert InactiveModule();
        if (!operators.isActive(request.operatorId)) revert InactiveOperator();
        _requireProfileActive(game.randomnessProfileId);
        _requireProfileActive(game.riskProfileId);
        _requireProfileActive(game.settlementProfileId);
        _requireProfileActive(game.accessPolicyId);
        _requireAcceptanceOpen(game.gameId, game.gameVersionId);

        if (
            !authorization.isAuthorized(
                msg.sender,
                BetIds420.ACTION_PLACE,
                authorization.scopeForGame(game.gameId, game.gameVersionId),
                request.stake
            )
        ) revert Unauthorized();

        // Access/RG consumption is deliberately before nonce use, escrow, and risk reservation.
        // Any downstream revert rolls this accounting back atomically with the wager attempt.
        accessPolicy.validateAndRecord(game.accessPolicyId, msg.sender, asset, request.stake);

        uint256 nonce = nextNonce[msg.sender];
        nextNonce[msg.sender] = nonce + 1;
        wagerId = keccak256(
            abi.encode(
                "420.BET.WAGER.V1",
                block.chainid,
                address(this),
                msg.sender,
                nonce,
                game.gameVersionId,
                request.operatorId,
                request.paramsHash
            )
        );

        if (asset == address(0)) {
            if (msg.value != request.stake) revert WrongValue();
            vault.escrowWagerStakeNative{value: request.stake}(wagerId, msg.sender);
        } else {
            if (msg.value != 0) revert WrongValue();
            vault.escrowWagerStakeToken(wagerId, msg.sender, request.stake);
        }

        reservedLiability = riskManager.reserveExposure(
            wagerId,
            vaultId,
            game.gameVersionId,
            game.riskProfileId,
            request.stake,
            request.maxGrossPayout,
            request.correlationKey
        );
        uint256 expectedLiability = request.maxGrossPayout - request.stake;
        if (reservedLiability != expectedLiability) revert InvalidLiability();

        BetTypes420.Wager memory wager = BetTypes420.Wager({
            wagerId: wagerId,
            player: msg.sender,
            operatorId: request.operatorId,
            gameId: game.gameId,
            gameVersionId: game.gameVersionId,
            asset: asset,
            stake: request.stake,
            maxGrossPayout: request.maxGrossPayout,
            paramsHash: request.paramsHash,
            vaultId: vaultId,
            randomnessProfileId: game.randomnessProfileId,
            riskProfileId: game.riskProfileId,
            settlementProfileId: game.settlementProfileId,
            accessPolicyId: game.accessPolicyId,
            rulesetId: game.rulesetId,
            acceptedAt: 0,
            deadline: request.deadline,
            status: BetTypes420.WagerStatus.NONE
        });
        betRegistry.recordAccepted(wager);

        emit WagerAcceptanceCompleted(
            wagerId,
            msg.sender,
            game.gameVersionId,
            vaultId,
            request.stake,
            request.maxGrossPayout,
            reservedLiability,
            nonce
        );
    }

    function _requireProfileActive(bytes32 profileId) private view {
        if (!profiles.isActive(profileId)) revert InactiveProfile();
    }

    function _requireAcceptanceOpen(bytes32 gameId, bytes32 gameVersionId) private view {
        BetEmergencyState420 e = emergencyState;
        if (address(e) == address(0)) return;
        _requireNotHalted(e, BetTypes420.EmergencyDomain.NEW_WAGERS, bytes32(0));
        _requireNotHalted(e, BetTypes420.EmergencyDomain.GAME, gameId);
        _requireNotHalted(e, BetTypes420.EmergencyDomain.GAME_VERSION, gameVersionId);
        _requireNotHalted(e, BetTypes420.EmergencyDomain.VAULT_NEW_RISK, vaultId);
    }

    function _requireNotHalted(BetEmergencyState420 e, BetTypes420.EmergencyDomain domain, bytes32 subject) private view {
        if (e.isHalted(domain, subject)) revert EmergencyHalted(domain, subject);
    }
}

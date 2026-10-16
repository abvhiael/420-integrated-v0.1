// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BankrollVault420.sol";
import "./BetAccessPolicy420.sol";
import "./BetAuthorization420.sol";
import "./BetEconomics420.sol";
import "./BetEmergencyState420.sol";
import "./BetGameRegistry420.sol";
import "./BetIds420.sol";
import "./BetModuleRegistry420.sol";
import "./BetOperatorRegistry420.sol";
import "./BetProfileRegistry420.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";
import "./RiskManager420.sol";
import "./KenoV1420.sol";
import "./KenoPaytableAuthority420.sol";
import "./PlinkoV1420.sol";
import "./PlinkoPaytableAuthority420.sol";
import "./ReferenceSlotV1420.sol";
import "./ReferenceSlotTermsAuthority420.sol";
import "./RouletteV1420.sol";
import "./BlackjackV1420.sol";

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
    BetEconomics420 public immutable economics;
    RiskManager420 public immutable riskManager;
    BetRegistry420 public immutable betRegistry;
    BankrollVault420 public immutable vault;
    bytes32 public immutable vaultId;
    address public immutable asset;
    BetEmergencyState420 public emergencyState;
    bytes32 private constant KENO_GAME_ID = keccak256("420BET.GAME.KENO");
    mapping(bytes32 => address) public kenoAuthority;
    mapping(bytes32 => address) public kenoResolver;
    bytes32 private constant PLINKO_GAME_ID = keccak256("420BET.GAME.PLINKO");
    mapping(bytes32 => address) public plinkoAuthority;
    mapping(bytes32 => address) public plinkoResolver;
    bytes32 private constant SLOT_GAME_ID = keccak256("420BET.GAME.SLOT");
    mapping(bytes32 => address) public slotTermsAuthority;
    mapping(bytes32 => address) public slotResolver;
    bytes32 private constant ROULETTE_GAME_ID = keccak256("420BET.GAME.ROULETTE");
    mapping(bytes32 => address) public rouletteResolver;
    bytes32 private constant BLACKJACK_GAME_ID = keccak256("420BET.GAME.BLACKJACK");
    mapping(bytes32 => address) public blackjackResolver;

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
    error KenoAuthorityRequired();
    error KenoAuthorityAlreadyBound();
    error PlinkoAuthorityRequired();
    error PlinkoAuthorityAlreadyBound();
    error SlotAuthorityRequired();
    error SlotAuthorityAlreadyBound();
    error RouletteCanonicalWagerRequired();
    error RouletteResolverAlreadyBound();
    error BlackjackCanonicalWagerRequired();
    error BlackjackResolverAlreadyBound();
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
        address economics_,
        address riskManager_,
        address betRegistry_,
        address vault_
    ) {
        if (
            authorization_ == address(0) || games_ == address(0) || modules_ == address(0)
                || operators_ == address(0) || profiles_ == address(0) || accessPolicy_ == address(0)
                || economics_ == address(0) || riskManager_ == address(0) || betRegistry_ == address(0)
                || vault_ == address(0)
        ) revert ZeroAddress();
        authorization = BetAuthorization420(authorization_);
        games = BetGameRegistry420(games_);
        modules = BetModuleRegistry420(modules_);
        operators = BetOperatorRegistry420(operators_);
        profiles = BetProfileRegistry420(profiles_);
        accessPolicy = BetAccessPolicy420(accessPolicy_);
        economics = BetEconomics420(payable(economics_));
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

    function bindEmergencyState(address emergencyState_) external {
        if (emergencyState_ == address(0)) revert ZeroAddress();
        if (address(emergencyState) != address(0)) revert EmergencyAlreadyBound();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_EMERGENCY_SET, authorization.scopeGlobal(), 0)) {
            revert Unauthorized();
        }
        emergencyState = BetEmergencyState420(emergencyState_);
        emit EmergencyStateBound(emergencyState_);
    }

    /// @notice Governance binds an immutable verifier for a Keno game version.
    function bindKenoPaytable(bytes32 gameVersionId, address resolver, address verifier) external {
        if (resolver == address(0) || verifier == address(0) || gameVersionId == bytes32(0))
            revert InvalidRequest();
        if (kenoAuthority[gameVersionId] != address(0)) revert KenoAuthorityAlreadyBound();
        BetGameRegistry420.GameVersion memory g = games.getGame(gameVersionId);
        if (g.gameId != KENO_GAME_ID ||
            modules.getModule(g.moduleVersionId).implementation != resolver ||
            KenoV1420(resolver).gameVersionId() != gameVersionId ||
            KenoV1420(resolver).rulesetId() != g.rulesetId ||
            KenoPaytableAuthority420(verifier).gameVersionId() != gameVersionId ||
            KenoPaytableAuthority420(verifier).rulesetId() != g.rulesetId)
            revert InvalidRequest();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_GAME_REGISTER,
            authorization.scopeForGame(g.gameId, gameVersionId), 0)) revert Unauthorized();
        kenoAuthority[gameVersionId] = verifier;
        kenoResolver[gameVersionId] = resolver;
    }

    function placeKenoWager(AcceptanceRequest calldata request, KenoV1420.Params calldata params)
        external payable nonReentrant returns (bytes32 wagerId, uint256 reservedLiability)
    {
        BetGameRegistry420.GameVersion memory g=games.getGame(request.gameVersionId);
        if (g.gameId != KENO_GAME_ID) revert InvalidRequest();
        address verifier = kenoAuthority[request.gameVersionId];
        if (verifier == address(0)) revert KenoAuthorityRequired();
        KenoPaytableAuthority420(verifier).verify(
            request.stake, request.maxGrossPayout, request.paramsHash, params,
            kenoResolver[request.gameVersionId]);
        return _placeWager(request);
    }

    /// @notice Bind a single approved Plinko schedule to the registered game module.
    function bindPlinkoPaytable(bytes32 gameVersionId, address resolver, address verifier) external {
        if (gameVersionId == bytes32(0) || resolver == address(0) || verifier == address(0))
            revert InvalidRequest();
        if (plinkoAuthority[gameVersionId] != address(0)) revert PlinkoAuthorityAlreadyBound();
        BetGameRegistry420.GameVersion memory g = games.getGame(gameVersionId);
        if (g.gameId != PLINKO_GAME_ID ||
            modules.getModule(g.moduleVersionId).implementation != resolver ||
            PlinkoV1420(resolver).gameId() != PLINKO_GAME_ID ||
            PlinkoV1420(resolver).gameVersionId() != gameVersionId ||
            PlinkoV1420(resolver).rulesetId() != g.rulesetId ||
            address(PlinkoV1420(resolver).wagerRegistry()) != address(betRegistry) ||
            PlinkoPaytableAuthority420(verifier).gameVersionId() != gameVersionId ||
            PlinkoPaytableAuthority420(verifier).rulesetId() != g.rulesetId)
            revert InvalidRequest();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_GAME_REGISTER,
            authorization.scopeForGame(g.gameId, gameVersionId), 0)) revert Unauthorized();
        plinkoAuthority[gameVersionId] = verifier;
        plinkoResolver[gameVersionId] = resolver;
    }

    function placePlinkoWager(AcceptanceRequest calldata request, PlinkoV1420.Params calldata params)
        external payable nonReentrant returns (bytes32 wagerId, uint256 reservedLiability)
    {
        BetGameRegistry420.GameVersion memory g = games.getGame(request.gameVersionId);
        if (g.gameId != PLINKO_GAME_ID) revert InvalidRequest();
        address verifier = plinkoAuthority[request.gameVersionId];
        if (verifier == address(0)) revert PlinkoAuthorityRequired();
        PlinkoPaytableAuthority420(verifier).verify(request.stake, request.maxGrossPayout,
            request.paramsHash, params, plinkoResolver[request.gameVersionId]);
        return _placeWager(request);
    }

    /// @notice The slot payout, reel and RTP artifact binding is immutable per game version.
    function bindSlotTerms(bytes32 versionId, address resolver, address authority) external {
        if (versionId == bytes32(0) || resolver == address(0) || authority == address(0))
            revert InvalidRequest();
        if (slotTermsAuthority[versionId] != address(0)) revert SlotAuthorityAlreadyBound();
        BetGameRegistry420.GameVersion memory g = games.getGame(versionId);
        ReferenceSlotV1420 s = ReferenceSlotV1420(resolver);
        if (g.gameId != SLOT_GAME_ID ||
            modules.getModule(g.moduleVersionId).implementation != resolver ||
            s.gameId() != SLOT_GAME_ID || s.gameVersionId() != versionId ||
            s.rulesetId() != g.rulesetId || address(s.wagerRegistry()) != address(betRegistry) ||
            ReferenceSlotTermsAuthority420(authority).gameVersionId() != versionId ||
            ReferenceSlotTermsAuthority420(authority).rulesetId() != g.rulesetId)
            revert InvalidRequest();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_GAME_REGISTER,
            authorization.scopeForGame(g.gameId, versionId), 0)) revert Unauthorized();
        slotTermsAuthority[versionId] = authority;
        slotResolver[versionId] = resolver;
    }

    function placeSlotWager(AcceptanceRequest calldata request, ReferenceSlotV1420.Params calldata params)
        external payable nonReentrant returns (bytes32 wagerId, uint256 reservedLiability)
    {
        BetGameRegistry420.GameVersion memory g = games.getGame(request.gameVersionId);
        if (g.gameId != SLOT_GAME_ID) revert InvalidRequest();
        address authority = slotTermsAuthority[request.gameVersionId];
        if (authority == address(0)) revert SlotAuthorityRequired();
        ReferenceSlotTermsAuthority420(authority).verify(request.stake, request.maxGrossPayout,
            request.paramsHash, params, slotResolver[request.gameVersionId]);
        return _placeWager(request);
    }

    /// @notice Governance-authorized, immutable game-version binding to the canonical roulette module.
    function bindRouletteResolver(bytes32 versionId, address resolver) external {
        if (versionId == bytes32(0) || resolver == address(0)) revert InvalidRequest();
        if (rouletteResolver[versionId] != address(0)) revert RouletteResolverAlreadyBound();
        BetGameRegistry420.GameVersion memory g = games.getGame(versionId);
        RouletteV1420 r = RouletteV1420(resolver);
        if (g.gameId != ROULETTE_GAME_ID ||
            modules.getModule(g.moduleVersionId).implementation != resolver ||
            r.gameId() != ROULETTE_GAME_ID || r.gameVersionId() != versionId ||
            r.rulesetId() != g.rulesetId || address(r.wagerRegistry()) != address(betRegistry))
            revert InvalidRequest();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_GAME_REGISTER,
            authorization.scopeForGame(g.gameId, versionId), 0)) revert Unauthorized();
        rouletteResolver[versionId] = resolver;
    }

    /// @notice Fail closed before nonce consumption, stake transfer or risk reservation.
    function placeRouletteWager(AcceptanceRequest calldata request, RouletteV1420.Params calldata params)
        external payable nonReentrant returns (bytes32 wagerId, uint256 reservedLiability)
    {
        BetGameRegistry420.GameVersion memory g = games.getGame(request.gameVersionId);
        if (g.gameId != ROULETTE_GAME_ID) revert InvalidRequest();
        address resolver = rouletteResolver[request.gameVersionId];
        if (resolver == address(0)) revert RouletteCanonicalWagerRequired();
        RouletteV1420 r = RouletteV1420(resolver);
        if (r.hashParams(params) != request.paramsHash ||
            r.requiredMaxGrossPayout(request.stake, params) != request.maxGrossPayout)
            revert InvalidRequest();
        return _placeWager(request);
    }

    /// @notice Each Blackjack version is bound exactly once to its registered resolver.
    function bindBlackjackResolver(bytes32 versionId, address resolver) external {
        if (versionId == bytes32(0) || resolver == address(0)) revert InvalidRequest();
        if (blackjackResolver[versionId] != address(0)) revert BlackjackResolverAlreadyBound();
        BetGameRegistry420.GameVersion memory g = games.getGame(versionId);
        BlackjackV1420 b = BlackjackV1420(resolver);
        if (g.gameId != BLACKJACK_GAME_ID ||
            modules.getModule(g.moduleVersionId).implementation != resolver ||
            b.gameId() != BLACKJACK_GAME_ID || b.gameVersionId() != versionId ||
            b.rulesetId() != g.rulesetId || address(b.wagerRegistry()) != address(betRegistry))
            revert InvalidRequest();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_GAME_REGISTER,
            authorization.scopeForGame(g.gameId, versionId), 0)) revert Unauthorized();
        blackjackResolver[versionId] = resolver;
    }

    /// @notice Bind stakes and maximum 3:2-natural reserve before any custody mutation.
    function placeBlackjackWager(AcceptanceRequest calldata request, BlackjackV1420.Params calldata params)
        external payable nonReentrant returns (bytes32 wagerId, uint256 reservedLiability)
    {
        BetGameRegistry420.GameVersion memory g = games.getGame(request.gameVersionId);
        if (g.gameId != BLACKJACK_GAME_ID) revert InvalidRequest();
        address resolver = blackjackResolver[request.gameVersionId];
        if (resolver == address(0)) revert BlackjackCanonicalWagerRequired();
        BlackjackV1420 b = BlackjackV1420(resolver);
        if (b.hashParams(params) != request.paramsHash ||
            b.requiredMaxGrossPayout(request.stake) != request.maxGrossPayout)
            revert InvalidRequest();
        return _placeWager(request);
    }

    function placeWager(AcceptanceRequest calldata request)
        external
        payable
        nonReentrant
        returns (bytes32 wagerId, uint256 reservedLiability)
    {
        bytes32 gameId = games.getGame(request.gameVersionId).gameId;
        if (gameId == KENO_GAME_ID) revert KenoAuthorityRequired();
        if (gameId == PLINKO_GAME_ID) revert PlinkoAuthorityRequired();
        if (gameId == SLOT_GAME_ID) revert SlotAuthorityRequired();
        if (gameId == ROULETTE_GAME_ID) revert RouletteCanonicalWagerRequired();
        if (gameId == BLACKJACK_GAME_ID) revert BlackjackCanonicalWagerRequired();
        return _placeWager(request);
    }

    function _placeWager(AcceptanceRequest calldata request) private
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

        // Fee terms are copied/reserved before stake custody or bankroll liability changes.
        // Any later revert rolls the fee reservation back atomically with the wager attempt.
        economics.bindWager(wagerId, game.gameVersionId, request.operatorId, request.stake);

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

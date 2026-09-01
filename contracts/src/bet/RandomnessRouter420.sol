// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./BetAuthorization420.sol";
import "./BetEmergencyState420.sol";
import "./BetIds420.sol";
import "./BetProfileRegistry420.sol";
import "./BetRegistry420.sol";
import "./BetTypes420.sol";

contract RandomnessRouter420 is I420System {
    bytes32 public constant RANDOMNESS_PROFILE_TYPE = keccak256("RANDOMNESS");
    bytes32 public constant ROOT_DOMAIN = keccak256("420.BET.RANDOMNESS.ROOT.V1");

    enum Method { NONE, THRESHOLD_VRF, COMMIT_REVEAL, EXTERNAL_VRF }
    enum Source { NONE, PRIMARY, FALLBACK }

    struct RandomnessProfile {
        bytes32 profileId;
        Method method;
        address primaryProvider;
        address fallbackProvider;
        uint64 fallbackDelay;
        bytes32 securityLevelHash;
        bytes32 domainSeparator;
        bytes32 manifestHash;
        bool exists;
    }

    struct RandomnessRequest {
        bytes32 wagerId;
        bytes32 profileId;
        bytes32 gameVersionId;
        bytes32 paramsHash;
        bytes32 contextHash;
        uint64 requestedAt;
        uint64 fallbackAt;
        bytes32 root;
        bytes32 proofHash;
        bytes32 entropyHash;
        Source source;
        bool fulfilled;
    }

    BetAuthorization420 public immutable authorization;
    BetProfileRegistry420 public immutable profileRegistry;
    BetRegistry420 public immutable wagerRegistry;
    BetEmergencyState420 public emergencyState;
    mapping(bytes32 => RandomnessProfile) private _profiles;
    mapping(bytes32 => RandomnessRequest) private _requests;

    error ZeroAddress(); error InvalidId(); error InvalidConfiguration(); error AlreadyExists(); error NotFound();
    error Unauthorized(); error ProfileInactive(); error WagerNotEligible(); error WagerExpired(); error AlreadyRequested(); error NotRequested();
    error AlreadyFulfilled(); error WrongProvider(); error FallbackNotReady(); error PrimaryExpired(); error InvalidEntropy();
    error EmergencyAlreadyBound();
    error EmergencyHalted(BetTypes420.EmergencyDomain domain, bytes32 subject);

    event RandomnessProfileConfigured(bytes32 indexed profileId, Method method, address indexed primaryProvider, address indexed fallbackProvider, uint64 fallbackDelay, bytes32 securityLevelHash, bytes32 domainSeparator, bytes32 manifestHash);
    event RandomnessRequested(bytes32 indexed wagerId, bytes32 indexed profileId, bytes32 indexed gameVersionId, bytes32 contextHash, uint64 requestedAt, uint64 fallbackAt);
    event RandomnessFulfilled(bytes32 indexed wagerId, bytes32 indexed profileId, Source source, bytes32 root, bytes32 proofHash, bytes32 entropyHash);
    event EmergencyStateBound(address indexed emergencyState);

    constructor(address authorization_, address profileRegistry_, address wagerRegistry_) {
        if (authorization_ == address(0) || profileRegistry_ == address(0) || wagerRegistry_ == address(0)) revert ZeroAddress();
        authorization = BetAuthorization420(authorization_); profileRegistry = BetProfileRegistry420(profileRegistry_); wagerRegistry = BetRegistry420(wagerRegistry_);
    }
    function systemName() external pure returns (string memory) { return "RandomnessRouter420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function bindEmergencyState(address emergencyState_) external {
        if (emergencyState_ == address(0)) revert ZeroAddress();
        if (address(emergencyState) != address(0)) revert EmergencyAlreadyBound();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_EMERGENCY_SET, authorization.scopeGlobal(), 0)) revert Unauthorized();
        emergencyState = BetEmergencyState420(emergencyState_);
        emit EmergencyStateBound(emergencyState_);
    }

    function configureProfile(RandomnessProfile calldata input) external {
        if (input.profileId == bytes32(0)) revert InvalidId();
        if (_profiles[input.profileId].exists) revert AlreadyExists();
        if (!profileRegistry.isActiveOfType(input.profileId, RANDOMNESS_PROFILE_TYPE)) revert ProfileInactive();
        if (input.method == Method.NONE || input.primaryProvider == address(0) || input.fallbackDelay == 0 || input.securityLevelHash == bytes32(0) || input.domainSeparator == bytes32(0) || input.manifestHash == bytes32(0)) revert InvalidConfiguration();
        if (input.fallbackProvider == input.primaryProvider && input.fallbackProvider != address(0)) revert InvalidConfiguration();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_RANDOMNESS_CONFIGURE, authorization.scopeForProfile(input.profileId), 0)) revert Unauthorized();
        RandomnessProfile memory copy = input; copy.exists = true; _profiles[input.profileId] = copy;
        emit RandomnessProfileConfigured(copy.profileId, copy.method, copy.primaryProvider, copy.fallbackProvider, copy.fallbackDelay, copy.securityLevelHash, copy.domainSeparator, copy.manifestHash);
    }

    function requestRandomness(bytes32 wagerId, bytes32 contextHash) external returns (uint64 fallbackAt) {
        if (wagerId == bytes32(0) || contextHash == bytes32(0)) revert InvalidId();
        if (_requests[wagerId].wagerId != bytes32(0)) revert AlreadyRequested();
        BetTypes420.Wager memory wager = wagerRegistry.getWager(wagerId);
        if (wager.status != BetTypes420.WagerStatus.ACCEPTED) revert WagerNotEligible();
        if (block.timestamp >= wager.deadline) revert WagerExpired();
        RandomnessProfile storage profile = _getProfile(wager.randomnessProfileId);
        if (!profileRegistry.isActiveOfType(profile.profileId, RANDOMNESS_PROFILE_TYPE)) revert ProfileInactive();
        BetEmergencyState420 e = emergencyState;
        if (address(e) != address(0) && e.isHalted(BetTypes420.EmergencyDomain.RANDOMNESS_PROFILE, profile.profileId)) {
            revert EmergencyHalted(BetTypes420.EmergencyDomain.RANDOMNESS_PROFILE, profile.profileId);
        }
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_RANDOMNESS_REQUEST, authorization.scopeForWager(wagerId), 0)) revert Unauthorized();
        uint64 requestedAt = uint64(block.timestamp); fallbackAt = requestedAt + profile.fallbackDelay;
        _requests[wagerId] = RandomnessRequest(wagerId, profile.profileId, wager.gameVersionId, wager.paramsHash, contextHash, requestedAt, fallbackAt, bytes32(0), bytes32(0), bytes32(0), Source.NONE, false);
        emit RandomnessRequested(wagerId, profile.profileId, wager.gameVersionId, contextHash, requestedAt, fallbackAt);
    }

    function fulfillPrimary(bytes32 wagerId, bytes32 entropy, bytes32 proofHash) external returns (bytes32) { return _fulfill(wagerId, entropy, proofHash, Source.PRIMARY); }
    function fulfillFallback(bytes32 wagerId, bytes32 entropy, bytes32 proofHash) external returns (bytes32) { return _fulfill(wagerId, entropy, proofHash, Source.FALLBACK); }
    function getProfile(bytes32 profileId) external view returns (RandomnessProfile memory) { return _getProfile(profileId); }
    function getRequest(bytes32 wagerId) external view returns (RandomnessRequest memory r) { r = _requests[wagerId]; if (r.wagerId == bytes32(0)) revert NotRequested(); }
    function rootOf(bytes32 wagerId) external view returns (bytes32) { RandomnessRequest storage r = _requests[wagerId]; if (!r.fulfilled) revert NotFound(); return r.root; }

    function _fulfill(bytes32 wagerId, bytes32 entropy, bytes32 proofHash, Source source) private returns (bytes32 root) {
        if (entropy == bytes32(0) || proofHash == bytes32(0)) revert InvalidEntropy();
        RandomnessRequest storage request = _requests[wagerId];
        if (request.wagerId == bytes32(0)) revert NotRequested();

        bytes32 entropyHash = keccak256(abi.encode(entropy));
        if (request.fulfilled) {
            if (request.source == source && request.proofHash == proofHash && request.entropyHash == entropyHash) return request.root;
            revert AlreadyFulfilled();
        }

        RandomnessProfile storage profile = _getProfile(request.profileId);
        if (msg.sender != _expectedProvider(profile, request.fallbackAt, source)) revert WrongProvider();
        if (!authorization.isAuthorized(msg.sender, BetIds420.ACTION_RANDOMNESS_FULFILL, authorization.scopeForWager(wagerId), 0)) revert Unauthorized();

        // Fulfilment deliberately remains available while RANDOMNESS_PROFILE is halted.
        // A halt stops new requests; it must not strand a request that was already committed.
        // If fulfilment arrives after the wager deadline, the root remains auditable but
        // SettlementEngine420 only permits the deterministic VOID terminal path.
        root = _deriveRoot(wagerId, request, profile, source, entropy, proofHash);
        request.root = root;
        request.proofHash = proofHash;
        request.entropyHash = entropyHash;
        request.source = source;
        request.fulfilled = true;
        emit RandomnessFulfilled(wagerId, request.profileId, source, root, proofHash, entropyHash);
    }

    function _expectedProvider(RandomnessProfile storage profile, uint64 fallbackAt, Source source) private view returns (address expected) {
        if (source == Source.PRIMARY) {
            if (profile.fallbackProvider != address(0) && block.timestamp >= fallbackAt) revert PrimaryExpired();
            return profile.primaryProvider;
        }
        if (source == Source.FALLBACK) {
            if (profile.fallbackProvider == address(0)) revert WrongProvider();
            if (block.timestamp < fallbackAt) revert FallbackNotReady();
            return profile.fallbackProvider;
        }
        revert WrongProvider();
    }

    function _deriveRoot(
        bytes32 wagerId,
        RandomnessRequest storage request,
        RandomnessProfile storage profile,
        Source source,
        bytes32 entropy,
        bytes32 proofHash
    ) private view returns (bytes32) {
        return keccak256(abi.encode(
            ROOT_DOMAIN,
            block.chainid,
            address(this),
            wagerId,
            request.gameVersionId,
            request.paramsHash,
            request.contextHash,
            request.profileId,
            profile.method,
            profile.securityLevelHash,
            profile.domainSeparator,
            profile.primaryProvider,
            profile.fallbackProvider,
            profile.fallbackDelay,
            source,
            entropy,
            proofHash
        ));
    }

    function _getProfile(bytes32 profileId) private view returns (RandomnessProfile storage p) { p = _profiles[profileId]; if (!p.exists) revert NotFound(); }
}

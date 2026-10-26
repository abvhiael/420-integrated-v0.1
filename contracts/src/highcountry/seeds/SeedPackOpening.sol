// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { IRandomnessRouter420 } from "../../interfaces/IRandomnessRouter420.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { IEmergencyState } from "../interfaces/IEmergencyState.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

interface IPersistentSeedRandomness is IRandomnessRouter420 {
    function requestPersistentRandomness(
        bytes32 profile,
        bytes32 domain,
        bytes32 purpose,
        uint64 deadline
    ) external returns (bytes32);
    function persistentRequest(
        bytes32 id
    ) external view returns (bool);
}

/// @notice One irreversible request per admitted pack key. No cancel, refund, alternate request or raw entropy API.
contract SeedPackOpening {
    error InvalidOpening();
    error Restricted();
    error UnverifiedRandomness();
    bytes32 public constant MODULE = keccak256("HC.MODULE.SEED_PACK_OPENING.V1");
    bytes32 public constant REQUEST = keccak256("HC.ACTION.SEED_PACK_OPENING.REQUEST.V1");
    bytes32 public constant DOMAIN = keccak256("HC.RANDOM.SEED_PACK.V1");
    bytes32 public constant TIER_DRAW = keccak256("HC.SEED.TIER.V1");
    bytes32 public constant CULTIVAR_DRAW = keccak256("HC.SEED.CULTIVAR.V1");
    IPersistentSeedRandomness public immutable router;
    IHighCountryAuthorization public immutable authorization;
    IEmergencyState public immutable emergencyState;
    bytes32 public immutable gameId;
    bytes32 public immutable policyHash;
    bytes32 public immutable profileId;
    uint64 public immutable timeoutSeconds;
    bytes32[4] private _poolHashes;
    uint16[3][4] private _poolSizes;

    struct Opening {
        bytes32 commitment;
        address owner;
        uint8 pool;
        bytes32 requestId;
        uint8 tier;
        uint16 index;
        bytes32 entropy;
        bytes32 proofHash;
        bool fulfilled;
    }
    mapping(bytes32 => Opening) private _openings;
    event OpeningRequested(
        bytes32 indexed packKey, bytes32 indexed requestId, address indexed owner, bytes32 commitment, uint8 pool
    );
    event OpeningFulfilled(
        bytes32 indexed packKey, bytes32 indexed requestId, uint8 tier, uint16 index, bytes32 proofHash
    );

    constructor(
        address router_,
        address authorization_,
        address emergency_,
        bytes32 game_,
        bytes32 policy_,
        bytes32 profile_,
        uint64 timeout_,
        bytes32[4] memory hashes,
        uint16[3][4] memory sizes
    ) {
        if (
            router_.code.length == 0 || authorization_.code.length == 0 || emergency_.code.length == 0 || game_ == 0
                || policy_ == 0 || profile_ == 0 || timeout_ == 0
        ) revert InvalidOpening();
        router = IPersistentSeedRandomness(router_);
        authorization = IHighCountryAuthorization(authorization_);
        emergencyState = IEmergencyState(emergency_);
        if (emergencyState.authorizationRoot() != authorization_) revert InvalidOpening();
        gameId = game_;
        policyHash = policy_;
        profileId = profile_;
        timeoutSeconds = timeout_;
        for (uint256 i; i < 4; i++) {
            if (hashes[i] == 0) revert InvalidOpening();
            _poolHashes[i] = hashes[i];
            for (uint256 j; j < 3; j++) {
                if (sizes[i][j] == 0 || sizes[i][j] > 65) revert InvalidOpening();
                _poolSizes[i][j] = sizes[i][j];
            }
        }
    }

    function poolHash(
        uint8 pool
    ) external view returns (bytes32) {
        if (pool > 3) revert InvalidOpening();
        return _poolHashes[pool];
    }

    function poolSize(
        uint8 pool,
        uint8 tier
    ) external view returns (uint16) {
        if (pool > 3 || tier > 2) revert InvalidOpening();
        return _poolSizes[pool][tier];
    }

    function getOpening(
        bytes32 key
    ) external view returns (Opening memory) {
        return _openings[key];
    }

    function purpose(
        bytes32 key,
        address owner,
        uint8 pool,
        bytes32 commitment
    ) public view returns (bytes32) {
        if (pool > 3) revert InvalidOpening();
        return keccak256(abi.encode(DOMAIN, gameId, policyHash, key, owner, pool, _poolHashes[pool], commitment));
    }

    function _open() private view {
        if (
            emergencyState.isRestricted(keccak256("HC.EMERGENCY.MARKET"))
                || emergencyState.isRestricted(keccak256("HC.EMERGENCY.RANDOMNESS_REQUEST"))
        ) revert Restricted();
    }

    function requestOpening(
        bytes32 key,
        address owner,
        uint8 pool,
        bytes32 commitment
    ) external returns (bytes32) {
        if (key == 0 || owner == address(0) || pool > 3 || commitment == 0) revert InvalidOpening();
        authorization.requireAuthorized(AuthorizationRequest(msg.sender, MODULE, REQUEST, key, 0));
        Opening storage o = _openings[key];
        if (o.commitment != 0) {
            if (o.owner != owner || o.pool != pool || o.commitment != commitment) revert InvalidOpening();
            return o.requestId;
        }
        _open();
        uint256 deadline = block.timestamp + timeoutSeconds;
        if (deadline > type(uint64).max) revert InvalidOpening();
        o.commitment = commitment;
        o.owner = owner;
        o.pool = pool;
        bytes32 id =
            router.requestPersistentRandomness(
            profileId, DOMAIN, purpose(key, owner, pool, commitment), uint64(deadline)
        );
        IRandomnessRouter420.Request memory r = router.request(id);
        if (
            id == 0 || !router.persistentRequest(id) || r.requester != address(this) || r.profileId != profileId
                || r.domain != DOMAIN || r.purpose != purpose(key, owner, pool, commitment) || r.deadline != deadline
                || r.securityTier < 2 || r.fallbackPolicy != 0 || r.status != IRandomnessRouter420.Status.REQUESTED
        ) revert UnverifiedRandomness();
        o.requestId = id;
        emit OpeningRequested(key, id, owner, commitment, pool);
        return id;
    }

    /// @dev Rejection sampling removes modulo bias. Counter expansion is deterministic within one entropy root.
    function uniform(
        bytes32 entropy,
        bytes32 requestId,
        bytes32 domain,
        uint256 bound
    ) public pure returns (uint256) {
        if (entropy == 0 || requestId == 0 || bound == 0 || bound > 65) revert InvalidOpening();
        for (uint256 counter; counter < 256; counter++) {
            uint256 value = uint256(keccak256(abi.encode(entropy, requestId, domain, counter)));
            (bool accepted, uint256 ticket) = reduce(value, bound);
            if (accepted) return ticket;
        }
        revert UnverifiedRandomness(); // Same committed draw remains recoverable; never substitute another request.
    }

    function reduce(
        uint256 value,
        uint256 bound
    ) public pure returns (bool, uint256) {
        if (bound == 0 || bound > 65) revert InvalidOpening();
        uint256 threshold;
        unchecked {
            threshold = (0 - bound) % bound;
        }
        return (value >= threshold, value % bound);
    }

    function tierForTicket(
        uint256 ticket
    ) public pure returns (uint8) {
        if (ticket >= 10) revert InvalidOpening();
        return ticket < 6 ? 0 : ticket < 9 ? 1 : 2;
    }

    function fulfillOpening(
        bytes32 key
    ) external returns (uint8, uint16) {
        Opening storage o = _openings[key];
        if (o.requestId == 0) revert InvalidOpening();
        if (o.fulfilled) return (o.tier, o.index);
        _open();
        IRandomnessRouter420.Request memory r = router.request(o.requestId);
        if (
            r.status != IRandomnessRouter420.Status.FULFILLED || r.requester != address(this)
                || r.profileId != profileId || r.domain != DOMAIN
                || r.purpose != purpose(key, o.owner, o.pool, o.commitment) || !router.persistentRequest(o.requestId)
                || r.securityTier < 2 || r.fallbackPolicy != 0
        ) revert UnverifiedRandomness();
        (bytes32 entropy, bytes32 proof) = router.result(o.requestId);
        if (entropy == 0 || proof == 0) revert UnverifiedRandomness();
        uint8 tier = tierForTicket(uniform(entropy, o.requestId, TIER_DRAW, 10));
        uint16 index = uint16(uniform(entropy, o.requestId, CULTIVAR_DRAW, _poolSizes[o.pool][tier]));
        o.tier = tier;
        o.index = index;
        o.entropy = entropy;
        o.proofHash = proof;
        o.fulfilled = true;
        emit OpeningFulfilled(key, o.requestId, tier, index, proof);
        return (tier, index);
    }
}

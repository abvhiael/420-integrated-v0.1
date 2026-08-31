// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "../interfaces/IRandomnessRouter420.sol";
import "../interfaces/IRandomnessVerifier420.sol";
import "./RandomnessIds420.sol";
import "./RandomnessProfileRegistry420.sol";
import "./RandomnessRouteRegistry420.sol";
import "./RandomnessRegistry.sol";

/// @notice Canonical application-facing router for generalized 420Random.
/// @dev Requests bind profile, domain, purpose, exact route implementations and fallback policy before entropy exists.
contract RandomnessRouter420 is I420System, IRandomnessRouter420 {
    RandomnessProfileRegistry420 public immutable profileRegistry;
    RandomnessRouteRegistry420 public immutable routeRegistry;
    RandomnessRegistry public immutable randomnessRegistry;

    mapping(address => uint256) public requesterNonce;
    mapping(bytes32 => Request) private _requests;

    error InvalidRequest();
    error InvalidProfile();
    error InvalidRoute();
    error InvalidDeadline();
    error UnknownRequest();
    error WrongStatus();
    error UnauthorizedOperator();
    error InvalidProof();
    error PrimaryWindowElapsed();
    error FallbackUnavailable();
    error FallbackTooEarly();
    error RequestExpired();
    error DeadlineNotReached();

    event RandomnessRequestCreated(
        bytes32 indexed requestId,
        address indexed requester,
        bytes32 indexed profileId,
        uint32 profileRevision,
        bytes32 domain,
        bytes32 purpose,
        bytes32 primaryRoute,
        bytes32 fallbackRoute,
        uint64 primaryDeadline,
        uint64 deadline,
        uint8 securityTier,
        uint8 fallbackPolicy
    );
    event RandomnessFallbackActivated(bytes32 indexed requestId, bytes32 indexed fallbackRoute);
    event RandomnessRequestVoided(bytes32 indexed requestId);
    event RandomnessResolved(
        bytes32 indexed requestId,
        bytes32 indexed routeId,
        bytes32 randomness,
        bytes32 proofHash
    );

    constructor(address profileRegistry_, address routeRegistry_, address randomnessRegistry_) {
        if (profileRegistry_ == address(0) || routeRegistry_ == address(0) || randomnessRegistry_ == address(0)) {
            revert InvalidRequest();
        }
        profileRegistry = RandomnessProfileRegistry420(profileRegistry_);
        routeRegistry = RandomnessRouteRegistry420(routeRegistry_);
        randomnessRegistry = RandomnessRegistry(randomnessRegistry_);
    }

    function systemName() external pure returns (string memory) { return "RandomnessRouter420"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    function requestRandomness(bytes32 profileId, bytes32 domain, bytes32 purpose, uint64 deadline)
        external returns (bytes32 requestId)
    {
        if (profileId == bytes32(0) || domain == bytes32(0) || purpose == bytes32(0)) revert InvalidRequest();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        RandomnessProfileRegistry420.Profile memory profile_ = profileRegistry.profile(profileId);
        if (!profile_.active || profile_.revision == 0) revert InvalidProfile();
        if (uint256(deadline) > block.timestamp + profile_.maxTimeoutSeconds) revert InvalidDeadline();

        RandomnessRouteRegistry420.Route memory primary = routeRegistry.route(profile_.primaryRoute);
        if (!primary.active || primary.revision == 0 || primary.operator == address(0) || primary.verifier == address(0)) {
            revert InvalidRoute();
        }

        RandomnessRouteRegistry420.Route memory fallback_;
        if (profile_.fallbackPolicy == RandomnessIds420.FALLBACK_VOID) {
            if (profile_.fallbackRoute != bytes32(0)) revert InvalidProfile();
        } else if (profile_.fallbackPolicy == RandomnessIds420.FALLBACK_ONCE_THEN_VOID) {
            if (profile_.fallbackRoute == bytes32(0)) revert InvalidProfile();
            fallback_ = routeRegistry.route(profile_.fallbackRoute);
            if (!fallback_.active || fallback_.revision == 0 || fallback_.operator == address(0) || fallback_.verifier == address(0)) {
                revert InvalidRoute();
            }
        } else {
            revert InvalidProfile();
        }

        uint64 primaryDeadline = deadline;
        if (profile_.fallbackPolicy == RandomnessIds420.FALLBACK_ONCE_THEN_VOID) {
            uint256 configuredPrimaryDeadline = block.timestamp + profile_.primaryTimeoutSeconds;
            if (configuredPrimaryDeadline < deadline) primaryDeadline = uint64(configuredPrimaryDeadline);
        }

        uint256 nonce = requesterNonce[msg.sender]++;
        requestId = keccak256(
            abi.encode(
                RandomnessIds420.REQUEST_TYPEHASH,
                block.chainid,
                address(this),
                msg.sender,
                nonce,
                profileId,
                profile_.revision,
                domain,
                purpose,
                deadline
            )
        );
        if (_requests[requestId].status != Status.NONE) revert InvalidRequest();

        Request storage request_ = _requests[requestId];
        request_.requester = msg.sender;
        request_.profileId = profileId;
        request_.profileRevision = profile_.revision;
        request_.domain = domain;
        request_.purpose = purpose;
        request_.primaryRoute = profile_.primaryRoute;
        request_.fallbackRoute = profile_.fallbackRoute;
        request_.primaryRouteRevision = primary.revision;
        request_.fallbackRouteRevision = fallback_.revision;
        request_.primaryOperator = primary.operator;
        request_.fallbackOperator = fallback_.operator;
        request_.primaryVerifier = primary.verifier;
        request_.fallbackVerifier = fallback_.verifier;
        request_.primaryMethod = primary.methodId;
        request_.fallbackMethod = fallback_.methodId;
        request_.requestedAt = uint64(block.timestamp);
        request_.primaryDeadline = primaryDeadline;
        request_.deadline = deadline;
        request_.securityTier = profile_.securityTier;
        request_.fallbackPolicy = profile_.fallbackPolicy;
        request_.status = Status.REQUESTED;

        bytes32 bindingHash = keccak256(abi.encode(requestId, request_));
        randomnessRegistry.recordRequest(requestId, bindingHash, uint64(block.timestamp));

        emit RandomnessRequestCreated(
            requestId,
            msg.sender,
            profileId,
            profile_.revision,
            domain,
            purpose,
            profile_.primaryRoute,
            profile_.fallbackRoute,
            primaryDeadline,
            deadline,
            profile_.securityTier,
            profile_.fallbackPolicy
        );
    }

    function fulfillRandomness(bytes32 requestId, bytes32 providerRandomness, bytes calldata proof) external {
        Request storage request_ = _requests[requestId];
        if (request_.status == Status.NONE) revert UnknownRequest();
        if (request_.status != Status.REQUESTED && request_.status != Status.FALLBACK_ACTIVE) revert WrongStatus();
        if (block.timestamp > request_.deadline) revert RequestExpired();

        bytes32 routeId;
        uint32 routeRevision;
        address operator;
        address verifier;
        bytes32 methodId;

        if (request_.status == Status.REQUESTED) {
            if (block.timestamp > request_.primaryDeadline) revert PrimaryWindowElapsed();
            routeId = request_.primaryRoute;
            routeRevision = request_.primaryRouteRevision;
            operator = request_.primaryOperator;
            verifier = request_.primaryVerifier;
            methodId = request_.primaryMethod;
        } else {
            routeId = request_.fallbackRoute;
            routeRevision = request_.fallbackRouteRevision;
            operator = request_.fallbackOperator;
            verifier = request_.fallbackVerifier;
            methodId = request_.fallbackMethod;
        }

        if (msg.sender != operator) revert UnauthorizedOperator();
        bool valid = IRandomnessVerifier420(verifier).verifyRandomness(
            requestId,
            request_.domain,
            request_.purpose,
            providerRandomness,
            proof
        );
        if (!valid) revert InvalidProof();

        bytes32 randomness = keccak256(
            abi.encode(
                RandomnessIds420.ROOT_TYPEHASH,
                block.chainid,
                address(this),
                requestId,
                request_.profileId,
                request_.profileRevision,
                routeId,
                routeRevision,
                methodId,
                providerRandomness
            )
        );
        bytes32 proofHash = keccak256(proof);

        request_.status = Status.FULFILLED;
        randomnessRegistry.recordResult(requestId, routeId, randomness, proofHash, uint64(block.timestamp));
        emit RandomnessResolved(requestId, routeId, randomness, proofHash);
    }

    function activateFallback(bytes32 requestId) external {
        Request storage request_ = _requests[requestId];
        if (request_.status == Status.NONE) revert UnknownRequest();
        if (request_.status != Status.REQUESTED) revert WrongStatus();
        if (
            request_.fallbackPolicy != RandomnessIds420.FALLBACK_ONCE_THEN_VOID ||
            request_.fallbackRoute == bytes32(0)
        ) revert FallbackUnavailable();
        if (block.timestamp <= request_.primaryDeadline) revert FallbackTooEarly();
        if (block.timestamp > request_.deadline) revert RequestExpired();
        request_.status = Status.FALLBACK_ACTIVE;
        emit RandomnessFallbackActivated(requestId, request_.fallbackRoute);
    }

    function voidExpired(bytes32 requestId) external {
        Request storage request_ = _requests[requestId];
        if (request_.status == Status.NONE) revert UnknownRequest();
        if (request_.status != Status.REQUESTED && request_.status != Status.FALLBACK_ACTIVE) revert WrongStatus();
        if (block.timestamp <= request_.deadline) revert DeadlineNotReached();
        request_.status = Status.VOIDED;
        emit RandomnessRequestVoided(requestId);
    }

    function status(bytes32 requestId) external view returns (Status) {
        return _requests[requestId].status;
    }

    function request(bytes32 requestId) external view returns (Request memory) {
        if (_requests[requestId].status == Status.NONE) revert UnknownRequest();
        return _requests[requestId];
    }

    function result(bytes32 requestId) external view returns (bytes32 randomness, bytes32 proofHash) {
        if (_requests[requestId].status == Status.NONE) revert UnknownRequest();
        return randomnessRegistry.result(requestId);
    }
}
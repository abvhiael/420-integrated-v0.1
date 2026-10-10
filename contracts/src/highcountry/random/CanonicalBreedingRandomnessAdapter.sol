// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { IRandomnessRouter420 } from "../../interfaces/IRandomnessRouter420.sol";
import { RandomDomains } from "../constants/RandomDomains.sol";

/// @notice Fail-closed High Country breeding consumer of proof-verified 420 Random.
/// @dev The canonical router freezes governance routes and validates provider proofs.
///      High Country never accepts a raw provider callback as canonical entropy.
contract CanonicalBreedingRandomnessAdapter {
    error Unauthorized();
    error InvalidRequest();
    error UnverifiedRandomness();

    struct Pending {
        bytes32 canonicalId;
        bytes32 domain;
        bytes32 context;
        bool cancelled;
        bool consumed;
    }

    IRandomnessRouter420 public immutable router;
    address public immutable breedingEngine;
    bytes32 public immutable profileId;
    uint64 public immutable timeoutSeconds;
    mapping(bytes32 => Pending) public pending;

    event BreedingRandomnessRouted(bytes32 indexed localId, bytes32 indexed canonicalId);
    event BreedingRandomnessAbandoned(bytes32 indexed localId);
    event BreedingRandomnessConsumed(bytes32 indexed localId, bytes32 indexed canonicalId);

    constructor(address router_, address breedingEngine_, bytes32 profileId_, uint64 timeoutSeconds_) {
        if (
            router_.code.length == 0 || breedingEngine_ == address(0) || profileId_ == bytes32(0)
                || timeoutSeconds_ == 0
        ) revert InvalidRequest();
        router = IRandomnessRouter420(router_);
        breedingEngine = breedingEngine_;
        profileId = profileId_;
        timeoutSeconds = timeoutSeconds_;
    }

    function request(bytes32 localId, bytes32 domain, bytes32 context) external {
        if (msg.sender != breedingEngine) revert Unauthorized();
        if (
            localId == bytes32(0) || context == bytes32(0) || domain != RandomDomains.BREEDING
                || localId != keccak256(abi.encode(domain, context)) || pending[localId].canonicalId != bytes32(0)
        ) revert InvalidRequest();
        uint256 deadline = block.timestamp + uint256(timeoutSeconds);
        if (deadline > type(uint64).max) revert InvalidRequest();
        bytes32 canonicalId = router.requestRandomness(profileId, domain, context, uint64(deadline));
        if (canonicalId == bytes32(0)) revert UnverifiedRandomness();
        IRandomnessRouter420.Request memory bound = router.request(canonicalId);
        if (
            bound.requester != address(this) || bound.profileId != profileId || bound.domain != domain
                || bound.purpose != context || bound.deadline != uint64(deadline)
                || bound.status != IRandomnessRouter420.Status.REQUESTED
        ) revert UnverifiedRandomness();
        pending[localId] = Pending(canonicalId, domain, context, false, false);
        emit BreedingRandomnessRouted(localId, canonicalId);
    }

    function cancel(bytes32 localId) external {
        if (msg.sender != breedingEngine) revert Unauthorized();
        Pending storage p = pending[localId];
        if (p.canonicalId == bytes32(0) || p.cancelled || p.consumed) revert InvalidRequest();
        p.cancelled = true;
        emit BreedingRandomnessAbandoned(localId);
    }

    function consume(bytes32 localId, bytes32 expectedDomain, bytes32 expectedContext)
        external returns (bytes32 entropy)
    {
        if (msg.sender != breedingEngine) revert Unauthorized();
        Pending storage p = pending[localId];
        if (
            p.canonicalId == bytes32(0) || p.cancelled || p.consumed
                || expectedDomain != p.domain || expectedContext != p.context
        ) revert InvalidRequest();
        if (router.status(p.canonicalId) != IRandomnessRouter420.Status.FULFILLED) revert UnverifiedRandomness();
        IRandomnessRouter420.Request memory bound = router.request(p.canonicalId);
        if (
            bound.requester != address(this) || bound.profileId != profileId
                || bound.domain != p.domain || bound.purpose != p.context
                || bound.status != IRandomnessRouter420.Status.FULFILLED
                || block.timestamp > bound.deadline
        ) revert UnverifiedRandomness();
        bytes32 proofHash;
        (entropy, proofHash) = router.result(p.canonicalId);
        if (entropy == bytes32(0) || proofHash == bytes32(0)) revert UnverifiedRandomness();
        p.consumed = true;
        emit BreedingRandomnessConsumed(localId, p.canonicalId);
    }
}

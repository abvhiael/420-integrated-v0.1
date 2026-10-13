// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Explicit immutable-contract replacement manifest; never a proxy or call router.
contract UpgradeCoordinator {
    error Unauthorized();
    error Invalid();
    address public immutable releaseAuthority;
    address public immutable independentReviewer;
    uint64 public constant DELAY = 2 days;

    struct Replacement {
        address oldModule;
        address newModule;
        bytes32 oldCodeHash;
        bytes32 newCodeHash;
        bytes32 migrationHash;
        bytes32 configHash;
        uint64 executableAt;
        bool reviewed;
        bool executed;
        bool cancelled;
    }
    mapping(bytes32 => Replacement) public replacements;
    mapping(address => bool) public consumedReplacement;
    event Proposed(bytes32 indexed id, address indexed oldModule, address indexed newModule, uint64 executableAt);
    event Reviewed(bytes32 indexed id);
    event Cancelled(bytes32 indexed id);
    event Accepted(bytes32 indexed id, address oldModule, address newModule, bytes32 migrationHash, bytes32 configHash);

    constructor(
        address release_,
        address reviewer_
    ) {
        if (release_ == address(0) || reviewer_ == address(0) || release_ == reviewer_) revert Invalid();
        releaseAuthority = release_;
        independentReviewer = reviewer_;
    }

    function propose(
        bytes32 id,
        address oldModule,
        address newModule,
        bytes32 oldHash,
        bytes32 newHash,
        bytes32 migrationHash,
        bytes32 configHash
    ) external {
        if (msg.sender != releaseAuthority) revert Unauthorized();
        if (
            id == bytes32(0) || replacements[id].executableAt != 0 || oldModule == newModule
                || oldModule.code.length == 0 || newModule.code.length == 0 || oldHash == bytes32(0)
                || newHash == bytes32(0) || migrationHash == bytes32(0) || configHash == bytes32(0)
                || consumedReplacement[oldModule] || oldModule.codehash != oldHash || newModule.codehash != newHash
        ) revert Invalid();
        uint64 when_ = uint64(block.timestamp + DELAY);
        replacements[id] =
            Replacement(oldModule, newModule, oldHash, newHash, migrationHash, configHash, when_, false, false, false);
        emit Proposed(id, oldModule, newModule, when_);
    }

    function review(
        bytes32 id
    ) external {
        Replacement storage p = replacements[id];
        if (msg.sender != independentReviewer || p.executableAt == 0 || p.cancelled || p.executed || p.reviewed) {
            revert Unauthorized();
        }
        p.reviewed = true;
        emit Reviewed(id);
    }

    function cancel(
        bytes32 id
    ) external {
        Replacement storage p = replacements[id];
        if (
            (msg.sender != releaseAuthority && msg.sender != independentReviewer) || p.executableAt == 0 || p.executed
                || p.cancelled
        ) revert Unauthorized();
        p.cancelled = true;
        emit Cancelled(id);
    }

    /// @notice Only publishes accepted provenance. Service switching, user consent and migration remain external.
    function accept(
        bytes32 id
    ) external {
        Replacement storage p = replacements[id];
        if (
            msg.sender != releaseAuthority || p.executableAt == 0 || p.cancelled || p.executed || !p.reviewed
                || block.timestamp < p.executableAt || consumedReplacement[p.oldModule]
                || p.oldModule.codehash != p.oldCodeHash || p.newModule.codehash != p.newCodeHash
        ) revert Unauthorized();
        p.executed = true;
        consumedReplacement[p.oldModule] = true;
        emit Accepted(id, p.oldModule, p.newModule, p.migrationHash, p.configHash);
    }
}

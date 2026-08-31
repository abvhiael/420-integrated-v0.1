// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../system/SystemAccess.sol";
import "../interfaces/I420System.sol";

/// @notice Canonical immutable request/result registry for 420Random.
/// @dev This contract is the implementation intended for the frozen RandomnessRegistry predeploy at 0x0428.
contract RandomnessRegistry is SystemAccess, I420System {
    struct Record {
        bytes32 bindingHash;
        bytes32 randomness;
        bytes32 proofHash;
        bytes32 routeId;
        uint64 requestedAt;
        uint64 fulfilledAt;
        bool exists;
        bool fulfilled;
    }

    address public randomnessRouter;
    mapping(bytes32 => Record) private _records;

    error RouterNotBound();
    error RouterAlreadyBound();
    error OnlyRouter();
    error InvalidRequest();
    error RequestAlreadyExists();
    error UnknownRequest();
    error AlreadyFulfilled();
    error InvalidResult();

    event RandomnessRouterBound(address indexed router);
    event RandomnessRequested(bytes32 indexed requestId, bytes32 indexed bindingHash, uint64 requestedAt);
    event RandomnessFulfilled(
        bytes32 indexed requestId,
        bytes32 indexed routeId,
        bytes32 randomness,
        bytes32 proofHash,
        uint64 fulfilledAt
    );

    constructor(address timelock_) SystemAccess(timelock_) {}

    modifier onlyRouter() {
        if (msg.sender != randomnessRouter || randomnessRouter == address(0)) revert OnlyRouter();
        _;
    }

    function systemName() external pure returns (string memory) { return "RandomnessRegistry"; }
    function protocolVersion() external pure returns (uint32) { return 1; }

    /// @notice One-time governance binding to the canonical application-facing router.
    function bindRouter(address router_) external onlyGovernance {
        if (router_ == address(0)) revert RouterNotBound();
        if (randomnessRouter != address(0)) revert RouterAlreadyBound();
        randomnessRouter = router_;
        emit RandomnessRouterBound(router_);
    }

    function recordRequest(bytes32 requestId, bytes32 bindingHash, uint64 requestedAt) external onlyRouter {
        if (requestId == bytes32(0) || bindingHash == bytes32(0) || requestedAt == 0) revert InvalidRequest();
        if (_records[requestId].exists) revert RequestAlreadyExists();
        _records[requestId] = Record({
            bindingHash: bindingHash,
            randomness: bytes32(0),
            proofHash: bytes32(0),
            routeId: bytes32(0),
            requestedAt: requestedAt,
            fulfilledAt: 0,
            exists: true,
            fulfilled: false
        });
        emit RandomnessRequested(requestId, bindingHash, requestedAt);
    }

    function recordResult(
        bytes32 requestId,
        bytes32 routeId,
        bytes32 randomness,
        bytes32 proofHash,
        uint64 fulfilledAt
    ) external onlyRouter {
        Record storage record_ = _records[requestId];
        if (!record_.exists) revert UnknownRequest();
        if (record_.fulfilled) revert AlreadyFulfilled();
        // randomness and proofHash intentionally span the full bytes32 domain, including zero.
        if (routeId == bytes32(0) || fulfilledAt == 0) revert InvalidResult();
        record_.routeId = routeId;
        record_.randomness = randomness;
        record_.proofHash = proofHash;
        record_.fulfilledAt = fulfilledAt;
        record_.fulfilled = true;
        emit RandomnessFulfilled(requestId, routeId, randomness, proofHash, fulfilledAt);
    }

    function record(bytes32 requestId) external view returns (Record memory) {
        return _records[requestId];
    }

    function result(bytes32 requestId) external view returns (bytes32 randomness, bytes32 proofHash) {
        Record storage record_ = _records[requestId];
        if (!record_.exists) revert UnknownRequest();
        if (!record_.fulfilled) return (bytes32(0), bytes32(0));
        return (record_.randomness, record_.proofHash);
    }
}
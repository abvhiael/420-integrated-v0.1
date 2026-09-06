// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import { HCAlreadyExists, HCInvalidId, HCInvalidState, HCNotFound, HCZeroAddress } from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

contract RandomnessCoordinator {
    struct RandomRequest {
        bytes32 id;
        bytes32 domain;
        bytes32 contextHash;
        address requester;
        address provider;
        bytes32 entropy;
        bool fulfilled;
        bool consumed;
        bool exists;
    }

    IHighCountryAuthorization public immutable authorization;
    mapping(bytes32 => RandomRequest) private _requests;

    event RandomnessRequested(bytes32 indexed requestId, bytes32 indexed domain, address indexed requester, bytes32 contextHash);
    event RandomnessFulfilled(bytes32 indexed requestId, address indexed provider, bytes32 entropy);
    event RandomnessConsumed(bytes32 indexed requestId, address indexed requester);

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
    }

    function request(bytes32 requestId, bytes32 domain, bytes32 contextHash) external {
        if (requestId == bytes32(0) || domain == bytes32(0) || contextHash == bytes32(0)) revert HCInvalidId();
        if (_requests[requestId].exists) revert HCAlreadyExists();
        _auth(ActionIds.RANDOMNESS_REQUEST, requestId);
        _requests[requestId] = RandomRequest(requestId, domain, contextHash, msg.sender, address(0), bytes32(0), false, false, true);
        emit RandomnessRequested(requestId, domain, msg.sender, contextHash);
    }

    function fulfill(bytes32 requestId, bytes32 entropy) external {
        if (entropy == bytes32(0)) revert HCInvalidId();
        RandomRequest storage r = _requests[requestId];
        if (!r.exists) revert HCNotFound();
        if (r.fulfilled || r.consumed) revert HCInvalidState();
        _auth(ActionIds.RANDOMNESS_FULFILL, requestId);
        r.provider = msg.sender;
        r.entropy = entropy;
        r.fulfilled = true;
        emit RandomnessFulfilled(requestId, msg.sender, entropy);
    }

    function consume(bytes32 requestId, bytes32 expectedDomain, bytes32 expectedContextHash) external returns (bytes32 entropy) {
        RandomRequest storage r = _requests[requestId];
        if (!r.exists) revert HCNotFound();
        if (!r.fulfilled || r.consumed) revert HCInvalidState();
        if (msg.sender != r.requester || r.domain != expectedDomain || r.contextHash != expectedContextHash) revert HCInvalidState();
        r.consumed = true;
        emit RandomnessConsumed(requestId, msg.sender);
        return r.entropy;
    }

    function result(bytes32 requestId) external view returns (bytes32 entropy, bool fulfilled) {
        RandomRequest memory r = _requests[requestId];
        if (!r.exists) revert HCNotFound();
        return (r.entropy, r.fulfilled);
    }

    function getRequest(bytes32 requestId) external view returns (RandomRequest memory) {
        RandomRequest memory r = _requests[requestId];
        if (!r.exists) revert HCNotFound();
        return r;
    }

    function _auth(bytes32 actionId, bytes32 requestId) private view {
        authorization.requireAuthorized(AuthorizationRequest(msg.sender, ModuleIds.RANDOMNESS_COORDINATOR, actionId, requestId, 0));
    }
}

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
        bytes32 entropy;
        bool fulfilled;
        bool exists;
    }

    IHighCountryAuthorization public immutable authorization;
    mapping(bytes32 => RandomRequest) private _requests;

    event RandomnessRequested(bytes32 indexed requestId, bytes32 indexed domain, address indexed requester, bytes32 contextHash);
    event RandomnessFulfilled(bytes32 indexed requestId, bytes32 entropy);

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
    }

    function request(bytes32 requestId, bytes32 domain, bytes32 contextHash) external {
        if (requestId == bytes32(0) || domain == bytes32(0) || contextHash == bytes32(0)) revert HCInvalidId();
        if (_requests[requestId].exists) revert HCAlreadyExists();
        _auth(ActionIds.RANDOMNESS_REQUEST, requestId);
        _requests[requestId] = RandomRequest(requestId, domain, contextHash, msg.sender, bytes32(0), false, true);
        emit RandomnessRequested(requestId, domain, msg.sender, contextHash);
    }

    function fulfill(bytes32 requestId, bytes32 entropy) external {
        if (entropy == bytes32(0)) revert HCInvalidId();
        RandomRequest storage r = _requests[requestId];
        if (!r.exists) revert HCNotFound();
        if (r.fulfilled) revert HCInvalidState();
        _auth(ActionIds.RANDOMNESS_FULFILL, requestId);
        r.entropy = entropy;
        r.fulfilled = true;
        emit RandomnessFulfilled(requestId, entropy);
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

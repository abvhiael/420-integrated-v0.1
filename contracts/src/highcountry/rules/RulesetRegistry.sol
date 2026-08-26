// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import { ActionIds } from "../constants/ActionIds.sol";
import { ModuleIds } from "../constants/ModuleIds.sol";
import { HCInvalidId, HCRulesetAlreadyRegistered, HCRulesetNotFound, HCZeroAddress } from "../errors/HighCountryErrors.sol";
import { IHighCountryAuthorization } from "../interfaces/IHighCountryAuthorization.sol";
import { IRulesetRegistry } from "../interfaces/IRulesetRegistry.sol";
import { AuthorizationRequest } from "../types/HighCountryTypes.sol";

contract RulesetRegistry is IRulesetRegistry {
    bytes32 public constant RULESET_ID_DOMAIN = keccak256("HC.RULESET.V1");

    IHighCountryAuthorization public immutable authorization;
    mapping(bytes32 => RulesetRecord) private _rulesets;

    constructor(address authorization_) {
        if (authorization_ == address(0)) revert HCZeroAddress();
        authorization = IHighCountryAuthorization(authorization_);
    }

    function deriveRulesetId(bytes32 contentHash) public pure returns (bytes32) {
        if (contentHash == bytes32(0)) revert HCInvalidId();
        return keccak256(abi.encode(RULESET_ID_DOMAIN, contentHash));
    }

    function registerRuleset(bytes32 contentHash) external returns (bytes32 rulesetId) {
        rulesetId = deriveRulesetId(contentHash);
        if (_rulesets[rulesetId].exists) revert HCRulesetAlreadyRegistered(rulesetId);

        authorization.requireAuthorized(
            AuthorizationRequest({
                principal: msg.sender,
                moduleId: ModuleIds.RULESET_REGISTRY,
                actionId: ActionIds.RULESET_REGISTER,
                scopeHash: rulesetId,
                amount: 0
            })
        );

        uint64 registeredAt = uint64(block.timestamp);
        _rulesets[rulesetId] = RulesetRecord({ contentHash: contentHash, registeredAt: registeredAt, exists: true });
        emit RulesetRegistered(rulesetId, contentHash, registeredAt);
    }

    function getRuleset(bytes32 rulesetId) external view returns (RulesetRecord memory) {
        RulesetRecord memory record = _rulesets[rulesetId];
        if (!record.exists) revert HCRulesetNotFound(rulesetId);
        return record;
    }

    function exists(bytes32 rulesetId) external view returns (bool) {
        return _rulesets[rulesetId].exists;
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IRulesetRegistry {
    struct RulesetRecord {
        bytes32 contentHash;
        uint64 registeredAt;
        bool exists;
    }

    event RulesetRegistered(bytes32 indexed rulesetId, bytes32 indexed contentHash, uint64 registeredAt);

    function deriveRulesetId(bytes32 contentHash) external pure returns (bytes32);
    function registerRuleset(bytes32 contentHash) external returns (bytes32 rulesetId);
    function getRuleset(bytes32 rulesetId) external view returns (RulesetRecord memory);
    function exists(bytes32 rulesetId) external view returns (bool);
}

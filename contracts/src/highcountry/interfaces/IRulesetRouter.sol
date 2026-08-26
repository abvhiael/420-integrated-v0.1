// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

interface IRulesetRouter {
    event RulesetRouteSet(bytes32 indexed domain, bytes32 indexed rulesetId);

    function rulesetFor(bytes32 domain) external view returns (bytes32);
    function setRulesetFor(bytes32 domain, bytes32 rulesetId) external;
}

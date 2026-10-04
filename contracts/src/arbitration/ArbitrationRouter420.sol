// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../interfaces/I420System.sol";
import "./ArbitrationPolicyRegistry420.sol";
import "./ArbitrationCaseRegistry420.sol";
import "./ArbitrationRulingRegistry420.sol";

/// @notice Canonical read/discovery endpoint for 420Arbitration.
/// @dev State-changing authority remains in the underlying registries.
contract ArbitrationRouter420 is I420System {
    ArbitrationPolicyRegistry420 public immutable policies;
    ArbitrationCaseRegistry420 public immutable cases;
    ArbitrationRulingRegistry420 public immutable rulings;

    error ZeroAddress();
    error DependencyMismatch();

    constructor(
        address policyRegistry_,
        address caseRegistry_,
        address rulingRegistry_
    ) {
        if (policyRegistry_ == address(0) || caseRegistry_ == address(0) || rulingRegistry_ == address(0)) {
            revert ZeroAddress();
        }

        ArbitrationPolicyRegistry420 p = ArbitrationPolicyRegistry420(policyRegistry_);
        ArbitrationCaseRegistry420 c = ArbitrationCaseRegistry420(caseRegistry_);
        ArbitrationRulingRegistry420 r = ArbitrationRulingRegistry420(rulingRegistry_);

        if (address(c.policies()) != policyRegistry_ || address(r.cases()) != caseRegistry_) {
            revert DependencyMismatch();
        }

        policies = p;
        cases = c;
        rulings = r;
    }

    function systemName() external pure returns (string memory) {
        return "ArbitrationRouter420";
    }

    function protocolVersion() external pure returns (uint32) {
        return 1;
    }

    function getPolicy(
        bytes32 domainId
    ) external view returns (ArbitrationPolicyRegistry420.Policy memory) {
        return policies.getPolicy(domainId);
    }

    function getCase(
        bytes32 caseId
    ) external view returns (ArbitrationCaseRegistry420.CaseRecord memory) {
        return cases.getCase(caseId);
    }

    function getRuling(
        bytes32 caseId,
        uint8 round
    ) external view returns (ArbitrationRulingRegistry420.Ruling memory) {
        return rulings.getRuling(caseId, round);
    }
}

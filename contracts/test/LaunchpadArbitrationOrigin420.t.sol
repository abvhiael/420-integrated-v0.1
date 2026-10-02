// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/arbitration/ArbitrationPolicyRegistry420.sol";
import "../src/arbitration/ArbitrationCaseRegistry420.sol";

contract LaunchpadArbitrationOrigin420Test {
    bytes32 internal constant DOMAIN =
        keccak256("420/arbitration/domain/launchpad-crowdfunding/v1");
    bytes32 internal constant COMPONENT =
        keccak256("420/COMPONENT/LAUNCHPAD/V1");
    bytes32 internal constant SALE_ID = keccak256("launchpad/sale");
    address internal constant RESPONDENT = address(0xBEEF);

    ArbitrationPolicyRegistry420 internal policies;
    ArbitrationCaseRegistry420 internal cases;

    function setUp() public {
        policies = new ArbitrationPolicyRegistry420(address(this));
        policies.setPolicy(DOMAIN, address(this), address(0), 1 days, 1 days, 0, true);
        cases = new ArbitrationCaseRegistry420(address(this), address(policies));
    }

    function testCaseOriginReturnsImmutableLaunchpadBinding() public {
        bytes32 caseId = cases.openCase(
            DOMAIN,
            RESPONDENT,
            COMPONENT,
            SALE_ID,
            keccak256("claim"),
            keccak256("remedy")
        );

        (
            address claimant,
            address respondent,
            bytes32 domainId,
            bytes32 originComponentId,
            bytes32 originObjectId,
            ArbitrationCaseRegistry420.State state
        ) = cases.caseOrigin(caseId);

        require(claimant == address(this), "claimant");
        require(respondent == RESPONDENT, "respondent");
        require(domainId == DOMAIN, "domain");
        require(originComponentId == COMPONENT, "component");
        require(originObjectId == SALE_ID, "sale");
        require(state == ArbitrationCaseRegistry420.State.OPEN, "state");
    }
}

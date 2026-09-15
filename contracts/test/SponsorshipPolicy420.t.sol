// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/accounts/SponsorshipPolicy420.sol";

contract SponsorshipPolicy420Test {
    SponsorshipPolicy420 internal engine;

    function setUp() public {
        engine = new SponsorshipPolicy420(address(this));
    }

    function testPolicyIdIsDeterministicAndRegistrationIsImmutable() public {
        SponsorshipPolicy420.Policy memory policy = _policy();
        bytes32 expected = engine.policyId(policy);
        bytes32 registered = engine.registerPolicy(policy);
        require(registered == expected, "policy id mismatch");
        require(engine.registered(expected), "policy not registered");
        require(engine.enabled(expected), "policy not enabled");

        (bool ok, bytes memory reason) = address(engine).call(
            abi.encodeWithSelector(SponsorshipPolicy420.registerPolicy.selector, policy)
        );
        require(!ok, "duplicate policy registered");
        require(_selector(reason) == SponsorshipPolicy420.PolicyAlreadyRegistered.selector, "wrong duplicate failure");
    }

    function testExactPolicyAllowsMatchingEvaluation() public {
        SponsorshipPolicy420.Policy memory policy = _policy();
        bytes32 id = engine.registerPolicy(policy);
        SponsorshipPolicy420.Evaluation memory evaluation = _evaluation(policy);
        require(engine.evaluate(id, evaluation), "matching evaluation rejected");
    }

    function testPolicyCanOnlyNarrowAccountTargetSelectorAndCost() public {
        SponsorshipPolicy420.Policy memory policy = _policy();
        bytes32 id = engine.registerPolicy(policy);
        SponsorshipPolicy420.Evaluation memory evaluation = _evaluation(policy);

        evaluation.account = address(0xAAAA);
        require(!engine.evaluate(id, evaluation), "wrong account sponsored");
        evaluation = _evaluation(policy);

        evaluation.target = address(0xBBBB);
        require(!engine.evaluate(id, evaluation), "wrong target sponsored");
        evaluation = _evaluation(policy);

        evaluation.selector = bytes4(keccak256("other()"));
        require(!engine.evaluate(id, evaluation), "wrong selector sponsored");
        evaluation = _evaluation(policy);

        evaluation.maxCostWei = policy.maxCostWei + 1;
        require(!engine.evaluate(id, evaluation), "cost ceiling broadened");
        evaluation = _evaluation(policy);

        evaluation.valueWei = policy.maxValueWei + 1;
        require(!engine.evaluate(id, evaluation), "value ceiling broadened");
    }

    function testValidityCapabilityAndSessionCommitmentsFailClosed() public {
        SponsorshipPolicy420.Policy memory policy = _policy();
        bytes32 id = engine.registerPolicy(policy);
        SponsorshipPolicy420.Evaluation memory evaluation = _evaluation(policy);

        evaluation.timestamp = policy.validAfter - 1;
        require(!engine.evaluate(id, evaluation), "early evaluation sponsored");
        evaluation = _evaluation(policy);

        evaluation.timestamp = policy.validUntil + 1;
        require(!engine.evaluate(id, evaluation), "expired evaluation sponsored");
        evaluation = _evaluation(policy);

        evaluation.capabilityCommitment = keccak256("wrong-capability");
        require(!engine.evaluate(id, evaluation), "wrong capability sponsored");
        evaluation = _evaluation(policy);

        evaluation.sessionCommitment = keccak256("wrong-session");
        require(!engine.evaluate(id, evaluation), "wrong session sponsored");
    }

    function testPolicyDisableIsFailClosedWithoutChangingCommitment() public {
        SponsorshipPolicy420.Policy memory policy = _policy();
        bytes32 id = engine.registerPolicy(policy);
        SponsorshipPolicy420.Evaluation memory evaluation = _evaluation(policy);
        require(engine.evaluate(id, evaluation), "precondition failed");

        engine.setPolicyEnabled(id, false);
        require(!engine.enabled(id), "policy still enabled");
        require(!engine.evaluate(id, evaluation), "disabled policy sponsored");
        require(engine.policyId(engine.getPolicy(id)) == id, "commitment mutated");
    }

    function testInvalidPoliciesRejected() public {
        SponsorshipPolicy420.Policy memory policy = _policy();
        policy.account = address(0);
        (bool ok1, bytes memory reason1) = address(engine).call(
            abi.encodeWithSelector(SponsorshipPolicy420.registerPolicy.selector, policy)
        );
        require(!ok1 && _selector(reason1) == SponsorshipPolicy420.InvalidPolicy.selector, "zero account accepted");

        policy = _policy();
        policy.validUntil = policy.validAfter;
        (bool ok2, bytes memory reason2) = address(engine).call(
            abi.encodeWithSelector(SponsorshipPolicy420.registerPolicy.selector, policy)
        );
        require(!ok2 && _selector(reason2) == SponsorshipPolicy420.InvalidPolicy.selector, "empty window accepted");

        policy = _policy();
        policy.maxCostWei = 0;
        (bool ok3, bytes memory reason3) = address(engine).call(
            abi.encodeWithSelector(SponsorshipPolicy420.registerPolicy.selector, policy)
        );
        require(!ok3 && _selector(reason3) == SponsorshipPolicy420.InvalidPolicy.selector, "zero cost accepted");
    }

    function _policy() internal pure returns (SponsorshipPolicy420.Policy memory) {
        return SponsorshipPolicy420.Policy({
            account: address(0x4201),
            target: address(0x4202),
            selector: bytes4(keccak256("doThing(uint256)")),
            maxValueWei: 0.25 ether,
            maxCostWei: 0.01 ether,
            validAfter: 100,
            validUntil: 1000,
            capabilityCommitment: keccak256("420/GAS/GAS5/CAPABILITY"),
            sessionCommitment: keccak256("420/GAS/GAS5/SESSION")
        });
    }

    function _evaluation(SponsorshipPolicy420.Policy memory policy)
        internal
        pure
        returns (SponsorshipPolicy420.Evaluation memory)
    {
        return SponsorshipPolicy420.Evaluation({
            account: policy.account,
            target: policy.target,
            selector: policy.selector,
            valueWei: policy.maxValueWei,
            maxCostWei: policy.maxCostWei,
            timestamp: 500,
            capabilityCommitment: policy.capabilityCommitment,
            sessionCommitment: policy.sessionCommitment
        });
    }

    function _selector(bytes memory reason) private pure returns (bytes4 selector) {
        if (reason.length < 4) return bytes4(0);
        assembly { selector := mload(add(reason, 32)) }
    }
}

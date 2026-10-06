// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/media/MediaCapabilityRegistry420.sol";
import "../src/media/MediaOperatorRegistry420.sol";
import "../src/media/MediaSLA420.sol";
import "../src/media/MediaSettlement420.sol";
import "../src/media/MediaJobMarket420.sol";

interface VmMediaHardening420 {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

contract HostileMediaJob420 {
    error HostileCallback();

    address public payer = address(0xA11CE);
    bytes32 public operatorId = keccak256("hostile-operator");
    address public beneficiary = address(0xBEEF);
    uint256 public maxSpend = 100 ether;
    uint8 public status = 2;
    bool public revertFunding;
    bool public revertSettlement;
    bool public revertRefund;

    function setReverts(bool funding, bool settlement, bool refund_) external {
        revertFunding = funding;
        revertSettlement = settlement;
        revertRefund = refund_;
    }

    function settlementTerms(bytes32)
        external
        view
        returns (address, bytes32, address, uint256, uint8)
    {
        return (payer, operatorId, beneficiary, maxSpend, status);
    }

    function confirmFunding(bytes32, bytes32, uint256) external view {
        if (revertFunding) revert HostileCallback();
    }

    function confirmSettlement(bytes32) external view {
        if (revertSettlement) revert HostileCallback();
    }

    function confirmRefund(bytes32) external view {
        if (revertRefund) revert HostileCallback();
    }

    function resolve(MediaSettlement420 settlement, bytes32 jobId, bool claimable, bytes32 resolutionRef) external {
        settlement.resolve(jobId, claimable, resolutionRef);
    }
}

contract MediaPhase1Hardening420Test {
    VmMediaHardening420 constant vm =
        VmMediaHardening420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant EOA = address(0xBAD);
    address constant VAULT = address(0xA017);
    address constant PAYOUT = address(0x5E771E);
    bytes32 constant JOB_ID = keccak256("hardening-job");

    function testCapabilityRegistryBindingRejectsCodeLessAddress() public {
        MediaOperatorRegistry420 operators = new MediaOperatorRegistry420(address(this));
        vm.expectRevert(MediaOperatorRegistry420.InvalidDependency.selector);
        operators.bindCapabilityRegistry(EOA);
    }

    function testJobDependenciesRejectCodeLessAddress() public {
        MediaJobMarket420 jobs = new MediaJobMarket420(address(this));
        MediaOperatorRegistry420 operators = new MediaOperatorRegistry420(address(this));
        MediaSLA420 sla = new MediaSLA420(address(this));
        MediaSettlement420 settlement = new MediaSettlement420(address(this));

        vm.expectRevert(MediaJobMarket420.InvalidDependency.selector);
        jobs.bindDependencies(address(operators), address(sla), EOA);

        jobs.bindDependencies(address(operators), address(sla), address(settlement));
        require(jobs.dependenciesBound(), "valid dependency graph not bound");
    }

    function testSettlementRejectsCodeLessJobMarket() public {
        MediaSettlement420 settlement = new MediaSettlement420(address(this));
        vm.expectRevert(MediaSettlement420.InvalidDependency.selector);
        settlement.bindJobMarket(EOA);
    }

    function testHostileFundingCallbackRollsBackSettlementState() public {
        (MediaSettlement420 settlement, HostileMediaJob420 hostile) = _fixture();
        hostile.setReverts(true, false, false);

        vm.prank(VAULT);
        vm.expectRevert(HostileMediaJob420.HostileCallback.selector);
        settlement.confirmVaultFunding(
            JOB_ID,
            hostile.payer(),
            hostile.operatorId(),
            hostile.beneficiary(),
            keccak256("vault"),
            keccak256("funding"),
            42 ether
        );

        (,,,,,,, MediaSettlement420.SettlementState state) = settlement.settlements(JOB_ID);
        require(state == MediaSettlement420.SettlementState.NONE, "funding callback leaked state");
    }

    function testHostileSettlementCallbackRollsBackClosedState() public {
        (MediaSettlement420 settlement, HostileMediaJob420 hostile) = _fixture();
        _fund(settlement, hostile, 42 ether);
        hostile.resolve(settlement, JOB_ID, true, keccak256("resolution"));
        hostile.setReverts(false, true, false);

        vm.prank(PAYOUT);
        vm.expectRevert(HostileMediaJob420.HostileCallback.selector);
        settlement.release(JOB_ID, hostile.beneficiary());

        (,,,,,,, MediaSettlement420.SettlementState state) = settlement.settlements(JOB_ID);
        require(state == MediaSettlement420.SettlementState.CLAIMABLE, "release callback leaked closed state");
    }

    function testFuzzFundingWithinBoundPreservesExactAmount(uint96 seed) public {
        (MediaSettlement420 settlement, HostileMediaJob420 hostile) = _fixture();
        uint256 amount = (uint256(seed) % hostile.maxSpend()) + 1;
        _fund(settlement, hostile, amount);
        (,,,,,, uint256 storedAmount, MediaSettlement420.SettlementState state) = settlement.settlements(JOB_ID);
        require(storedAmount == amount, "funding amount changed");
        require(state == MediaSettlement420.SettlementState.FUNDED, "funding state mismatch");
    }

    function _fixture() private returns (MediaSettlement420 settlement, HostileMediaJob420 hostile) {
        settlement = new MediaSettlement420(address(this));
        hostile = new HostileMediaJob420();
        settlement.bindJobMarket(address(hostile));
        settlement.bindVaultAdapter(VAULT);
        settlement.bindPayoutAdapter(PAYOUT);
    }

    function _fund(MediaSettlement420 settlement, HostileMediaJob420 hostile, uint256 amount) private {
        vm.prank(VAULT);
        settlement.confirmVaultFunding(
            JOB_ID,
            hostile.payer(),
            hostile.operatorId(),
            hostile.beneficiary(),
            keccak256("vault"),
            keccak256("funding"),
            amount
        );
    }
}

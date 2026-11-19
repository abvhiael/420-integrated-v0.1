// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/governance/CivicGovernor420.sol";
import "../src/governance/CivicMerkleElectorateSource420.sol";
import "../src/system/CapabilityRegistry420.sol";
import "../src/system/SystemAccess.sol";
import "../src/treasury/TreasuryPolicyRegistry420.sol";
import "../src/treasury/TreasuryBudgetRegistry420.sol";
import "../src/treasury/TreasuryDisbursementRegistry420.sol";
import "../src/treasury/TreasuryAuthorization420.sol";
import "../src/treasury/TreasuryIds420.sol";
import "../src/libraries/CapabilityIds420.sol";

interface VmTreasuryRec5 {
    function prank(
        address
    ) external;
    function roll(
        uint256
    ) external;
    function warp(
        uint256
    ) external;
    function mockCallRevert(
        address,
        bytes calldata,
        bytes calldata
    ) external;
    function mockCall(
        address,
        bytes calldata,
        bytes calldata
    ) external;
    function clearMockedCalls() external;
    function deal(
        address,
        uint256
    ) external;
}

contract TreasuryRec9Governance420Test {
    VmTreasuryRec5 private constant vm = VmTreasuryRec5(address(uint160(uint256(keccak256("hevm cheat code")))));
    address private constant VOTER = address(0xA11CE);
    address private constant EXECUTOR = address(0xE420);
    address private constant GRANT_AUTH = address(0xCAFE);
    address private constant ATTACKER = address(0xBAD);
    address private constant RECIPIENT = address(0xB0B);
    address private constant ASSET = address(0);
    bytes32 private constant BUDGET = keccak256("rec5-budget");
    bytes32 private constant CIVIC = keccak256("rec5-governed-budget-action");
    bytes32 private constant RELEASE = keccak256("rec5-commitment");
    bytes32 private constant OTHER_COMPONENT = keccak256("rec5-other-component");
    uint64 private constant EPOCH = 365 days;

    GovernanceTimelock private lock;
    CivicGovernor420 private governor;
    CivicVoting420 private voting;
    CivicProposalRegistry420 private proposals;
    CapabilityRegistry420 private caps;
    TreasuryAuthorization420 private auth;
    TreasuryPolicyRegistry420 private policy;
    TreasuryBudgetRegistry420 private budgets;
    TreasuryDisbursementRegistry420 private disb;
    uint256 private nonce;

    function setUp() public {
        vm.warp(1000);
        vm.roll(100);
        lock = new GovernanceTimelock(address(this));
        CivicConstitution420 constitution = new CivicConstitution420(address(lock));
        proposals = new CivicProposalRegistry420(address(lock));
        CivicElectorateRegistry420 electorates = new CivicElectorateRegistry420(address(lock));
        CivicMerkleElectorateSource420 source =
            new CivicMerkleElectorateSource420(address(lock), keccak256("420CIVIC_COMMUNITY_EQUAL_WEIGHT_MERKLE_V1"));
        voting = new CivicVoting420(address(proposals), address(electorates));
        governor =
            new CivicGovernor420(address(constitution), address(proposals), address(electorates), address(voting));
        caps = new CapabilityRegistry420();
        auth = new TreasuryAuthorization420(address(caps));
        policy = new TreasuryPolicyRegistry420(address(lock));
        budgets = new TreasuryBudgetRegistry420(address(lock), address(policy));
        disb = new TreasuryDisbursementRegistry420(address(lock), address(auth), address(policy), address(budgets));

        // Deploy-time registrar is retired to governance. Grants are separately delegated.
        caps.registerProtocolComponent(TreasuryIds420.COMPONENT_TREASURY, GRANT_AUTH);
        caps.registerProtocolComponent(OTHER_COMPONENT, GRANT_AUTH);
        caps.transferComponentRegistrar(address(lock));

        // Actual bootstrap Timelock operations establish the Civic fixture; no Timelock impersonation on positive paths.
        _bootstrap(
            address(constitution),
            abi.encodeCall(constitution.setRule, (CivicIds420.ProposalClass.G1, 2, 7 days, 5000, 6000, 0, 0, false))
        );
        _bootstrap(
            address(electorates),
            abi.encodeCall(electorates.setHouseSource, (CivicIds420.House.COMMUNITY, address(source)))
        );
        _bootstrap(address(proposals), abi.encodeCall(proposals.bindProposalAuthority, (address(governor))));
        _bootstrap(address(electorates), abi.encodeCall(electorates.bindSnapshotAuthority, (address(governor))));
        _bootstrap(
            address(source),
            abi.encodeCall(source.publishCheckpoint, (uint64(block.number + 1), keccak256(abi.encode(VOTER)), 1))
        );
        vm.roll(block.number + 2);
        lock.activateCivicAuthority(address(governor));
        require(lock.scheduler() == address(governor) && lock.civicAuthorityActivated(), "Civic not active");
    }

    function _bootstrap(
        address target,
        bytes memory data
    ) private {
        bytes32 id = keccak256(abi.encode("bootstrap", ++nonce));
        lock.schedule(id, target, 0, data, GovernanceTimelock.Class.G1);
        vm.warp(block.timestamp + 7 days);
        lock.execute(id);
    }

    function _action(
        address target,
        bytes memory data
    ) private pure returns (CivicGovernor420.Action memory) {
        return CivicGovernor420.Action({ target: target, value: 0, data: data });
    }

    function _one(
        address target,
        bytes memory data
    ) private pure returns (CivicGovernor420.Action[] memory a) {
        a = new CivicGovernor420.Action[](1);
        a[0] = _action(target, data);
    }

    function _pass(
        CivicGovernor420.Action[] memory a
    ) private returns (bytes32 id) {
        vm.prank(VOTER);
        id = governor.createProposal(
            CivicIds420.ProposalClass.G1, keccak256(abi.encode(++nonce)), keccak256(abi.encode(a))
        );
        vm.roll(block.number + 1);
        vm.prank(VOTER);
        voting.castVote(id, CivicIds420.House.COMMUNITY, CivicVoting420.Support.FOR, abi.encode(new bytes32[](0)));
        vm.roll(block.number + 2);
        require(governor.finalize(id), "vote did not pass");
    }

    function _queue(
        CivicGovernor420.Action[] memory a
    ) private returns (bytes32 id) {
        id = _pass(a);
        governor.queue(id, a);
    }

    function _mature(
        bytes32 id
    ) private returns (uint64 maturity) {
        (,,, maturity,,,) = lock.operations(id);
        if (block.timestamp < maturity) vm.warp(maturity);
    }

    function _execute(
        CivicGovernor420.Action[] memory a
    ) private {
        bytes32 id = _queue(a);
        _mature(id);
        vm.prank(ATTACKER); // permissionless trigger, never an authorization substitution
        lock.execute(id);
        (,,,,,,, CivicIds420.ProposalState state,) = proposals.proposals(id);
        require(state == CivicIds420.ProposalState.EXECUTED, "proposal not executed");
        require(lock.executingCivicOperation() == bytes32(0), "dispatch context leaked");
    }

    function _govern(
        address target,
        bytes memory data
    ) private {
        _execute(_one(target, data));
    }

    function _reject(
        address actor,
        address target,
        bytes memory data,
        bytes4 selector
    ) private {
        vm.prank(actor);
        (bool ok, bytes memory reason) = target.call(data);
        require(!ok, "unauthorized call succeeded");
        if (selector != bytes4(0)) require(bytes4(reason) == selector, "unexpected rejection");
    }

    function _policy(
        bool allowed,
        uint128 single,
        uint128 epochCap
    ) private pure returns (bytes memory) {
        return abi.encodeCall(TreasuryPolicyRegistry420.setAssetPolicy, (ASSET, allowed, single, epochCap, EPOCH));
    }


    function testNestedMatureCivicOperationCannotBorrowOuterContext() public {
        bytes32 inner = _queue(_one(address(policy), _policy(true, 100, 250)));
        TreasuryRec9Callback420 callback = new TreasuryRec9Callback420(lock, inner);
        CivicGovernor420.Action[] memory outer = new CivicGovernor420.Action[](2);
        outer[0] = _action(address(callback), abi.encodeCall(callback.executeInner, ()));
        outer[1] = _action(address(policy), _policy(true, 120, 300));
        bytes32 outerId = _queue(outer);
        _mature(outerId);
        _mature(inner);
        lock.execute(outerId);
        require(callback.executed(), "callback not invoked");
        require(policy.assetPolicy(ASSET).revision == 2 && policy.isAllowed(ASSET, 120), "nested ordering");
        require(lock.executingCivicOperation() == bytes32(0), "context leak");
        (,,,,, bool innerDone,) = lock.operations(inner);
        (,,,,, bool outerDone,) = lock.operations(outerId);
        require(innerDone && outerDone, "operation finalization");
        _reject(ATTACKER, address(lock), abi.encodeCall(lock.execute, (inner)), bytes4(0));
        _reject(ATTACKER, address(lock), abi.encodeCall(lock.execute, (outerId)), bytes4(0));
        _reject(address(governor), address(lock),
            abi.encodeCall(lock.executeCivicAction, (outerId, address(policy), _policy(false, 120, 300))), bytes4(0));
        require(policy.assetPolicy(ASSET).revision == 2, "stale context altered policy");
    }

    function testNestedMatureCivicOperationRollsBackWithOuterFailure() public {
        bytes32 inner = _queue(_one(address(policy), _policy(true, 100, 250)));
        TreasuryRec9Callback420 callback = new TreasuryRec9Callback420(lock, inner);
        CivicGovernor420.Action[] memory outer = new CivicGovernor420.Action[](2);
        outer[0] = _action(address(callback), abi.encodeCall(callback.executeInner, ()));
        outer[1] = _action(address(budgets), abi.encodeCall(budgets.setController, (address(0))));
        bytes32 outerId = _queue(outer);
        _mature(outerId);
        _mature(inner);
        _reject(ATTACKER, address(lock), abi.encodeCall(lock.execute, (outerId)), bytes4(0));
        require(!callback.executed() && policy.assetPolicy(ASSET).revision == 0, "nested effects not rolled back");
        require(lock.executingCivicOperation() == bytes32(0), "context leaked on failure");
        (,,,,, bool innerDone,) = lock.operations(inner);
        (,,,,, bool outerDone,) = lock.operations(outerId);
        require(!innerDone && !outerDone, "operation flags not rolled back");
        (,,,,,,, CivicIds420.ProposalState innerState,) = proposals.proposals(inner);
        (,,,,,,, CivicIds420.ProposalState outerState,) = proposals.proposals(outerId);
        require(innerState == CivicIds420.ProposalState.QUEUED && outerState == CivicIds420.ProposalState.QUEUED,
            "proposal flags not rolled back");
        lock.execute(inner);
        require(policy.isAllowed(ASSET, 100) && lock.executingCivicOperation() == bytes32(0), "independent recovery");
    }
}

contract TreasuryRec9Callback420 {
    GovernanceTimelock private immutable lock;
    bytes32 private immutable inner;
    bool public executed;
    constructor(GovernanceTimelock l, bytes32 id) {
        lock = l;
        inner = id;
    }
    function executeInner() external {
        require(msg.sender == address(lock), "caller");
        require(lock.executingCivicOperation() == bytes32(0), "outer context exposed");
        lock.execute(inner);
        require(lock.executingCivicOperation() == bytes32(0), "inner context exposed");
        executed = true;
    }
}

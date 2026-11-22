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

contract TreasuryGovernanceAuthorization420Test {
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

        _reject(
            ATTACKER,
            address(budgets),
            abi.encodeCall(budgets.setController, (ATTACKER)),
            SystemAccess.Unauthorized.selector
        );
        require(budgets.controller() == address(0), "unauthorized initialization");
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

    function _budget() private view returns (bytes memory) {
        return abi.encodeCall(
            budgets.createBudget,
            (
                BUDGET,
                keccak256("rec5-vault-instance"),
                TreasuryIds420.BUDGET_SECURITY,
                ASSET,
                uint128(2000),
                uint64(block.timestamp),
                uint64(block.timestamp + 250 days),
                CIVIC,
                keccak256("metadata")
            )
        );
    }

    function _initialize() private {
        CivicGovernor420.Action[] memory a = new CivicGovernor420.Action[](3);
        a[0] = _action(address(budgets), abi.encodeCall(budgets.setController, (address(disb))));
        a[1] = _action(address(policy), _policy(true, 100, 250));
        a[2] = _action(address(budgets), _budget());
        _execute(a);
        require(budgets.controller() == address(disb), "controller");
        require(
            policy.assetPolicy(ASSET).revision == 1 && budgets.budget(BUDGET).ceiling == 2000, "governed initialization"
        );
    }

    function _scheduleData(
        uint128 amount,
        bytes32 purpose
    ) private view returns (bytes32 id, bytes memory data) {
        uint64 start = uint64(block.timestamp);
        uint64 end = uint64(block.timestamp + 180 days);
        id = disb.canonicalId(BUDGET, RECIPIENT, amount, start, end, CIVIC, purpose);
        data = abi.encodeCall(disb.schedule, (id, BUDGET, RECIPIENT, amount, start, end, CIVIC, purpose));
    }

    function _schedule(
        uint128 amount
    ) private returns (bytes32 id) {
        bytes memory data;
        (id, data) = _scheduleData(amount, keccak256(abi.encode(++nonce)));
        _govern(address(disb), data);
        require(disb.disbursement(id).state == TreasuryDisbursementRegistry420.State.SCHEDULED, "not scheduled");
    }

    function _grant(
        address principal,
        bytes32 component,
        bytes32 action,
        bytes32 scope,
        uint256 limit,
        uint256 periodLimit,
        uint64 from,
        uint64 until
    ) private returns (bytes32 gid) {
        gid = keccak256(abi.encode("grant", ++nonce));
        vm.prank(GRANT_AUTH);
        caps.createGrant(
            gid, principal, component, action, scope, limit, periodLimit, periodLimit == 0 ? 0 : EPOCH, from, until
        );
    }

    function _exact(
        bytes32 id,
        uint256 limit,
        uint256 periodLimit,
        uint64 from,
        uint64 until
    ) private returns (bytes32) {
        return _grant(
            EXECUTOR,
            TreasuryIds420.COMPONENT_TREASURY,
            TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT,
            auth.scopeForDisbursement(id),
            limit,
            periodLimit,
            from,
            until
        );
    }

    function _snapshot(
        bytes32 id
    ) private view returns (bytes32) {
        return keccak256(
            abi.encode(budgets.budget(BUDGET), disb.disbursement(id), disb.epochSpent(ASSET, block.timestamp / EPOCH))
        );
    }

    function _denied(
        bytes32 id,
        address principal,
        bytes4 selector
    ) private {
        bytes32 beforeState = _snapshot(id);
        _reject(principal, address(disb), abi.encodeCall(disb.markExecuted, (id, RELEASE)), selector);
        require(_snapshot(id) == beforeState, "failed authorization mutated Treasury");
    }

    function _settle(
        bytes32 id
    ) private {
        vm.prank(EXECUTOR);
        disb.markExecuted(id, RELEASE);
        TreasuryDisbursementRegistry420.Disbursement memory d = disb.disbursement(id);
        require(
            d.state == TreasuryDisbursementRegistry420.State.EXECUTED && d.vaultReleaseHash == RELEASE, "settlement"
        );
    }

    function _unauthorized(
        bytes32 id,
        address principal
    ) private {
        _denied(id, principal, TreasuryDisbursementRegistry420.ExecutionUnauthorized.selector);
    }

    function testRealCivicGovernanceLifecycleAndPrivilegeIsolation() public {
        _reject(address(this), address(policy), _policy(true, 100, 250), SystemAccess.Unauthorized.selector);
        _reject(EXECUTOR, address(budgets), _budget(), TreasuryBudgetRegistry420.UnauthorizedCaller.selector);
        _reject(address(governor), address(policy), _policy(true, 100, 250), SystemAccess.Unauthorized.selector);
        _initialize();
        bytes32 id;
        bytes memory data;
        (id, data) = _scheduleData(100, keccak256("governed schedule"));
        _reject(EXECUTOR, address(disb), data, TreasuryDisbursementRegistry420.ExecutionUnauthorized.selector);
        _govern(address(disb), data);
        require(budgets.budget(BUDGET).committed == 100, "schedule accounting");
        _exact(id, 100, 0, 0, 0);
        // A valid execution grant does not authorize cancellation, policy, budget or raw accounting writes.
        _reject(EXECUTOR, address(disb), abi.encodeCall(disb.cancel, (id)), SystemAccess.Unauthorized.selector);
        _reject(EXECUTOR, address(policy), _policy(false, 100, 250), SystemAccess.Unauthorized.selector);
        _reject(EXECUTOR, address(budgets), _budget(), TreasuryBudgetRegistry420.UnauthorizedCaller.selector);
        _reject(
            EXECUTOR,
            address(budgets),
            abi.encodeCall(budgets.setController, (EXECUTOR)),
            SystemAccess.Unauthorized.selector
        );
        _reject(
            address(lock),
            address(budgets),
            abi.encodeCall(budgets.reserve, (BUDGET, uint128(1))),
            TreasuryBudgetRegistry420.UnauthorizedCaller.selector
        );
        _reject(
            EXECUTOR,
            address(budgets),
            abi.encodeCall(budgets.settle, (BUDGET, uint128(1))),
            TreasuryBudgetRegistry420.UnauthorizedCaller.selector
        );
        _reject(
            EXECUTOR,
            address(budgets),
            abi.encodeCall(budgets.release, (BUDGET, uint128(1))),
            TreasuryBudgetRegistry420.UnauthorizedCaller.selector
        );
        _govern(address(disb), abi.encodeCall(disb.cancel, (id)));
        require(budgets.budget(BUDGET).committed == 0 && budgets.budget(BUDGET).executed == 0, "cancel accounting");
        _denied(id, EXECUTOR, TreasuryDisbursementRegistry420.InvalidState.selector);
        _govern(address(policy), _policy(false, 90, 200));
        require(!policy.isAllowed(ASSET, 1) && policy.assetPolicy(ASSET).revision == 2, "governed policy revision");
    }

    function testControllerCannotInitializeToZeroOrBeReplacedEvenByCivic() public {
        bytes32 id = _queue(_one(address(budgets), abi.encodeCall(budgets.setController, (address(0)))));
        _mature(id);
        _reject(ATTACKER, address(lock), abi.encodeCall(lock.execute, (id)), bytes4(0));
        require(budgets.controller() == address(0), "zero initialization mutated controller");
        _initialize();
        id = _queue(_one(address(budgets), abi.encodeCall(budgets.setController, (ATTACKER))));
        _mature(id);
        _reject(ATTACKER, address(lock), abi.encodeCall(lock.execute, (id)), bytes4(0));
        require(budgets.controller() == address(disb), "controller replaced");
        (,,,,, bool executed,) = lock.operations(id);
        require(!executed, "failed operation finalized");
    }

    function testExactComponentActionScopePrincipalAndCanonicalIdentifiers() public {
        _initialize();
        bytes32 id = _schedule(100);
        bytes32 other = _schedule(100);
        bytes32 scope = keccak256(abi.encode(id));
        require(auth.scopeForDisbursement(id) == scope, "scope preimage drift");
        require(TreasuryIds420.COMPONENT_TREASURY == keccak256("420/TREASURY/COMPONENT/V1"), "component drift");
        require(
            TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT == keccak256("420/TREASURY/ACTION/EXECUTE_DISBURSEMENT/V1"),
            "action drift"
        );
        _unauthorized(id, EXECUTOR);
        _grant(EXECUTOR, OTHER_COMPONENT, TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT, scope, 100, 0, 0, 0);
        _grant(
            EXECUTOR, TreasuryIds420.COMPONENT_TREASURY, TreasuryIds420.ACTION_CANCEL_DISBURSEMENT, scope, 100, 0, 0, 0
        );
        _grant(EXECUTOR, TreasuryIds420.COMPONENT_TREASURY, CapabilityIds420.TREASURY_SPEND, scope, 100, 0, 0, 0);
        _grant(
            EXECUTOR, TreasuryIds420.COMPONENT_TREASURY, TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT, id, 100, 0, 0, 0
        );
        _exact(other, 100, 0, 0, 0);
        _grant(
            ATTACKER, TreasuryIds420.COMPONENT_TREASURY, TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT, scope, 99, 0, 0, 0
        );
        _unauthorized(id, EXECUTOR);
        _unauthorized(id, ATTACKER);
        _exact(id, 100, 0, 0, 0);
        _unauthorized(id, address(lock));
        _settle(id);
        require(
            budgets.budget(BUDGET).executed == 100 && disb.epochSpent(ASSET, block.timestamp / EPOCH) == 100,
            "exact accounting"
        );
        _denied(id, EXECUTOR, TreasuryDisbursementRegistry420.InvalidState.selector);
    }

    function testRealCapabilityAmountPeriodWindowReplacementAndRevocation() public {
        _initialize();
        bytes32 id = _schedule(100);
        _exact(id, 99, 0, 0, 0);
        _unauthorized(id, EXECUTOR);
        _exact(id, 100, 99, 0, 0);
        _unauthorized(id, EXECUTOR);
        bytes32 metered = _exact(id, 100, 150, 0, 0);
        vm.prank(GRANT_AUTH);
        caps.consume(metered, 51);
        _unauthorized(id, EXECUTOR);
        uint64 start = uint64(block.timestamp + 10);
        uint64 end = start + 10;
        bytes32 windowed = _exact(id, 100, 100, start, end);
        require(caps.grant(metered).revoked, "replacement left old grant active");
        _unauthorized(id, EXECUTOR);
        vm.warp(start);
        require(
            auth.isDisbursementAuthorized(EXECUTOR, id, TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT, 100),
            "validFrom not inclusive"
        );
        vm.warp(end);
        require(
            auth.isDisbursementAuthorized(EXECUTOR, id, TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT, 100),
            "validUntil not inclusive"
        );
        vm.warp(end + 1);
        _unauthorized(id, EXECUTOR);
        bytes32 current = _exact(id, 100, 100, 0, 0);
        _reject(
            EXECUTOR,
            address(caps),
            abi.encodeCall(caps.revokeGrant, (current)),
            CapabilityRegistry420.UnauthorizedAuthority.selector
        );
        vm.prank(GRANT_AUTH);
        caps.revokeGrant(current);
        require(caps.grant(current).revoked && caps.grant(windowed).revoked, "revocation not recorded");
        _unauthorized(id, EXECUTOR);
        _exact(id, 100, 100, 0, 0);
        _settle(id);
    }

    function testCapabilityDependencyRevertAndMalformedReturnAreAtomic() public {
        _initialize();
        bytes32 id = _schedule(100);
        _exact(id, 100, 0, 0, 0);
        bytes memory callData = abi.encodeCall(
            caps.isAuthorized,
            (
                EXECUTOR,
                TreasuryIds420.COMPONENT_TREASURY,
                TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT,
                auth.scopeForDisbursement(id),
                uint256(100)
            )
        );
        vm.mockCallRevert(address(caps), callData, abi.encodeWithSignature("Error(string)", "registry unavailable"));
        _denied(id, EXECUTOR, bytes4(keccak256("Error(string)")));
        vm.clearMockedCalls();
        vm.mockCall(address(caps), callData, hex"01");
        _denied(id, EXECUTOR, bytes4(0));
        vm.clearMockedCalls();
        _settle(id);
    }

    function testValidCapabilityCannotOverrideGovernedPolicyCapsOrEmergencyRevocation() public {
        _initialize();
        bytes32 first = _schedule(100);
        bytes32 next = _schedule(100);
        bytes32 third = _schedule(100);
        _exact(first, 100, 0, 0, 0);
        _exact(next, 100, 0, 0, 0);
        bytes32 emergencyGrant = _exact(third, 100, 0, 0, 0);
        _settle(first);
        _govern(address(policy), _policy(true, 99, 250));
        _denied(next, EXECUTOR, TreasuryDisbursementRegistry420.NotExecutable.selector);
        _govern(address(policy), _policy(true, 100, 199));
        _denied(next, EXECUTOR, TreasuryDisbursementRegistry420.EpochLimit.selector);
        _govern(address(policy), _policy(false, 100, 250));
        _denied(next, EXECUTOR, TreasuryDisbursementRegistry420.NotExecutable.selector);
        _govern(address(policy), _policy(true, 100, 300));
        _settle(next);
        vm.prank(GRANT_AUTH);
        caps.revokeGrant(emergencyGrant);
        _unauthorized(third, EXECUTOR);
        _govern(address(disb), abi.encodeCall(disb.cancel, (third)));
        require(
            budgets.budget(BUDGET).executed == 200 && budgets.budget(BUDGET).committed == 200, "emergency accounting"
        );
    }

    function testRegistrarAndComponentAuthorityAreNotTreasuryGovernance() public {
        _initialize();
        bytes32 id = _schedule(100);
        _reject(GRANT_AUTH, address(policy), _policy(false, 100, 250), SystemAccess.Unauthorized.selector);
        _reject(GRANT_AUTH, address(disb), abi.encodeCall(disb.cancel, (id)), SystemAccess.Unauthorized.selector);
        _reject(
            GRANT_AUTH,
            address(caps),
            abi.encodeCall(caps.updateProtocolComponentAuthority, (TreasuryIds420.COMPONENT_TREASURY, GRANT_AUTH)),
            CapabilityRegistry420.UnauthorizedAuthority.selector
        );
        _reject(
            address(this),
            address(caps),
            abi.encodeCall(caps.transferComponentRegistrar, (address(this))),
            CapabilityRegistry420.UnauthorizedAuthority.selector
        );
        _reject(
            EXECUTOR,
            address(caps),
            abi.encodeCall(
                caps.createGrant,
                (
                    keccak256("self-grant"),
                    EXECUTOR,
                    TreasuryIds420.COMPONENT_TREASURY,
                    TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT,
                    auth.scopeForDisbursement(id),
                    uint256(100),
                    uint256(0),
                    uint64(0),
                    uint64(0),
                    uint64(0)
                )
            ),
            CapabilityRegistry420.UnauthorizedAuthority.selector
        );
        _govern(
            address(caps),
            abi.encodeCall(caps.updateProtocolComponentAuthority, (TreasuryIds420.COMPONENT_TREASURY, address(lock)))
        );
        require(
            caps.componentAuthority(TreasuryIds420.COMPONENT_TREASURY) == address(lock), "governed authority update"
        );
        bytes memory grantData = abi.encodeCall(
            caps.createGrant,
            (
                keccak256("Civic grant"),
                EXECUTOR,
                TreasuryIds420.COMPONENT_TREASURY,
                TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT,
                auth.scopeForDisbursement(id),
                uint256(100),
                uint256(0),
                uint64(0),
                uint64(0),
                uint64(0)
            )
        );
        _reject(GRANT_AUTH, address(caps), grantData, CapabilityRegistry420.UnauthorizedAuthority.selector);
        _govern(address(caps), grantData);
        _settle(id);
    }

    function testExactDelayBatchRollbackAndRetiredEmergencyOverride() public {
        CivicGovernor420.Action[] memory a = new CivicGovernor420.Action[](2);
        a[0] = _action(address(policy), _policy(true, 100, 250));
        a[1] = _action(address(budgets), abi.encodeCall(budgets.setController, (address(0))));
        bytes32 id = _pass(a);
        CivicGovernor420.Action[] memory substituted = _one(address(policy), _policy(true, 100, 250));
        _reject(
            ATTACKER,
            address(governor),
            abi.encodeCall(governor.queue, (id, substituted)),
            CivicGovernor420.ActionHashMismatch.selector
        );
        governor.queue(id, a);
        _reject(ATTACKER, address(lock), abi.encodeCall(lock.execute, (id)), bytes4(0));
        _reject(address(this), address(lock), abi.encodeCall(lock.cancel, (id)), bytes4(0));
        _reject(
            address(this),
            address(lock),
            abi.encodeCall(
                lock.schedule,
                (keccak256("retired"), address(policy), 0, _policy(true, 100, 250), GovernanceTimelock.Class.G1)
            ),
            bytes4(0)
        );
        _reject(
            address(governor),
            address(lock),
            abi.encodeCall(lock.executeCivicAction, (id, address(policy), _policy(true, 100, 250))),
            bytes4(0)
        );
        _reject(
            ATTACKER,
            address(governor),
            abi.encodeCall(governor.executeQueuedBatch, (id, a)),
            CivicGovernor420.UnauthorizedTimelock.selector
        );
        _mature(id);
        _reject(ATTACKER, address(lock), abi.encodeCall(lock.execute, (id)), bytes4(0));
        require(
            policy.assetPolicy(ASSET).revision == 0 && budgets.controller() == address(0),
            "failed batch partially executed"
        );
        (,,,,, bool executed, bool cancelled) = lock.operations(id);
        require(!executed && !cancelled && lock.executingCivicOperation() == bytes32(0), "failed batch state");
        (,,,,,,, CivicIds420.ProposalState state,) = proposals.proposals(id);
        require(state == CivicIds420.ProposalState.QUEUED, "failed proposal finalized");
    }

    function testGovernedActionCannotEnterAnotherQueuedBatchBeforeItsDelay() public {
        CivicGovernor420.Action[] memory laterActions = _one(address(policy), _policy(true, 100, 250));
        bytes32 later = _pass(laterActions);
        CivicGovernor420.Action[] memory earlierActions =
            _one(address(governor), abi.encodeCall(governor.executeQueuedBatch, (later, laterActions)));
        bytes32 earlier = _queue(earlierActions);
        vm.warp(block.timestamp + 1 days);
        governor.queue(later, laterActions);
        uint64 earlyMaturity = _mature(earlier);
        (,,, uint64 lateMaturity,,,) = lock.operations(later);
        require(earlyMaturity < lateMaturity, "test delay ordering");
        _reject(ATTACKER, address(lock), abi.encodeCall(lock.execute, (earlier)), bytes4(0));
        require(policy.assetPolicy(ASSET).revision == 0, "nested call bypassed maturity");
        (,,,,, bool executed,) = lock.operations(later);
        require(!executed, "later operation executed prematurely");
        vm.warp(lateMaturity);
        lock.execute(later);
        require(
            policy.isAllowed(ASSET, 100) && lock.executingCivicOperation() == bytes32(0),
            "legitimate mature operation failed"
        );
    }

    function testNativeActionValueAndFailedBatchRestoreTimelockBalance() public {
        vm.deal(address(lock), 2 ether);
        vm.deal(RECIPIENT, 0);
        CivicGovernor420.Action[] memory actions = new CivicGovernor420.Action[](2);
        actions[0] = CivicGovernor420.Action({ target: RECIPIENT, value: 1 ether, data: "" });
        actions[1] = _action(address(budgets), abi.encodeCall(budgets.setController, (address(0))));
        bytes32 id = _queue(actions);
        _mature(id);
        _reject(ATTACKER, address(lock), abi.encodeCall(lock.execute, (id)), bytes4(0));
        require(address(lock).balance == 2 ether && RECIPIENT.balance == 0, "failed batch leaked funds");
        require(address(governor).balance == 0, "failed batch retained governor funds");

        CivicGovernor420.Action[] memory valid = new CivicGovernor420.Action[](1);
        valid[0] = actions[0];
        _execute(valid);
        require(address(lock).balance == 1 ether && RECIPIENT.balance == 1 ether, "exact value not transferred");
        require(address(governor).balance == 0, "governor retained action funds");
    }
}

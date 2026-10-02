// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/treasury/TreasuryIds420.sol";
import "../src/treasury/TreasuryAuthorization420.sol";
import "../src/treasury/TreasuryPolicyRegistry420.sol";
import "../src/treasury/TreasuryBudgetRegistry420.sol";
import "../src/treasury/TreasuryDisbursementRegistry420.sol";
import "../src/treasury/TreasuryRouter420.sol";

interface VmTreasuryProperties420 {
    function prank(address) external;
    function warp(uint256) external;
}

contract PropertyCaps420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) private _authorized;

    function _key(address principal, bytes32 componentId, bytes32 actionId, bytes32 scope) private pure returns (bytes32) {
        return keccak256(abi.encode(principal, componentId, actionId, scope));
    }

    function set(address principal, bytes32 componentId, bytes32 actionId, bytes32 scope, bool allowed) external {
        _authorized[_key(principal, componentId, actionId, scope)] = allowed;
    }

    function grant(bytes32) external pure returns (CapabilityGrant memory g) {
        return g;
    }

    function isAuthorized(
        address principal,
        bytes32 componentId,
        bytes32 actionId,
        bytes32 scope,
        uint256
    ) external view returns (bool) {
        return _authorized[_key(principal, componentId, actionId, scope)];
    }
}

contract RevertingCaps420 is ICapabilityRegistry420 {
    function grant(bytes32) external pure returns (CapabilityGrant memory g) {
        return g;
    }

    function isAuthorized(address, bytes32, bytes32, bytes32, uint256) external pure returns (bool) {
        revert("capability dependency unavailable");
    }
}

contract TreasurySecurityProperties420Test {
    VmTreasuryProperties420 constant vm =
        VmTreasuryProperties420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address constant EXECUTOR = address(0xE);
    address constant ASSET = address(0x420);
    bytes32 constant VAULT_ID = keccak256("treasury-vault");
    bytes32 constant ACTION = keccak256("civic-action");

    struct Env {
        PropertyCaps420 caps;
        TreasuryAuthorization420 auth;
        TreasuryPolicyRegistry420 policy;
        TreasuryBudgetRegistry420 budgets;
        TreasuryDisbursementRegistry420 disbursements;
        TreasuryRouter420 router;
        bytes32 budgetId;
    }

    function _setup(uint128 ceiling, uint128 maxSingle, uint128 maxEpoch, uint64 epochSeconds)
        internal
        returns (Env memory e)
    {
        e.caps = new PropertyCaps420();
        e.auth = new TreasuryAuthorization420(address(e.caps));
        e.policy = new TreasuryPolicyRegistry420(address(this));
        e.budgets = new TreasuryBudgetRegistry420(address(this), address(e.policy));
        e.disbursements =
            new TreasuryDisbursementRegistry420(address(this), address(e.auth), address(e.policy), address(e.budgets));
        e.budgets.setController(address(e.disbursements));
        e.router = new TreasuryRouter420(address(e.budgets), address(e.disbursements));
        e.policy.setAssetPolicy(ASSET, true, maxSingle, maxEpoch, epochSeconds);
        e.budgetId = keccak256(abi.encode("property-budget", ceiling, maxSingle, maxEpoch, epochSeconds));
        e.budgets.createBudget(
            e.budgetId,
            VAULT_ID,
            TreasuryIds420.BUDGET_DEVELOPMENT,
            ASSET,
            ceiling,
            uint64(block.timestamp),
            uint64(block.timestamp + 10000),
            ACTION,
            keccak256("property-meta")
        );
    }

    function _boundedAmount(uint256 seed, uint128 maxValue) private pure returns (uint128) {
        return uint128((seed % uint256(maxValue)) + 1);
    }

    function _recipient(uint256 seed) private pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encode("recipient", seed))) | 1));
    }

    function _schedule(
        Env memory e,
        uint256 salt,
        address recipient,
        uint128 amount,
        uint64 notBefore,
        uint64 expiresAt
    ) private returns (bytes32 id) {
        bytes32 purpose = keccak256(abi.encode("purpose", salt));
        id = e.disbursements.canonicalId(e.budgetId, recipient, amount, notBefore, expiresAt, ACTION, purpose);
        e.disbursements.schedule(id, e.budgetId, recipient, amount, notBefore, expiresAt, ACTION, purpose);
    }

    function _authorize(Env memory e, bytes32 id) private {
        e.caps.set(
            EXECUTOR,
            TreasuryIds420.COMPONENT_TREASURY,
            TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT,
            e.auth.scopeForDisbursement(id),
            true
        );
    }

    function _assertAccounting(
        Env memory e,
        uint128 expectedCommitted,
        uint128 expectedExecuted,
        uint128 ceiling
    ) private view {
        TreasuryBudgetRegistry420.Budget memory budget = e.budgets.budget(e.budgetId);
        require(budget.executed == expectedExecuted, "executed accounting drift");
        require(budget.committed == expectedCommitted, "committed accounting drift");
        require(budget.executed <= budget.committed, "executed exceeds committed");
        require(budget.committed <= budget.ceiling, "committed exceeds ceiling");
        require(budget.ceiling == ceiling, "ceiling drift");
        require(e.router.remainingBudget(e.budgetId) == uint256(ceiling - expectedCommitted), "remaining drift");
    }

    function testFuzzReserveSettleReleaseConservation(
        uint256 amountSeed0,
        uint256 amountSeed1,
        uint256 amountSeed2,
        uint256 amountSeed3,
        uint256 operationSeed
    ) public {
        uint128 ceiling = 2000;
        Env memory e = _setup(ceiling, 1000, 10000, 100);
        uint128[4] memory amounts = [
            _boundedAmount(amountSeed0, 500),
            _boundedAmount(amountSeed1, 500),
            _boundedAmount(amountSeed2, 500),
            _boundedAmount(amountSeed3, 500)
        ];
        bytes32[4] memory ids;
        uint64 notBefore = uint64(block.timestamp);
        uint64 expiresAt = uint64(block.timestamp + 500);

        uint128 committed;
        for (uint256 i = 0; i < 4; i++) {
            ids[i] = _schedule(e, i, _recipient(i), amounts[i], notBefore, expiresAt);
            _authorize(e, ids[i]);
            committed += amounts[i];
            _assertAccounting(e, committed, 0, ceiling);
        }

        uint128 executed;
        for (uint256 i = 0; i < 4; i++) {
            uint256 op = (operationSeed >> (i * 2)) & 3;
            if (op == 1) {
                vm.prank(EXECUTOR);
                e.disbursements.markExecuted(ids[i], keccak256(abi.encode("release", i, operationSeed)));
                executed += amounts[i];
            } else if (op == 2) {
                e.disbursements.cancel(ids[i]);
                committed -= amounts[i];
            }
            _assertAccounting(e, committed, executed, ceiling);
        }
    }

    function testFuzzCanonicalIdFieldBindingAndReplay(
        uint256 recipientSeed,
        uint256 amountSeed,
        uint256 timingSeed,
        bytes32 purposeSeed
    ) public {
        Env memory e = _setup(2000, 1000, 5000, 100);
        address recipient = _recipient(recipientSeed);
        uint128 amount = _boundedAmount(amountSeed, 999);
        uint64 notBefore = uint64(block.timestamp + (timingSeed % 50));
        uint64 expiresAt = uint64(notBefore + 1 + (timingSeed % 100));
        bytes32 purpose = purposeSeed == bytes32(0) ? keccak256("nonzero-purpose") : purposeSeed;

        bytes32 id =
            e.disbursements.canonicalId(e.budgetId, recipient, amount, notBefore, expiresAt, ACTION, purpose);
        e.disbursements.schedule(id, e.budgetId, recipient, amount, notBefore, expiresAt, ACTION, purpose);

        uint128 otherAmount = amount == 999 ? 998 : amount + 1;
        address otherRecipient = _recipient(recipientSeed + 1);

        require(
            e.disbursements.canonicalId(
                e.budgetId, otherRecipient, amount, notBefore, expiresAt, ACTION, purpose
            ) != id,
            "recipient not bound"
        );
        require(
            e.disbursements.canonicalId(
                e.budgetId, recipient, otherAmount, notBefore, expiresAt, ACTION, purpose
            ) != id,
            "amount not bound"
        );
        require(
            e.disbursements.canonicalId(
                e.budgetId, recipient, amount, notBefore + 1, expiresAt + 1, ACTION, purpose
            ) != id,
            "time not bound"
        );
        require(
            e.disbursements.canonicalId(
                e.budgetId, recipient, amount, notBefore, expiresAt, ACTION, keccak256(abi.encode(purpose))
            ) != id,
            "purpose not bound"
        );

        (bool replay,) = address(e.disbursements).call(
            abi.encodeWithSelector(
                e.disbursements.schedule.selector,
                id,
                e.budgetId,
                recipient,
                amount,
                notBefore,
                expiresAt,
                ACTION,
                purpose
            )
        );
        require(!replay, "canonical replay accepted");
    }

    function testPolicyRevisionPreservesSpentAmountAndEpochBoundaryResets() public {
        Env memory e = _setup(3000, 1000, 1500, 100);
        uint64 notBefore = uint64(block.timestamp);
        uint64 expiresAt = uint64(block.timestamp + 1000);
        bytes32 first = _schedule(e, 1, _recipient(1), 800, notBefore, expiresAt);
        bytes32 second = _schedule(e, 2, _recipient(2), 200, notBefore, expiresAt);
        _authorize(e, first);
        _authorize(e, second);

        vm.prank(EXECUTOR);
        e.disbursements.markExecuted(first, keccak256("release-first"));

        TreasuryPolicyRegistry420.AssetPolicy memory beforeRevision = e.policy.assetPolicy(ASSET);
        e.policy.setAssetPolicy(ASSET, true, 1000, 900, 100);
        TreasuryPolicyRegistry420.AssetPolicy memory afterRevision = e.policy.assetPolicy(ASSET);
        require(afterRevision.revision == beforeRevision.revision + 1, "revision did not advance");

        vm.prank(EXECUTOR);
        (bool sameEpoch,) = address(e.disbursements).call(
            abi.encodeWithSelector(e.disbursements.markExecuted.selector, second, keccak256("release-second"))
        );
        require(!sameEpoch, "policy revision reset spent amount");

        uint256 nextEpoch = ((block.timestamp / 100) + 1) * 100;
        vm.warp(nextEpoch);
        vm.prank(EXECUTOR);
        e.disbursements.markExecuted(second, keccak256("release-second-next-epoch"));

        TreasuryBudgetRegistry420.Budget memory budget = e.budgets.budget(e.budgetId);
        require(budget.executed == 1000, "epoch boundary execution accounting");
    }

    function testPolicyEpochDurationCannotChangeAfterInitialization() public {
        Env memory e = _setup(2000, 1000, 1500, 100);
        (bool ok,) = address(e.policy).call(
            abi.encodeWithSelector(e.policy.setAssetPolicy.selector, ASSET, true, uint128(1000), uint128(1500), uint64(200))
        );
        require(!ok, "epoch duration changed after initialization");
        require(e.policy.assetPolicy(ASSET).epochSeconds == 100, "epoch duration drift");
    }

    function testCapabilityDependencyRevertFailsClosedWithoutAccountingMutation() public {
        RevertingCaps420 revertingCaps = new RevertingCaps420();
        TreasuryAuthorization420 auth = new TreasuryAuthorization420(address(revertingCaps));
        TreasuryPolicyRegistry420 policy = new TreasuryPolicyRegistry420(address(this));
        TreasuryBudgetRegistry420 budgets = new TreasuryBudgetRegistry420(address(this), address(policy));
        TreasuryDisbursementRegistry420 disbursements =
            new TreasuryDisbursementRegistry420(address(this), address(auth), address(policy), address(budgets));
        budgets.setController(address(disbursements));
        policy.setAssetPolicy(ASSET, true, 1000, 1500, 100);

        bytes32 budgetId = keccak256("dependency-budget");
        budgets.createBudget(
            budgetId,
            VAULT_ID,
            TreasuryIds420.BUDGET_DEVELOPMENT,
            ASSET,
            2000,
            uint64(block.timestamp),
            uint64(block.timestamp + 1000),
            ACTION,
            keccak256("dependency-meta")
        );

        uint64 notBefore = uint64(block.timestamp);
        uint64 expiresAt = uint64(block.timestamp + 100);
        bytes32 purpose = keccak256("dependency-purpose");
        bytes32 id =
            disbursements.canonicalId(budgetId, _recipient(77), 500, notBefore, expiresAt, ACTION, purpose);
        disbursements.schedule(id, budgetId, _recipient(77), 500, notBefore, expiresAt, ACTION, purpose);

        vm.prank(EXECUTOR);
        (bool ok,) = address(disbursements).call(
            abi.encodeWithSelector(disbursements.markExecuted.selector, id, keccak256("release-dependency"))
        );
        require(!ok, "dependency revert did not fail closed");

        TreasuryBudgetRegistry420.Budget memory budget = budgets.budget(budgetId);
        require(budget.committed == 500, "commitment mutated on dependency failure");
        require(budget.executed == 0, "executed mutated on dependency failure");
        require(
            disbursements.disbursement(id).state == TreasuryDisbursementRegistry420.State.SCHEDULED,
            "state mutated on dependency failure"
        );
        require(disbursements.epochSpent(ASSET, block.timestamp / 100) == 0, "epoch spend mutated on dependency failure");
    }
}

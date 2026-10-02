// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/treasury/TreasuryIds420.sol";
import "../src/treasury/TreasuryAuthorization420.sol";
import "../src/treasury/TreasuryPolicyRegistry420.sol";
import "../src/treasury/TreasuryBudgetRegistry420.sol";
import "../src/treasury/TreasuryDisbursementRegistry420.sol";
import "../src/treasury/TreasuryRouter420.sol";

interface VmTreasury420 {
    function prank(address) external;
    function warp(uint256) external;
}

contract MockTreasuryCaps420 is ICapabilityRegistry420 {
    mapping(bytes32 => bool) ok;

    function key(address p, bytes32 c, bytes32 a, bytes32 s) public pure returns (bytes32) {
        return keccak256(abi.encode(p, c, a, s));
    }

    function set(address p, bytes32 c, bytes32 a, bytes32 s, bool v) external {
        ok[key(p, c, a, s)] = v;
    }

    function grant(bytes32) external pure returns (CapabilityGrant memory g) {
        return g;
    }

    function isAuthorized(address p, bytes32 c, bytes32 a, bytes32 s, uint256) external view returns (bool) {
        return ok[key(p, c, a, s)];
    }
}

contract TreasuryGenesis420Test {
    VmTreasury420 constant vm = VmTreasury420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant EXECUTOR = address(0xE);
    address constant RECIPIENT = address(0xB0B);
    address constant RECIPIENT_2 = address(0xB0C);
    address constant ASSET = address(0x420);

    struct Env {
        MockTreasuryCaps420 caps;
        TreasuryAuthorization420 auth;
        TreasuryPolicyRegistry420 policy;
        TreasuryBudgetRegistry420 budgets;
        TreasuryDisbursementRegistry420 disb;
        TreasuryRouter420 router;
    }

    function setup() internal returns (Env memory e) {
        e.caps = new MockTreasuryCaps420();
        e.auth = new TreasuryAuthorization420(address(e.caps));
        e.policy = new TreasuryPolicyRegistry420(address(this));
        e.budgets = new TreasuryBudgetRegistry420(address(this), address(e.policy));
        e.disb =
            new TreasuryDisbursementRegistry420(address(this), address(e.auth), address(e.policy), address(e.budgets));
        e.budgets.setController(address(e.disb));
        e.router = new TreasuryRouter420(address(e.budgets), address(e.disb));
        e.policy.setAssetPolicy(ASSET, true, 1000, 1500, 100);
    }

    function makeBudget(Env memory e) internal returns (bytes32 b, bytes32 action) {
        return makeBudgetWithWindow(e, uint64(block.timestamp), uint64(block.timestamp + 1000));
    }

    function makeBudgetWithWindow(Env memory e, uint64 validFrom, uint64 validUntil)
        internal
        returns (bytes32 b, bytes32 action)
    {
        b = keccak256(abi.encode("budget", validFrom, validUntil));
        action = keccak256("civic-action");
        e.budgets.createBudget(
            b,
            keccak256("treasury-vault"),
            TreasuryIds420.BUDGET_DEVELOPMENT,
            ASSET,
            2000,
            validFrom,
            validUntil,
            action,
            keccak256("meta")
        );
    }

    function schedule(
        Env memory e,
        bytes32 b,
        bytes32 action,
        address recipient,
        uint128 amount,
        uint64 nb,
        uint64 ex,
        bytes32 purpose
    ) internal returns (bytes32 id) {
        id = e.disb.canonicalId(b, recipient, amount, nb, ex, action, purpose);
        e.disb.schedule(id, b, recipient, amount, nb, ex, action, purpose);
    }

    function authorize(Env memory e, bytes32 id) internal {
        e.caps.set(
            EXECUTOR,
            TreasuryIds420.COMPONENT_TREASURY,
            TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT,
            e.auth.scopeForDisbursement(id),
            true
        );
    }

    function testCivicBoundBudgetAndReplaySafeDisbursement() public {
        Env memory e = setup();
        (bytes32 b, bytes32 action) = makeBudget(e);
        uint64 nb = uint64(block.timestamp);
        uint64 ex = uint64(block.timestamp + 100);
        bytes32 purpose = keccak256("purpose");
        bytes32 id = schedule(e, b, action, RECIPIENT, 500, nb, ex, purpose);
        (bool replay,) = address(e.disb).call(
            abi.encodeWithSelector(
                e.disb.schedule.selector, id, b, RECIPIENT, uint128(500), nb, ex, action, purpose
            )
        );
        require(!replay, "replay");
        require(e.router.remainingBudget(b) == 1500, "reserve accounting");
    }

    function testExecutionDefaultDenyAndScopedCapability() public {
        Env memory e = setup();
        (bytes32 b, bytes32 action) = makeBudget(e);
        bytes32 id = schedule(
            e,
            b,
            action,
            RECIPIENT,
            500,
            uint64(block.timestamp),
            uint64(block.timestamp + 100),
            keccak256("purpose")
        );
        vm.prank(EXECUTOR);
        (bool denied,) =
            address(e.disb).call(abi.encodeWithSelector(e.disb.markExecuted.selector, id, keccak256("release")));
        require(!denied, "default allow");

        authorize(e, id);
        vm.prank(EXECUTOR);
        e.disb.markExecuted(id, keccak256("release"));
        require(e.disb.disbursement(id).state == TreasuryDisbursementRegistry420.State.EXECUTED, "not executed");
    }

    function testBudgetAndSingleDisbursementCapsFailClosed() public {
        Env memory e = setup();
        (bytes32 b, bytes32 action) = makeBudget(e);
        uint64 nb = uint64(block.timestamp);
        uint64 ex = uint64(block.timestamp + 100);
        bytes32 purpose = keccak256("big");
        bytes32 tooBig = e.disb.canonicalId(b, RECIPIENT, 1001, nb, ex, action, purpose);
        (bool ok,) = address(e.disb).call(
            abi.encodeWithSelector(
                e.disb.schedule.selector, tooBig, b, RECIPIENT, uint128(1001), nb, ex, action, purpose
            )
        );
        require(!ok, "single cap bypass");
    }

    function testEpochCapFailsClosedAcrossDisbursements() public {
        Env memory e = setup();
        (bytes32 b, bytes32 action) = makeBudget(e);
        uint64 nb = uint64(block.timestamp);
        uint64 ex = uint64(block.timestamp + 90);
        bytes32 first = schedule(e, b, action, RECIPIENT, 800, nb, ex, keccak256("first"));
        bytes32 second = schedule(e, b, action, RECIPIENT_2, 800, nb, ex, keccak256("second"));
        authorize(e, first);
        authorize(e, second);

        vm.prank(EXECUTOR);
        e.disb.markExecuted(first, keccak256("release-1"));

        vm.prank(EXECUTOR);
        (bool ok,) =
            address(e.disb).call(abi.encodeWithSelector(e.disb.markExecuted.selector, second, keccak256("release-2")));
        require(!ok, "epoch cap bypass");
    }

    function testTemporalWindow() public {
        Env memory e = setup();
        (bytes32 b, bytes32 action) = makeBudget(e);
        uint64 nb = uint64(block.timestamp + 10);
        uint64 ex = uint64(block.timestamp + 20);
        bytes32 id = schedule(e, b, action, RECIPIENT, 100, nb, ex, keccak256("timed"));
        authorize(e, id);

        vm.prank(EXECUTOR);
        (bool early,) =
            address(e.disb).call(abi.encodeWithSelector(e.disb.markExecuted.selector, id, keccak256("release")));
        require(!early, "early execution");

        vm.warp(ex + 1);
        vm.prank(EXECUTOR);
        (bool late,) =
            address(e.disb).call(abi.encodeWithSelector(e.disb.markExecuted.selector, id, keccak256("release")));
        require(!late, "late execution");
    }

    function testScheduleCannotOutliveParentBudget() public {
        Env memory e = setup();
        uint64 validFrom = uint64(block.timestamp);
        uint64 validUntil = uint64(block.timestamp + 20);
        (bytes32 b, bytes32 action) = makeBudgetWithWindow(e, validFrom, validUntil);
        uint64 nb = uint64(block.timestamp + 5);
        uint64 ex = uint64(block.timestamp + 21);
        bytes32 purpose = keccak256("outside-budget");
        bytes32 id = e.disb.canonicalId(b, RECIPIENT, 100, nb, ex, action, purpose);
        (bool ok,) = address(e.disb).call(
            abi.encodeWithSelector(e.disb.schedule.selector, id, b, RECIPIENT, uint128(100), nb, ex, action, purpose)
        );
        require(!ok, "budget validity bypass");
    }

    function testPolicyRevocationBlocksExecutionAndRouterAgrees() public {
        Env memory e = setup();
        (bytes32 b, bytes32 action) = makeBudget(e);
        bytes32 id = schedule(
            e,
            b,
            action,
            RECIPIENT,
            500,
            uint64(block.timestamp),
            uint64(block.timestamp + 100),
            keccak256("revoked")
        );
        authorize(e, id);
        require(e.router.isExecutable(id), "expected executable");

        e.policy.setAssetPolicy(ASSET, false, 1000, 1500, 100);
        require(!e.router.isExecutable(id), "router ignored revocation");

        vm.prank(EXECUTOR);
        (bool ok,) =
            address(e.disb).call(abi.encodeWithSelector(e.disb.markExecuted.selector, id, keccak256("release")));
        require(!ok, "revoked policy executed");
    }

    function testNonzeroVaultReleaseCommitmentRequired() public {
        Env memory e = setup();
        (bytes32 b, bytes32 action) = makeBudget(e);
        bytes32 id = schedule(
            e,
            b,
            action,
            RECIPIENT,
            100,
            uint64(block.timestamp),
            uint64(block.timestamp + 100),
            keccak256("release-proof")
        );
        authorize(e, id);

        vm.prank(EXECUTOR);
        (bool ok,) = address(e.disb).call(abi.encodeWithSelector(e.disb.markExecuted.selector, id, bytes32(0)));
        require(!ok, "zero release commitment");
    }

    function testCancellationReleasesCommitmentAndIsTerminal() public {
        Env memory e = setup();
        (bytes32 b, bytes32 action) = makeBudget(e);
        bytes32 id = schedule(
            e,
            b,
            action,
            RECIPIENT,
            500,
            uint64(block.timestamp),
            uint64(block.timestamp + 100),
            keccak256("cancel")
        );
        require(e.router.remainingBudget(b) == 1500, "reservation missing");
        e.disb.cancel(id);
        require(e.router.remainingBudget(b) == 2000, "reservation not released");
        require(e.disb.disbursement(id).state == TreasuryDisbursementRegistry420.State.CANCELLED, "not cancelled");

        (bool again,) = address(e.disb).call(abi.encodeWithSelector(e.disb.cancel.selector, id));
        require(!again, "terminal cancellation replay");
    }
}

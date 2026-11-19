// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./helpers/InvariantTarget420.sol";
import "../src/system/CapabilityRegistry420.sol";
import "../src/treasury/TreasuryIds420.sol";
import "../src/treasury/TreasuryAuthorization420.sol";
import "../src/treasury/TreasuryPolicyRegistry420.sol";
import "../src/treasury/TreasuryBudgetRegistry420.sol";
import "../src/treasury/TreasuryDisbursementRegistry420.sol";
import "../src/treasury/TreasuryRouter420.sol";

interface VmTreasuryRec9 {
    function warp(uint256) external;
    function prank(address) external;
}

/// @dev Real Registry and Treasury contracts; this test fixture is the governed controller
/// configuration authority and a scoped executor, not a production privileged bypass.
contract TreasuryRec9Handler420 {
    VmTreasuryRec9 private constant vm =
        VmTreasuryRec9(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 private constant CIVIC = keccak256("rec9-civic");
    bytes32 private constant RELEASE = keccak256("rec9-release");
    uint64 private constant EPOCH = 100;
    uint128 private constant CEILING = 1000;
    address private constant TOKEN = address(0x420);
    address private constant RECIPIENT = address(0xB0B);

    CapabilityRegistry420 public immutable caps;
    TreasuryAuthorization420 public immutable auth;
    TreasuryPolicyRegistry420 public immutable policy;
    TreasuryBudgetRegistry420 public immutable budgets;
    TreasuryDisbursementRegistry420 public immutable disb;
    TreasuryRouter420 public immutable router;

    struct ModelBudget {
        uint128 committed;
        uint128 executed;
    }
    struct ModelPolicy {
        bool allowed;
        uint128 single;
        uint128 epochCap;
        uint32 revision;
    }
    struct ModelDisbursement {
        bytes32 id;
        bytes32 grant;
        uint8 budget;
        uint128 amount;
        uint64 notBefore;
        uint64 expiresAt;
        uint8 state;
        bool revoked;
    }

    ModelBudget[3] private modelBudgets;
    ModelPolicy[2] private modelPolicies;
    ModelDisbursement[] private records;
    mapping(address => mapping(uint256 => uint256)) private modelSpent;
    uint256 private serial;

    constructor() {
        vm.warp(1000);
        caps = new CapabilityRegistry420();
        caps.registerProtocolComponent(TreasuryIds420.COMPONENT_TREASURY, address(this));
        auth = new TreasuryAuthorization420(address(caps));
        policy = new TreasuryPolicyRegistry420(address(this));
        budgets = new TreasuryBudgetRegistry420(address(this), address(policy));
        disb = new TreasuryDisbursementRegistry420(address(this), address(auth), address(policy), address(budgets));
        budgets.setController(address(disb));
        router = new TreasuryRouter420(address(budgets), address(disb));
        for (uint8 i; i < 2; ++i) {
            policy.setAssetPolicy(_asset(i), true, 600, 900, EPOCH);
            modelPolicies[i] = ModelPolicy(true, 600, 900, 1);
        }
        for (uint8 i; i < 3; ++i) {
            budgets.createBudget(
                _budgetId(i), keccak256(abi.encode("vault", i)), TreasuryIds420.BUDGET_DEVELOPMENT,
                _asset(_assetIndex(i)), CEILING, 1000, 1_000_000, CIVIC, keccak256("metadata")
            );
        }
    }

    function _asset(uint8 index) private pure returns (address) {
        return index == 0 ? address(0) : TOKEN;
    }

    function _assetIndex(uint8 index) private pure returns (uint8) {
        return index == 2 ? 1 : 0;
    }

    function _budgetId(uint8 index) private pure returns (bytes32) {
        return keccak256(abi.encode("rec9-budget", index));
    }

    function schedule(uint8 seed, uint128 rawAmount, uint8 delay) external {
        // An intentionally bounded stateful witness set; all calls still exercise real contracts.
        if (records.length >= 32) return;
        uint8 b = seed % 3;
        uint8 a = _assetIndex(b);
        uint128 amount = 1 + rawAmount % 700;
        uint64 start = uint64(block.timestamp) + delay % 4;
        uint64 end = start + 20;
        bytes32 purpose = keccak256(abi.encode(++serial));
        bytes32 id = disb.canonicalId(_budgetId(b), RECIPIENT, amount, start, end, CIVIC, purpose);
        ModelPolicy memory p = modelPolicies[a];
        bool expected = p.allowed && amount <= p.single
            && uint256(modelBudgets[b].committed) + amount <= CEILING;
        (bool ok,) = address(disb).call(
            abi.encodeCall(disb.schedule, (id, _budgetId(b), RECIPIENT, amount, start, end, CIVIC, purpose))
        );
        require(ok == expected, "schedule outcome");
        if (ok) {
            bytes32 grant = keccak256(abi.encode("grant", id));
            caps.createGrant(
                grant, address(this), TreasuryIds420.COMPONENT_TREASURY,
                TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT, auth.scopeForDisbursement(id), amount, 0, 0, 0, 0
            );
            records.push(ModelDisbursement(id, grant, b, amount, start, end, 1, false));
            modelBudgets[b].committed += amount;
            _checkRecord(records[records.length - 1]);
        } else {
            (bool exists,) = address(disb).staticcall(abi.encodeCall(disb.disbursement, (id)));
            require(!exists, "failed schedule created record");
        }
        _checkBudget(b);
        _checkEpoch(a, block.timestamp / EPOCH);
    }

    function _eligible(ModelDisbursement memory d) private view returns (bool) {
        uint8 a = _assetIndex(d.budget);
        ModelPolicy memory p = modelPolicies[a];
        uint256 spent = modelSpent[_asset(a)][block.timestamp / EPOCH];
        return d.state == 1 && block.timestamp >= d.notBefore && block.timestamp <= d.expiresAt
            && p.allowed && d.amount <= p.single && spent + d.amount <= p.epochCap;
    }

    function execute(uint256 seed, bool zeroCommitment, bool wrongPrincipal) external {
        if (records.length == 0) return;
        ModelDisbursement storage d = records[seed % records.length];
        uint8 a = _assetIndex(d.budget);
        uint256 epoch = block.timestamp / EPOCH;
        bool expected = _eligible(d) && !d.revoked && !zeroCommitment && !wrongPrincipal;
        if (wrongPrincipal) vm.prank(address(0xBAD));
        (bool ok,) = address(disb).call(
            abi.encodeCall(disb.markExecuted, (d.id, zeroCommitment ? bytes32(0) : RELEASE))
        );
        require(ok == expected, "execute outcome");
        if (ok) {
            d.state = 2;
            modelBudgets[d.budget].executed += d.amount;
            modelSpent[_asset(a)][epoch] += d.amount;
        }
        _checkRecord(d);
        _checkBudget(d.budget);
        _checkEpoch(a, epoch);
    }

    function cancel(uint256 seed, bool wrongPrincipal) external {
        if (records.length == 0) return;
        ModelDisbursement storage d = records[seed % records.length];
        bool expected = d.state == 1 && !wrongPrincipal;
        if (wrongPrincipal) vm.prank(address(0xBAD));
        (bool ok,) = address(disb).call(abi.encodeCall(disb.cancel, (d.id)));
        require(ok == expected, "cancel outcome");
        if (ok) {
            d.state = 3;
            modelBudgets[d.budget].committed -= d.amount;
        }
        _checkRecord(d);
        _checkBudget(d.budget);
        _checkEpoch(_assetIndex(d.budget), block.timestamp / EPOCH);
    }

    function revoke(uint256 seed) external {
        if (records.length == 0) return;
        ModelDisbursement storage d = records[seed % records.length];
        caps.revokeGrant(d.grant);
        d.revoked = true;
        _checkRecord(d);
    }

    function revise(uint8 seed, uint128 singleSeed, uint128 capSeed, bool allowed) external {
        uint8 a = seed % 2;
        uint128 single = 1 + singleSeed % 700;
        uint128 cap = single + capSeed % 1000;
        uint32 revision = modelPolicies[a].revision + 1;
        policy.setAssetPolicy(_asset(a), allowed, single, cap, EPOCH);
        modelPolicies[a] = ModelPolicy(allowed, single, cap, revision);
        _checkPolicy(a);
        _checkEpoch(a, block.timestamp / EPOCH);
    }

    function advance(uint8 delta) external {
        uint256 prior = block.timestamp / EPOCH;
        vm.warp(block.timestamp + 1 + uint256(delta % 110));
        for (uint8 a; a < 2; ++a) {
            _checkEpoch(a, prior);
            _checkEpoch(a, block.timestamp / EPOCH);
        }
    }

    function inspect(uint256 seed) external view {
        if (records.length != 0) _checkRecord(records[seed % records.length]);
    }

    function _checkRecord(ModelDisbursement memory d) private view {
        TreasuryDisbursementRegistry420.Disbursement memory actual = disb.disbursement(d.id);
        require(actual.exists && uint8(actual.state) == d.state, "state drift");
        require(actual.budgetId == _budgetId(d.budget) && actual.asset == _asset(_assetIndex(d.budget)), "asset/budget drift");
        require(actual.recipient == RECIPIENT && actual.amount == d.amount, "recipient/amount drift");
        require(actual.notBefore == d.notBefore && actual.expiresAt == d.expiresAt, "window drift");
        require(actual.civicActionHash == CIVIC, "Civic binding drift");
        require(actual.vaultReleaseHash == (d.state == 2 ? RELEASE : bytes32(0)), "release drift");
        require(router.isExecutable(d.id) == _eligible(d), "router/model drift");
        require(caps.grant(d.grant).revoked == d.revoked, "capability revocation drift");
    }

    function _checkBudget(uint8 b) private view {
        TreasuryBudgetRegistry420.Budget memory actual = budgets.budget(_budgetId(b));
        ModelBudget memory expected = modelBudgets[b];
        require(actual.executed == expected.executed && actual.committed == expected.committed, "budget drift");
        require(actual.executed <= actual.committed && actual.committed <= CEILING, "conservation");
        require(router.remainingBudget(_budgetId(b)) == CEILING - expected.committed, "remaining drift");
    }

    function _checkEpoch(uint8 a, uint256 epoch) private view {
        require(disb.epochSpent(_asset(a), epoch) == modelSpent[_asset(a)][epoch], "epoch drift");
    }

    function _checkPolicy(uint8 a) private view {
        ModelPolicy memory p = modelPolicies[a];
        TreasuryPolicyRegistry420.AssetPolicy memory actual = policy.assetPolicy(_asset(a));
        require(actual.allowed == p.allowed && actual.maxSingleDisbursement == p.single, "policy drift");
        require(actual.revision == p.revision && actual.epochSeconds == EPOCH, "epoch/revision drift");
        require(actual.maxEpochDisbursement == p.epochCap, "cap drift");
    }

    function assertModel() external view {
        for (uint8 b; b < 3; ++b) _checkBudget(b);
        for (uint8 a; a < 2; ++a) {
            _checkPolicy(a);
            _checkEpoch(a, block.timestamp / EPOCH);
        }
        // Check the latest record even when the invariant driver does not select inspect.
        if (records.length != 0) _checkRecord(records[records.length - 1]);
    }
}

contract TreasuryRec9Invariant420Test is InvariantTarget420 {
    TreasuryRec9Handler420 private handler;

    function setUp() public {
        handler = new TreasuryRec9Handler420();
        targetContract(address(handler));
    }

    function invariant_RealCapabilityScopedAccountingAndEligibility() public view {
        handler.assertModel();
    }
}

contract TreasuryRec9Boundary420Test {
    VmTreasuryRec9 private constant vm =
        VmTreasuryRec9(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 private constant A = keccak256("budget-a");
    bytes32 private constant B = keccak256("budget-b");
    bytes32 private constant CIVIC = keccak256("civic");
    bytes32 private constant PURPOSE = keccak256("purpose");
    address private constant RECIPIENT = address(0xB0B);
    address private constant EXECUTOR = address(0xE420);
    CapabilityRegistry420 private caps;
    TreasuryAuthorization420 private auth;
    TreasuryPolicyRegistry420 private policy;
    TreasuryBudgetRegistry420 private budgets;
    TreasuryDisbursementRegistry420 private disb;
    TreasuryRouter420 private router;

    function setUp() public {
        vm.warp(1000);
        caps = new CapabilityRegistry420();
        caps.registerProtocolComponent(TreasuryIds420.COMPONENT_TREASURY, address(this));
        auth = new TreasuryAuthorization420(address(caps));
        policy = new TreasuryPolicyRegistry420(address(this));
        budgets = new TreasuryBudgetRegistry420(address(this), address(policy));
        disb = new TreasuryDisbursementRegistry420(address(this), address(auth), address(policy), address(budgets));
        router = new TreasuryRouter420(address(budgets), address(disb));
        budgets.setController(address(disb));
        for (uint256 i; i < 2; ++i) {
            address asset = i == 0 ? address(0) : address(0x420);
            policy.setAssetPolicy(asset, true, type(uint128).max, type(uint128).max, 100);
            budgets.createBudget(
                i == 0 ? A : B, keccak256("vault"), TreasuryIds420.BUDGET_DEVELOPMENT,
                asset, type(uint128).max, 1000, 2000, CIVIC, keccak256("metadata")
            );
        }
    }

    function _reject(address target, bytes memory data, bytes4 selector) private {
        (bool ok, bytes memory reason) = target.call(data);
        require(!ok && (selector == bytes4(0) || bytes4(reason) == selector), "unexpected acceptance/rejection");
    }

    function _schedule(bytes32 budget, uint128 amount, bytes32 purpose) private returns (bytes32 id) {
        id = disb.canonicalId(budget, RECIPIENT, amount, 1000, 2000, CIVIC, purpose);
        disb.schedule(id, budget, RECIPIENT, amount, 1000, 2000, CIVIC, purpose);
    }

    function _grant(bytes32 id, uint128 amount) private {
        caps.createGrant(
            keccak256(abi.encode("grant", id)), EXECUTOR, TreasuryIds420.COMPONENT_TREASURY,
            TreasuryIds420.ACTION_EXECUTE_DISBURSEMENT, auth.scopeForDisbursement(id), amount, 0, 0, 0, 0
        );
    }

    function testUint128CeilingAndEpochSaturationRemainAtomic() public {
        uint128 maximum = type(uint128).max;
        bytes32 id = _schedule(A, maximum, PURPOSE);
        bytes32 secondPurpose = keccak256("second");
        bytes32 second = disb.canonicalId(A, RECIPIENT, 1, 1000, 2000, CIVIC, secondPurpose);
        _reject(
            address(disb), abi.encodeCall(disb.schedule, (second, A, RECIPIENT, 1, 1000, 2000, CIVIC, secondPurpose)),
            TreasuryBudgetRegistry420.BudgetExceeded.selector
        );
        _grant(id, maximum);
        vm.prank(EXECUTOR);
        disb.markExecuted(id, keccak256("release"));
        require(budgets.budget(A).executed == maximum && budgets.budget(A).committed == maximum, "uint128 saturation");
        require(disb.epochSpent(address(0), 10) == maximum && router.remainingBudget(A) == 0, "epoch/remaining");
        bytes32 other = _schedule(B, maximum, PURPOSE);
        _grant(other, maximum);
        vm.prank(EXECUTOR);
        disb.markExecuted(other, keccak256("other release"));
        require(disb.epochSpent(address(0x420), 10) == maximum, "asset bucket isolation");
        vm.prank(EXECUTOR);
        _reject(
            address(disb), abi.encodeCall(disb.markExecuted, (id, keccak256("replay"))),
            TreasuryDisbursementRegistry420.InvalidState.selector
        );
        require(disb.epochSpent(address(0), 10) == maximum, "replay mutated epoch");
    }

    function testFuzzBudgetAssetRecipientAndActionSubstitution(uint128 seed, address alternate) public {
        uint128 amount = seed == 0 ? 1 : seed;
        if (alternate == RECIPIENT || alternate == address(0)) alternate = address(0xB0C);
        bytes32 id = disb.canonicalId(A, RECIPIENT, amount, 1000, 2000, CIVIC, PURPOSE);
        _reject(
            address(disb), abi.encodeCall(disb.schedule, (id, B, RECIPIENT, amount, 1000, 2000, CIVIC, PURPOSE)),
            TreasuryDisbursementRegistry420.InvalidDisbursement.selector
        );
        _reject(
            address(disb), abi.encodeCall(disb.schedule, (id, A, alternate, amount, 1000, 2000, CIVIC, PURPOSE)),
            TreasuryDisbursementRegistry420.InvalidDisbursement.selector
        );
        _reject(
            address(disb),
            abi.encodeCall(disb.schedule, (id, A, RECIPIENT, amount, 1000, 2000, keccak256("other"), PURPOSE)),
            TreasuryDisbursementRegistry420.InvalidDisbursement.selector
        );
        require(budgets.budget(A).committed == 0 && budgets.budget(B).committed == 0, "substitution accounting");
        require(_schedule(A, amount, PURPOSE) == id, "canonical schedule");
        bytes32 tokenId = _schedule(B, amount, PURPOSE);
        _grant(id, amount);
        vm.prank(EXECUTOR);
        _reject(
            address(disb), abi.encodeCall(disb.markExecuted, (tokenId, keccak256("wrong asset"))),
            TreasuryDisbursementRegistry420.ExecutionUnauthorized.selector
        );
        require(disb.disbursement(tokenId).asset == address(0x420) && budgets.budget(B).executed == 0, "asset substitution");
    }

    function testMalformedCalldataAndUnknownSelectorsCannotMutateAccounting() public {
        bytes32 id = _schedule(A, 1, PURPOSE);
        _grant(id, 1);
        bytes32 beforeState = keccak256(abi.encode(disb.disbursement(id), budgets.budget(A)));
        vm.prank(EXECUTOR);
        _reject(address(disb), abi.encodePacked(disb.markExecuted.selector, id), bytes4(0));
        _reject(address(disb), hex"ffffffff", bytes4(0));
        _reject(address(policy), abi.encodePacked(policy.setAssetPolicy.selector, bytes32(0)), bytes4(0));
        _reject(address(disb), abi.encodeCall(disb.cancel, (keccak256("unknown"))),
            TreasuryDisbursementRegistry420.DisbursementNotFound.selector);
        require(keccak256(abi.encode(disb.disbursement(id), budgets.budget(A))) == beforeState, "malformed mutation");
        require(disb.epochSpent(address(0), 10) == 0, "malformed epoch mutation");
        vm.prank(EXECUTOR);
        disb.markExecuted(id, keccak256("valid"));
        require(budgets.budget(A).executed == 1, "valid recovery");
    }
}

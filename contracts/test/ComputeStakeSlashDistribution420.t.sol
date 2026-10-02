// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/compute/ComputeStakeSlashDistribution420.sol";
import "../src/interfaces/IComputeSlashDistributionSource420.sol";
import "../src/interfaces/IComputeSlashRecipientResolver420.sol";

interface VmSlashDistribution420 {
    function prank(address caller) external;
}

contract MockSlashRecipientResolver420 is IComputeSlashRecipientResolver420 {
    Recipients private _recipients;

    function set(address payer, address replacement, address challenger) external {
        _recipients = Recipients(payer, replacement, challenger);
    }

    function resolve(bytes32, bytes32, address, bytes32, address)
        external
        view
        returns (Recipients memory recipients)
    {
        return _recipients;
    }
}

contract MockSlashDistributionSource420 is IComputeSlashDistributionSource420 {
    mapping(bytes32 => uint256) public remaining;
    mapping(address => uint256) public paid;
    bytes32 public lastAuthorization;

    function set(bytes32 positionId, uint256 amount) external {
        remaining[positionId] = amount;
    }

    function previewSlashBatch(bytes32 positionId, uint256 maxAmount, uint64 maxTranches)
        external
        view
        returns (uint256 amount, uint64 visitedTranches)
    {
        if (maxAmount == 0 || maxTranches == 0) return (0, 0);
        uint256 cap = uint256(maxTranches) * 40 ether;
        amount = remaining[positionId];
        if (amount > maxAmount) amount = maxAmount;
        if (amount > cap) amount = cap;
        if (amount == 0) return (0, 0);
        visitedTranches = uint64((amount + 40 ether - 1) / 40 ether);
    }

    function executeSlashBatch(
        bytes32 positionId,
        bytes32 authorizationRef,
        uint256 amount,
        uint64 maxTranches,
        address[] calldata recipients,
        uint256[] calldata recipientAmounts
    ) external returns (uint64 visitedTranches) {
        require(recipients.length == recipientAmounts.length && amount != 0, "shape");
        uint256 cap = uint256(maxTranches) * 40 ether;
        require(amount <= cap && amount <= remaining[positionId], "capacity");

        uint256 total;
        for (uint256 i; i < recipients.length; ++i) {
            require(recipients[i] != address(0) && recipientAmounts[i] != 0, "recipient");
            paid[recipients[i]] += recipientAmounts[i];
            total += recipientAmounts[i];
        }
        require(total == amount, "sum");
        remaining[positionId] -= amount;
        lastAuthorization = authorizationRef;
        visitedTranches = uint64((amount + 40 ether - 1) / 40 ether);
    }
}

contract MockSlashDistributionAuthorizer420 {
    mapping(bytes32 => ComputeStakeSlashAuthorization420.Authorization) private _auths;
    address public distributionPolicies;
    address public distributionExecutor;
    address public workerCollateral;
    address public verifierCollateral;
    uint256 public consumeCount;

    constructor(address policies_, address worker_, address verifier_) {
        distributionPolicies = policies_;
        workerCollateral = worker_;
        verifierCollateral = verifier_;
    }

    function setExecutor(address executor_) external {
        distributionExecutor = executor_;
    }

    function setAuthorization(
        bytes32 ref,
        ComputeStakeSlashAuthorization420.Authorization calldata a
    ) external {
        _auths[ref] = a;
    }

    function authorization(bytes32 ref)
        external
        view
        returns (ComputeStakeSlashAuthorization420.Authorization memory a)
    {
        a = _auths[ref];
        require(a.exists, "missing");
    }

    function consumeDistribution(bytes32 ref) external returns (uint256 amount) {
        require(msg.sender == distributionExecutor, "executor");
        ComputeStakeSlashAuthorization420.Authorization storage a = _auths[ref];
        require(a.exists && !a.distributed, "state");
        a.distributed = true;
        ++consumeCount;
        return a.amount;
    }
}

contract ComputeStakeSlashDistribution420Test {
    VmSlashDistribution420 private constant vm =
        VmSlashDistribution420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant GOV = address(0x420);
    address private constant SUBJECT = address(0xBAD0);
    address private constant PAYER = address(0x1111);
    address private constant REPLACEMENT = address(0x2222);
    address private constant CHALLENGER = address(0x3333);
    address private constant TREASURY = address(0x4444);

    bytes32 private constant AUTH_REF = keccak256("auth-ref");
    bytes32 private constant POSITION = keccak256("position");
    bytes32 private constant SLASH_POLICY_COMMITMENT = keccak256("slash-policy-commitment");

    ComputeStakeSlashDistributionPolicy420 private policies;
    MockSlashRecipientResolver420 private resolver;
    MockSlashDistributionSource420 private workerSource;
    MockSlashDistributionSource420 private verifierSource;
    MockSlashDistributionAuthorizer420 private authorizer;
    ComputeStakeSlashDistribution420 private distribution;

    uint32 private distributionRevision;
    bytes32 private distributionCommitment;
    uint256 private totalAmount;

    function setUp() public {
        resolver = new MockSlashRecipientResolver420();
        resolver.set(PAYER, REPLACEMENT, CHALLENGER);

        policies = new ComputeStakeSlashDistributionPolicy420(GOV);
        vm.prank(GOV);
        distributionRevision = policies.publish(
            SLASH_POLICY_COMMITMENT,
            address(resolver),
            TREASURY,
            4000,
            3000,
            2000,
            1000
        );
        distributionCommitment =
            policies.commitment(SLASH_POLICY_COMMITMENT, distributionRevision);

        workerSource = new MockSlashDistributionSource420();
        verifierSource = new MockSlashDistributionSource420();
        authorizer = new MockSlashDistributionAuthorizer420(
            address(policies), address(workerSource), address(verifierSource)
        );
        distribution =
            new ComputeStakeSlashDistribution420(address(authorizer), address(policies));
        authorizer.setExecutor(address(distribution));

        totalAmount = 101 ether + 3;
        workerSource.set(POSITION, totalAmount);
        authorizer.setAuthorization(AUTH_REF, _authorization(distributionCommitment));
    }

    function _authorization(bytes32 exactDistributionCommitment)
        private
        view
        returns (ComputeStakeSlashAuthorization420.Authorization memory a)
    {
        a = ComputeStakeSlashAuthorization420.Authorization({
            authorizationRef: AUTH_REF,
            positionId: POSITION,
            subjectKind: 1,
            subjectRef: keccak256("worker"),
            subjectAccount: SUBJECT,
            stakePolicyId: keccak256("stake-policy"),
            slashPolicyRevision: 1,
            slashPolicyCommitment: SLASH_POLICY_COMMITMENT,
            evidenceAdapter: address(0x5555),
            evidenceRef: keccak256("evidence"),
            misconductKey: keccak256("misconduct"),
            evidenceCommitment: keccak256("evidence-commitment"),
            violationCode: keccak256("violation"),
            amount: totalAmount,
            distributionPolicyRevision: distributionRevision,
            distributionPolicyCommitment: exactDistributionCommitment,
            authorizedAt: uint64(block.timestamp),
            distributed: false,
            exists: true
        });
    }

    function _bps(uint256 amount, uint16 bps) private pure returns (uint256) {
        uint256 whole = amount / 10_000;
        uint256 remainder = amount % 10_000;
        return whole * uint256(bps) + (remainder * uint256(bps)) / 10_000;
    }

    function testDistributionIsResumableAndConsumesOnlyAfterFinalBatch() public {
        (uint256 first, bool done) = distribution.executeBatch(AUTH_REF, 1);
        require(first == 40 ether && !done, "first batch");
        require(authorizer.consumeCount() == 0, "consumed early");

        (uint256 second, done) = distribution.executeBatch(AUTH_REF, 1);
        require(second == 40 ether && !done, "second batch");
        require(authorizer.consumeCount() == 0, "consumed early two");

        (uint256 third, done) = distribution.executeBatch(AUTH_REF, 2);
        require(third == totalAmount - 80 ether && done, "final batch");
        require(authorizer.consumeCount() == 1, "not consumed");

        uint256 payerTarget = _bps(totalAmount, 4000);
        uint256 replacementTarget = _bps(totalAmount, 3000);
        uint256 challengerTarget = _bps(totalAmount, 2000);
        uint256 treasuryTarget = _bps(totalAmount, 1000);
        uint256 assigned = payerTarget + replacementTarget + challengerTarget + treasuryTarget;
        payerTarget += totalAmount - assigned;

        require(workerSource.paid(PAYER) == payerTarget, "payer target");
        require(workerSource.paid(REPLACEMENT) == replacementTarget, "replacement target");
        require(workerSource.paid(CHALLENGER) == challengerTarget, "challenger target");
        require(workerSource.paid(TREASURY) == treasuryTarget, "treasury target");
        require(workerSource.remaining(POSITION) == 0, "source remainder");
        require(workerSource.lastAuthorization() == AUTH_REF, "authorization binding");

        ComputeStakeSlashDistribution420.Execution memory e =
            distribution.execution(AUTH_REF);
        require(e.completed && e.distributedAmount == totalAmount, "execution state");
    }

    function testCompletedDistributionCannotReplay() public {
        distribution.executeBatch(AUTH_REF, 10);
        (bool ok,) = address(distribution).call(
            abi.encodeCall(distribution.executeBatch, (AUTH_REF, uint64(1)))
        );
        require(!ok, "distribution replay");
        require(authorizer.consumeCount() == 1, "double consume");
    }

    function testFrozenDistributionCommitmentMismatchFailsClosed() public {
        bytes32 badRef = keccak256("bad-auth");
        ComputeStakeSlashAuthorization420.Authorization memory a =
            _authorization(keccak256("wrong-distribution-commitment"));
        a.authorizationRef = badRef;
        authorizer.setAuthorization(badRef, a);
        workerSource.set(POSITION, totalAmount);

        (bool ok,) = address(distribution).call(
            abi.encodeCall(distribution.executeBatch, (badRef, uint64(1)))
        );
        require(!ok, "stale/tampered distribution accepted");
        require(authorizer.consumeCount() == 0, "failed distribution consumed");
    }

    function testSubjectCannotReceiveItsOwnSlashDistribution() public {
        resolver.set(SUBJECT, REPLACEMENT, CHALLENGER);
        (bool ok,) = address(distribution).call(
            abi.encodeCall(distribution.executeBatch, (AUTH_REF, uint64(1)))
        );
        require(!ok, "subject received own slash");
        require(workerSource.remaining(POSITION) == totalAmount, "failed route moved funds");
    }
}

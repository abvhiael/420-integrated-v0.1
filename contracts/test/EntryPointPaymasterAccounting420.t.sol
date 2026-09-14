// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/accounts/EntryPoint420.sol";
import "../src/accounts/IPaymaster420.sol";
import "../src/accounts/PaymasterData420.sol";

interface VmGas3 {
    function chainId(uint256 newChainId) external;
    function warp(uint256 newTimestamp) external;
    function deal(address who, uint256 newBalance) external;
}

contract Gas3Paymaster420 is IPaymaster420 {
    function validatePaymasterUserOp(PackedUserOperation420 calldata, bytes32, uint256)
        external
        pure
        returns (bytes memory context, uint256 validationData)
    {
        return (hex"0420", 0);
    }

    function postOp(PostOpMode420, bytes calldata, uint256) external pure {
        revert("GAS-4 only");
    }

    function withdraw(EntryPoint420 entryPoint, address payable recipient, uint256 amountWei) external {
        entryPoint.withdrawTo(recipient, amountWei);
    }
}

contract Gas3Account420 is IAccountValidation420 {
    EntryPoint420 public entryPoint;
    address public paymaster;
    uint256 public expectedReservation;
    uint256 public observedReservation;
    uint256 public executions;

    function configureObservation(EntryPoint420 ep, address sponsor, uint256 expected) external {
        entryPoint = ep;
        paymaster = sponsor;
        expectedReservation = expected;
    }

    function validateUserOp(PackedUserOperation420 calldata, bytes32, uint256) external pure returns (uint256) {
        return 0;
    }

    function execute() external {
        observedReservation = entryPoint.reservedOf(paymaster);
        require(observedReservation == expectedReservation, "reservation not active during execution");
        executions += 1;
    }
}

contract EntryPointPaymasterAccounting420Test {
    VmGas3 internal constant vm = VmGas3(address(uint160(uint256(keccak256("hevm cheat code")))));

    EntryPoint420 internal entryPoint;
    Gas3Paymaster420 internal paymaster;
    Gas3Account420 internal account;

    receive() external payable {}

    function setUp() public {
        vm.chainId(420);
        vm.warp(500);
        vm.deal(address(this), 100 ether);
        entryPoint = new EntryPoint420();
        paymaster = new Gas3Paymaster420();
        account = new Gas3Account420();
    }

    function testDepositCreatesOnChainAvailableBalance() public {
        entryPoint.depositTo{value: 5 ether}(address(paymaster));
        require(entryPoint.balanceOf(address(paymaster)) == 5 ether, "deposit balance mismatch");
        require(entryPoint.reservedOf(address(paymaster)) == 0, "unexpected reservation");
        require(entryPoint.availableOf(address(paymaster)) == 5 ether, "available balance mismatch");
    }

    function testSponsoredOperationReservesExactMaxCostDuringExecutionAndReleasesAfter() public {
        entryPoint.depositTo{value: 1 ether}(address(paymaster));
        uint256 maxCostWei = 221_000 * 1 gwei;
        bytes32 authorizationId = keccak256("420/GAS/GAS3/AUTH/1");
        account.configureObservation(entryPoint, address(paymaster), maxCostWei);

        PackedUserOperation420 memory op = _sponsoredOp(0, authorizationId);
        (bool success,) = entryPoint.handleOp(op);

        require(success, "sponsored execution failed");
        require(account.observedReservation() == maxCostWei, "execution did not observe reservation");
        require(entryPoint.reservedOf(address(paymaster)) == 0, "reservation not released");
        require(entryPoint.availableOf(address(paymaster)) == 1 ether, "GAS-3 charged deposit early");
        require(entryPoint.authorizationConsumed(address(paymaster), authorizationId), "authorization not consumed");
        (uint256 amountWei, bool active) = entryPoint.reservationOf(address(paymaster), authorizationId);
        require(amountWei == 0 && !active, "released reservation remains active");
    }

    function testInsufficientDepositFailsBeforeNonceConsumptionAndExecution() public {
        entryPoint.depositTo{value: 1 wei}(address(paymaster));
        bytes32 authorizationId = keccak256("420/GAS/GAS3/AUTH/LOW");
        PackedUserOperation420 memory op = _sponsoredOp(0, authorizationId);

        (bool ok, bytes memory reason) = address(entryPoint).call(
            abi.encodeWithSelector(EntryPoint420.handleOp.selector, op)
        );
        require(!ok, "underfunded sponsor accepted");
        require(_selector(reason) == EntryPoint420.InsufficientPaymasterDeposit.selector, "wrong underfunded failure");
        require(entryPoint.getNonce(address(account), 0) == 0, "nonce consumed on underfunded sponsorship");
        require(account.executions() == 0, "account executed without funded reservation");
        require(!entryPoint.authorizationConsumed(address(paymaster), authorizationId), "failed reservation consumed authorization");
    }

    function testAuthorizationIdIsSingleUseAcrossDifferentUserOps() public {
        entryPoint.depositTo{value: 1 ether}(address(paymaster));
        bytes32 authorizationId = keccak256("420/GAS/GAS3/AUTH/REPLAY");
        uint256 maxCostWei = 221_000 * 1 gwei;
        account.configureObservation(entryPoint, address(paymaster), maxCostWei);

        PackedUserOperation420 memory first = _sponsoredOp(0, authorizationId);
        (bool success,) = entryPoint.handleOp(first);
        require(success, "first authorization use failed");

        PackedUserOperation420 memory second = _sponsoredOp(1, authorizationId);
        (bool ok, bytes memory reason) = address(entryPoint).call(
            abi.encodeWithSelector(EntryPoint420.handleOp.selector, second)
        );
        require(!ok, "authorization replay accepted");
        require(_selector(reason) == EntryPoint420.SponsorshipAuthorizationAlreadyConsumed.selector, "wrong replay failure");
        require(entryPoint.getNonce(address(account), 0) == 1, "nonce consumed on replay rejection");
    }

    function testPaymasterCanWithdrawOnlyAvailableDeposit() public {
        entryPoint.depositTo{value: 2 ether}(address(paymaster));
        uint256 beforeBalance = address(this).balance;
        paymaster.withdraw(entryPoint, payable(address(this)), 1 ether);
        require(entryPoint.balanceOf(address(paymaster)) == 1 ether, "deposit not debited");
        require(entryPoint.availableOf(address(paymaster)) == 1 ether, "available balance wrong after withdrawal");
        require(address(this).balance == beforeBalance + 1 ether, "recipient not paid");
    }

    function testNonPaymasterCannotWithdrawAnotherSponsorsDeposit() public {
        entryPoint.depositTo{value: 2 ether}(address(paymaster));
        (bool ok, bytes memory reason) = address(entryPoint).call(
            abi.encodeWithSelector(EntryPoint420.withdrawTo.selector, payable(address(this)), 1 ether)
        );
        require(!ok, "unrelated caller withdrew sponsor balance");
        require(_selector(reason) == EntryPoint420.InsufficientPaymasterDeposit.selector, "wrong unauthorized withdrawal failure");
        require(entryPoint.balanceOf(address(paymaster)) == 2 ether, "sponsor balance changed");
    }

    function _sponsoredOp(uint256 nonceValue, bytes32 authorizationId)
        internal
        view
        returns (PackedUserOperation420 memory op)
    {
        uint256 verificationGasLimit = 100_000;
        uint256 callGasLimit = 100_000;
        op = PackedUserOperation420({
            sender: address(account),
            nonce: nonceValue,
            initCode: bytes(""),
            callData: abi.encodeWithSelector(Gas3Account420.execute.selector),
            accountGasLimits: bytes32((verificationGasLimit << 128) | callGasLimit),
            preVerificationGas: 21_000,
            gasFees: bytes32(uint256(1 gwei)),
            paymasterAndData: bytes(""),
            signature: bytes("")
        });

        PaymasterData420.V1 memory data = PaymasterData420.V1({
            version: 1,
            paymaster: address(paymaster),
            entryPoint: address(entryPoint),
            chainId: 420,
            policyId: keccak256("420/GAS/GAS3/POLICY"),
            validAfter: 100,
            validUntil: 1000,
            maxSponsoredCostWei: 1 ether,
            authorizationId: authorizationId,
            sponsorData: hex"0420"
        });
        op.paymasterAndData = PaymasterData420.encodeV1(data);
    }

    function _selector(bytes memory reason) private pure returns (bytes4 selector) {
        if (reason.length < 4) return bytes4(0);
        assembly { selector := mload(add(reason, 32)) }
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/accounts/Paymaster420.sol";
import "../src/accounts/SmartAccount420.sol";

interface VmPaymaster420 {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function prank(address msgSender) external;
    function chainId(uint256 newChainId) external;
    function warp(uint256 newTimestamp) external;
}

contract PaymasterTarget420 {
    function set(uint256) external {}
    function alternate(uint256) external {}
}

contract Paymaster420Test {
    VmPaymaster420 internal constant vm = VmPaymaster420(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 internal constant SPONSOR_PK = 0x420BEEF;

    address internal constant ENTRY_POINT = address(0xE420);
    address internal constant ACCOUNT = address(0xA420);

    SponsorshipPolicy420 internal policies;
    Paymaster420 internal paymaster;
    PaymasterTarget420 internal target;
    address internal sponsorSigner;
    bytes32 internal policyId;

    function setUp() public {
        vm.chainId(420);
        vm.warp(500);
        sponsorSigner = vm.addr(SPONSOR_PK);
        policies = new SponsorshipPolicy420(address(this));
        paymaster = new Paymaster420(ENTRY_POINT, address(policies), address(this), sponsorSigner);
        target = new PaymasterTarget420();

        SponsorshipPolicy420.Policy memory policy = SponsorshipPolicy420.Policy({
            account: ACCOUNT,
            target: address(target),
            selector: PaymasterTarget420.set.selector,
            maxValueWei: 0,
            maxCostWei: 1 ether,
            validAfter: 100,
            validUntil: 1000,
            capabilityCommitment: bytes32(0),
            sessionCommitment: bytes32(0)
        });
        policyId = policies.registerPolicy(policy);
    }

    function testValidSponsorSignatureAndPolicyPass() public {
        PackedUserOperation420 memory op = _signedSponsoredOp(PaymasterTarget420.set.selector, policyId);
        vm.prank(ENTRY_POINT);
        (bytes memory context, uint256 validationData) = paymaster.validatePaymasterUserOp(op, keccak256("final-user-op"), 0.1 ether);
        require(validationData == 0, "valid sponsorship rejected");
        (bytes32 authorizationId, bytes32 sponsorshipDigest, bytes32 finalHash) =
            abi.decode(context, (bytes32, bytes32, bytes32));
        require(authorizationId == keccak256("AUTH-420"), "authorization context");
        require(sponsorshipDigest != bytes32(0), "digest missing");
        require(finalHash == keccak256("final-user-op"), "final hash context");
    }

    function testOperationMutationAfterSponsorSignatureFailsClosed() public {
        PackedUserOperation420 memory op = _signedSponsoredOp(PaymasterTarget420.set.selector, policyId);
        op.callData = abi.encodeWithSelector(
            SmartAccount420.execute.selector,
            address(target),
            0,
            abi.encodeWithSelector(PaymasterTarget420.alternate.selector, 420)
        );
        vm.prank(ENTRY_POINT);
        (, uint256 validationData) = paymaster.validatePaymasterUserOp(op, keccak256("mutated-final-user-op"), 0.1 ether);
        require(validationData == 1, "mutated operation accepted");
    }

    function testDisabledPolicyFailsClosedEvenWithValidSignature() public {
        PackedUserOperation420 memory op = _signedSponsoredOp(PaymasterTarget420.set.selector, policyId);
        policies.setPolicyEnabled(policyId, false);
        vm.prank(ENTRY_POINT);
        (, uint256 validationData) = paymaster.validatePaymasterUserOp(op, keccak256("final-user-op"), 0.1 ether);
        require(validationData == 1, "disabled policy accepted");
    }

    function testOnlyEntryPointCanValidateOrPostOp() public {
        PackedUserOperation420 memory op = _signedSponsoredOp(PaymasterTarget420.set.selector, policyId);
        (bool validateOk,) = address(paymaster).call(
            abi.encodeWithSelector(Paymaster420.validatePaymasterUserOp.selector, op, keccak256("final-user-op"), 0.1 ether)
        );
        require(!validateOk, "non-entrypoint validation accepted");

        (bool postOk,) = address(paymaster).call(
            abi.encodeWithSelector(Paymaster420.postOp.selector, PostOpMode420.OpSucceeded, abi.encode(bytes32(0), bytes32(0), bytes32(0)), 1)
        );
        require(!postOk, "non-entrypoint postOp accepted");
    }

    function testSponsorSignerRotationInvalidatesOldProof() public {
        PackedUserOperation420 memory op = _signedSponsoredOp(PaymasterTarget420.set.selector, policyId);
        paymaster.setSponsorSigner(vm.addr(0x420CAFE));
        vm.prank(ENTRY_POINT);
        (, uint256 validationData) = paymaster.validatePaymasterUserOp(op, keccak256("final-user-op"), 0.1 ether);
        require(validationData == 1, "old sponsor proof survived signer rotation");
    }

    function _signedSponsoredOp(bytes4 targetSelector, bytes32 selectedPolicyId)
        internal
        returns (PackedUserOperation420 memory op)
    {
        op = PackedUserOperation420({
            sender: ACCOUNT,
            nonce: 7,
            initCode: bytes(""),
            callData: abi.encodeWithSelector(
                SmartAccount420.execute.selector,
                address(target),
                0,
                abi.encodeWithSelector(targetSelector, 420)
            ),
            accountGasLimits: bytes32(uint256(100000) << 128 | uint256(100000)),
            preVerificationGas: 21000,
            gasFees: bytes32(uint256(1 gwei)),
            paymasterAndData: bytes(""),
            signature: bytes("")
        });

        PaymasterData420.V1 memory sponsorship = PaymasterData420.V1({
            version: 1,
            paymaster: address(paymaster),
            entryPoint: ENTRY_POINT,
            chainId: 420,
            policyId: selectedPolicyId,
            validAfter: 100,
            validUntil: 1000,
            maxSponsoredCostWei: 1 ether,
            authorizationId: keccak256("AUTH-420"),
            sponsorData: bytes("")
        });

        bytes32 sponsorshipDigest = _sponsorshipDigest(op, sponsorship);
        bytes32 signedDigest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", sponsorshipDigest));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SPONSOR_PK, signedDigest);
        bytes memory sponsorData = abi.encode(abi.encodePacked(r, s, v), bytes32(0), bytes32(0));
        sponsorship.sponsorData = sponsorData;
        op.paymasterAndData = PaymasterData420.encodeV1(sponsorship);
    }

    function _sponsorshipDigest(PackedUserOperation420 memory op, PaymasterData420.V1 memory sponsorship)
        internal
        pure
        returns (bytes32)
    {
        bytes32 baseHash = keccak256(
            abi.encode(
                keccak256("420/GAS/BASE_USER_OPERATION/V1"),
                sponsorship.chainId,
                sponsorship.entryPoint,
                op.sender,
                op.nonce,
                keccak256(op.initCode),
                keccak256(op.callData),
                op.accountGasLimits,
                op.preVerificationGas,
                op.gasFees
            )
        );
        return keccak256(
            abi.encode(
                keccak256("420/GAS/SPONSORSHIP_DIGEST/V1"),
                baseHash,
                sponsorship.paymaster,
                sponsorship.policyId,
                sponsorship.validAfter,
                sponsorship.validUntil,
                sponsorship.maxSponsoredCostWei,
                sponsorship.authorizationId
            )
        );
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/accounts/Paymaster420.sol";
import "../src/accounts/SmartAccount420.sol";

interface VmGas113 {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function prank(address msgSender) external;
    function chainId(uint256 newChainId) external;
    function warp(uint256 newTimestamp) external;
}

contract Gas113Target420 {
    function allowed(uint256) external {}
    function forbidden(uint256) external {}
}

contract Paymaster420AuthorityConfusionTest {
    VmGas113 internal constant vm = VmGas113(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 internal constant SPONSOR_PK = 0x420BEEF;
    address internal constant ENTRY_POINT = address(0xE420);
    address internal constant ACCOUNT = address(0xA420);
    address internal constant OTHER_ACCOUNT = address(0xB420);

    bytes32 internal constant CAPABILITY = keccak256("420/GAS/GAS11.3/CAPABILITY");
    bytes32 internal constant SESSION = keccak256("420/GAS/GAS11.3/SESSION");

    SponsorshipPolicy420 internal policies;
    Paymaster420 internal paymaster;
    Gas113Target420 internal target;
    bytes32 internal policyId;

    function setUp() public {
        vm.chainId(420);
        vm.warp(500);
        policies = new SponsorshipPolicy420(address(this));
        target = new Gas113Target420();
        paymaster = new Paymaster420(ENTRY_POINT, address(policies), address(this), vm.addr(SPONSOR_PK));

        SponsorshipPolicy420.Policy memory policy = SponsorshipPolicy420.Policy({
            account: ACCOUNT,
            target: address(target),
            selector: Gas113Target420.allowed.selector,
            maxValueWei: 0,
            maxCostWei: 1 ether,
            validAfter: 100,
            validUntil: 1000,
            capabilityCommitment: CAPABILITY,
            sessionCommitment: SESSION
        });
        policyId = policies.registerPolicy(policy);
    }

    function testExactAccountTargetSelectorAndCommitmentsPass() public {
        PackedUserOperation420 memory op = _signedOp(
            ACCOUNT,
            address(target),
            Gas113Target420.allowed.selector,
            0,
            CAPABILITY,
            SESSION
        );
        require(_validate(op) == 0, "exact narrowed authority rejected");
    }

    function testCapabilityCommitmentCannotBeSubstitutedBySponsorData() public {
        PackedUserOperation420 memory op = _signedOp(
            ACCOUNT,
            address(target),
            Gas113Target420.allowed.selector,
            0,
            keccak256("attacker-capability"),
            SESSION
        );
        require(_validate(op) == 1, "wrong capability commitment sponsored");
    }

    function testSessionCommitmentCannotBeSubstitutedBySponsorData() public {
        PackedUserOperation420 memory op = _signedOp(
            ACCOUNT,
            address(target),
            Gas113Target420.allowed.selector,
            0,
            CAPABILITY,
            keccak256("attacker-session")
        );
        require(_validate(op) == 1, "wrong session commitment sponsored");
    }

    function testSponsorshipCannotBroadenAccountAuthority() public {
        PackedUserOperation420 memory op = _signedOp(
            OTHER_ACCOUNT,
            address(target),
            Gas113Target420.allowed.selector,
            0,
            CAPABILITY,
            SESSION
        );
        require(_validate(op) == 1, "different account sponsored");
    }

    function testSponsorshipCannotBroadenTargetAuthority() public {
        Gas113Target420 otherTarget = new Gas113Target420();
        PackedUserOperation420 memory op = _signedOp(
            ACCOUNT,
            address(otherTarget),
            Gas113Target420.allowed.selector,
            0,
            CAPABILITY,
            SESSION
        );
        require(_validate(op) == 1, "different target sponsored");
    }

    function testSponsorshipCannotBroadenSelectorAuthority() public {
        PackedUserOperation420 memory op = _signedOp(
            ACCOUNT,
            address(target),
            Gas113Target420.forbidden.selector,
            0,
            CAPABILITY,
            SESSION
        );
        require(_validate(op) == 1, "different selector sponsored");
    }

    function testSponsorshipCannotBroadenValueAuthority() public {
        PackedUserOperation420 memory op = _signedOp(
            ACCOUNT,
            address(target),
            Gas113Target420.allowed.selector,
            1,
            CAPABILITY,
            SESSION
        );
        require(_validate(op) == 1, "value escalation sponsored");
    }

    function testPolicyIdCannotBeSwappedToASeparatelyPermissivePolicyAfterSigning() public {
        SponsorshipPolicy420.Policy memory permissive = SponsorshipPolicy420.Policy({
            account: OTHER_ACCOUNT,
            target: address(target),
            selector: Gas113Target420.forbidden.selector,
            maxValueWei: 1 ether,
            maxCostWei: 1 ether,
            validAfter: 100,
            validUntil: 1000,
            capabilityCommitment: bytes32(0),
            sessionCommitment: bytes32(0)
        });
        bytes32 permissiveId = policies.registerPolicy(permissive);
        PackedUserOperation420 memory op = _signedOp(
            ACCOUNT,
            address(target),
            Gas113Target420.allowed.selector,
            0,
            CAPABILITY,
            SESSION
        );

        PaymasterData420.V1 memory sponsorship = this.decodePaymasterData(op.paymasterAndData);
        sponsorship.policyId = permissiveId;
        op.paymasterAndData = PaymasterData420.encodeV1(sponsorship);
        require(_validate(op) == 1, "post-signature policy substitution accepted");
    }

    function decodePaymasterData(bytes calldata raw) external pure returns (PaymasterData420.V1 memory) {
        return PaymasterData420.decodeV1(raw);
    }

    function _validate(PackedUserOperation420 memory op) internal returns (uint256 validationData) {
        vm.prank(ENTRY_POINT);
        (, validationData) = paymaster.validatePaymasterUserOp(op, keccak256("gas-11.3-final-op"), 0.1 ether);
    }

    function _signedOp(
        address sender,
        address callTarget,
        bytes4 targetSelector,
        uint256 valueWei,
        bytes32 capabilityCommitment,
        bytes32 sessionCommitment
    ) internal returns (PackedUserOperation420 memory op) {
        op = PackedUserOperation420({
            sender: sender,
            nonce: 7,
            initCode: bytes(""),
            callData: abi.encodeWithSelector(
                SmartAccount420.execute.selector,
                callTarget,
                valueWei,
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
            policyId: policyId,
            validAfter: 100,
            validUntil: 1000,
            maxSponsoredCostWei: 1 ether,
            authorizationId: keccak256(abi.encode("GAS-11.3", sender, callTarget, targetSelector, valueWei)),
            sponsorData: bytes("")
        });

        bytes32 sponsorshipDigest = _sponsorshipDigest(op, sponsorship);
        bytes32 signedDigest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", sponsorshipDigest));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SPONSOR_PK, signedDigest);
        sponsorship.sponsorData = abi.encode(
            abi.encodePacked(r, s, v),
            capabilityCommitment,
            sessionCommitment
        );
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

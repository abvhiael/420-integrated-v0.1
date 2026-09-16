// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/accounts/Paymaster420.sol";
import "../src/accounts/SmartAccount420.sol";

interface VmPaymasterHostile420 {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function prank(address msgSender) external;
    function chainId(uint256 newChainId) external;
    function warp(uint256 newTimestamp) external;
}

contract PaymasterHostileTarget420 {
    function set(uint256) external {}
}

contract Paymaster420HostileBindingTest {
    VmPaymasterHostile420 internal constant vm =
        VmPaymasterHostile420(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 internal constant SPONSOR_PK = 0x420BEEF;
    uint256 internal constant ATTACKER_PK = 0xBAD420;
    address internal constant ENTRY_POINT = address(0xE420);
    address internal constant ACCOUNT = address(0xA420);

    SponsorshipPolicy420 internal policies;
    Paymaster420 internal paymaster;
    PaymasterHostileTarget420 internal target;
    bytes32 internal policyId;
    bytes32 internal alternatePolicyId;

    function setUp() public {
        vm.chainId(420);
        vm.warp(500);

        policies = new SponsorshipPolicy420(address(this));
        paymaster = new Paymaster420(ENTRY_POINT, address(policies), address(this), vm.addr(SPONSOR_PK));
        target = new PaymasterHostileTarget420();

        SponsorshipPolicy420.Policy memory policy = SponsorshipPolicy420.Policy({
            account: ACCOUNT,
            target: address(target),
            selector: PaymasterHostileTarget420.set.selector,
            maxValueWei: 0,
            maxCostWei: 1 ether,
            validAfter: 100,
            validUntil: 1000,
            capabilityCommitment: bytes32(0),
            sessionCommitment: bytes32(0)
        });
        policyId = policies.registerPolicy(policy);

        policy.maxCostWei = 2 ether;
        alternatePolicyId = policies.registerPolicy(policy);
    }

    function testValidControlPasses() public {
        PackedUserOperation420 memory op = _signedOp(_baseSponsorship(), SPONSOR_PK);
        require(_validationData(op, 0.1 ether) == 0, "valid control rejected");
    }

    function testSponsorProofCannotReplayAcrossNonce() public {
        PackedUserOperation420 memory op = _signedOp(_baseSponsorship(), SPONSOR_PK);
        op.nonce += 1;
        require(_validationData(op, 0.1 ether) == 1, "sponsor proof replayed across nonce");
    }

    function testWrongChainReplayFailsClosed() public {
        PackedUserOperation420 memory op = _signedOp(_baseSponsorship(), SPONSOR_PK);
        vm.chainId(421);
        require(_validationData(op, 0.1 ether) == 1, "cross-chain replay accepted");
    }

    function testWrongEntryPointBindingFailsClosed() public {
        PaymasterData420.V1 memory sponsorship = _baseSponsorship();
        sponsorship.entryPoint = address(0xE421);
        PackedUserOperation420 memory op = _signedOp(sponsorship, SPONSOR_PK);
        require(_validationData(op, 0.1 ether) == 1, "wrong entrypoint accepted");
    }

    function testWrongPaymasterBindingFailsClosed() public {
        PaymasterData420.V1 memory sponsorship = _baseSponsorship();
        sponsorship.paymaster = address(0xB420);
        PackedUserOperation420 memory op = _signedOp(sponsorship, SPONSOR_PK);
        require(_validationData(op, 0.1 ether) == 1, "wrong paymaster accepted");
    }

    function testPolicySubstitutionInvalidatesSponsorProof() public {
        PaymasterData420.V1 memory sponsorship = _baseSponsorship();
        PackedUserOperation420 memory op = _signedOp(sponsorship, SPONSOR_PK);

        sponsorship.sponsorData = _sponsorData(op);
        sponsorship.policyId = alternatePolicyId;
        op.paymasterAndData = PaymasterData420.encodeV1(sponsorship);

        require(_validationData(op, 0.1 ether) == 1, "policy substitution accepted");
    }

    function testAuthorizationIdSubstitutionInvalidatesSponsorProof() public {
        PaymasterData420.V1 memory sponsorship = _baseSponsorship();
        PackedUserOperation420 memory op = _signedOp(sponsorship, SPONSOR_PK);

        sponsorship.sponsorData = _sponsorData(op);
        sponsorship.authorizationId = keccak256("ATTACKER-AUTH");
        op.paymasterAndData = PaymasterData420.encodeV1(sponsorship);

        require(_validationData(op, 0.1 ether) == 1, "authorization substitution accepted");
    }

    function testValidityWindowSubstitutionInvalidatesSponsorProof() public {
        PaymasterData420.V1 memory sponsorship = _baseSponsorship();
        PackedUserOperation420 memory op = _signedOp(sponsorship, SPONSOR_PK);

        sponsorship.sponsorData = _sponsorData(op);
        sponsorship.validUntil = 900;
        op.paymasterAndData = PaymasterData420.encodeV1(sponsorship);

        require(_validationData(op, 0.1 ether) == 1, "validity substitution accepted");
    }

    function testCostCapSubstitutionInvalidatesSponsorProof() public {
        PaymasterData420.V1 memory sponsorship = _baseSponsorship();
        PackedUserOperation420 memory op = _signedOp(sponsorship, SPONSOR_PK);

        sponsorship.sponsorData = _sponsorData(op);
        sponsorship.maxSponsoredCostWei = 2 ether;
        op.paymasterAndData = PaymasterData420.encodeV1(sponsorship);

        require(_validationData(op, 0.1 ether) == 1, "cost-cap substitution accepted");
    }

    function testExpiredSignedSponsorshipFailsClosed() public {
        PaymasterData420.V1 memory sponsorship = _baseSponsorship();
        sponsorship.validUntil = 400;
        PackedUserOperation420 memory op = _signedOp(sponsorship, SPONSOR_PK);
        require(_validationData(op, 0.1 ether) == 1, "expired sponsorship accepted");
    }

    function testPrematureSignedSponsorshipFailsClosed() public {
        PaymasterData420.V1 memory sponsorship = _baseSponsorship();
        sponsorship.validAfter = 600;
        sponsorship.validUntil = 900;
        PackedUserOperation420 memory op = _signedOp(sponsorship, SPONSOR_PK);
        require(_validationData(op, 0.1 ether) == 1, "premature sponsorship accepted");
    }

    function testValidityWindowBoundariesAreInclusive() public {
        PaymasterData420.V1 memory sponsorship = _baseSponsorship();
        sponsorship.validAfter = 500;
        sponsorship.validUntil = 600;
        PackedUserOperation420 memory op = _signedOp(sponsorship, SPONSOR_PK);
        require(_validationData(op, 0.1 ether) == 0, "validAfter boundary rejected");

        vm.warp(600);
        require(_validationData(op, 0.1 ether) == 0, "validUntil boundary rejected");
    }

    function testAttackerSignerCannotSubstituteSponsor() public {
        PackedUserOperation420 memory op = _signedOp(_baseSponsorship(), ATTACKER_PK);
        require(_validationData(op, 0.1 ether) == 1, "attacker signer accepted");
    }

    function testRuntimeCostCannotExceedSignedCap() public {
        PaymasterData420.V1 memory sponsorship = _baseSponsorship();
        sponsorship.maxSponsoredCostWei = 0.2 ether;
        PackedUserOperation420 memory op = _signedOp(sponsorship, SPONSOR_PK);
        require(_validationData(op, 0.3 ether) == 1, "runtime cost exceeded signed cap");
    }

    function _baseOp() internal view returns (PackedUserOperation420 memory op) {
        op = PackedUserOperation420({
            sender: ACCOUNT,
            nonce: 7,
            initCode: bytes(""),
            callData: abi.encodeWithSelector(
                SmartAccount420.execute.selector,
                address(target),
                0,
                abi.encodeWithSelector(PaymasterHostileTarget420.set.selector, 420)
            ),
            accountGasLimits: bytes32(uint256(100000) << 128 | uint256(100000)),
            preVerificationGas: 21000,
            gasFees: bytes32(uint256(1 gwei)),
            paymasterAndData: bytes(""),
            signature: bytes("")
        });
    }

    function _baseSponsorship() internal view returns (PaymasterData420.V1 memory sponsorship) {
        sponsorship = PaymasterData420.V1({
            version: 1,
            paymaster: address(paymaster),
            entryPoint: ENTRY_POINT,
            chainId: 420,
            policyId: policyId,
            validAfter: 100,
            validUntil: 1000,
            maxSponsoredCostWei: 1 ether,
            authorizationId: keccak256("AUTH-420-HOSTILE"),
            sponsorData: bytes("")
        });
    }

    function _signedOp(PaymasterData420.V1 memory sponsorship, uint256 signerPk)
        internal
        returns (PackedUserOperation420 memory op)
    {
        op = _baseOp();
        bytes32 sponsorshipDigest = _sponsorshipDigest(op, sponsorship);
        bytes32 signedDigest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", sponsorshipDigest));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, signedDigest);
        sponsorship.sponsorData = abi.encode(abi.encodePacked(r, s, v), bytes32(0), bytes32(0));
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

    function _sponsorData(PackedUserOperation420 memory op) internal pure returns (bytes memory sponsorData) {
        (, , , , , , , , , sponsorData) = abi.decode(
            op.paymasterAndData,
            (uint8, address, address, uint256, bytes32, uint48, uint48, uint128, bytes32, bytes)
        );
    }

    function _validationData(PackedUserOperation420 memory op, uint256 maxCostWei) internal returns (uint256 result) {
        vm.prank(ENTRY_POINT);
        (, result) = paymaster.validatePaymasterUserOp(op, keccak256("hostile-final-user-op"), maxCostWei);
    }
}

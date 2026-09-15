// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/accounts/IEntryPoint420.sol";
import "../src/accounts/PaymasterData420.sol";
import "../src/accounts/SponsorshipDigest420.sol";

contract SponsorshipDigestHarness420 {
    function baseHash(PackedUserOperation420 calldata userOp, address entryPoint, uint256 chainId)
        external
        pure
        returns (bytes32)
    {
        return SponsorshipDigest420.baseUserOpHash(userOp, entryPoint, chainId);
    }

    function digest(PackedUserOperation420 calldata userOp, PaymasterData420.V1 calldata sponsorship)
        external
        pure
        returns (bytes32)
    {
        PaymasterData420.V1 memory copy = sponsorship;
        return SponsorshipDigest420.digestV1(userOp, copy);
    }
}

contract SponsorshipDigest420Test {
    SponsorshipDigestHarness420 internal harness = new SponsorshipDigestHarness420();

    function testSponsorProofBytesDoNotCreateCircularDigest() public view {
        PackedUserOperation420 memory first = _op();
        PackedUserOperation420 memory second = _op();
        first.paymasterAndData = hex"11112222";
        second.paymasterAndData = hex"deadbeefcafebabe";
        first.signature = hex"01";
        second.signature = hex"0203";

        PaymasterData420.V1 memory sponsorship = _sponsorship();
        bytes32 a = harness.digest(first, sponsorship);
        bytes32 b = harness.digest(second, sponsorship);
        require(a == b, "mutable sponsor/signature bytes changed digest");
    }

    function testOperationMutationChangesDigest() public view {
        PackedUserOperation420 memory original = _op();
        PackedUserOperation420 memory mutated = _op();
        mutated.callData = hex"a9059cbb01";
        require(harness.digest(original, _sponsorship()) != harness.digest(mutated, _sponsorship()), "call mutation not bound");

        mutated = _op();
        mutated.nonce = 8;
        require(harness.digest(original, _sponsorship()) != harness.digest(mutated, _sponsorship()), "nonce mutation not bound");

        mutated = _op();
        mutated.accountGasLimits = bytes32(uint256(99));
        require(harness.digest(original, _sponsorship()) != harness.digest(mutated, _sponsorship()), "gas mutation not bound");
    }

    function testEnvelopeMutationChangesDigest() public view {
        PackedUserOperation420 memory op = _op();
        PaymasterData420.V1 memory original = _sponsorship();
        PaymasterData420.V1 memory mutated = _sponsorship();

        mutated.policyId = keccak256("other policy");
        require(harness.digest(op, original) != harness.digest(op, mutated), "policy mutation not bound");

        mutated = _sponsorship();
        mutated.authorizationId = keccak256("other authorization");
        require(harness.digest(op, original) != harness.digest(op, mutated), "authorization mutation not bound");

        mutated = _sponsorship();
        mutated.maxSponsoredCostWei += 1;
        require(harness.digest(op, original) != harness.digest(op, mutated), "cost mutation not bound");

        mutated = _sponsorship();
        mutated.validUntil += 1;
        require(harness.digest(op, original) != harness.digest(op, mutated), "validity mutation not bound");
    }

    function testChainEntryPointAndPaymasterAreBound() public view {
        PackedUserOperation420 memory op = _op();
        PaymasterData420.V1 memory original = _sponsorship();
        bytes32 expected = harness.digest(op, original);

        require(harness.baseHash(op, original.entryPoint, 420) != harness.baseHash(op, original.entryPoint, 421), "chain not bound");
        require(harness.baseHash(op, original.entryPoint, 420) != harness.baseHash(op, address(0x9999), 420), "entrypoint not bound");

        PaymasterData420.V1 memory mutated = _sponsorship();
        mutated.paymaster = address(0x9999);
        require(expected != harness.digest(op, mutated), "paymaster not bound");
    }

    function _op() internal pure returns (PackedUserOperation420 memory) {
        return PackedUserOperation420({
            sender: address(0xBEEF),
            nonce: 7,
            initCode: bytes(""),
            callData: hex"a9059cbb00",
            accountGasLimits: bytes32(uint256(42)),
            preVerificationGas: 21000,
            gasFees: bytes32(uint256(420)),
            paymasterAndData: bytes(""),
            signature: bytes("")
        });
    }

    function _sponsorship() internal pure returns (PaymasterData420.V1 memory) {
        return PaymasterData420.V1({
            version: 1,
            paymaster: address(0x4200),
            entryPoint: address(0x4201),
            chainId: 420,
            policyId: keccak256("policy"),
            validAfter: 100,
            validUntil: 200,
            maxSponsoredCostWei: 1 ether,
            authorizationId: keccak256("authorization"),
            sponsorData: hex"01020304"
        });
    }
}

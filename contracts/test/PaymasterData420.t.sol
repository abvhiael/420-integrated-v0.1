// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/accounts/EntryPoint420.sol";
import "../src/accounts/PaymasterData420.sol";

contract PaymasterDataHarness420 {
    function encode(PaymasterData420.V1 calldata input) external pure returns (bytes memory) {
        PaymasterData420.V1 memory data = input;
        return PaymasterData420.encodeV1(data);
    }

    function decode(bytes calldata raw) external pure returns (PaymasterData420.V1 memory) {
        return PaymasterData420.decodeV1(raw);
    }
}

contract PaymasterData420Test {
    PaymasterDataHarness420 internal harness;
    EntryPoint420 internal entryPoint;

    constructor() {
        harness = new PaymasterDataHarness420();
        entryPoint = new EntryPoint420();
    }

    function testCanonicalV1RoundTripPreservesAllBindings() public view {
        PaymasterData420.V1 memory expected = _validData();
        bytes memory encoded = harness.encode(expected);
        PaymasterData420.V1 memory decoded = harness.decode(encoded);

        require(decoded.version == 1, "version");
        require(decoded.paymaster == expected.paymaster, "paymaster");
        require(decoded.entryPoint == address(entryPoint), "entrypoint");
        require(decoded.chainId == 420, "chain");
        require(decoded.policyId == expected.policyId, "policy");
        require(decoded.validAfter == expected.validAfter, "validAfter");
        require(decoded.validUntil == expected.validUntil, "validUntil");
        require(decoded.maxSponsoredCostWei == expected.maxSponsoredCostWei, "max cost");
        require(decoded.authorizationId == expected.authorizationId, "authorization");
        require(keccak256(decoded.sponsorData) == keccak256(expected.sponsorData), "sponsor data");
    }

    function testUnknownVersionFailsClosed() public {
        PaymasterData420.V1 memory data = _validData();
        data.version = 2;
        (bool ok,) = address(harness).call(abi.encodeWithSelector(harness.encode.selector, data));
        require(!ok, "unknown version accepted");
    }

    function testWrongChainFailsClosed() public {
        PaymasterData420.V1 memory data = _validData();
        data.chainId = 421;
        (bool ok,) = address(harness).call(abi.encodeWithSelector(harness.encode.selector, data));
        require(!ok, "wrong chain accepted");
    }

    function testZeroPaymasterAndEntryPointFailClosed() public {
        PaymasterData420.V1 memory data = _validData();
        data.paymaster = address(0);
        (bool paymasterOk,) = address(harness).call(abi.encodeWithSelector(harness.encode.selector, data));
        require(!paymasterOk, "zero paymaster accepted");

        data = _validData();
        data.entryPoint = address(0);
        (bool entryPointOk,) = address(harness).call(abi.encodeWithSelector(harness.encode.selector, data));
        require(!entryPointOk, "zero entrypoint accepted");
    }

    function testPolicyAuthorizationCostAndValidityAreRequired() public {
        PaymasterData420.V1 memory data = _validData();
        data.policyId = bytes32(0);
        (bool policyOk,) = address(harness).call(abi.encodeWithSelector(harness.encode.selector, data));
        require(!policyOk, "zero policy accepted");

        data = _validData();
        data.authorizationId = bytes32(0);
        (bool authOk,) = address(harness).call(abi.encodeWithSelector(harness.encode.selector, data));
        require(!authOk, "zero authorization accepted");

        data = _validData();
        data.maxSponsoredCostWei = 0;
        (bool costOk,) = address(harness).call(abi.encodeWithSelector(harness.encode.selector, data));
        require(!costOk, "zero cost accepted");

        data = _validData();
        data.validUntil = data.validAfter;
        (bool windowOk,) = address(harness).call(abi.encodeWithSelector(harness.encode.selector, data));
        require(!windowOk, "empty validity window accepted");
    }

    function testSponsorDataIsBounded() public {
        PaymasterData420.V1 memory data = _validData();
        data.sponsorData = new bytes(4097);
        (bool ok,) = address(harness).call(abi.encodeWithSelector(harness.encode.selector, data));
        require(!ok, "oversized sponsor data accepted");
    }

    function testTrailingBytesAreRejectedAsNonCanonical() public {
        bytes memory encoded = harness.encode(_validData());
        bytes memory mutated = bytes.concat(encoded, hex"00");
        (bool ok,) = address(harness).call(abi.encodeWithSelector(harness.decode.selector, mutated));
        require(!ok, "trailing bytes accepted");
    }

    function testTruncatedPayloadFailsClosed() public {
        bytes memory encoded = harness.encode(_validData());
        bytes memory truncated = new bytes(encoded.length - 1);
        for (uint256 i; i < truncated.length; ++i) truncated[i] = encoded[i];
        (bool ok,) = address(harness).call(abi.encodeWithSelector(harness.decode.selector, truncated));
        require(!ok, "truncated payload accepted");
    }

    function testEntryPointRemainsFailClosedDuringGas1() public {
        bytes memory paymasterAndData = harness.encode(_validData());
        PackedUserOperation420 memory op = PackedUserOperation420({
            sender: address(0xBEEF),
            nonce: 0,
            initCode: bytes(""),
            callData: hex"12345678",
            accountGasLimits: bytes32(0),
            preVerificationGas: 0,
            gasFees: bytes32(0),
            paymasterAndData: paymasterAndData,
            signature: bytes("")
        });

        (bool ok,) = address(entryPoint).call(abi.encodeWithSelector(EntryPoint420.handleOp.selector, op));
        require(!ok, "GAS-1 accidentally enabled paymasters");
    }

    function _validData() internal view returns (PaymasterData420.V1 memory) {
        return PaymasterData420.V1({
            version: 1,
            paymaster: address(0x420420),
            entryPoint: address(entryPoint),
            chainId: 420,
            policyId: keccak256("420/GAS/POLICY/TEST"),
            validAfter: 100,
            validUntil: 1000,
            maxSponsoredCostWei: 42 ether,
            authorizationId: keccak256("420/GAS/AUTH/TEST"),
            sponsorData: hex"0420"
        });
    }
}

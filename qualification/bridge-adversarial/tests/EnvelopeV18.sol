// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// Stateful hostile relayer. The actual verifier/issuer adapter is the target;
/// no programmable finality return value or acceptance oracle is substituted.
contract EnvelopeActorV18 {
    address public immutable owner = msg.sender;
    address public target;
    bytes4 public selector;
    uint256 public attempts;
    uint256 public unauthorizedAcceptances;
    uint256 public maximumGas;

    function configure(address destination, bytes4 entrypoint) external {
        require(msg.sender == owner && target == address(0));
        target = destination;
        selector = entrypoint;
    }

    function attack(bytes memory proof) public {
        bytes memory input = abi.encodeWithSelector(selector, proof);
        uint256 beforeGas = gasleft();
        (bool accepted,) = target.call{gas: 500_000}(input);
        uint256 spent = beforeGas - gasleft();
        require(spent < 450_000, "hostile envelope exhausted bounded call");
        if (spent > maximumGas) maximumGas = spent;
        attempts++;
        if (accepted) unauthorizedAcceptances++;
    }

    function words(bytes32 seed, uint8 size, uint8 poison) external {
        bytes memory input = new bytes(32 * (uint256(size) % 64 + 1));
        for (uint256 i; i < input.length; i += 32) {
            bytes32 word = keccak256(abi.encode(seed, i));
            if (i / 32 == uint256(poison) % (input.length / 32)) word = bytes32(type(uint256).max);
            assembly { mstore(add(add(input, 32), i), word) }
        }
        attack(input);
    }

    function lengthBomb(uint8 shift, bool offset) external {
        bytes memory input = new bytes(2048);
        uint256 value = type(uint256).max - uint256(shift);
        uint256 position = offset ? 32 : 96;
        assembly { mstore(add(add(input, 32), position), value) }
        attack(input);
    }

    function foreign(uint8 format) external {
        if (format % 3 == 0) attack(bytes('{"finalized":true,"confirmations":1000000,"chainId":420}'));
        else if (format % 3 == 1) attack(hex"0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c");
        else attack(abi.encode(uint32(0), uint64(1), bytes32(uint256(1)), new bytes(40)));
    }
}

/// These tests cover unauthenticated admission, hostile ABI and bounded work.
/// Valid-context consensus, gateway, reorg and redemption attacks are separately
/// linked to retained exact-revision qualification, not inferred from this class.
abstract contract EnvelopeV18Test {
    EnvelopeActorV18 internal boundary;
    uint256 internal maximumEnvelope;
    struct FuzzSelector { address addr; bytes4[] selectors; }

    function targetContracts() public view returns (address[] memory result) {
        result = new address[](1); result[0] = address(boundary);
    }

    function targetSelectors() public view returns (FuzzSelector[] memory result) {
        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = EnvelopeActorV18.words.selector;
        selectors[1] = EnvelopeActorV18.lengthBomb.selector;
        selectors[2] = EnvelopeActorV18.foreign.selector;
        result = new FuzzSelector[](1); result[0] = FuzzSelector(address(boundary), selectors);
    }

    function testV18DynamicLengthAndOffsetBombs() public {
        for (uint8 i; i < 16; i++) { boundary.lengthBomb(i, true); boundary.lengthBomb(i, false); }
        require(boundary.unauthorizedAcceptances() == 0, "fabricated ABI accepted");
    }

    function testV18CrossProtocolAndRpcAssertions() public {
        for (uint8 i; i < 3; i++) boundary.foreign(i);
        require(boundary.unauthorizedAcceptances() == 0, "foreign evidence accepted");
    }

    function testV18LargeHostileEnvelopeHasBoundedVerifierWork() public {
        // Payload construction / caller memory is outside the callee budget.
        // This does not claim that maximum-sized calldata fits a deployment block.
        boundary.attack(new bytes(maximumEnvelope + 1));
        require(boundary.unauthorizedAcceptances() == 0, "oversized evidence accepted");
    }

    function testFuzzV18MalformedEnvelope(bytes32 seed, uint8 size, uint8 poison) public {
        boundary.words(seed, size, poison);
        require(boundary.unauthorizedAcceptances() == 0, "fabricated evidence accepted");
    }

    function invariantV18UntrustedRelayerCannotAuthorizeTransfer() public view {
        require(boundary.unauthorizedAcceptances() == 0, "unauthenticated authorization");
        require(boundary.maximumGas() < 450_000, "unbounded rejection work");
    }
}

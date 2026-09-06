// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Minimal Foundry test compatibility shim used by repository-local tests.
/// @dev This is intentionally limited to cheatcodes/assertions exercised by repository tests.
interface Vm {
    function addr(uint256 privateKey) external returns (address);
    function prank(address msgSender) external;
    function expectRevert(bytes4 revertData) external;
    function warp(uint256 newTimestamp) external;
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function deal(address account, uint256 newBalance) external;
}

abstract contract Test {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertEq(uint256 left, uint256 right) internal pure {
        require(left == right, "assertEq");
    }
}

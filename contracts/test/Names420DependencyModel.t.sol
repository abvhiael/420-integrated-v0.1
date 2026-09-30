// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/apps/Names420.sol";
import "../src/system/SystemAccess.sol";

interface VmNamesDependency420 {
    function expectRevert(
        bytes4
    ) external;
}

contract Names420DependencyModelTest {
    VmNamesDependency420 internal constant vm =
        VmNamesDependency420(address(uint160(uint256(keccak256("hevm cheat code")))));

    address internal constant TIMELOCK = address(0x420);

    function testGovernanceAuthorityIsConstructorBound() public {
        Names420 names = new Names420(TIMELOCK);
        require(names.governanceTimelock() == TIMELOCK, "governance timelock mismatch");
    }

    function testZeroGovernanceAuthorityIsRejected() public {
        vm.expectRevert(SystemAccess.ZeroAddress.selector);
        new Names420(address(0));
    }
}

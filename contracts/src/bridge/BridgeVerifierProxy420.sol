// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

/// @notice Registry-created proxy with native (nondelegated) implementation identity.
/// @dev Qualification is checked by bridge admission, independently of upgrade authority.
contract BridgeVerifierProxy420 {
    bytes32 private constant SLOT = bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
    bytes32 private constant VERSION = keccak256("420/BRIDGE/VERIFIER/PROXY/VERSION");
    address public immutable governanceTimelock;
    event Upgraded(address indexed implementation, uint256 version);
    constructor(address governance, address implementation_, bytes memory initialization) payable {
        require(governance != address(0), "governance"); governanceTimelock = governance;
        _upgrade(implementation_, initialization);
    }
    function implementation() public view returns (address value) { bytes32 slot=SLOT; assembly { value:=sload(slot) } }
    function implementationVersion() public view returns (uint256 value) { bytes32 slot=VERSION; assembly { value:=sload(slot) } }
    function upgradeToAndCall(address target, bytes calldata data, uint256 expectedVersion) external {
        require(msg.sender == governanceTimelock, "governance");
        require(implementationVersion() == expectedVersion, "stale version"); _upgrade(target,data);
    }
    function _upgrade(address target, bytes memory data) private {
        require(target.code.length != 0 && target != address(this), "implementation");
        bytes32 slot=SLOT; bytes32 versionSlot=VERSION; uint256 next=implementationVersion()+1;
        assembly { sstore(slot,target) sstore(versionSlot,next) }
        if(data.length != 0) { (bool ok,bytes memory reason)=target.delegatecall(data); if(!ok) assembly { revert(add(reason,32),mload(reason)) } }
        require(implementation()==target && implementationVersion()==next, "initializer changed identity");
        emit Upgraded(target,next);
    }
    fallback() external payable { _delegate(); }
    receive() external payable { _delegate(); }
    function _delegate() private {
        address target=implementation();
        assembly { calldatacopy(0,0,calldatasize()) let ok:=delegatecall(gas(),target,0,calldatasize(),0,0) returndatacopy(0,0,returndatasize()) switch ok case 0 {revert(0,returndatasize())} default {return(0,returndatasize())} }
    }
}

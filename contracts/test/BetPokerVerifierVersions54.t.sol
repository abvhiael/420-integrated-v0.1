// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bet/PokerVerifierVersions420.sol";
interface VmPokerVersions54 {function prank(address) external;function expectRevert(bytes4) external;}
contract VersionFixture54 {function isVerifier() external pure returns(bool){return true;}}
contract PokerVerifierVersions54Test {
    VmPokerVersions54 constant vm=VmPokerVersions54(address(uint160(uint256(keccak256("hevm cheat code")))));
    PokerVerifierVersions420 versions;
    VersionFixture54 verifier;
    address constant ADMIN=address(0xA421);
    constructor(){versions=new PokerVerifierVersions420(ADMIN);verifier=new VersionFixture54();}
    function testPinnedCodeAndKeyVersionCannotBeSubstituted() public {
        bytes32 id=keccak256("nlhe-circuit-version-1");
        vm.prank(ADMIN);
        versions.register(id,address(verifier),keccak256("key"),keccak256("circuit"),keccak256("schema"));
        require(versions.matches(id,address(verifier),keccak256("key"),keccak256("circuit"),
            keccak256("schema")),"pinned version");
        require(!versions.matches(id,address(verifier),keccak256("wrong key"),keccak256("circuit"),
            keccak256("schema")),"must reject key");
        require(!versions.matches(id,address(0xAA),keccak256("key"),keccak256("circuit"),
            keccak256("schema")),"must reject changed implementation");
        vm.expectRevert(PokerVerifierVersions420.AlreadyRegistered.selector);
        vm.prank(ADMIN);versions.register(id,address(verifier),keccak256("new key"),
            keccak256("new circuit"),keccak256("new schema"));
    }
    function testUnauthorizedRegistrationAndNoncontractRejected() public {
        bytes32 id=keccak256("v");
        vm.expectRevert(PokerVerifierVersions420.Unauthorized.selector);
        versions.register(id,address(verifier),keccak256("k"),keccak256("c"),keccak256("s"));
        vm.expectRevert(PokerVerifierVersions420.InvalidVersion.selector);
        vm.prank(ADMIN);versions.register(id,address(0xAA),keccak256("k"),keccak256("c"),keccak256("s"));
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../src/bet/PokerGnarkElGamalAdapters420.sol";
import "../src/bet/PokerVerifierVersions420.sol";
interface VmElGamal54 {function prank(address) external;function expectRevert(bytes4) external;}
/// @dev Dummy Groth16 verifier for adapter/public-input plumbing ONLY.
contract GnarkABIFixture54 {
    bool public accept;
    function setAccept(bool value) external {accept=value;}
    function verifyProof(uint256[8] calldata,uint256[5] calldata) external view returns(bool){return accept;}
}
contract GnarkInitialABIFixture54 {
    bool public accept;
    function setAccept(bool value) external {accept=value;}
    function verifyProof(uint256[8] calldata,uint256[5] calldata) external view returns(bool){return accept;}
}
contract PokerGnarkElGamalAdapters54Test {
    VmElGamal54 constant vm=VmElGamal54(address(uint160(uint256(keccak256("hevm cheat code")))));
    PokerVerifierVersions420 versions;
    PokerGnarkShuffle52Adapter420 shuffle;
    PokerGnarkInitial52Adapter420 initial;
    GnarkABIFixture54 fake;
    GnarkInitialABIFixture54 fakeInitial;
    bytes32 constant HAND=bytes32(uint256(420));
    bytes32 constant ROOT_ONE=bytes32(uint256(100));
    bytes32 constant ROOT_TWO=bytes32(uint256(101));
    bytes32 constant KEY=keccak256(abi.encode(uint256(7),uint256(8)));
    bytes32 constant VERSION_A=keccak256("adapter A");
    bytes32 constant VERSION_B=keccak256("adapter B");
    constructor(){
        versions=new PokerVerifierVersions420(address(this));
        fake=new GnarkABIFixture54();
        fakeInitial=new GnarkInitialABIFixture54();
        versions.register(VERSION_A,address(fake),keccak256("vk A"),keccak256("circuit A"),
            keccak256("schema A"));
        versions.register(VERSION_B,address(fakeInitial),keccak256("vk B"),keccak256("circuit B"),
            keccak256("schema B"));
        shuffle=new PokerGnarkShuffle52Adapter420(address(fake),address(versions),VERSION_A,
            keccak256("circuit A"),keccak256("vk A"),keccak256("schema A"),KEY);
        initial=new PokerGnarkInitial52Adapter420(address(fakeInitial),address(versions),VERSION_B,
            keccak256("circuit B"),keccak256("vk B"),keccak256("schema B"),KEY);
    }
    function testShuffleInputsBoundToExactHandRootAndThresholdKey() public {
        uint256[8] memory proof;
        uint256[5] memory publicValues=[uint256(100),uint256(101),uint256(420),uint256(7),uint256(8)];
        fake.setAccept(true);
        require(shuffle.verifyShuffleProof(keccak256("statement"),HAND,ROOT_ONE,ROOT_TWO,KEY,
            abi.encode(proof,publicValues)),"valid ABI");
        require(!shuffle.verifyShuffleProof(keccak256("statement"),HAND,ROOT_ONE,
            bytes32(uint256(99)),KEY,abi.encode(proof,publicValues)),"wrong output root");
        require(!shuffle.verifyShuffleProof(keccak256("statement"),bytes32(uint256(421)),
            ROOT_ONE,ROOT_TWO,KEY,abi.encode(proof,publicValues)),"wrong hand");
        require(!shuffle.verifyShuffleProof(keccak256("statement"),HAND,ROOT_ONE,ROOT_TWO,
            keccak256("wrong key"),abi.encode(proof,publicValues)),"wrong key");
        fake.setAccept(false);
        require(!shuffle.verifyShuffleProof(keccak256("statement"),HAND,ROOT_ONE,
            ROOT_TWO,KEY,abi.encode(proof,publicValues)),"reverted/false cryptographic verifier");
    }
    function testInitialInputsBoundToExactDeck() public {
        uint256[8] memory proof;
        bytes32 statement=keccak256("statement");
        uint256[5] memory publicValues=[uint256(100),uint256(statement)%21888242871839275222246405745257275088696311157297823662689037894645226208583,uint256(420),uint256(7),uint256(8)];
        fakeInitial.setAccept(true);
        require(initial.verifyInitialDeck(statement,HAND,ROOT_ONE,KEY,
            abi.encode(proof,publicValues)),"initial accepted");
        require(!initial.verifyInitialDeck(keccak256("statement"),HAND,ROOT_TWO,KEY,
            abi.encode(proof,publicValues)),"root substitution blocked");
        require(!initial.verifyInitialDeck(keccak256("different statement"),HAND,ROOT_ONE,KEY,abi.encode(proof,publicValues)),"changed full context accepted");
        fakeInitial.setAccept(false);
        require(!initial.verifyInitialDeck(keccak256("statement"),HAND,ROOT_ONE,KEY,
            abi.encode(proof,publicValues)),"invalid proof blocked");
    }
    function testWrongRegisteredVerifyingKeyCannotDeployAdapter() public {
        vm.expectRevert(PokerGnarkVerifierBound420.InvalidConfiguration.selector);
        new PokerGnarkShuffle52Adapter420(address(fake),address(versions),VERSION_A,
            keccak256("circuit A"),keccak256("attacker vk"),keccak256("schema A"),KEY);
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./PokerVerifierVersions420.sol";
interface IPokerRecipientKeyPoP420 {
    function verifyKeyPossession(uint256 scope,uint256 keyX,uint256 keyY,
        bytes calldata proof) external view returns(bool);
}
/// @notice Production-version-pinned proof of knowledge of recipient
/// BabyJubjub decryption scalar, with exact on-chain scope / curve point.
contract PokerGnarkRecipientKeyPoPAdapter420 is IPokerRecipientKeyPoP420 {
    uint256 internal constant FR=
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    bytes4 private constant SELECTOR=bytes4(keccak256("verifyProof(uint256[8],uint256[3])"));
    address public immutable verifier;
    bytes32 public immutable verifierCodeHash;
    PokerVerifierVersions420 public immutable registry;
    bytes32 public immutable versionId;
    bytes32 public immutable keyHash;
    bytes32 public immutable circuitHash;
    bytes32 public immutable schemaHash;
    error InvalidConfiguration();
    constructor(address actual,address versions,bytes32 version,bytes32 vk,
        bytes32 circuit,bytes32 schema){
        if(actual==address(0)||actual.code.length==0||versions==address(0)||
           version==bytes32(0)||vk==bytes32(0)||circuit==bytes32(0)||
           schema==bytes32(0))revert InvalidConfiguration();
        PokerVerifierVersions420 source=PokerVerifierVersions420(versions);
        if(!source.matches(version,actual,vk,circuit,schema))revert InvalidConfiguration();
        verifier=actual;verifierCodeHash=actual.codehash;registry=source;
        versionId=version;keyHash=vk;circuitHash=circuit;schemaHash=schema;
    }
    function verifyKeyPossession(uint256 scope,uint256 keyX,uint256 keyY,
        bytes calldata packed) external view returns(bool){
        if(scope==0||scope>=FR||keyX>=FR||keyY>=FR||
           packed.length!=352||verifier.codehash!=verifierCodeHash||
           !registry.matches(versionId,verifier,keyHash,circuitHash,schemaHash))
           return false;
        (uint256[8] memory p,uint256[3] memory pub)=
            abi.decode(packed,(uint256[8],uint256[3]));
        if(pub[0]!=scope||pub[1]!=keyX||pub[2]!=keyY)return false;
        (bool ok,bytes memory response)=verifier.staticcall(
            abi.encodeWithSelector(SELECTOR,p,pub));
        if(!ok)return false;
        if(response.length==0)return true;
        if(response.length==32)return abi.decode(response,(bool));
        return false;
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {CultivarModerationRegistry} from "../../../src/highcountry/genetics/CultivarModerationRegistry.sol";
import {HighCountryAuthorization} from "../../../src/highcountry/auth/HighCountryAuthorization.sol";
import {ICapabilityRegistry420} from "../../../src/interfaces/genesis/ICapabilityRegistry420.sol";
import {MockCapabilityRegistry} from "../mocks/MockCapabilityRegistry.sol";
contract R072CultivarModerationTest {
 MockCapabilityRegistry private caps;
 HighCountryAuthorization private auth;
 CultivarModerationRegistry private moderation;
 bytes32 private constant CID=bytes32(uint256(101));
 bytes32 private constant GENOME=bytes32(uint256(102));
 bytes32 private constant A=bytes32(uint256(103));
 bytes32 private constant B=bytes32(uint256(104));
 bytes32 private constant NAME=bytes32(uint256(105));
 constructor(){
  caps=new MockCapabilityRegistry();auth=new HighCountryAuthorization(address(caps));
  moderation=new CultivarModerationRegistry(address(auth));
  _grant(moderation.SUBMIT(),CID,keccak256("submit"));
  _grant(moderation.REVIEW(),CID,keccak256("review"));
  _grant(moderation.APPEAL(),CID,keccak256("appeal"));
 }
 function _grant(bytes32 action,bytes32 id,bytes32 key) private {
  ICapabilityRegistry420.CapabilityGrant memory g=ICapabilityRegistry420.CapabilityGrant({
    principal:address(this),componentId:moderation.MODULE_ID(),capabilityId:action,scopeHash:id,
    perCallLimit:0,periodLimit:0,periodSeconds:0,validFrom:0,
    validUntil:uint64(block.timestamp+1 days),revoked:false});
  caps.setGrant(key,g,0);
 }
 function testPublishHideAndRename() public {
  moderation.propose(CID,GENOME,A,B,NAME,true);
  require(!moderation.usable(CID),"pending usable");
  moderation.review(CID,true,false,bytes32(uint256(201)));
  require(moderation.usable(CID),"published not usable");
  moderation.review(CID,false,false,bytes32(uint256(202)));
  require(!moderation.usable(CID)&&moderation.blockedNameHash(NAME),"hidden not blocked");
  moderation.requestRename(CID,bytes32(uint256(205)));
  require(!moderation.usable(CID),"rename bypassed review");
  moderation.review(CID,true,false,bytes32(uint256(203)));
  require(moderation.usable(CID),"new name never published");
 }
 function testRetiredNeverReenabled() public {
  moderation.propose(CID,GENOME,A,B,NAME,true);
  moderation.review(CID,false,true,bytes32(uint256(203)));
  (bool ok,)=address(moderation).call(abi.encodeCall(moderation.requestRename,(CID,bytes32(uint256(210)))));
  require(!ok&&!moderation.usable(CID),"retirement escaped");
  (ok,)=address(moderation).call(abi.encodeCall(moderation.review,(CID,true,false,bytes32(uint256(204)))));
  require(!ok,"retirement republished");
 }
 function testDuplicatesAndBadParentsRejected() public {
  (bool ok,)=address(moderation).call(abi.encodeCall(moderation.propose,(CID,GENOME,A,A,NAME,true)));
  require(!ok,"same parents accepted");
  moderation.propose(CID,GENOME,A,B,NAME,true);
  (ok,)=address(moderation).call(abi.encodeCall(moderation.propose,(CID,GENOME,A,B,NAME,true)));
  require(!ok,"duplicate accepted");
 }
}

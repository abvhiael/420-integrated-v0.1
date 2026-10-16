// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {IHighCountryAuthorization} from "../interfaces/IHighCountryAuthorization.sol";
import {AuthorizationRequest} from "../types/HighCountryTypes.sol";
interface IFoundingGenesisExpansion {function finalized() external view returns(bool);}
contract RegionExpansionRegistry {
 error InvalidExpansion(); error InvalidState();
 bytes32 public constant MODULE_ID=keccak256("HC.REGION_EXPANSION.V1");
 bytes32 public constant STAGE=keccak256("HC.REGION_EXPANSION.STAGE.V1");
 bytes32 public constant OPEN=keccak256("HC.REGION_EXPANSION.OPEN.V1");
 enum Status { NONE, STAGED, OPEN }
 struct Release {bytes32 commitment;bytes32 metadataHash;bytes32 climateId;bytes32 rulesetId;bytes32 landPolicyHash;Status status;}
 IHighCountryAuthorization public immutable authorization;
 IFoundingGenesisExpansion public immutable genesis;
 mapping(uint16=>Release) private _releases;
 event Staged(uint16 indexed id,bytes32 indexed commitment);
 event Opened(uint16 indexed id,bytes32 indexed commitment);
 constructor(address auth,address genesis_) {
  if(auth==address(0)||genesis_==address(0)||auth.code.length==0||genesis_.code.length==0)revert InvalidExpansion();
  authorization=IHighCountryAuthorization(auth);genesis=IFoundingGenesisExpansion(genesis_);
 }
 function stage(uint16 id,bytes32 metadata,bytes32 climate,bytes32 ruleset,bytes32 landPolicy,bytes32 commitment) external {
  if(id<4||metadata==0||climate==0||ruleset==0||landPolicy==0||_releases[id].status!=Status.NONE)revert InvalidExpansion();
  if(commitment!=keccak256(abi.encode("HC.EXPANSION.RELEASE.V1",block.chainid,address(this),id,metadata,climate,ruleset,landPolicy)))revert InvalidExpansion();
  _auth(STAGE,id);_releases[id]=Release(commitment,metadata,climate,ruleset,landPolicy,Status.STAGED);
  emit Staged(id,commitment);
 }
 function open(uint16 id) external {
  if(!genesis.finalized()||_releases[id].status!=Status.STAGED)revert InvalidState();
  _auth(OPEN,id);_releases[id].status=Status.OPEN;emit Opened(id,_releases[id].commitment);
 }
 function isOpen(uint16 id) external view returns(bool){return _releases[id].status==Status.OPEN;}
 function getRelease(uint16 id) external view returns(Release memory){return _releases[id];}
 function _auth(bytes32 action,uint16 id) private view {
  authorization.requireAuthorized(AuthorizationRequest(msg.sender,MODULE_ID,action,bytes32(uint256(id)),0));
 }
}

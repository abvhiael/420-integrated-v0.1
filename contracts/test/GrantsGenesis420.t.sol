// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "../src/interfaces/genesis/ICapabilityRegistry420.sol";
import "../src/grants/GrantIds420.sol";
import "../src/grants/GrantAuthorization420.sol";
import "../src/grants/GrantProgramRegistry420.sol";
import "../src/grants/GrantApplicationRegistry420.sol";
import "../src/grants/GrantAwardRegistry420.sol";
import "../src/grants/GrantMilestoneRegistry420.sol";

interface VmGrants420 { function prank(address) external; function warp(uint256) external; }
contract MockGrantCaps420 is ICapabilityRegistry420 {
    mapping(bytes32=>bool) internal ok;
    function key(address p,bytes32 c,bytes32 a,bytes32 s) public pure returns(bytes32){return keccak256(abi.encode(p,c,a,s));}
    function set(address p,bytes32 c,bytes32 a,bytes32 s,bool v) external {ok[key(p,c,a,s)]=v;}
    function grant(bytes32) external pure returns(CapabilityGrant memory g){return g;}
    function isAuthorized(address p,bytes32 c,bytes32 a,bytes32 s,uint256) external view returns(bool){return ok[key(p,c,a,s)];}
}
contract MockGrantTreasury420 is ITreasuryDisbursementGrant420 {
    mapping(bytes32=>Disbursement) internal ds;
    function set(bytes32 id,bytes32 budget,address recipient,address asset,uint128 amount,bytes32 civic,bytes32 purpose,State state,bytes32 releaseHash) external {ds[id]=Disbursement(budget,recipient,asset,amount,0,type(uint64).max,civic,purpose,releaseHash,state,true);}
    function disbursement(bytes32 id) external view returns(Disbursement memory){return ds[id];}
}
contract GrantsGenesis420Test {
    VmGrants420 constant vm=VmGrants420(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE=address(0xA11CE); address constant DELEGATE=address(0xD1E); address constant ASSET=address(0x420);
    struct Env { MockGrantCaps420 caps; GrantAuthorization420 auth; GrantProgramRegistry420 programs; GrantApplicationRegistry420 applications; GrantAwardRegistry420 awards; MockGrantTreasury420 treasury; GrantMilestoneRegistry420 milestones; }
    function setup() internal returns(Env memory e){e.caps=new MockGrantCaps420();e.auth=new GrantAuthorization420(address(e.caps));e.programs=new GrantProgramRegistry420(address(this));e.applications=new GrantApplicationRegistry420(address(e.auth),address(e.programs));e.awards=new GrantAwardRegistry420(address(this),address(e.programs),address(e.applications));e.treasury=new MockGrantTreasury420();e.milestones=new GrantMilestoneRegistry420(address(this),address(e.auth),address(e.programs),address(e.awards),address(e.treasury));}
    function makeProgram(Env memory e) internal returns(bytes32 p,bytes32 budget,bytes32 civic){p=keccak256("program");budget=keccak256("budget");civic=keccak256("civic");e.programs.createProgram(p,GrantIds420.PROGRAM_DEVELOPMENT,budget,civic,1000,700,uint64(block.timestamp),uint64(block.timestamp+1000),keccak256("program-meta"));}
    function submit(Env memory e,bytes32 p,uint128 amount,uint256 nonce) internal returns(bytes32 app){bytes32 content=keccak256(abi.encode("application",nonce));app=e.applications.canonicalId(p,ALICE,nonce,content);vm.prank(ALICE);e.applications.submit(app,p,ALICE,nonce,amount,content);}
    function award(Env memory e,bytes32 app,uint128 amount) internal returns(bytes32 a){bytes32 terms=keccak256(abi.encode("terms",app));a=e.awards.canonicalId(app,ALICE,amount,terms);e.awards.createAward(a,app,ALICE,amount,terms);}
    function testApplicationReplayAndDelegationDefaultDeny() public {Env memory e=setup();(bytes32 p,,)=makeProgram(e);bytes32 content=keccak256("delegated");bytes32 id=e.applications.canonicalId(p,ALICE,1,content);vm.prank(DELEGATE);(bool denied,)=address(e.applications).call(abi.encodeWithSelector(e.applications.submit.selector,id,p,ALICE,uint256(1),uint128(500),content));require(!denied,"default allow");e.caps.set(DELEGATE,GrantIds420.COMPONENT_GRANTS,GrantIds420.ACTION_SUBMIT_APPLICATION,e.auth.scopeProgram(p),true);vm.prank(DELEGATE);e.applications.submit(id,p,ALICE,1,500,content);vm.prank(ALICE);(bool replay,)=address(e.applications).call(abi.encodeWithSelector(e.applications.submit.selector,id,p,ALICE,uint256(1),uint128(500),content));require(!replay,"application replay");}
    function testProgramAndAwardCapsFailClosed() public {Env memory e=setup();(bytes32 p,,)=makeProgram(e);bytes32 app1=submit(e,p,700,1);award(e,app1,700);bytes32 app2=submit(e,p,400,2);bytes32 terms=keccak256("terms2");bytes32 a2=e.awards.canonicalId(app2,ALICE,400,terms);(bool over,)=address(e.awards).call(abi.encodeWithSelector(e.awards.createAward.selector,a2,app2,ALICE,uint128(400),terms));require(!over,"program cap bypass");}
    function testMilestoneMustMatchTreasuryExactlyAndFinalizeAfterExecution() public {Env memory e=setup();(bytes32 p,bytes32 budget,bytes32 civic)=makeProgram(e);bytes32 app=submit(e,p,600,1);bytes32 a=award(e,app,600);bytes32 purpose=keccak256("milestone-purpose");bytes32 m=e.milestones.canonicalId(a,1,300,purpose);e.milestones.createMilestone(m,a,1,300,purpose);vm.prank(ALICE);e.milestones.submitClaim(m,keccak256("evidence"));bytes32 d=keccak256("treasury-disbursement");e.treasury.set(d,budget,ALICE,ASSET,299,civic,purpose,ITreasuryDisbursementGrant420.State.SCHEDULED,bytes32(0));(bool mismatch,)=address(e.milestones).call(abi.encodeWithSelector(e.milestones.approve.selector,m,d));require(!mismatch,"amount mismatch accepted");e.treasury.set(d,budget,ALICE,ASSET,300,civic,purpose,ITreasuryDisbursementGrant420.State.SCHEDULED,bytes32(0));e.milestones.approve(m,d);(bool early,)=address(e.milestones).call(abi.encodeWithSelector(e.milestones.finalizePaid.selector,m));require(!early,"paid before treasury execution");e.treasury.set(d,budget,ALICE,ASSET,300,civic,purpose,ITreasuryDisbursementGrant420.State.EXECUTED,keccak256("vault-release"));e.milestones.finalizePaid(m);require(e.milestones.milestone(m).state==GrantMilestoneRegistry420.State.PAID,"not paid");}
    function testMilestoneTotalCannotExceedAward() public {Env memory e=setup();(bytes32 p,,)=makeProgram(e);bytes32 app=submit(e,p,500,1);bytes32 a=award(e,app,500);bytes32 p1=keccak256("p1");bytes32 m1=e.milestones.canonicalId(a,1,300,p1);e.milestones.createMilestone(m1,a,1,300,p1);bytes32 p2=keccak256("p2");bytes32 m2=e.milestones.canonicalId(a,2,300,p2);(bool over,)=address(e.milestones).call(abi.encodeWithSelector(e.milestones.createMilestone.selector,m2,a,uint32(2),uint128(300),p2));require(!over,"milestone cap bypass");}
}

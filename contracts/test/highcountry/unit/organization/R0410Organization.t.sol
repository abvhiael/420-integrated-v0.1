// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import { OrganizationRegistry } from "../../../../src/highcountry/organization/OrganizationRegistry.sol";
import { OrganizationAuthority } from "../../../../src/highcountry/organization/OrganizationAuthority.sol";

contract R0410Actor {
    function join(OrganizationRegistry r,bytes32 id) external {r.join(id);}
    function leave(OrganizationRegistry r,bytes32 id) external {r.requestLeave(id);}
    function reserve(OrganizationRegistry r,bytes32 id,uint32 amount) external {r.reserveObligation(id,amount);}
    function ack(OrganizationRegistry r,bytes32 id,uint32 left) external {r.acknowledgeObligation(id,left);}
    function finalize(OrganizationRegistry r,bytes32 id,address who) external {r.finalizeExit(id,who);}
    function consume(OrganizationAuthority a,bytes32 id,bytes32 act,bytes32 scope) external {a.consume(id,act,scope);}
    function revoke(OrganizationAuthority a,bytes32 id) external {a.revoke(id);}
}

contract R0410OrganizationTest {
    OrganizationRegistry r;
    OrganizationAuthority a;
    R0410Actor alice;
    R0410Actor bob;
    bytes32 constant ORG=keccak256("org");
    bytes32 constant ACTION=keccak256("manage-plants");
    bytes32 constant SCOPE=keccak256("field-7");
    function setUp() public {
        r=new OrganizationRegistry();
        a=new OrganizationAuthority(address(r));
        alice=new R0410Actor();
        bob=new R0410Actor();
        r.create(ORG,keccak256("meta"));
        r.invite(ORG,address(alice),true);
        alice.join(r,ORG);
    }
    function testMembershipInvitationAndReplay() public {
        (bool denied,) = address(bob).call(abi.encodeCall(bob.join,(r,ORG)));
        require(!denied,"uninvited member entered");
        r.invite(ORG,address(bob),true);
        bob.join(r,ORG);
        (bool replay,) = address(bob).call(abi.encodeCall(bob.join,(r,ORG)));
        require(!replay,"join replay");
    }
    function testBoundedDelegationAndUseReplay() public {
        bytes32 id=a.delegate(ORG,address(alice),ACTION,SCOPE,uint64(block.timestamp),uint64(block.timestamp+1 days),1);
        require(a.valid(id,address(alice),ACTION,SCOPE),"valid delegate absent");
        require(!a.valid(id,address(bob),ACTION,SCOPE),"unauthorized person");
        require(!a.valid(id,address(alice),ACTION,bytes32(uint256(99))),"scope escalation");
        (bool impersonate,) = address(bob).call(abi.encodeCall(bob.consume,(a,id,ACTION,SCOPE)));
        require(!impersonate,"delegate impersonation");
        alice.consume(a,id,ACTION,SCOPE);
        require(!a.valid(id,address(alice),ACTION,SCOPE),"replay allowed");
    }
    function testNoImplicitFinancialOrRightsAuthority() public {
        for(uint256 i=0;i<3;i++) {
            bytes32 forbidden=i==0?a.TREASURY_ACTION():i==1?a.WALLET_ACTION():a.RIGHTS_ACTION();
            (bool ok,) = address(a).call(abi.encodeCall(a.delegate,
                (ORG,address(alice),forbidden,SCOPE,uint64(block.timestamp),uint64(block.timestamp+1 days),uint32(1))));
            require(!ok,"admin silently granted financial or rights authority");
        }
    }
    function testLeaveRevokesAuthorizationAndObligationsBlockExit() public {
        bytes32 id=a.delegate(ORG,address(alice),ACTION,SCOPE,uint64(block.timestamp),uint64(block.timestamp+1 days),2);
        alice.reserve(r,ORG,2);
        alice.leave(r,ORG);
        require(!a.valid(id,address(alice),ACTION,SCOPE),"leaving member retained access");
        (bool premature,) = address(r).call(abi.encodeCall(r.finalizeExit,(ORG,address(alice))));
        require(!premature,"outstanding obligations silently dropped");
        alice.ack(r,ORG,0);
        r.finalizeExit(ORG,address(alice));
        require(!r.isActiveMember(ORG,address(alice)),"ex-member active");
    }
    function testAdminRotationRevokesOldDelegation() public {
        bytes32 id=a.delegate(ORG,address(alice),ACTION,SCOPE,uint64(block.timestamp),uint64(block.timestamp+1 days),5);
        r.transferAdmin(ORG,address(alice));
        require(!a.valid(id,address(alice),ACTION,SCOPE),"old admin grants survived rotation");
        (bool retained,) = address(a).call(abi.encodeCall(a.delegate,
            (ORG,address(bob),ACTION,SCOPE,uint64(block.timestamp),uint64(block.timestamp+1 days),uint32(2))));
        require(!retained,"former admin delegated");
    }
    function testRemovalAndRevocation() public {
        bytes32 id=a.delegate(ORG,address(alice),ACTION,SCOPE,uint64(block.timestamp),uint64(block.timestamp+1 days),5);
        alice.revoke(a,id);
        require(!a.valid(id,address(alice),ACTION,SCOPE),"delegate revocation failed");
        r.remove(ORG,address(alice));
        require(!r.isActiveMember(ORG,address(alice)),"removed member active");
    }
}

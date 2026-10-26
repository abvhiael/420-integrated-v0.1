// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../tournament-5c2/PokerTournamentEntryEscrow420.t.sol";
import "../../src/bet/tournament/purchases/PokerTournamentPurchasePolicies420.sol";
contract TournamentPurchasePolicy420Test is EntryFixture420 {
    PokerTournamentPurchasePolicies420 private plans;bytes32 private constant PLAN=keccak256("purchase plan");
    function setUp()public override {super.setUp();plans=new PokerTournamentPurchasePolicies420(address(policies));grant(address(this),plans.REGISTER(),plans.scope(PLAN));grant(address(this),plans.APPROVE(),plans.scope(PLAN));grant(address(this),plans.PUBLISH(),plans.scope(PLAN));}
    function _base(bool extras)private {PokerTournamentPolicy420.Config memory c=config();if(extras){c.purchaseKind=PokerTournamentPolicy420.PurchaseKind.RE_ENTRY;c.extraCap=2;c.extraDuration=1000;}_publish(c);}
    function testFreezeoutCannotAcquireAddOns()public{_base(false);_reject(address(plans),abi.encodeCall(plans.register,(PLAN,POLICY,true,uint32(300))));plans.register(PLAN,POLICY,false,0);plans.approve(PLAN);plans.publish(PLAN);require(!plans.get(PLAN).addOn);}
    function testInvalidWindowsFailBeforeFreezingTerms()public{_base(true);_reject(address(plans),abi.encodeCall(plans.register,(PLAN,POLICY,true,uint32(0))));_reject(address(plans),abi.encodeCall(plans.register,(PLAN,POLICY,true,uint32(3601))));_reject(address(plans),abi.encodeCall(plans.register,(PLAN,POLICY,false,uint32(300))));plans.register(PLAN,POLICY,true,300);require(plans.get(PLAN).window==300);}
    function testPublicationRequiresApprovalAndOriginalPublisher()public{_base(true);plans.register(PLAN,POLICY,true,300);_reject(address(plans),abi.encodeCall(plans.publish,(PLAN)));_fail(outsider,address(plans),abi.encodeCall(plans.approve,(PLAN)));plans.approve(PLAN);plans.publish(PLAN);_reject(address(plans),abi.encodeCall(plans.publish,(PLAN)));}
    function testTermsCannotBeAddedAfterRegistrationOpens()public{_base(true);vm.warp(200);_reject(address(plans),abi.encodeCall(plans.register,(PLAN,POLICY,true,uint32(300))));}
    function testLatePublicationFailsEvenIfApprovedEarlier()public{_base(true);plans.register(PLAN,POLICY,true,300);plans.approve(PLAN);vm.warp(200);_reject(address(plans),abi.encodeCall(plans.publish,(PLAN)));}
    function testSinglePlanPerPolicyAndDomainBoundDigest()public{_base(true);plans.register(PLAN,POLICY,true,300);bytes32 other=keccak256("other");grant(address(this),plans.REGISTER(),plans.scope(other));_reject(address(plans),abi.encodeCall(plans.register,(other,POLICY,true,uint32(300))));require(plans.planForPolicy(POLICY)==PLAN&&plans.get(PLAN).digest!=bytes32(0));}
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../tournament-5c2/PokerTournamentEntryEscrow420.t.sol";
import "../../src/bet/tournament/purchases/PokerTournamentPurchaseEscrow420.sol";
// Hostile tokens test custody boundaries; these are not cryptographic verifiers.
contract TournamentPurchaseAssetAttack420Test is EntryFixture420 {
    HostileEntryAsset420 private hostile;
    function _adversarial()private{
        hostile=new HostileEntryAsset420();policies=new PokerTournamentPolicyRegistry420(address(auth),address(ops),address(hostile));
        PokerTournamentPurchasePolicies420 plans=new PokerTournamentPurchasePolicies420(address(policies));
        escrow=PokerTournamentEntryEscrow420(address(new PokerTournamentPurchaseEscrow420(address(plans),address(identity),ISSUER,TYPE,address(dev))));
        asset=Wrapped420(payable(address(hostile)));hostile.approve(address(escrow),type(uint256).max);
        hostile.transfer(address(alice),1000);alice.invoke(address(hostile),abi.encodeCall(hostile.approve,(address(escrow),type(uint256).max)));
        grant(address(this),escrow.CREATE(),escrow.scope(EVENT));grant(address(alice),escrow.ENTER(),escrow.scope(EVENT));PokerTournamentPolicy420.Config memory c=config();
        grant(address(this),policies.CREATE(),policies.scope(POLICY));grant(address(this),policies.APPROVE(),policies.scope(POLICY));grant(address(this),policies.PUBLISH(),policies.scope(POLICY));policies.register(POLICY,c);policies.approve(POLICY);policies.publish(POLICY);
        bytes32 plan=keccak256("asset-test frozen plan");grant(address(this),plans.REGISTER(),plans.scope(plan));grant(address(this),plans.APPROVE(),plans.scope(plan));grant(address(this),plans.PUBLISH(),plans.scope(plan));plans.register(plan,POLICY,false,0);plans.approve(plan);plans.publish(plan);escrow.create(EVENT,POLICY);vm.warp(200);
    }
    function testReportedTransferWithoutTokensRejectedAtomically()public{_adversarial();hostile.setAttack(1,address(0),"");_fail(alice,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,A,AC,uint64(1),uint256(103),escrow.eventOf(EVENT).manifest)));require(escrow.eventOf(EVENT).receipts==0&&escrow.totalLiability()==0&&hostile.balanceOf(address(alice))==1000);}
    function testFeeOnIncomingTransferRejectedAtomically()public{_adversarial();hostile.setAttack(2,address(0),"");_fail(alice,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,A,AC,uint64(1),uint256(103),escrow.eventOf(EVENT).manifest)));require(escrow.totalLiability()==0&&hostile.balanceOf(address(escrow))==0);}
    function testTokenCannotOverchargePayerBeyondQuote()public{_adversarial();hostile.setAttack(6,address(0),"");_fail(alice,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,A,AC,uint64(1),uint256(103),escrow.eventOf(EVENT).manifest)));require(escrow.totalLiability()==0&&hostile.balanceOf(address(alice))==1000);}
    function testCrossFunctionReentryDuringDepositBlocked()public{_adversarial();hostile.setAttack(3,address(escrow),abi.encodeCall(escrow.tick,(EVENT)));_buy(alice,A,AC,1);require(hostile.callbackBlocked()&&escrow.totalLiability()==103);_invariant();}
    function testReentryDuringRefundWithdrawalBlocked()public{_adversarial();_buy(alice,A,AC,1);alice.invoke(address(escrow),abi.encodeCall(escrow.unregister,(EVENT,uint64(1),uint64(1))));hostile.setAttack(3,address(escrow),abi.encodeCall(escrow.tick,(EVENT)));alice.invoke(address(escrow),abi.encodeCall(escrow.withdraw,()));require(hostile.callbackBlocked()&&escrow.totalLiability()==0&&hostile.balanceOf(address(alice))==1000);}
    function testOutgoingTransferFailurePreservesCredit()public{_adversarial();_buy(alice,A,AC,1);alice.invoke(address(escrow),abi.encodeCall(escrow.unregister,(EVENT,uint64(1),uint64(1))));hostile.setAttack(4,address(0),"");_fail(alice,address(escrow),abi.encodeCall(escrow.withdraw,()));require(escrow.credit(address(alice))==103&&escrow.totalLiability()==103&&escrow.totalWithdrawn()==0);}
    function testShortOutgoingTransferCannotConsumeRefund()public{_adversarial();_buy(alice,A,AC,1);alice.invoke(address(escrow),abi.encodeCall(escrow.unregister,(EVENT,uint64(1),uint64(1))));hostile.setAttack(5,address(0),"");_fail(alice,address(escrow),abi.encodeCall(escrow.withdraw,()));require(escrow.credit(address(alice))==103&&hostile.balanceOf(address(alice))==897&&hostile.balanceOf(address(escrow))==103);}
    function testCrossFacetCallbackDuringInitialDepositBlocked()public{_adversarial();PokerTournamentPurchaseEscrow420 bank=PokerTournamentPurchaseEscrow420(address(escrow));hostile.setAttack(3,address(escrow),abi.encodeCall(bank.purchaseLate,(EVENT,A,AC,uint64(2),uint256(103),escrow.eventOf(EVENT).manifest)));_buy(alice,A,AC,1);require(hostile.callbackBlocked()&&bank.solvent());}
}

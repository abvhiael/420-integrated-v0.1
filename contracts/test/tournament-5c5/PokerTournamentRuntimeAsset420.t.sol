// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../tournament-5c2/PokerTournamentEntryEscrow420.t.sol";
import "../../src/bet/tournament/PokerTournamentRuntimeEscrow420.sol";
// Hostile tokens test custody boundaries; these are not cryptographic verifiers.
contract TournamentRuntimeAssetAttack420Test is EntryFixture420 {
    HostileEntryAsset420 private hostile;
    function _adversarial()private{
        hostile=new HostileEntryAsset420();policies=new PokerTournamentPolicyRegistry420(address(auth),address(ops),address(hostile));
        escrow=PokerTournamentEntryEscrow420(address(new PokerTournamentRuntimeEscrow420(address(policies),address(identity),ISSUER,TYPE,address(dev))));
        asset=Wrapped420(payable(address(hostile)));hostile.approve(address(escrow),type(uint256).max);
        hostile.transfer(address(alice),1000);alice.invoke(address(hostile),abi.encodeCall(hostile.approve,(address(escrow),type(uint256).max)));
        grant(address(this),escrow.CREATE(),escrow.scope(EVENT));grant(address(alice),escrow.ENTER(),escrow.scope(EVENT));_create(config());
    }
    function testReportedTransferWithoutTokensRejectedAtomically()public{_adversarial();hostile.setAttack(1,address(0),"");_fail(alice,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,A,AC,uint64(1),uint256(103),escrow.eventOf(EVENT).manifest)));require(escrow.eventOf(EVENT).receipts==0&&escrow.totalLiability()==0&&hostile.balanceOf(address(alice))==1000);}
    function testFeeOnIncomingTransferRejectedAtomically()public{_adversarial();hostile.setAttack(2,address(0),"");_fail(alice,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,A,AC,uint64(1),uint256(103),escrow.eventOf(EVENT).manifest)));require(escrow.totalLiability()==0&&hostile.balanceOf(address(escrow))==0);}
    function testTokenCannotOverchargePayerBeyondQuote()public{_adversarial();hostile.setAttack(6,address(0),"");_fail(alice,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,A,AC,uint64(1),uint256(103),escrow.eventOf(EVENT).manifest)));require(escrow.totalLiability()==0&&hostile.balanceOf(address(alice))==1000);}
    function testCrossFunctionReentryDuringDepositBlocked()public{_adversarial();hostile.setAttack(3,address(escrow),abi.encodeCall(escrow.tick,(EVENT)));_buy(alice,A,AC,1);require(hostile.callbackBlocked()&&escrow.totalLiability()==103);_invariant();}
    function testReentryDuringRefundWithdrawalBlocked()public{_adversarial();_buy(alice,A,AC,1);alice.invoke(address(escrow),abi.encodeCall(escrow.unregister,(EVENT,uint64(1),uint64(1))));hostile.setAttack(3,address(escrow),abi.encodeCall(escrow.tick,(EVENT)));alice.invoke(address(escrow),abi.encodeCall(escrow.withdraw,()));require(hostile.callbackBlocked()&&escrow.totalLiability()==0&&hostile.balanceOf(address(alice))==1000);}
    function testOutgoingTransferFailurePreservesCredit()public{_adversarial();_buy(alice,A,AC,1);alice.invoke(address(escrow),abi.encodeCall(escrow.unregister,(EVENT,uint64(1),uint64(1))));hostile.setAttack(4,address(0),"");_fail(alice,address(escrow),abi.encodeCall(escrow.withdraw,()));require(escrow.credit(address(alice))==103&&escrow.totalLiability()==103&&escrow.totalWithdrawn()==0);}
    function testShortOutgoingTransferCannotConsumeRefund()public{_adversarial();_buy(alice,A,AC,1);alice.invoke(address(escrow),abi.encodeCall(escrow.unregister,(EVENT,uint64(1),uint64(1))));hostile.setAttack(5,address(0),"");_fail(alice,address(escrow),abi.encodeCall(escrow.withdraw,()));require(escrow.credit(address(alice))==103&&hostile.balanceOf(address(alice))==897&&hostile.balanceOf(address(escrow))==103);}
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/bet/tournament/PokerTournamentEntryEscrow420.sol";
import "../../src/system/CapabilityRegistry420.sol";
import "../../src/exchange/Wrapped420.sol";
interface IEntryVm420 {function warp(uint256) external;function deal(address,uint256) external;}
contract EntryActor420 {
    receive() external payable {}
    function wrap(Wrapped420 token,uint256 amount) external {token.deposit{value:amount}();}
    function invoke(address target,bytes calldata data) external payable returns(bytes memory) {
        (bool ok,bytes memory value)=target.call{value:msg.value}(data);
        if(!ok)assembly{revert(add(value,32),mload(value))}return value;
    }
}
contract PurchaseMathHarness420 {
    function quote(uint128 buyIn,uint128 stack) external pure returns(PokerTournamentPurchaseAccounting420.Quote memory){return PokerTournamentPurchaseAccounting420.quote(buyIn,stack);}
    function allowed(PokerTournamentPolicy420.Config calldata c,uint16 used,uint256 chips,bool eliminated,bool boundary,
        uint64 started,uint16 level,uint256 now_,uint64 choice)external pure returns(bool){
        return PokerTournamentPurchaseAccounting420.extraAllowed(c,used,chips,eliminated,boundary,started,level,now_,choice);
    }
}
/// @dev Hostile ERC20 boundary fixture, never a card verifier or canonical funded asset.
contract HostileEntryAsset420 {
    mapping(address=>uint256)public balanceOf;mapping(address=>mapping(address=>uint256))public allowance;
    uint8 public mode;address public target;bytes public callback;bool public callbackBlocked;
    constructor(){balanceOf[msg.sender]=10000;}
    function setAttack(uint8 mode_,address target_,bytes calldata callback_)external{mode=mode_;target=target_;callback=callback_;}
    function approve(address spender,uint256 amount)external returns(bool){allowance[msg.sender][spender]=amount;return true;}
    function transferFrom(address from,address to,uint256 amount)external returns(bool){
        require(allowance[from][msg.sender]>=amount);allowance[from][msg.sender]-=amount;
        if(mode==1)return true;
        uint256 debit=mode==6?amount+1:amount;require(balanceOf[from]>=debit);balanceOf[from]-=debit;balanceOf[to]+=mode==2?amount-1:amount;
        if(mode==3){(bool ok,bytes memory reason)=target.call(callback);callbackBlocked=!ok;require(!ok&&reason.length==4&&bytes4(reason)==PokerTournamentEntryEscrow420.Reentrancy.selector,"callback was not stopped by mutex");}
        return true;
    }
    function transfer(address to,uint256 amount)external returns(bool){
        if(mode==4)return false;
        require(balanceOf[msg.sender]>=amount);balanceOf[msg.sender]-=amount;balanceOf[to]+=mode==5?amount-1:amount;
        if(mode==3){(bool ok,bytes memory reason)=target.call(callback);callbackBlocked=!ok;require(!ok&&reason.length==4&&bytes4(reason)==PokerTournamentEntryEscrow420.Reentrancy.selector,"callback was not stopped by mutex");}
        return true;
    }
}
abstract contract EntryFixture420 {
    IEntryVm420 internal constant vm=IEntryVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    CapabilityRegistry420 internal caps;BetAuthorization420 internal auth;BetOperatorRegistry420 internal ops;
    Identity420 internal identity;Wrapped420 internal asset;DevelopmentCompensationVault420 internal dev;
    PokerTournamentPolicyRegistry420 internal policies;PokerTournamentEntryEscrow420 internal escrow;
    EntryActor420 internal alice;EntryActor420 internal bob;EntryActor420 internal outsider;
    bytes32 internal constant OP=keccak256("operator");bytes32 internal constant POLICY=keccak256("policy");
    bytes32 internal constant EVENT=keccak256("event");bytes32 internal constant ISSUER=keccak256("verified-issuer");
    bytes32 internal constant TYPE=keccak256("verified-person");bytes32 internal constant A=keccak256("alice");
    bytes32 internal constant B=keccak256("bob");bytes32 internal constant AC=keccak256("alice-credential");bytes32 internal constant BC=keccak256("bob-credential");
    uint256 internal grantNonce;bytes32 internal aliceGrant;
    receive() external payable {}
    function grant(address actor,bytes32 action,bytes32 scope_) internal returns(bytes32 id){
        id=bytes32(++grantNonce);caps.createGrant(id,actor,keccak256("420.BET.CORE"),action,scope_,0,0,0,1,10000000);
    }
    function setUp() public virtual {
        vm.warp(100);caps=new CapabilityRegistry420();caps.registerProtocolComponent(keccak256("420.BET.CORE"),address(this));
        auth=new BetAuthorization420(address(caps));ops=new BetOperatorRegistry420(address(auth));asset=new Wrapped420();
        identity=new Identity420(address(this));identity.setIssuer(ISSUER,address(this),keccak256("issuer manifest"),true);
        dev=new DevelopmentCompensationVault420(address(caps),address(0x420));
        policies=new PokerTournamentPolicyRegistry420(address(auth),address(ops),address(asset));
        escrow=new PokerTournamentEntryEscrow420(address(policies),address(identity),ISSUER,TYPE,address(dev));
        grant(address(this),keccak256("BET_OPERATOR_REGISTER"),auth.scopeForOperator(OP));grant(address(this),keccak256("BET_OPERATOR_ACTIVATE"),auth.scopeForOperator(OP));
        ops.registerOperator(OP,address(this),keccak256("operator manifest"));ops.activate(OP);
        alice=new EntryActor420();bob=new EntryActor420();outsider=new EntryActor420();
        _identity(alice,A,AC,keccak256("person A"));_identity(bob,B,BC,keccak256("person B"));
        _fund(alice,10000);_fund(bob,10000);_fund(outsider,10000);vm.deal(address(this),10000);asset.deposit{value:10000}();asset.approve(address(escrow),type(uint256).max);
        grant(address(this),escrow.CREATE(),escrow.scope(EVENT));aliceGrant=grant(address(alice),escrow.ENTER(),escrow.scope(EVENT));grant(address(bob),escrow.ENTER(),escrow.scope(EVENT));
    }
    function _identity(EntryActor420 actor,bytes32 subject,bytes32 credential,bytes32 person)internal{
        actor.invoke(address(identity),abi.encodeCall(identity.createProfile,(subject,bytes32(0))));
        identity.issueCredential(credential,ISSUER,subject,TYPE,person,1000000);
    }
    function _fund(EntryActor420 actor,uint256 amount)internal{vm.deal(address(actor),amount);actor.wrap(asset,amount);actor.invoke(address(asset),abi.encodeCall(asset.approve,(address(escrow),type(uint256).max)));}
    function config()internal pure returns(PokerTournamentPolicy420.Config memory c){
        c.gameVersion=keccak256("tournament version");c.operatorId=OP;c.payoutPolicy=keccak256("payout reference");c.recoveryPolicy=keccak256("recovery reference");c.blindSchedule=keccak256("blinds");c.seatingPolicy=keccak256("seating");
        c.seatsPerTable=9;c.maxTables=1;c.minimum=2;c.startingTarget=2;c.maxPlayers=9;c.buyIn=100;c.startingStack=1000;
        c.registrationOpens=200;c.startOrRegistrationDeadline=400;c.underfillGrace=1800;c.technicalGrace=600;c.purchaseReadiness=600;c.rebuyChoice=60;c.recoveryGrace=86400;c.lateDuration=1000;
    }
    function _publish(PokerTournamentPolicy420.Config memory c)internal{
        grant(address(this),policies.CREATE(),policies.scope(POLICY));grant(address(this),policies.APPROVE(),policies.scope(POLICY));grant(address(this),policies.PUBLISH(),policies.scope(POLICY));
        policies.register(POLICY,c);policies.approve(POLICY);policies.publish(POLICY);escrow.create(EVENT,POLICY);
    }
    function _create(PokerTournamentPolicy420.Config memory c)internal{_publish(c);vm.warp(200);}
    function _buy(EntryActor420 actor,bytes32 subject,bytes32 credential,uint64 nonce)internal returns(uint64){
        return abi.decode(actor.invoke(address(escrow),abi.encodeCall(escrow.purchase,(EVENT,subject,credential,nonce,escrow.quote(EVENT).total,escrow.eventOf(EVENT).manifest))),(uint64));
    }
    function _fail(EntryActor420 actor,address target,bytes memory data)internal{(bool ok,)=address(actor).call(abi.encodeCall(actor.invoke,(target,data)));require(!ok,"unexpected acceptance");}
    function _reject(address target,bytes memory data)internal{(bool ok,)=target.call(data);require(!ok,"unexpected acceptance");}
    function _invariant()internal view{require(escrow.solvent());require(asset.balanceOf(address(escrow))>=escrow.totalLiability());require(escrow.totalReceived()==escrow.totalWithdrawn()+escrow.totalLiability());}
}
contract TournamentEntryFunded420Test is EntryFixture420 {
    event FundedIdentity(address escrow,bytes32 runtimeHash,bytes32 manifest,address asset,address identity,address policies,uint256 liability);
    function testLegitimateFundedPurchaseAndFullRefund() public {
        _create(config());uint64 i=_buy(alice,A,AC,1);
        require(asset.balanceOf(address(escrow))==103&&escrow.heldPrizes()==100&&escrow.heldFees()==3);
        PokerTournamentEntryEscrow420.Entry memory x=escrow.entryOf(EVENT,i);require(x.payer==address(alice)&&x.chips==1000&&x.nonce==1);
        emit FundedIdentity(address(escrow),address(escrow).codehash,escrow.eventOf(EVENT).manifest,address(asset),address(identity),address(policies),escrow.totalLiability());
        alice.invoke(address(escrow),abi.encodeCall(escrow.unregister,(EVENT,i,uint64(1))));
        require(escrow.credit(address(alice))==103&&escrow.totalLiability()==103&&escrow.heldPrizes()==0&&escrow.heldFees()==0);
        alice.invoke(address(escrow),abi.encodeCall(escrow.withdraw,()));require(asset.balanceOf(address(alice))==10000);_invariant();
    }
    function testTwoPaidEntriesRetainAllPrizesAndFees()public{_create(config());_buy(alice,A,AC,1);_buy(bob,B,BC,1);require(escrow.eventOf(EVENT).reservedPlayers==2&&escrow.heldPrizes()==200&&escrow.heldFees()==6);require(asset.balanceOf(address(0x420))==0);_invariant();}
    function testSponsoredFreePrizePrefundedAtCreation()public{PokerTournamentPolicy420.Config memory c=config();c.buyIn=0;c.sponsoredPrize=1000;_create(c);require(asset.balanceOf(address(escrow))==1000);_buy(alice,A,AC,1);require(escrow.heldPrizes()==1000&&escrow.heldFees()==0);_invariant();}
    function testSponsorAndPlayerFundedIndependently()public{PokerTournamentPolicy420.Config memory c=config();c.sponsoredPrize=500;_create(c);_buy(alice,A,AC,1);require(asset.balanceOf(address(this))==9500&&asset.balanceOf(address(alice))==9897&&escrow.heldPrizes()==600);_invariant();}
    function testUnderfillCancelsAndRefundsSponsorAndEntry()public{PokerTournamentPolicy420.Config memory c=config();c.sponsoredPrize=500;_create(c);uint64 i=_buy(alice,A,AC,1);vm.warp(2200);escrow.tick(EVENT);escrow.refundCancelled(EVENT,i);require(escrow.credit(address(this))==500&&escrow.credit(address(alice))==103);escrow.withdraw();alice.invoke(address(escrow),abi.encodeCall(escrow.withdraw,()));require(asset.balanceOf(address(this))==10000&&asset.balanceOf(address(alice))==10000);_invariant();}
    function testTechnicalTimeoutFullRefundIncludingFees()public{_create(config());_buy(alice,A,AC,1);_buy(bob,B,BC,1);vm.warp(999);escrow.tick(EVENT);require(escrow.eventOf(EVENT).state==PokerTournamentEntryEscrow420.State.STARTING);vm.warp(1000);escrow.tick(EVENT);escrow.refundCancelled(EVENT,1);escrow.refundCancelled(EVENT,2);require(escrow.totalCredits()==206&&escrow.heldFees()==0);_invariant();}
    function testUnderfillStartsAtThresholdDuringOnlyGrace()public{_create(config());_buy(alice,A,AC,1);vm.warp(400);escrow.tick(EVENT);require(escrow.eventOf(EVENT).state==PokerTournamentEntryEscrow420.State.DELAYED);vm.warp(450);_buy(bob,B,BC,1);require(escrow.eventOf(EVENT).readyAt==450);vm.warp(1050);escrow.tick(EVENT);require(escrow.eventOf(EVENT).state==PokerTournamentEntryEscrow420.State.CANCELLED);}
    function testSngLockImmediateAndCannotUnregister()public{PokerTournamentPolicy420.Config memory c=config();c.startKind=PokerTournamentPolicy420.StartKind.SIT_AND_GO;_create(c);_buy(alice,A,AC,1);_buy(bob,B,BC,1);require(escrow.eventOf(EVENT).readyAt==200);_fail(alice,address(escrow),abi.encodeCall(escrow.unregister,(EVENT,uint64(1),uint64(1))));_invariant();}
    function testScheduledLockCannotBeExtendedByLateTick()public{_create(config());_buy(alice,A,AC,1);_buy(bob,B,BC,1);vm.warp(1500);escrow.tick(EVENT);require(escrow.eventOf(EVENT).state==PokerTournamentEntryEscrow420.State.CANCELLED&&escrow.eventOf(EVENT).readyAt==400);}
    function testRefundedReservationNotUniquePlayedCount()public{_create(config());_buy(alice,A,AC,1);alice.invoke(address(escrow),abi.encodeCall(escrow.unregister,(EVENT,uint64(1),uint64(1))));require(escrow.eventOf(EVENT).reservedPlayers==0&&escrow.admittedUniquePlayers(EVENT)==0);}
    function testReceiptNonceSurvivesRefundAndReRegistration()public{_create(config());_buy(alice,A,AC,1);alice.invoke(address(escrow),abi.encodeCall(escrow.unregister,(EVENT,uint64(1),uint64(1))));require(_buy(alice,A,AC,2)==2);require(escrow.entryOf(EVENT,1).refunded&&!escrow.entryOf(EVENT,2).refunded);_invariant();}
    function testPermissionlessCancelledRefundCannotRedirect()public{_create(config());_buy(alice,A,AC,1);vm.warp(2200);outsider.invoke(address(escrow),abi.encodeCall(escrow.refundCancelled,(EVENT,uint64(1))));require(escrow.credit(address(alice))==103&&escrow.credit(address(outsider))==0);}
    function testRevokedIdentityDoesNotTrapRefund()public{_create(config());_buy(alice,A,AC,1);identity.revokeCredential(AC);alice.invoke(address(escrow),abi.encodeCall(escrow.unregister,(EVENT,uint64(1),uint64(1))));alice.invoke(address(escrow),abi.encodeCall(escrow.withdraw,()));require(asset.balanceOf(address(alice))==10000);}
    function testControllerRotationCannotStealOriginalPayment()public{_create(config());_buy(alice,A,AC,1);alice.invoke(address(identity),abi.encodeCall(identity.transferProfileController,(A,address(outsider))));outsider.invoke(address(identity),abi.encodeCall(identity.acceptProfileController,(A)));_fail(outsider,address(escrow),abi.encodeCall(escrow.unregister,(EVENT,uint64(1),uint64(1))));alice.invoke(address(escrow),abi.encodeCall(escrow.unregister,(EVENT,uint64(1),uint64(1))));require(escrow.credit(address(alice))==103);}
    function testAliasSameVerifiedPersonRejected()public{_create(config());_buy(alice,A,AC,1);bytes32 alias_=keccak256("alias");bytes32 credential=keccak256("alias credential");_identity(outsider,alias_,credential,keccak256("person A"));grant(address(outsider),escrow.ENTER(),escrow.scope(EVENT));_fail(outsider,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,alias_,credential,uint64(2),uint256(103),escrow.eventOf(EVENT).manifest)));require(escrow.eventOf(EVENT).reservedPlayers==1);}
    function testOtherControllerCannotUseCredential()public{_create(config());_fail(outsider,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,A,AC,uint64(1),uint256(103),escrow.eventOf(EVENT).manifest)));_invariant();}
    function testRevokedCredentialRejectsPurchase()public{_create(config());identity.revokeCredential(AC);_fail(alice,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,A,AC,uint64(1),uint256(103),escrow.eventOf(EVENT).manifest)));require(escrow.totalLiability()==0);}
    function testWrongIssuerOrTypeRejected()public{_create(config());bytes32 wrong=keccak256("wrong");identity.issueCredential(wrong,ISSUER,A,keccak256("wrong type"),keccak256("person A"),1000000);_fail(alice,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,A,wrong,uint64(1),uint256(103),escrow.eventOf(EVENT).manifest)));}
    function testDuplicateEntryRejectedWithoutDebit()public{_create(config());_buy(alice,A,AC,1);_fail(alice,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,A,AC,uint64(2),uint256(103),escrow.eventOf(EVENT).manifest)));require(asset.balanceOf(address(alice))==9897);}
    function testManifestAndQuoteSlippageRejected()public{_create(config());_fail(alice,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,A,AC,uint64(1),uint256(102),escrow.eventOf(EVENT).manifest)));_fail(alice,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,A,AC,uint64(1),uint256(103),bytes32(0))));require(escrow.totalLiability()==0);}
    function testEventScopeCannotReplayPurchase()public{_create(config());_fail(alice,address(escrow),abi.encodeCall(escrow.purchase,(keccak256("other event"),A,AC,uint64(1),uint256(103),escrow.eventOf(EVENT).manifest)));}
    function testWrongNonceAndRefundReplayRejected()public{_create(config());_fail(alice,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,A,AC,uint64(2),uint256(103),escrow.eventOf(EVENT).manifest)));_buy(alice,A,AC,1);alice.invoke(address(escrow),abi.encodeCall(escrow.unregister,(EVENT,uint64(1),uint64(1))));_fail(alice,address(escrow),abi.encodeCall(escrow.unregister,(EVENT,uint64(1),uint64(1))));require(escrow.totalCredits()==103);}
    function testAllowanceFailureRollsBackReceiptAndLiability()public{_create(config());alice.invoke(address(asset),abi.encodeCall(asset.approve,(address(escrow),uint256(102))));_fail(alice,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,A,AC,uint64(1),uint256(103),escrow.eventOf(EVENT).manifest)));require(escrow.eventOf(EVENT).receipts==0&&escrow.totalLiability()==0);_invariant();}
    function testInsufficientSponsorCannotAdvertiseFundedEvent()public{PokerTournamentPolicy420.Config memory c=config();c.sponsoredPrize=10001;grant(address(this),policies.CREATE(),policies.scope(POLICY));grant(address(this),policies.APPROVE(),policies.scope(POLICY));grant(address(this),policies.PUBLISH(),policies.scope(POLICY));policies.register(POLICY,c);policies.approve(POLICY);policies.publish(POLICY);_reject(address(escrow),abi.encodeCall(escrow.create,(EVENT,POLICY)));require(escrow.eventOf(EVENT).state==PokerTournamentEntryEscrow420.State.NONE&&escrow.totalLiability()==0);}
    function testUnauthorizedCreateRejected()public{_fail(outsider,address(escrow),abi.encodeCall(escrow.create,(EVENT,POLICY)));}
    function testRevokedEntryCapabilityRejected()public{_create(config());caps.revokeGrant(aliceGrant);_fail(alice,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,A,AC,uint64(1),uint256(103),escrow.eventOf(EVENT).manifest)));require(escrow.totalReceived()==0);}
    function testRevokedCapabilityDoesNotTrapOriginalRefund()public{_create(config());_buy(alice,A,AC,1);caps.revokeGrant(aliceGrant);alice.invoke(address(escrow),abi.encodeCall(escrow.unregister,(EVENT,uint64(1),uint64(1))));alice.invoke(address(escrow),abi.encodeCall(escrow.withdraw,()));require(asset.balanceOf(address(alice))==10000);}
    function testUntrustedIssuerCannotEnter()public{_create(config());identity.setIssuerTrust(ISSUER,address(this),bytes32(0),Identity420.TrustClass.COMMUNITY,true);_fail(alice,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,A,AC,uint64(1),uint256(103),escrow.eventOf(EVENT).manifest)));}
    function testExpiredCredentialCannotEnter()public{_create(config());bytes32 short_=keccak256("short credential");identity.issueCredential(short_,ISSUER,A,TYPE,keccak256("person A"),201);vm.warp(201);_fail(alice,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,A,short_,uint64(1),uint256(103),escrow.eventOf(EVENT).manifest)));}
    function testExpiredEntryCapabilityCannotEnter()public{_create(config());caps.revokeGrant(aliceGrant);caps.createGrant(bytes32(++grantNonce),address(alice),keccak256("420.BET.CORE"),escrow.ENTER(),escrow.scope(EVENT),0,0,0,1,201);vm.warp(202);_fail(alice,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,A,AC,uint64(1),uint256(103),escrow.eventOf(EVENT).manifest)));}
    function testCapabilityLastValidSecondMatchesCanonicalAuthority()public{_create(config());caps.revokeGrant(aliceGrant);caps.createGrant(bytes32(++grantNonce),address(alice),keccak256("420.BET.CORE"),escrow.ENTER(),escrow.scope(EVENT),0,0,0,1,201);vm.warp(201);_buy(alice,A,AC,1);require(escrow.totalLiability()==103);}
    function testCredentialFromDifferentVerifiedIssuerRejected()public{_create(config());bytes32 other=keccak256("different issuer");bytes32 credential=keccak256("different issuer credential");identity.setIssuer(other,address(this),bytes32(0),true);identity.issueCredential(credential,other,A,TYPE,keccak256("person A"),1000000);_fail(alice,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,A,credential,uint64(1),uint256(103),escrow.eventOf(EVENT).manifest)));}
    function testLowBuyInRoundsFeeDownOnce()public{PokerTournamentPolicy420.Config memory c=config();c.buyIn=33;_create(c);_buy(alice,A,AC,1);require(escrow.heldPrizes()==33&&escrow.heldFees()==0&&escrow.totalLiability()==33);}
    function testEventIsolationAndIndependentRefundLiabilities()public{_publish(config());bytes32 other=keccak256("other event");grant(address(this),escrow.CREATE(),escrow.scope(other));escrow.create(other,POLICY);grant(address(bob),escrow.ENTER(),escrow.scope(other));vm.warp(200);_buy(alice,A,AC,1);bob.invoke(address(escrow),abi.encodeCall(escrow.purchase,(other,B,BC,uint64(1),uint256(103),escrow.eventOf(other).manifest)));alice.invoke(address(escrow),abi.encodeCall(escrow.unregister,(EVENT,uint64(1),uint64(1))));alice.invoke(address(escrow),abi.encodeCall(escrow.withdraw,()));require(escrow.eventOf(other).prize==100&&escrow.eventOf(other).fees==3&&asset.balanceOf(address(escrow))==103);_invariant();}
    function testPerCallCapabilityLimitIncludesFee()public{_create(config());caps.revokeGrant(aliceGrant);caps.createGrant(bytes32(++grantNonce),address(alice),keccak256("420.BET.CORE"),escrow.ENTER(),escrow.scope(EVENT),102,0,0,1,1000000);_fail(alice,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,A,AC,uint64(1),uint256(103),escrow.eventOf(EVENT).manifest)));}
    function testRefundCannotResetPeriodCapabilitySpend()public{_create(config());caps.revokeGrant(aliceGrant);caps.createGrant(bytes32(++grantNonce),address(alice),keccak256("420.BET.CORE"),escrow.ENTER(),escrow.scope(EVENT),0,150,1000,1,1000000);_buy(alice,A,AC,1);alice.invoke(address(escrow),abi.encodeCall(escrow.unregister,(EVENT,uint64(1),uint64(1))));_fail(alice,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,A,AC,uint64(2),uint256(103),escrow.eventOf(EVENT).manifest)));require(escrow.totalReceived()==103);}
    function testEventCannotBeRecreated()public{_create(config());_reject(address(escrow),abi.encodeCall(escrow.create,(EVENT,POLICY)));}
    function testRetiredPolicyBlocksNewMoneyNotRefunds()public{_create(config());_buy(alice,A,AC,1);grant(address(this),policies.RETIRE(),policies.scope(POLICY));policies.retire(POLICY);_fail(bob,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,B,BC,uint64(1),uint256(103),escrow.eventOf(EVENT).manifest)));alice.invoke(address(escrow),abi.encodeCall(escrow.unregister,(EVENT,uint64(1),uint64(1))));require(escrow.credit(address(alice))==103);}
    function testBeforeOpenAndExactDeadlineRejected()public{_create(config());vm.warp(199);_fail(alice,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,A,AC,uint64(1),uint256(103),escrow.eventOf(EVENT).manifest)));vm.warp(2200);_fail(alice,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,A,AC,uint64(1),uint256(103),escrow.eventOf(EVENT).manifest)));require(escrow.totalReceived()==0);}
    function testCapAndReservedCapacityCannotBeExceeded()public{PokerTournamentPolicy420.Config memory c=config();c.maxPlayers=2;_create(c);_buy(alice,A,AC,1);_buy(bob,B,BC,1);_identity(outsider,keccak256("third"),keccak256("third cred"),keccak256("third person"));grant(address(outsider),escrow.ENTER(),escrow.scope(EVENT));_fail(outsider,address(escrow),abi.encodeCall(escrow.purchase,(EVENT,keccak256("third"),keccak256("third cred"),uint64(1),uint256(103),escrow.eventOf(EVENT).manifest)));require(escrow.eventOf(EVENT).reservedPlayers==2);}
    function testAllGameplayPurchasesFailClosed()public{PokerTournamentPolicy420.Config memory c=config();c.purchaseKind=PokerTournamentPolicy420.PurchaseKind.REBUY;c.extraCap=2;c.extraDuration=1000;_create(c);_buy(alice,A,AC,1);_fail(alice,address(escrow),abi.encodeCall(escrow.purchaseExtra,()));require(!escrow.gameplayPurchasesEnabled()&&escrow.totalLiability()==103);}
    function testCannotCashOutStackOrReleaseFeesOrSetWinner()public{_create(config());_buy(alice,A,AC,1);for(uint256 i;i<4;i++){bytes memory data=i==0?abi.encodeWithSignature("cashout(bytes32)",EVENT):i==1?abi.encodeWithSignature("releaseFees(bytes32)",EVENT):i==2?abi.encodeWithSignature("setWinner(bytes32,address)",EVENT,address(this)):abi.encodeWithSignature("start(bytes32)",EVENT);_reject(address(escrow),data);}require(asset.balanceOf(address(escrow))==103);}
    function testDonationsAreSurplusNeverPrizesOrCredits()public{_create(config());_buy(alice,A,AC,1);asset.transfer(address(escrow),50);require(asset.balanceOf(address(escrow))==153&&escrow.totalLiability()==103&&escrow.heldPrizes()==100);_invariant();}
    function testDoubleWithdrawalRejected()public{_create(config());_buy(alice,A,AC,1);alice.invoke(address(escrow),abi.encodeCall(escrow.unregister,(EVENT,uint64(1),uint64(1))));alice.invoke(address(escrow),abi.encodeCall(escrow.withdraw,()));_fail(alice,address(escrow),abi.encodeCall(escrow.withdraw,()));_invariant();}
    function testFreeZeroPrizeCancellationStillClearsEntry()public{PokerTournamentPolicy420.Config memory c=config();c.buyIn=0;_create(c);_buy(alice,A,AC,1);vm.warp(2200);escrow.refundCancelled(EVENT,1);require(escrow.eventOf(EVENT).reservedPlayers==0&&escrow.entryOf(EVENT,1).refunded&&escrow.totalLiability()==0);}
    function testFuzzFundedRefundConservation(uint16 sponsor,uint16 stake,uint8 repeats)public{PokerTournamentPolicy420.Config memory c=config();c.sponsoredPrize=sponsor%1000;c.buyIn=stake%5000;_create(c);uint256 n=uint256(repeats%20)+1;for(uint64 i=1;i<=n;i++){uint64 receipt=_buy(alice,A,AC,i);alice.invoke(address(escrow),abi.encodeCall(escrow.unregister,(EVENT,receipt,i)));if(c.buyIn!=0)alice.invoke(address(escrow),abi.encodeCall(escrow.withdraw,()));_invariant();}vm.warp(2200);escrow.tick(EVENT);if(c.sponsoredPrize!=0)escrow.withdraw();require(asset.balanceOf(address(alice))==10000&&asset.balanceOf(address(this))==10000&&escrow.totalLiability()==0);}
}
contract TournamentPurchaseMath420Test {
    PurchaseMathHarness420 private math;
    function setUp()public{math=new PurchaseMathHarness420();}
    function testExtraQuoteMatchesOriginalForEveryMode()public{PokerTournamentPurchaseAccounting420.Quote memory q=math.quote(101,1000);require(q.prize==101&&q.fee==3&&q.total==104&&q.chips==1000);}
    function testFreeExtraQuoteHasNoCharge()public{PokerTournamentPurchaseAccounting420.Quote memory q=math.quote(0,1000);require(q.prize==0&&q.fee==0&&q.total==0&&q.chips==1000);}
    function testFuzzQuoteExactSplit(uint128 stake,uint128 stack)public{if(stack==0)stack=1;PokerTournamentPurchaseAccounting420.Quote memory q=math.quote(stake,stack);require(q.fee==uint256(stake)*3/100&&q.total==q.prize+q.fee&&q.chips==stack);}
    function testZeroStackCannotBeIssued()public{(bool ok,)=address(math).call(abi.encodeCall(math.quote,(uint128(100),uint128(0))));require(!ok);}
    function testReentryRequiresEliminationZeroAndBoundary()public{PokerTournamentPolicy420.Config memory c;c.purchaseKind=PokerTournamentPolicy420.PurchaseKind.RE_ENTRY;c.extraCap=2;c.extraDuration=100;require(math.allowed(c,0,0,true,true,100,1,101,0));require(!math.allowed(c,0,1,true,true,100,1,101,0));require(!math.allowed(c,0,0,false,true,100,1,101,0));require(!math.allowed(c,0,0,true,false,100,1,101,0));}
    function testRebuyRequiresChoiceAndCapAndEarlierWindow()public{PokerTournamentPolicy420.Config memory c;c.purchaseKind=PokerTournamentPolicy420.PurchaseKind.REBUY;c.extraCap=2;c.extraDuration=100;c.extraLevel=3;require(math.allowed(c,1,0,false,true,100,1,101,160));require(!math.allowed(c,2,0,false,true,100,1,101,160));require(!math.allowed(c,1,0,true,true,100,1,101,160));require(!math.allowed(c,1,0,false,true,100,3,101,160));require(!math.allowed(c,1,0,false,true,100,1,160,160));require(!math.allowed(c,1,0,false,true,100,1,200,300));}
    function testFreezeoutRejectsEveryExtra()public{PokerTournamentPolicy420.Config memory c;c.extraCap=2;c.extraDuration=100;require(!math.allowed(c,0,0,true,true,100,1,101,160));}
}
contract TournamentAssetAttack420Test is EntryFixture420 {
    HostileEntryAsset420 private hostile;
    function _adversarial()private{
        hostile=new HostileEntryAsset420();policies=new PokerTournamentPolicyRegistry420(address(auth),address(ops),address(hostile));
        escrow=new PokerTournamentEntryEscrow420(address(policies),address(identity),ISSUER,TYPE,address(dev));
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

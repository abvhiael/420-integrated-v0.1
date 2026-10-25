// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "../../src/bet/tournament/PokerTournamentPolicyRegistry420.sol";
import "../../src/system/CapabilityRegistry420.sol";
import "../../src/exchange/Wrapped420.sol";
interface ITournamentVm420{function warp(uint256) external;}
contract TournamentPolicyActor420{
    function invoke(address target,bytes calldata data) external returns(bytes memory){(bool ok,bytes memory result)=target.call(data);if(!ok)assembly{revert(add(result,32),mload(result))}return result;}
}
contract TournamentPolicyMathHarness420{
    function validate(PokerTournamentPolicy420.Config calldata c,uint256 now_) external pure{PokerTournamentPolicy420.validate(c,now_);}
    function fee(uint256 b) external pure returns(uint256){return PokerTournamentPolicy420.fee(b);}
    function closeAt(uint64 s,uint32 d) external pure returns(uint64){return PokerTournamentPolicy420.closeAt(s,d);}
    function window(uint64 s,uint32 d,uint16 l,uint16 observed,uint256 t) external pure returns(bool){return PokerTournamentPolicy420.windowOpen(s,d,l,observed,t);}
}
contract PokerTournamentPolicy420Test{
    ITournamentVm420 private constant vm=ITournamentVm420(address(uint160(uint256(keccak256("hevm cheat code")))));
    CapabilityRegistry420 private cap;BetAuthorization420 private auth;BetOperatorRegistry420 private ops;Wrapped420 private asset;
    PokerTournamentPolicyRegistry420 private registry;TournamentPolicyActor420 private publisher;TournamentPolicyActor420 private outsider;TournamentPolicyMathHarness420 private math;
    bytes32 private constant OP=keccak256("operator");bytes32 private constant ID=keccak256("tournament-policy");uint256 private nonce;
    event PolicyIdentity(address registry,bytes32 codeHash,bytes32 policyDigest,bytes32 ruleset,address asset,address authorization,address operators);
    function _grant(address actor,bytes32 action,bytes32 scope_) private{cap.createGrant(bytes32(++nonce),actor,keccak256("420.BET.CORE"),action,scope_,0,0,0,uint64(block.timestamp),uint64(block.timestamp+3600));}
    function setUp() public{
        cap=new CapabilityRegistry420();cap.registerProtocolComponent(keccak256("420.BET.CORE"),address(this));auth=new BetAuthorization420(address(cap));ops=new BetOperatorRegistry420(address(auth));asset=new Wrapped420();
        publisher=new TournamentPolicyActor420();outsider=new TournamentPolicyActor420();registry=new PokerTournamentPolicyRegistry420(address(auth),address(ops),address(asset));math=new TournamentPolicyMathHarness420();
        _grant(address(this),keccak256("BET_OPERATOR_REGISTER"),auth.scopeForOperator(OP));_grant(address(this),keccak256("BET_OPERATOR_ACTIVATE"),auth.scopeForOperator(OP));
        ops.registerOperator(OP,address(publisher),keccak256("local operator manifest"));ops.activate(OP);
        _grant(address(publisher),registry.CREATE(),registry.scope(ID));_grant(address(publisher),registry.PUBLISH(),registry.scope(ID));_grant(address(this),registry.APPROVE(),registry.scope(ID));_grant(address(this),registry.RETIRE(),registry.scope(ID));
    }
    function _config() private view returns(PokerTournamentPolicy420.Config memory c){
        c.gameVersion=keccak256("tournament game version");c.operatorId=OP;c.payoutPolicy=keccak256("future pinned payout policy");c.recoveryPolicy=keccak256("future pinned recovery policy");c.blindSchedule=keccak256("frozen blinds");c.seatingPolicy=keccak256("future pinned seating policy");
        c.seatsPerTable=9;c.maxTables=1;c.minimum=2;c.startingTarget=9;c.maxPlayers=9;c.buyIn=10 ether;c.startingStack=10000;c.registrationOpens=uint64(block.timestamp+1000);c.startOrRegistrationDeadline=uint64(block.timestamp+86400);
        c.underfillGrace=1800;c.technicalGrace=600;c.purchaseReadiness=600;c.rebuyChoice=60;c.recoveryGrace=86400;c.lateDuration=3600;
    }
    function _register(PokerTournamentPolicy420.Config memory c) private{publisher.invoke(address(registry),abi.encodeCall(registry.register,(ID,c)));}
    function _publish() private{_register(_config());registry.approve(ID);publisher.invoke(address(registry),abi.encodeCall(registry.publish,(ID)));}
    function _invalid(PokerTournamentPolicy420.Config memory c) private{(bool ok,)=address(math).call(abi.encodeCall(math.validate,(c,block.timestamp)));require(!ok,"invalid policy accepted");}
    function testLegitimateImmutablePublicationWithCanonicalAuthority() public{_publish();PokerTournamentPolicyRegistry420.Record memory r=registry.get(ID);require(r.status==PokerTournamentPolicyRegistry420.Status.PUBLISHED&&r.publisher==address(publisher),"publication");require(r.digest==registry.digest(ID,_config())&&registry.usableForNewEvent(ID),"identity");emit PolicyIdentity(address(registry),address(registry).codehash,r.digest,registry.RULESET(),address(asset),address(auth),address(ops));}
    function testPublishedPolicyCannotBeOverwritten() public{_publish();(bool ok,)=address(publisher).call(abi.encodeCall(publisher.invoke,(address(registry),abi.encodeCall(registry.register,(ID,_config())))));require(!ok,"overwrite");}
    function testNoApprovalCannotPublish() public{_register(_config());(bool ok,)=address(publisher).call(abi.encodeCall(publisher.invoke,(address(registry),abi.encodeCall(registry.publish,(ID)))));require(!ok,"approval bypass");}
    function testScopedCapabilityDoesNotAuthorizeDifferentPolicyId() public{(bool ok,)=address(publisher).call(abi.encodeCall(publisher.invoke,(address(registry),abi.encodeCall(registry.register,(keccak256("other"),_config())))));require(!ok,"scope bypass");}
    function testScopedPublisherCannotImpersonateOperatorAccount() public{_grant(address(outsider),registry.CREATE(),registry.scope(ID));(bool ok,)=address(outsider).call(abi.encodeCall(outsider.invoke,(address(registry),abi.encodeCall(registry.register,(ID,_config())))));require(!ok,"operator bypass");}
    function testUnauthorizedApprovalRejected() public{_register(_config());(bool ok,)=address(outsider).call(abi.encodeCall(outsider.invoke,(address(registry),abi.encodeCall(registry.approve,(ID)))));require(!ok,"approval authority");}
    function testRetirementPreservesHistoricalConfiguration() public{_publish();bytes32 h=registry.get(ID).digest;registry.retire(ID);require(!registry.usableForNewEvent(ID)&&registry.get(ID).digest==h,"historical state");}
    function testRevokedOperatorStopsNewUseWithoutDeletingHistory() public{_publish();bytes32 h=registry.get(ID).digest;_grant(address(this),keccak256("BET_OPERATOR_REVOKE"),auth.scopeForOperator(OP));ops.revoke(OP);require(!registry.usableForNewEvent(ID)&&registry.get(ID).digest==h,"revocation");}
    function testExpiredPublicationCapabilityRejected() public{PokerTournamentPolicy420.Config memory c=_config();c.registrationOpens=uint64(block.timestamp+10000);_register(c);registry.approve(ID);vm.warp(block.timestamp+3601);(bool ok,)=address(publisher).call(abi.encodeCall(publisher.invoke,(address(registry),abi.encodeCall(registry.publish,(ID)))));require(!ok,"expiry");}
    function testIdentityBindsRegistryInstanceAndPolicyId() public{PokerTournamentPolicyRegistry420 other=new PokerTournamentPolicyRegistry420(address(auth),address(ops),address(asset));require(other.digest(ID,_config())!=registry.digest(ID,_config()),"registry replay");require(registry.digest(keccak256("other"),_config())!=registry.digest(ID,_config()),"id replay");}
    function testCashRulesetIsNotTournamentRuleset() public view{require(registry.RULESET()!=keccak256("420.BET.POKER.NLHE.CASH.V1"),"cash context");}
    function testRegistryDoesNotAcceptNativeFundsOrGrantGameplay() public{require(!registry.acceptsFunds(),"custody claim");(bool ok,)=address(registry).call(abi.encodeWithSignature("startTournament(bytes32)",ID));require(!ok,"gameplay surface");}
    function testQuotedBuyInFeeAndChipsAreFixed() public{_publish();(uint256 b,uint256 f,uint256 total,uint256 chips)=registry.quote(ID);require(b==10 ether&&f==0.3 ether&&total==10.3 ether&&chips==10000,"quote");}
    function testAllSixStartPurchaseCombinationsValidate() public{for(uint8 start;start<2;start++)for(uint8 kind;kind<3;kind++){PokerTournamentPolicy420.Config memory c=_config();c.startKind=PokerTournamentPolicy420.StartKind(start);c.purchaseKind=PokerTournamentPolicy420.PurchaseKind(kind);if(kind!=0){c.extraCap=3;c.extraDuration=1800;}math.validate(c,block.timestamp);}}
    function testFreeEventQuotesNoPurchaseFee() public{PokerTournamentPolicy420.Config memory c=_config();c.buyIn=0;c.sponsoredPrize=100 ether;_register(c);(uint256 b,uint256 f,uint256 total,)=registry.quote(ID);require(b==0&&f==0&&total==0,"free fee");}
    function testMultiTableCanStartBelowOverallCap() public{PokerTournamentPolicy420.Config memory c=_config();c.multiTable=true;c.maxTables=10;c.startingTarget=9;c.maxPlayers=90;math.validate(c,block.timestamp);}
    function testRejectsOnePlayerMinimum() public{PokerTournamentPolicy420.Config memory c=_config();c.minimum=1;_invalid(c);}
    function testRejectsStartingTargetBelowMinimum() public{PokerTournamentPolicy420.Config memory c=_config();c.startingTarget=1;_invalid(c);}
    function testRejectsCapBelowStartingTarget() public{PokerTournamentPolicy420.Config memory c=_config();c.maxPlayers=8;_invalid(c);}
    function testRejectsCapAboveSeatingCapacity() public{PokerTournamentPolicy420.Config memory c=_config();c.maxPlayers=10;_invalid(c);}
    function testRejectsUnsupportedTenSeatTable() public{PokerTournamentPolicy420.Config memory c=_config();c.seatsPerTable=10;_invalid(c);}
    function testSingleTableCannotDeclareSeveralTables() public{PokerTournamentPolicy420.Config memory c=_config();c.maxTables=2;_invalid(c);}
    function testMultiTableNeedsCapacityForSeveralTables() public{PokerTournamentPolicy420.Config memory c=_config();c.multiTable=true;_invalid(c);}
    function testFreezeoutCannotAdvertiseExtraPurchases() public{PokerTournamentPolicy420.Config memory c=_config();c.extraCap=1;c.extraDuration=1800;_invalid(c);}
    function testReentryRequiresFiniteCapAndWindow() public{PokerTournamentPolicy420.Config memory c=_config();c.purchaseKind=PokerTournamentPolicy420.PurchaseKind.RE_ENTRY;_invalid(c);c.extraCap=1;_invalid(c);c.extraDuration=1800;math.validate(c,block.timestamp);}
    function testMissingPayoutRecoveryAndBlindPoliciesRejected() public{PokerTournamentPolicy420.Config memory c=_config();c.payoutPolicy=0;_invalid(c);c=_config();c.recoveryPolicy=0;_invalid(c);c=_config();c.blindSchedule=0;_invalid(c);}
    function testZeroChoiceReadinessRecoveryGraceRejected() public{PokerTournamentPolicy420.Config memory c=_config();c.rebuyChoice=0;_invalid(c);c=_config();c.technicalGrace=0;_invalid(c);c=_config();c.recoveryGrace=0;_invalid(c);}
    function testLevelCutoffNeedsHardTimeLimit() public{PokerTournamentPolicy420.Config memory c=_config();c.lateDuration=0;c.lateLevel=4;_invalid(c);}
    function testRegistrationChronologyRejected() public{PokerTournamentPolicy420.Config memory c=_config();c.registrationOpens=uint64(block.timestamp);_invalid(c);c=_config();c.startOrRegistrationDeadline=c.registrationOpens;_invalid(c);}
    function testDeadlineOverflowCannotTruncate() public{PokerTournamentPolicy420.Config memory c=_config();c.startOrRegistrationDeadline=type(uint64).max;_invalid(c);(bool ok,)=address(math).call(abi.encodeCall(math.closeAt,(type(uint64).max,uint32(1))));require(!ok,"overflow");}
    function testWindowExcludesExactTimeAndLevelCutoffAndBeforeStart() public view{require(math.window(100,60,4,3,159),"open");require(!math.window(100,60,4,3,160),"time cutoff");require(!math.window(100,60,4,4,120),"level cutoff");require(!math.window(100,60,0,0,99),"prestart");require(!math.window(100,0,0,0,100),"disabled");}
    function testApprovedDefaultGracePolicy() public view{(uint32 underfill,uint32 technical,uint32 choice,uint32 recovery)=registry.defaultGracePolicy();require(underfill==1800&&technical==600&&choice==60&&recovery==86400,"approved defaults");}
    function testRevokedPublishCapabilityFailsBeforeOpeningDeadline() public{_register(_config());registry.approve(ID);cap.revokeGrant(bytes32(uint256(4)));(bool ok,)=address(publisher).call(abi.encodeCall(publisher.invoke,(address(registry),abi.encodeCall(registry.publish,(ID)))));require(!ok,"revoked publisher");}
    function testExpiredEventPreviewFailsWithoutDeletingHistoricalPolicy() public{_publish();PokerTournamentPolicyRegistry420.Record memory r=registry.get(ID);vm.warp(uint256(r.config.startOrRegistrationDeadline)+r.config.underfillGrace);require(!registry.usableForNewEvent(ID)&&registry.get(ID).digest==r.digest,"expired event policy");}
    function testFuzzFeeMatchesIndependentBoundedProduct(uint128 b) public view{require(math.fee(b)==uint256(b)*3/100,"fee arithmetic");}
    function testFuzzEarlierWindowAlwaysWins(uint64 start,uint32 duration,uint16 cutoff,uint16 level,uint64 now_) public view{bool expected=start!=0&&duration!=0&&uint256(start)+duration<=type(uint64).max&&now_>=start&&now_<uint256(start)+duration&&(cutoff==0||level<cutoff);require(math.window(start,duration,cutoff,level,now_)==expected,"window arithmetic");}
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {SeasonRegistry} from "../../../../src/highcountry/competition/SeasonRegistry.sol";
import {CompetitionTemplateRegistry} from "../../../../src/highcountry/competition/CompetitionTemplateRegistry.sol";
import {CompetitionEngine,ICompetitionEvidenceR0412,ICompetitionEntitlementR0412} from "../../../../src/highcountry/competition/CompetitionEngine.sol";
import {Global420Cup} from "../../../../src/highcountry/cup/Global420Cup.sol";
interface VmR0413 { function warp(uint256) external; }
contract CupEvidence is ICompetitionEvidenceR0412 {
    mapping(bytes32=>bytes32) public records;
    function certify(bytes32 id,address player,uint16 quality,uint64 time) external {
        records[id]=keccak256(abi.encode(player,quality,time));
    }
    function verifiedFlower(bytes32 id,address player,uint16 quality,uint64 time) external view returns(bool){
        return records[id]!=bytes32(0)&&records[id]==keccak256(abi.encode(player,quality,time));
    }
}
contract CupEligibility is ICompetitionEntitlementR0412 {
    function eligible(address,bytes32) external pure returns(bool){return false;}
}
contract CupPlayer {
    function enter(CompetitionEngine e,bytes32 eventId) external { e.enter(eventId); }
    function submit(CompetitionEngine e,bytes32 eventId,bytes32 harvest,uint16 quality,uint64 when_) external {
        e.submit(eventId,harvest,quality,when_);
    }
}
contract R0413GlobalCupTest {
    VmR0413 constant vm=VmR0413(address(uint160(uint256(keccak256("hevm cheat code")))));
    SeasonRegistry seasons; CompetitionTemplateRegistry templates;
    CompetitionEngine engine;Global420Cup cup;CupEvidence evidence;
    CupPlayer a;CupPlayer b;CupPlayer c;CupPlayer d;
    bytes32 constant S=keccak256("S");
    bytes32 constant T=keccak256("T");
    bytes32 constant A=keccak256("A");
    bytes32 constant B=keccak256("B");
    bytes32 constant F=keccak256("F");
    bytes32 constant CUP=keccak256("CUP");
    bytes32 constant SCOPE=keccak256("cross-game-prestige");
    uint64 openA;uint64 closeA;uint64 openF;uint64 closeF;
    function setUp() public {
        seasons=new SeasonRegistry();templates=new CompetitionTemplateRegistry();
        evidence=new CupEvidence();
        engine=new CompetitionEngine(address(seasons),address(templates),address(evidence),address(new CupEligibility()),address(this));
        cup=new Global420Cup(address(engine));
        a=new CupPlayer();b=new CupPlayer();c=new CupPlayer();d=new CupPlayer();
        openA=uint64(block.timestamp+100);closeA=openA+100;
        openF=closeA+200;closeF=openF+100;
        seasons.create(S,openA,closeF+1000,keccak256("season-rules"));
        templates.register(T,1,keccak256("equal-quality-rules"),bytes32(0));
        engine.create(A,S,T,openA,closeA,closeA+100);
        engine.create(B,S,T,openA,closeA,closeA+100);
        engine.create(F,S,T,openF,closeF,closeF+100);
        cup.create(CUP,A,B,F,keccak256("bracket-rules"),keccak256("no-funded-prizes"),SCOPE);
    }
    function score(CupPlayer player,bytes32 eventId,bytes32 h,uint16 quality,uint64 finalized) internal {
        evidence.certify(h,address(player),quality,finalized);
        player.submit(engine,eventId,h,quality,finalized);
    }
    function semis() internal {
        vm.warp(openA);
        a.enter(engine,A);b.enter(engine,A);c.enter(engine,B);d.enter(engine,B);
        score(a,A,keccak256("a-semi"),9000,openA);
        score(b,A,keccak256("b-semi"),8000,openA);
        score(c,B,keccak256("c-semi"),9500,openA);
        score(d,B,keccak256("d-semi"),7000,openA);
        vm.warp(closeA+100);
        engine.finalize(A);engine.finalize(B);
    }
    function testFinalizedBracketAndSingleScopedIssuance() public {
        semis();
        vm.warp(openF);
        a.enter(engine,F);c.enter(engine,F);
        score(a,F,keccak256("a-final"),9800,openF);
        score(c,F,keccak256("c-final"),9700,openF);
        vm.warp(closeF+100);
        engine.finalize(F);
        cup.finalize(CUP);
        require(cup.finalResultCommitment(CUP)!=bytes32(0),"missing provenance");
        require(!cup.isIssued(CUP,address(a),SCOPE),"issued early");
        cup.issueCrossGame(CUP);
        require(cup.isIssued(CUP,address(a),SCOPE),"scope not issued");
        require(!cup.isIssued(CUP,address(c),SCOPE),"wrong person");
        require(!cup.isIssued(CUP,address(a),keccak256("other")),"wrong scope");
        (bool replay,)=address(cup).call(abi.encodeCall(cup.issueCrossGame,(CUP)));
        require(!replay,"duplicate issuance");
        (bool again,)=address(cup).call(abi.encodeCall(cup.finalize,(CUP)));
        require(!again,"duplicate final");
    }
    function testEarlyFinalizationRejected() public {
        (bool early,)=address(cup).call(abi.encodeCall(cup.finalize,(CUP)));
        require(!early,"accepted prefinal result");
        (bool issuance,)=address(cup).call(abi.encodeCall(cup.issueCrossGame,(CUP)));
        require(!issuance,"unfinalized issuance");
    }
    function testNonqualifierFinalistCannotBeCertified() public {
        semis();
        vm.warp(openF);
        a.enter(engine,F);b.enter(engine,F);
        score(a,F,keccak256("a-final"),9800,openF);
        score(b,F,keccak256("b-final"),9900,openF);
        vm.warp(closeF+100);
        engine.finalize(F);
        (bool invalid,)=address(cup).call(abi.encodeCall(cup.finalize,(CUP)));
        require(!invalid,"nonqualifier champion accepted");
    }
    function testUnknownCupAndEventReuseRejected() public {
        (bool again,)=address(cup).call(abi.encodeCall(cup.create,(keccak256("second"),A,B,F,keccak256("rules"),keccak256("prizes"),SCOPE)));
        require(!again,"event replay across cups");
        (bool noPrizeRules,)=address(cup).call(abi.encodeCall(cup.create,(keccak256("empty"),A,B,F,keccak256("rules"),bytes32(0),SCOPE)));
        require(!noPrizeRules,"unpublished prize rules");
    }
}

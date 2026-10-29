// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {bindRetainedR04Emergency,retainedR04AuthorizationRoot} from "../../mocks/R04EmergencyFixture.sol";
import {SeasonRegistry} from "../../../../src/highcountry/competition/SeasonRegistry.sol";
import {CompetitionTemplateRegistry} from "../../../../src/highcountry/competition/CompetitionTemplateRegistry.sol";
import {CompetitionEngine,ICompetitionEvidenceR0412,ICompetitionEntitlementR0412} from "../../../../src/highcountry/competition/CompetitionEngine.sol";
import {Global420Cup} from "../../../../src/highcountry/cup/Global420Cup.sol";

contract CupAnvilEvidence is ICompetitionEvidenceR0412 {
    mapping(bytes32=>bytes32) public records;
    function certify(bytes32 id,address player,uint16 quality,uint64 time) external {
        records[id]=keccak256(abi.encode(player,quality,time));
    }
    function revoke(bytes32 id) external {delete records[id];}
    function verifiedFlower(bytes32 id,address player,uint16 quality,uint64 time) external view returns(bool){
        return records[id]!=bytes32(0)&&records[id]==keccak256(abi.encode(player,quality,time));
    }
}
contract CupAnvilEligibility is ICompetitionEntitlementR0412 {
    function eligible(address,bytes32) external pure returns(bool){return false;}
}
contract CupAnvilPlayer {
    function enter(CompetitionEngine engine,bytes32 eventId) external {engine.enter(eventId);}
    function submit(CompetitionEngine engine,bytes32 eventId,bytes32 id,uint16 q,uint64 time) external {
        engine.submit(eventId,id,q,time);
    }
}
/// @dev Dedicated local EVM acceptance only; never deploy to production/testnet.
contract CupHttpAnvilFixture {
    SeasonRegistry public seasons;
    CompetitionTemplateRegistry public templates;
    CompetitionEngine public engine;
    Global420Cup public cup;
    CupAnvilEvidence public evidence;
    CupAnvilPlayer public a;
    CupAnvilPlayer public b;
    CupAnvilPlayer public c;
    CupAnvilPlayer public d;
    bytes32 public constant S=keccak256("S");
    bytes32 public constant T=keccak256("T");
    bytes32 public constant A=keccak256("A");
    bytes32 public constant B=keccak256("B");
    bytes32 public constant F=keccak256("F");
    bytes32 public constant CUP=keccak256("CUP");
    bytes32 public constant SCOPE=keccak256("cross-game-prestige");
    uint64 public immutable openA;
    uint64 public immutable closeA;
    uint64 public immutable openF;
    uint64 public immutable closeF;
    constructor() {
        seasons=new SeasonRegistry();
        templates=new CompetitionTemplateRegistry();
        evidence=new CupAnvilEvidence();
        engine=new CompetitionEngine(
            retainedR04AuthorizationRoot(),address(seasons),address(templates),
            address(evidence),address(new CupAnvilEligibility()),address(this)
        );
        bindRetainedR04Emergency(address(engine));
        cup=new Global420Cup(retainedR04AuthorizationRoot(),address(engine));
        bindRetainedR04Emergency(address(cup));
        a=new CupAnvilPlayer();b=new CupAnvilPlayer();
        c=new CupAnvilPlayer();d=new CupAnvilPlayer();
        openA=uint64(block.timestamp+100);
        closeA=openA+100;
        openF=closeA+200;
        closeF=openF+100;
        seasons.create(S,openA,closeF+1000,keccak256("season-rules"));
        templates.register(T,1,keccak256("equal-quality-rules"),bytes32(0));
        engine.create(A,S,T,openA,closeA,closeA+100);
        engine.create(B,S,T,openA,closeA,closeA+100);
        engine.create(F,S,T,openF,closeF,closeF+100);
        cup.create(CUP,A,B,F,keccak256("bracket-rules"),keccak256("no-funded-prizes"),SCOPE);
    }
    function _score(CupAnvilPlayer player,bytes32 e,bytes32 id,uint16 q,uint64 at) private {
        evidence.certify(id,address(player),q,at);
        player.submit(engine,e,id,q,at);
    }
    function scoreSemis() external {
        require(block.timestamp>=openA&&block.timestamp<closeA,"wrong-window");
        a.enter(engine,A);b.enter(engine,A);c.enter(engine,B);d.enter(engine,B);
        _score(a,A,keccak256("a-semi"),9000,openA);
        _score(b,A,keccak256("b-semi"),8000,openA);
        _score(c,B,keccak256("c-semi"),9500,openA);
        _score(d,B,keccak256("d-semi"),7000,openA);
    }
    function finalizeSemis() external {
        require(block.timestamp>=closeA+100&&block.timestamp<openF,"wrong-window");
        engine.finalize(A);engine.finalize(B);
    }
    function scoreFinal() external {
        require(block.timestamp>=openF&&block.timestamp<closeF,"wrong-window");
        a.enter(engine,F);c.enter(engine,F);
        _score(a,F,keccak256("a-final"),9800,openF);
        _score(c,F,keccak256("c-final"),9700,openF);
    }
    function revokeFinalEvidence() external {evidence.revoke(keccak256('a-final'));}
    function finalizeCup() external {
        require(block.timestamp>=closeF+100,"wrong-window");
        engine.finalize(F);cup.finalize(CUP);cup.issueCrossGame(CUP);
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {SeasonRegistry} from "../../../../src/highcountry/competition/SeasonRegistry.sol";
import {CompetitionTemplateRegistry} from "../../../../src/highcountry/competition/CompetitionTemplateRegistry.sol";
import {CompetitionEngine,ICompetitionEvidenceR0412,ICompetitionEntitlementR0412} from "../../../../src/highcountry/competition/CompetitionEngine.sol";
interface VmR0412 {function warp(uint256) external;}
contract R0412Evidence is ICompetitionEvidenceR0412 {
    mapping(bytes32=>bytes32) public qualified;
    function approve(bytes32 id,address who,uint16 quality,uint64 when_) external {
        qualified[id]=keccak256(abi.encode(who,quality,when_));
    }
    function revoke(bytes32 id) external {delete qualified[id];}
    function verifiedFlower(bytes32 id,address who,uint16 q,uint64 at) external view returns(bool){
        return qualified[id]!=bytes32(0)&&qualified[id]==keccak256(abi.encode(who,q,at));
    }
}
contract R0412Entitlement is ICompetitionEntitlementR0412 {
    mapping(address=>mapping(bytes32=>bool)) public access;
    function permit(address player,bytes32 scope,bool yes) external {access[player][scope]=yes;}
    function eligible(address player,bytes32 scope) external view returns(bool){return access[player][scope];}
}
contract R0412Player {
    function enter(CompetitionEngine e,bytes32 id) external {e.enter(id);}
    function submit(CompetitionEngine e,bytes32 id,bytes32 harvest,uint16 score,uint64 at) external {
        e.submit(id,harvest,score,at);
    }
}
contract R0412CompetitionTest {
    VmR0412 constant vm=VmR0412(address(uint160(uint256(keccak256("hevm cheat code")))));
    bytes32 constant SEASON=keccak256("season");
    bytes32 constant BASE=keccak256("base");
    bytes32 constant OPTIONAL=keccak256("optional");
    bytes32 constant EVENT=keccak256("event");
    bytes32 constant SCOPE=keccak256("optional-pass");
    SeasonRegistry seasons; CompetitionTemplateRegistry templates; CompetitionEngine engine;
    R0412Evidence evidence;R0412Entitlement entitlement;R0412Player alice;R0412Player bob;
    uint64 opens;uint64 closes;uint64 challenge;
    function setUp() public {
        seasons=new SeasonRegistry();templates=new CompetitionTemplateRegistry();
        evidence=new R0412Evidence();entitlement=new R0412Entitlement();
        engine=new CompetitionEngine(address(seasons),address(templates),address(evidence),address(entitlement),address(this));
        alice=new R0412Player();bob=new R0412Player();
        opens=uint64(block.timestamp+100);closes=opens+100;challenge=closes+100;
        seasons.create(SEASON,opens,closes+1000,keccak256("season-rules"));
        templates.register(BASE,1,keccak256("base-rules"),bytes32(0));
        templates.register(OPTIONAL,1,keccak256("same-scoring"),SCOPE);
        engine.create(EVENT,SEASON,BASE,opens,closes,challenge);
    }
    function _start() internal {vm.warp(opens);}
    function _enterBoth() internal {_start();alice.enter(engine,EVENT);bob.enter(engine,EVENT);}
    function testWalletFreeBaseEventVerifiedScoreAndTie() public {
        _enterBoth();
        bytes32 a=keccak256("a");
        bytes32 b=keccak256("b");
        evidence.approve(a,address(alice),9000,opens);
        evidence.approve(b,address(bob),9000,opens+1);
        alice.submit(engine,EVENT,a,9000,opens);
        vm.warp(opens+2);
        bob.submit(engine,EVENT,b,9000,opens+1);
        vm.warp(challenge);
        engine.finalize(EVENT);
        require(engine.winners(EVENT)==address(alice),"earliest canonical evidence tie rule");
        require(engine.winnerScore(EVENT)==9000,"score altered");
        (bool duplicate,)=address(engine).call(abi.encodeCall(engine.finalize,(EVENT)));
        require(!duplicate,"double finalize");
    }
    function testUnverifiedAndDuplicateHarvestRejected() public {
        _enterBoth();bytes32 a=keccak256("shared");
        (bool fabricated,)=address(alice).call(abi.encodeCall(alice.submit,(engine,EVENT,a,10000,opens)));
        require(!fabricated,"fabricated score");
        evidence.approve(a,address(alice),7000,opens);
        alice.submit(engine,EVENT,a,7000,opens);
        (bool replay,)=address(alice).call(abi.encodeCall(alice.submit,(engine,EVENT,a,7000,opens)));
        require(!replay,"duplicate attempt");
        (bool stolen,)=address(bob).call(abi.encodeCall(bob.submit,(engine,EVENT,a,7000,opens)));
        require(!stolen,"foreign harvest replay");
    }
    function testOptionalEntitlementRevocationWithoutScoringBonus() public {
        engine.create(keccak256("opt"),SEASON,OPTIONAL,opens,closes,challenge);
        _start();
        (bool gate,)=address(alice).call(abi.encodeCall(alice.enter,(engine,keccak256("opt"))));
        require(!gate,"optional entry ungated");
        entitlement.permit(address(alice),SCOPE,true);
        alice.enter(engine,keccak256("opt"));
        entitlement.permit(address(alice),SCOPE,false);
        evidence.approve(keccak256("opt-harvest"),address(alice),8000,opens);
        (bool revoked,)=address(alice).call(abi.encodeCall(alice.submit,
           (engine,keccak256("opt"),keccak256("opt-harvest"),8000,opens)));
        require(!revoked,"revoked entitlement permitted harvest");
    }
    function testDisputeRejectAndEvidenceReorgFailClosed() public {
        _enterBoth();bytes32 a=keccak256("a");
        evidence.approve(a,address(alice),9000,opens);
        alice.submit(engine,EVENT,a,9000,opens);
        engine.reject(EVENT,address(alice));
        vm.warp(challenge);
        engine.finalize(EVENT);
        require(engine.winners(EVENT)==address(0),"rejected result won");
    }
    function testCanonicalEvidenceRevocationAtFinalization() public {
        _enterBoth();bytes32 a=keccak256("a");
        evidence.approve(a,address(alice),9000,opens);
        alice.submit(engine,EVENT,a,9000,opens);
        evidence.revoke(a);
        vm.warp(challenge);
        engine.finalize(EVENT);
        require(engine.winners(EVENT)==address(0),"revoked finality result won");
    }
    function testSeasonCancellationBlocksEvent() public {
        seasons.cancel(SEASON);
        vm.warp(opens);
        (bool accepted,) = address(alice).call(abi.encodeCall(alice.enter,(engine,EVENT)));
        require(!accepted,"cancelled season accepted entrant");
    }
    function testOptionalEntitlementRevokedAfterSubmissionDoesNotWin() public {
        bytes32 ev=keccak256("revoked-event");
        engine.create(ev,SEASON,OPTIONAL,opens,closes,challenge);
        entitlement.permit(address(alice),SCOPE,true);
        vm.warp(opens);
        alice.enter(engine,ev);
        bytes32 harvest=keccak256("valid");
        evidence.approve(harvest,address(alice),9800,opens);
        alice.submit(engine,ev,harvest,9800,opens);
        entitlement.permit(address(alice),SCOPE,false);
        vm.warp(challenge);
        engine.finalize(ev);
        require(engine.winners(ev)==address(0),"revoked optional entry won");
    }
    function testLifecycleBoundaries() public {
        (bool early,)=address(alice).call(abi.encodeCall(alice.enter,(engine,EVENT)));
        require(!early,"early entry");
        _enterBoth();
        vm.warp(closes);
        (bool late,)=address(bob).call(abi.encodeCall(bob.submit,(engine,EVENT,keccak256("x"),1,opens)));
        require(!late,"late evidence");
        (bool premature,)=address(engine).call(abi.encodeCall(engine.finalize,(EVENT)));
        require(!premature,"premature finalization");
    }
}

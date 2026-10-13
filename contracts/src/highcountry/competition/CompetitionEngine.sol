// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import {SeasonRegistry} from "./SeasonRegistry.sol";
import {CompetitionTemplateRegistry} from "./CompetitionTemplateRegistry.sol";

interface ICompetitionEvidenceR0412 {
    /// @notice Canonically verified, finalized FLOWER harvest (not a local preview).
    function verifiedFlower(bytes32 harvestId,address player,uint16 qualityBps,uint64 finalizedAt) external view returns(bool);
}
interface ICompetitionEntitlementR0412 {
    function eligible(address player,bytes32 scope) external view returns(bool);
}

/// @notice One confirmed FLOWER harvest per participant, score=qualityBps; no token bonuses.
contract CompetitionEngine {
    error Invalid();
    error Unauthorized();
    struct EventData {
        bytes32 season; bytes32 templateId;address organizer;uint64 opens;uint64 closes;
        uint64 challengeDeadline;uint32 entries;bool finalized;bool cancelled;
    }
    struct Result {bytes32 harvestId;uint16 qualityBps;uint64 finalizedAt;bool rejected;bool exists;}
    SeasonRegistry public immutable seasons;
    CompetitionTemplateRegistry public immutable templates;
    ICompetitionEvidenceR0412 public immutable evidence;
    ICompetitionEntitlementR0412 public immutable entitlements;
    address public immutable adjudicator;
    mapping(bytes32=>EventData) public events;
    mapping(bytes32=>mapping(address=>bool)) public entered;
    mapping(bytes32=>mapping(address=>Result)) public results;
    mapping(bytes32=>mapping(bytes32=>bool)) public harvested;
    mapping(bytes32=>address[]) private entrants;
    mapping(bytes32=>address) public winners;
    mapping(bytes32=>uint16) public winnerScore;
    event EventCreated(bytes32 indexed id,bytes32 season,bytes32 templateId);
    event Entered(bytes32 indexed id,address indexed player);
    event ResultSubmitted(bytes32 indexed id,address indexed player,bytes32 indexed harvestId,uint16 qualityBps);
    event ResultRejected(bytes32 indexed id,address indexed player,bytes32 indexed harvestId);
    event Finalized(bytes32 indexed id,address winner,uint16 qualityBps);
    constructor(address season_,address template_,address evidence_,address entitlement_,address adjudicator_){
        if(season_.code.length==0||template_.code.length==0||evidence_.code.length==0
          ||adjudicator_==address(0)) revert Invalid();
        seasons=SeasonRegistry(season_);
        templates=CompetitionTemplateRegistry(template_);
        evidence=ICompetitionEvidenceR0412(evidence_);
        entitlements=ICompetitionEntitlementR0412(entitlement_);
        adjudicator=adjudicator_;
    }
    function create(bytes32 id,bytes32 season,bytes32 templateId,uint64 opens,uint64 closes,uint64 challengeDeadline) external {
        (uint64 starts,uint64 ends,address authority,,bool cancelled)=seasons.seasons(season);
        (,,uint32 version,bool exists)=templates.templates(templateId);
        if(id==bytes32(0)||events[id].organizer!=address(0)||authority!=msg.sender||cancelled
          ||!exists||version!=1||opens<starts||closes>ends||closes<=opens
          ||challengeDeadline<=closes||challengeDeadline>closes+7 days) revert Invalid();
        events[id]=EventData(season,templateId,msg.sender,opens,closes,challengeDeadline,0,false,false);
        emit EventCreated(id,season,templateId);
    }
    function enter(bytes32 id) external {
        EventData storage e=events[id];
        if(e.organizer==address(0)||e.cancelled||e.finalized||block.timestamp<e.opens||block.timestamp>=e.closes
          ||entered[id][msg.sender]||entrants[id].length>=128) revert Unauthorized();
        (,,bytes32 scope)=_template(e.templateId);
        if(scope!=bytes32(0) && (address(entitlements).code.length==0||!entitlements.eligible(msg.sender,scope))) revert Unauthorized();
        entered[id][msg.sender]=true;entrants[id].push(msg.sender);e.entries++;
        emit Entered(id,msg.sender);
    }
    function _template(bytes32 id) private view returns(bytes32,uint32,bytes32){
        (bytes32 rules,bytes32 scope,uint32 v,)=templates.templates(id);
        return(rules,v,scope);
    }
    /// @notice Attestation is queried from an independently wired canonical finality verifier.
    function submit(bytes32 id,bytes32 harvestId,uint16 qualityBps,uint64 finalizedAt) external {
        EventData memory e=events[id];
        if(!entered[id][msg.sender]||e.cancelled||block.timestamp>=e.closes||block.timestamp<e.opens
          ||harvestId==bytes32(0)||qualityBps>10000||finalizedAt>block.timestamp
          ||results[id][msg.sender].exists||harvested[id][harvestId]) revert Unauthorized();
        (,,bytes32 scope)=_template(e.templateId);
        if(scope!=bytes32(0)&&!entitlements.eligible(msg.sender,scope)) revert Unauthorized();
        if(!evidence.verifiedFlower(harvestId,msg.sender,qualityBps,finalizedAt)) revert Unauthorized();
        harvested[id][harvestId]=true;
        results[id][msg.sender]=Result(harvestId,qualityBps,finalizedAt,false,true);
        emit ResultSubmitted(id,msg.sender,harvestId,qualityBps);
    }
    /// @notice Independent dispute adjudicator can reject forged/reorged evidence before closure.
    function reject(bytes32 id,address player) external {
        EventData memory e=events[id];Result storage r=results[id][player];
        if(msg.sender!=adjudicator||e.finalized||e.cancelled||block.timestamp>=e.challengeDeadline
           ||!r.exists||r.rejected) revert Unauthorized();
        r.rejected=true;emit ResultRejected(id,player,r.harvestId);
    }
    function finalize(bytes32 id) external {
        EventData storage e=events[id];
        if(e.organizer==address(0)||e.cancelled||e.finalized||block.timestamp<e.challengeDeadline) revert Unauthorized();
        address best;uint16 score;uint64 earliest=type(uint64).max;bytes32 bestHarvest=bytes32(type(uint256).max);
        for(uint256 i;i<entrants[id].length;i++){
            address player=entrants[id][i];Result memory r=results[id][player];
            if(!r.exists||r.rejected)continue;
            // Revalidation fails closed if canonicality has since been revoked.
            if(!evidence.verifiedFlower(r.harvestId,player,r.qualityBps,r.finalizedAt))continue;
            if(best==address(0)||r.qualityBps>score
              ||(r.qualityBps==score&&(r.finalizedAt<earliest
              ||(r.finalizedAt==earliest&&uint256(r.harvestId)<uint256(bestHarvest))))){
                best=player;score=r.qualityBps;earliest=r.finalizedAt;bestHarvest=r.harvestId;
            }
        }
        e.finalized=true;winners[id]=best;winnerScore[id]=score;emit Finalized(id,best,score);
    }
    function entrantAt(bytes32 id,uint256 index) external view returns(address){return entrants[id][index];}
}

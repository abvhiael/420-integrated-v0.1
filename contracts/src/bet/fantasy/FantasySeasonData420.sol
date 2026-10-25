// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./FantasyNHLScoring420.sol";
import "../BetAuthorization420.sol";
import "../../interfaces/IOracle420.sol";
interface IFantasySeasonCorrection420{function mayCorrect(bytes32 id,uint16 week) external view returns(bool);}

/// @notice Frozen season calendar and authenticated complete per-game facts.
contract FantasySeasonData420 {
    bytes32 public constant DOMAIN=keccak256("420.FANTASY.SEASON.DATA.V1");
    bytes32 public constant PUBLISH=keccak256("BET_FANTASY_PUBLISH_SEASON.V1");
    BetAuthorization420 public immutable authorization;
    IOracle420 public immutable oracle;
    FantasyNHLScoring420 public immutable nhl;
    address public host;
    struct Config{uint8 teams;uint8 mode;uint16 periodCount;uint64 fundingEnd;uint64 draftStart;uint64 tradeDeadline;bytes32 randomnessProfile;bytes32 rankingHash;bytes32 profileEvidence;address validator;bytes32 custodianKeyHash;bytes32 custodianUserKey;}
    struct Athlete{uint32 id;uint8 positions;}
    struct Game{bytes32 id;uint64 originalStart;}
    struct Period{uint64 lockAt;uint64 activeEnd;uint64 cutoff;uint64 claimCutoff;uint64 processAt;uint8 minimumStarts;bytes32 feed;bytes32 candidateFeed;bytes32 calendarEvidence;}
    struct Disposition{bytes32 game;uint64 actualStart;uint64 finalAt;bool final_;bool excluded;}
    struct Report{bytes32 root;bytes32 evidence;uint64 revision;uint64 asOf;}
    struct Fact{uint32 athlete;bool complete;bytes32[] games;FantasyTypes420.Stats[] stats;uint32[] seconds_;bool[] started;uint16[] powerplay;}
    struct Totals{int256 points;uint256[13] metrics;}
    mapping(bytes32=>Config) private configs;
    mapping(bytes32=>bytes32) public manifest;
    mapping(bytes32=>bool) public isSealed;
    mapping(bytes32=>bool) public calendarStarted;
    mapping(bytes32=>mapping(uint32=>uint16)) public athleteOrdinal;
    mapping(bytes32=>bool) public seasonCanceled;
    mapping(bytes32=>mapping(bytes32=>bool)) public related;
    mapping(bytes32=>Athlete[]) private athletes;
    mapping(bytes32=>mapping(uint32=>uint8)) public positions;
    mapping(bytes32=>mapping(uint16=>Period)) private periods;
    mapping(bytes32=>mapping(uint16=>Game[])) private games;
    mapping(bytes32=>mapping(bytes32=>uint16)) public gameWeek;
    mapping(bytes32=>mapping(uint16=>Report)) private reports;
    mapping(bytes32=>mapping(uint16=>bytes32)) public acceptedHeader;
    mapping(bytes32=>mapping(uint16=>mapping(bytes32=>bool))) public eligible;
    mapping(bytes32=>mapping(uint16=>bool)) public voided;
    mapping(bytes32=>mapping(uint16=>uint64)) public earlyStart;
    error Invalid();
    constructor(address auth,address oracle_,address scoring){
        if(auth.code.length==0||oracle_.code.length==0||scoring.codehash!=keccak256(type(FantasyNHLScoring420).runtimeCode))revert Invalid();
        authorization=BetAuthorization420(auth);oracle=IOracle420(oracle_);nhl=FantasyNHLScoring420(scoring);
    }
    function configOf(bytes32 id) external view returns(Config memory){return configs[id];}
    function recordConflict(bytes32 id,bytes32 userKey) external{
        if(manifest[id]==0||userKey==0||!authorization.isAuthorized(msg.sender,keccak256("BET_FANTASY_RECORD_SEASON_CONFLICT.V1"),authorization.scopeForContest(id),0))revert Invalid();related[id][userKey]=true;
    }
    function bindHost(address host_) external{
        if(host!=address(0)||host_.code.length==0||!authorization.isAuthorized(msg.sender,keccak256("BET_FANTASY_BIND_SEASON_HOST.V1"),authorization.scopeGlobal(),0))revert Invalid();host=host_;
    }
    function periodOf(bytes32 id,uint16 week) external view returns(Period memory){return periods[id][week];}
    function reportOf(bytes32 id,uint16 week) external view returns(Report memory){return reports[id][week];}
    function reportIsCurrent(bytes32 id,uint16 week) external view returns(bool){
        if(reports[id][week].revision==0)return false;
        try oracle.readResult(periods[id][week].feed) returns(IOracle420.ResultRead memory r){return r.resultHash==acceptedHeader[id][week]&&r.agreeingSources!=0&&r.updatedAt>=reports[id][week].asOf&&r.updatedAt<=block.timestamp;}catch{return false;}
    }
    function athleteAt(bytes32 id,uint256 index) external view returns(Athlete memory){return athletes[id][index];}
    function athleteCount(bytes32 id) external view returns(uint256){return athletes[id].length;}
    function cancellationDigest(bytes32 id,bytes32 evidence) public view returns(bytes32){return keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,manifest[id],keccak256("NHL_SEASON_OFFICIALLY_CANCELED"),evidence));}
    function cancelSeason(bytes32 id,bytes32 evidence) external{
        if(!isSealed[id]||evidence==0||seasonCanceled[id])revert Invalid();_read(periods[id][1].feed,cancellationDigest(id,evidence),0);seasonCanceled[id]=true;
    }
    function _cap(bytes32 id) private view{if(!authorization.isAuthorized(msg.sender,PUBLISH,authorization.scopeForContest(id),0))revert Invalid();}
    function publish(bytes32 id,Config calldata c,Athlete[] calldata roster) external{
        _cap(id);
        if(manifest[id]!=0||id==0||c.teams<4||c.teams>12||c.mode>3||(c.mode==1||c.mode==2)&&c.teams%2!=0||c.periodCount==0||c.periodCount>40||c.fundingEnd<=block.timestamp||c.draftStart<=c.fundingEnd||c.randomnessProfile==0||c.rankingHash==0||c.profileEvidence==0||c.validator==address(0)||c.custodianKeyHash==0||c.custodianUserKey==0||roster.length<uint256(c.teams)*12||roster.length>200)revert Invalid();
        configs[id]=c;
        _addAthletes(id,roster);
        manifest[id]=keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,c,roster));
    }
    function _addAthletes(bytes32 id,Athlete[] calldata roster) private{
        if(roster.length==0||roster.length>200||athletes[id].length+roster.length>1500)revert Invalid();
        for(uint256 i;i<roster.length;i++){
            Athlete calldata a=roster[i];if(a.id==0||a.positions==0||a.positions>31||(a.positions&16!=0&&a.positions!=16)||positions[id][a.id]!=0)revert Invalid();
            positions[id][a.id]=a.positions;athletes[id].push(a);athleteOrdinal[id][a.id]=uint16(athletes[id].length);
        }
    }
    /// Bounded pre-calendar publication supports a full NHL inventory at normal gas.
    function appendAthletes(bytes32 id,Athlete[] calldata roster) external{
        _cap(id);if(manifest[id]==0||calendarStarted[id]||isSealed[id]||block.timestamp>=configs[id].fundingEnd)revert Invalid();
        _addAthletes(id,roster);manifest[id]=keccak256(abi.encode(DOMAIN,manifest[id],roster));
    }
    function periodDigest(bytes32 id,uint16 week,Period calldata p,Game[] calldata schedule) public view returns(bytes32){return keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,manifest[id],week,p,schedule));}
    function _read(bytes32 feed,bytes32 expected,uint64 earliest) private view{
        IOracle420.ResultRead memory r=oracle.readResult(feed);if(r.resultHash!=expected||r.agreeingSources==0||r.updatedAt<earliest||r.updatedAt>block.timestamp)revert Invalid();
    }
    function publishPeriod(bytes32 id,uint16 week,Period calldata p,Game[] calldata schedule) external{
        _cap(id);Config memory c=configs[id];
        if(manifest[id]==0||isSealed[id]||block.timestamp>=c.fundingEnd||week==0||week>c.periodCount||periods[id][week].lockAt!=0||p.lockAt<=c.draftStart||p.activeEnd<=p.lockAt||p.cutoff<=p.activeEnd||p.cutoff-p.activeEnd<22 hours||p.cutoff-p.activeEnd>26 hours||p.claimCutoff>p.processAt||p.processAt>=p.lockAt||p.feed==0||p.candidateFeed==0||p.candidateFeed==p.feed||p.calendarEvidence==0||(p.minimumStarts!=1&&p.minimumStarts!=2)||(p.minimumStarts==1&&week!=1&&week!=c.periodCount)||schedule.length>128)revert Invalid();
        uint64 first=type(uint64).max;
        for(uint256 i;i<schedule.length;i++){
            Game calldata g=schedule[i];if(g.id==0||g.originalStart<p.lockAt||g.originalStart>=p.activeEnd||gameWeek[id][g.id]!=0)revert Invalid();
            gameWeek[id][g.id]=week;games[id][week].push(g);if(g.originalStart<first)first=g.originalStart;
        }
        if(schedule.length!=0&&first!=p.lockAt)revert Invalid();
        _read(p.feed,periodDigest(id,week,p,schedule),0);periods[id][week]=p;calendarStarted[id]=true;
    }
    function seal(bytes32 id) external{
        Config memory c=configs[id];if(isSealed[id]||manifest[id]==0||block.timestamp>=c.fundingEnd)revert Invalid();
        bytes32 h=manifest[id];
        for(uint16 i=1;i<=c.periodCount;i++){
            Period memory p=periods[id][i];if(p.lockAt==0||(i>1&&(periods[id][i-1].activeEnd>p.lockAt||periods[id][i-1].activeEnd>p.processAt)))revert Invalid();h=keccak256(abi.encode(h,p,games[id][i]));
        }
        manifest[id]=h;isSealed[id]=true;
    }
    function reportDigest(bytes32 id,uint16 week,Report calldata r,Disposition[] calldata dispositions) public view returns(bytes32){return keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,manifest[id],week,r,dispositions));}
    function update(bytes32 id,uint16 week,Report calldata r,Disposition[] calldata dispositions) external{
        Period memory p=periods[id][week];Report memory old=reports[id][week];
        if(!isSealed[id]||p.lockAt==0||block.timestamp<p.cutoff||r.revision<=old.revision||r.root==0||r.evidence==0||r.asOf<p.cutoff||r.asOf>p.cutoff+1 days||r.asOf>block.timestamp||dispositions.length!=games[id][week].length)revert Invalid();
        if(block.timestamp>=p.cutoff+1 days&&(host==address(0)||!IFantasySeasonCorrection420(host).mayCorrect(id,week)))revert Invalid();
        bytes32 header=reportDigest(id,week,r,dispositions);_read(p.feed,header,r.asOf);
        uint256 count;uint64 firstEarly;
        for(uint256 i;i<dispositions.length;i++){
            Disposition calldata d=dispositions[i];Game memory g=games[id][week][i];
            if(d.game!=g.id||(!d.final_&&!d.excluded)||(d.final_&&d.excluded)||(d.final_&&(d.actualStart==0||d.finalAt<=d.actualStart)))revert Invalid();
            bool counts=d.final_&&d.finalAt<=p.cutoff;eligible[id][week][g.id]=counts;if(counts)count++;
            if(d.actualStart!=0&&d.actualStart<g.originalStart&&(firstEarly==0||d.actualStart<firstEarly))firstEarly=d.actualStart;
        }
        reports[id][week]=r;acceptedHeader[id][week]=header;voided[id][week]=count==0;earlyStart[id][week]=firstEarly;
    }
    function factLeaf(bytes32 id,uint16 week,uint64 revision,Fact calldata f) public view returns(bytes32){return keccak256(bytes.concat(keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,manifest[id],week,revision,f))));}
    function calculate(bytes32 id,uint16 week,uint32[7] calldata lineup,bytes calldata witnesses) external view returns(Totals memory total){
        Report memory r=reports[id][week];if(r.revision==0||voided[id][week]||witnesses.length>524288)revert Invalid();
        (Fact[7] memory facts,bytes32[][7] memory proofs)=abi.decode(witnesses,(Fact[7],bytes32[][7]));
        for(uint256 a;a<7;a++){
            Fact memory f=facts[a];bool goalie=positions[id][lineup[a]]==16;
            if(!f.complete||f.athlete!=lineup[a]||f.games.length>32||f.games.length!=f.stats.length||f.games.length!=f.seconds_.length||f.games.length!=f.started.length||f.games.length!=f.powerplay.length)revert Invalid();
            bytes32 leaf=keccak256(bytes.concat(keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,manifest[id],week,r.revision,f))));nhl.verify(r.root,leaf,proofs[a]);
            for(uint256 g;g<f.games.length;g++){
                if(gameWeek[id][f.games[g]]!=week)revert Invalid();for(uint256 j;j<g;j++)if(f.games[j]==f.games[g])revert Invalid();
                if(!eligible[id][week][f.games[g]])continue;
                FantasyTypes420.Stats memory s=f.stats[g];
                if(s.played!=(f.seconds_[g]>0)||f.seconds_[g]>8 hours||f.powerplay[g]>uint256(s.goals)+s.assists||(f.started[g]&&(!goalie||!s.played)))revert Invalid();
                total.points+=nhl.score(s,goalie);
                if(goalie){
                    total.metrics[6]+=s.win?1:0;total.metrics[7]+=s.shutout?1:0;total.metrics[8]+=s.saves;total.metrics[9]+=uint256(s.saves)+s.goalsAgainst;
                    total.metrics[10]+=s.goalsAgainst;total.metrics[11]+=f.seconds_[g];total.metrics[12]+=f.started[g]?1:0;
                }else{
                    total.metrics[0]+=s.goals;total.metrics[1]+=s.assists;total.metrics[2]+=s.shots;total.metrics[3]+=s.blocks;total.metrics[4]+=f.powerplay[g];total.metrics[5]+=s.shorthanded;
                }
            }
        }
    }
}

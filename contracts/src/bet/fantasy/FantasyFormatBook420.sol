// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./FantasySlateBook420.sol";
import "./FantasyNHLScoring420.sol";
import "./FantasyDisputeController420.sol";

/// @notice Immutable approved-format snapshots; real canonical oracle stat witnesses.
/// @dev No payout vector or externally supplied score is accepted.
contract FantasyFormatBook420 {
    bytes32 public constant DOMAIN = keccak256("420.FANTASY.APPROVED.FORMATS.V1");
    bytes32 public constant PUBLISH = keccak256("BET_FANTASY_PUBLISH_FORMAT.V1");
    FantasySlateBook420 public immutable slates;
    FantasyNHLScoring420 public immutable nhl;
    FantasyDisputeController420 public disputes;
    enum Kind { NONE, SALARY, CAPTAIN, PEER, HOUSE, SEASON }
    struct Config {
        Kind kind;
        bytes32 slate;
        bytes32 feed;
        bytes32 salaryEvidence;
        bytes32 officialSchedule;
        uint16 officialGames;
        uint8 cardSize;
    }
    struct Price { uint32 athlete; bytes32 team; uint32 salary; }
    struct Market { uint32 athlete; uint32 lineTenths; uint8 metric; }
    struct Fact { FantasyTypes420.Stats stats; uint32 iceSeconds; bool started; }
    struct Witness { Fact[] facts; bytes32[][] proofs; }
    struct Report { bytes32 root; bytes32 evidence; uint64 revision; uint64 asOf; }
    mapping(bytes32=>Config) private configs;
    mapping(bytes32=>bytes32) public manifest;
    mapping(bytes32=>mapping(uint32=>Price)) public prices;
    mapping(bytes32=>Market[]) private markets;
    mapping(bytes32=>Report) private reports;
    mapping(bytes32=>mapping(bytes32=>bool)) public related;
    error Invalid();
    constructor(address slates_,address nhl_) {
        slates=FantasySlateBook420(slates_);nhl=FantasyNHLScoring420(nhl_);
        if(slates_.code.length==0 || nhl_.codehash!=keccak256(type(FantasyNHLScoring420).runtimeCode)) revert Invalid();
    }
    function configOf(bytes32 id) external view returns(Config memory){return configs[id];}
    function recordConflict(bytes32 id,bytes32 userKey) external{
        BetAuthorization420 auth=slates.authorization();if(manifest[id]==0||userKey==0||!auth.isAuthorized(msg.sender,keccak256("BET_FANTASY_RECORD_FORMAT_CONFLICT.V1"),auth.scopeForContest(id),0))revert Invalid();related[id][userKey]=true;
    }
    function bindDisputes(address disputes_) external{
        BetAuthorization420 auth=slates.authorization();FantasyDisputeController420 d=FantasyDisputeController420(disputes_);
        if(address(disputes)!=address(0)||disputes_.code.length==0||address(d.authorization())!=address(auth)||address(d.oracle())!=address(slates.oracle())||!auth.isAuthorized(msg.sender,keccak256("BET_FANTASY_BIND_FORMAT_DISPUTES.V1"),auth.scopeGlobal(),0))revert Invalid();disputes=d;
    }
    function reportOf(bytes32 id) external view returns(Report memory){return reports[id];}
    function reportIsCurrent(bytes32 id) external view returns(bool){
        Report memory r=reports[id];if(r.revision==0)return false;
        try slates.oracle().readResult(configs[id].feed) returns(IOracle420.ResultRead memory result){
            return result.resultHash==keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,manifest[id],r))&&result.updatedAt>=r.asOf&&result.updatedAt<=block.timestamp&&result.agreeingSources!=0;
        }catch{return false;}
    }
    function marketOf(bytes32 id,uint32 index) external view returns(Market memory){return markets[id][index];}
    function snapshotDigest(bytes32 id,Config calldata c,Price[] calldata table,Market[] calldata board) public view returns(bytes32){
        return keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,c,table,board,slates.slateOf(c.slate).manifest));
    }
    function _read(bytes32 feed,bytes32 expected,uint64 earliest) private view {
        IOracle420.ResultRead memory r=slates.oracle().readResult(feed);
        if(r.resultHash!=expected || r.updatedAt<earliest || r.updatedAt>block.timestamp || r.agreeingSources==0)revert Invalid();
    }
    function publish(bytes32 id,Config calldata c,Price[] calldata table,Market[] calldata board,bytes calldata feasible) external {
        BetAuthorization420 auth=slates.authorization();
        FantasySlateBook420.Slate memory s=slates.slateOf(c.slate);
        if(!auth.isAuthorized(msg.sender,PUBLISH,auth.scopeForContest(id),0) || manifest[id]!=0 || id==0 || s.manifest==0 || block.timestamp>=s.lockAt || c.feed==0)revert Invalid();
        if(c.kind==Kind.SALARY || c.kind==Kind.CAPTAIN){
            if(c.salaryEvidence==0 || table.length==0 || table.length>1000 || board.length!=0 || (c.kind==Kind.CAPTAIN && s.gameCount!=1))revert Invalid();
            for(uint256 i;i<table.length;i++){
                Price calldata p=table[i];FantasyTypes420.Athlete memory a=slates.athleteOf(c.slate,p.athlete);
                bool goalie=a.positions==16;
                uint32 low=c.kind==Kind.CAPTAIN?2000:goalie?6500:2500;
                uint32 high=c.kind==Kind.CAPTAIN?12000:goalie?8500:9000;
                if(a.id==0 || p.team==0 || p.salary<low || p.salary>high || p.salary%100!=0 || prices[id][p.athlete].athlete!=0)revert Invalid();
                prices[id][p.athlete]=p;
            }
        }else if(c.kind==Kind.PEER || c.kind==Kind.HOUSE){
            if(c.cardSize<2 || c.cardSize>3 || c.officialGames<s.gameCount || c.officialGames==0 || c.officialSchedule==0 || board.length<c.cardSize || board.length>5000 || table.length!=0)revert Invalid();
            for(uint256 i;i<board.length;i++){
                Market calldata m=board[i];FantasyTypes420.Athlete memory a=slates.athleteOf(c.slate,m.athlete);
                if(a.id==0 || m.metric>4 || (m.metric==4)!=(a.positions==16))revert Invalid();
                for(uint256 j;j<i;j++)if(board[j].athlete==m.athlete && board[j].metric==m.metric)revert Invalid();
                markets[id].push(m);
            }
        }else revert Invalid();
        bytes32 h=snapshotDigest(id,c,table,board);
        // Includes the independent salary evidence and NHL-wide schedule snapshot.
        _read(c.feed,h,0);configs[id]=c;manifest[id]=h;
        if(!validate(id,feasible))revert Invalid();
    }
    function statDigest(bytes32 id,Report calldata r) public view returns(bytes32){return keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,manifest[id],r));}
    function updateStats(bytes32 id,Report calldata r) external {
        FantasySlateBook420.Slate memory s=slates.slateOf(configs[id].slate);
        if(block.timestamp>=s.resolvedAt+1 days)revert Invalid();_setStats(id,r);
    }
    function correctStats(bytes32 id,bytes32 disputedPool,Report calldata r) external{
        if(address(disputes)==address(0)||disputes.configOf(disputedPool).scoringProfile!=manifest[id])revert Invalid();
        FantasyDisputeController420.Pool memory p=disputes.poolOf(disputedPool);
        if(p.state!=FantasyDisputeController420.PoolState.REVIEW||!p.invalidated||p.pending!=0||block.timestamp<p.challengeEnd||block.timestamp+1 days>p.deadline)revert Invalid();
        _setStats(id,r);
    }
    function _setStats(bytes32 id,Report calldata r) private{
        FantasySlateBook420.Slate memory s=slates.slateOf(configs[id].slate);
        if(manifest[id]==0||s.resolvedAt==0||r.revision<=reports[id].revision||r.root==0||r.evidence==0||r.asOf<s.resolvedAt||r.asOf>block.timestamp||r.asOf>s.resolvedAt+1 days)revert Invalid();
        _read(configs[id].feed,statDigest(id,r),r.asOf);reports[id]=r;
    }
    function factLeaf(bytes32 id,uint64 revision,uint32 athlete,Fact calldata f) external view returns(bytes32){
        return _leaf(id,revision,athlete,f);
    }
    function _leaf(bytes32 id,uint64 revision,uint32 athlete,Fact memory f) private view returns(bytes32){return keccak256(bytes.concat(keccak256(abi.encode(DOMAIN,block.chainid,address(this),id,manifest[id],revision,athlete,f))));}
    function validate(bytes32 id,bytes calldata encoded) public view returns(bool){
        if(encoded.length>2048)return false;
        Config storage c=configs[id];
        if(c.kind==Kind.SALARY || c.kind==Kind.CAPTAIN){
            uint32[] memory lineup=abi.decode(encoded,(uint32[]));uint256 n=c.kind==Kind.SALARY?9:6;
            if(lineup.length!=n)return false;
            bytes32[] memory teams=new bytes32[](n);uint256 unique;uint256 twiceCost;
            for(uint256 i;i<n;i++){
                Price memory p=prices[id][lineup[i]];FantasyTypes420.Athlete memory a=slates.athleteOf(c.slate,lineup[i]);
                uint8 required=c.kind==Kind.CAPTAIN?31:i<2?1:i<5?6:i<7?8:i==7?16:15;
                if(p.athlete==0 || (a.positions&required)==0)return false;
                uint256 count;
                for(uint256 j;j<i;j++){if(lineup[j]==lineup[i])return false;if(teams[j]==p.team)count++;}
                if(count>=4)return false;
                if(count==0)unique++;
                teams[i]=p.team;twiceCost+=uint256(p.salary)*(c.kind==Kind.CAPTAIN && i==0?3:2);
            }
            return twiceCost<=100000 && unique>=(c.kind==Kind.CAPTAIN?2:3);
        }
        if(c.kind!=Kind.PEER && c.kind!=Kind.HOUSE)return false;
        (uint32[] memory selected,bool[] memory over)=abi.decode(encoded,(uint32[],bool[]));
        if(selected.length!=c.cardSize || over.length!=selected.length)return false;
        for(uint256 i;i<selected.length;i++){
            if(selected[i]>=markets[id].length)return false;
            Market memory m=markets[id][selected[i]];FantasyTypes420.Athlete memory a=slates.athleteOf(c.slate,m.athlete);
            for(uint256 j;j<i;j++){
                Market memory other=markets[id][selected[j]];
                if(m.athlete==other.athlete)return false;
                if(a.game==slates.athleteOf(c.slate,other.athlete).game && (c.officialGames>=3 || m.metric<2 || m.metric>3 || other.metric<2 || other.metric>3))return false;
            }
        }
        return true;
    }
    function calculate(bytes32 id,bytes calldata encoded,bytes calldata witnesses) external view returns(int256 score,bool qualifies,uint256 multiplier){
        if(!validate(id,encoded))revert Invalid();
        Config storage c=configs[id];Report storage r=reports[id];
        if(r.revision==0 || witnesses.length>65536)revert Invalid();
        Witness memory w=abi.decode(witnesses,(Witness));
        bool salary=c.kind==Kind.SALARY || c.kind==Kind.CAPTAIN;
        uint32[] memory ids;bool[] memory over;
        if(salary)ids=abi.decode(encoded,(uint32[]));else(ids,over)=abi.decode(encoded,(uint32[],bool[]));
        if(w.facts.length!=ids.length || w.proofs.length!=ids.length)revert Invalid();
        uint256 active;uint256 wins;
        for(uint256 i;i<ids.length;i++){
            uint32 aid=salary?ids[i]:markets[id][ids[i]].athlete;
            FantasyTypes420.Athlete memory a=slates.athleteOf(c.slate,aid);
            if(!slates.resultOf(c.slate,a.game).eligible)continue;
            Fact memory f=w.facts[i];nhl.verify(r.root,_leaf(id,r.revision,aid,f),w.proofs[i]);
            int256 points=nhl.score(f.stats,a.positions==16);
            if(f.stats.played!=(f.iceSeconds>0) || f.iceSeconds>8 hours || (f.started && (a.positions!=16 || !f.stats.played)))revert Invalid();
            if(salary){score+=points*(c.kind==Kind.CAPTAIN && i==0?int256(3):int256(2));continue;}
            Market memory m=markets[id][ids[i]];
            if(a.positions==16?!f.started:!f.stats.played)continue;
            uint256 value=m.metric==0?f.stats.goals:m.metric==1?f.stats.assists:m.metric==2?f.stats.shots:m.metric==3?f.stats.blocks:f.stats.saves;
            value*=10;if(value==m.lineTenths)continue;
            active++;if((value>m.lineTenths)==over[i])wins++;
        }
        if(salary)return(score,true,0); // Twice the inherited tenths-point unit, exact captain halves.
        qualifies=active>=2;score=qualifies?int256(wins*6/active):int256(0);
        multiplier=!qualifies?1:wins==active?(active==2?3:5):0;
    }
}

// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;
import "./FantasySeasonRoster420.sol";

/// @notice Proof-derived weekly totals and exact four-mode season ranking.
contract FantasySeasonScores420 {
    FantasySeasonData420 public immutable data;
    FantasySeasonRoster420 public immutable roster;
    mapping(bytes32=>mapping(uint16=>mapping(uint8=>FantasySeasonData420.Totals))) private totals;
    mapping(bytes32=>mapping(uint16=>mapping(uint8=>uint64))) public revision;
    error Invalid();
    constructor(address data_,address roster_){data=FantasySeasonData420(data_);roster=FantasySeasonRoster420(roster_);if(address(roster.data())!=data_)revert Invalid();}
    function totalOf(bytes32 id,uint16 week,uint8 m) external view returns(FantasySeasonData420.Totals memory){return totals[id][week][m];}
    function score(bytes32 id,uint16 week,uint8 m,bytes calldata witnesses) external{
        FantasySeasonData420.Report memory r=data.reportOf(id,week);
        if(m==0||m>data.configOf(id).teams||r.revision==0||revision[id][week][m]>=r.revision)revert Invalid();
        totals[id][week][m]=data.calculate(id,week,roster.lineupOf(id,week,m),witnesses);revision[id][week][m]=r.revision;
    }
    function weekReady(bytes32 id,uint16 week) public view returns(bool){
        FantasySeasonData420.Report memory r=data.reportOf(id,week);if(r.revision==0)return false;
        if(data.voided(id,week)||(data.earlyStart(id,week)!=0&&roster.lastEdit(id,week)>=data.earlyStart(id,week)))return true;
        for(uint8 m=1;m<=data.configOf(id).teams;m++)if(revision[id][week][m]!=r.revision)return false;return true;
    }
    function isVoid(bytes32 id,uint16 week) public view returns(bool){return data.voided(id,week)||(data.earlyStart(id,week)!=0&&roster.lastEdit(id,week)>=data.earlyStart(id,week));}
    function weekRoot(bytes32 id,uint16 week) external view returns(bytes32 h){
        if(!weekReady(id,week))revert Invalid();FantasySeasonData420.Report memory r=data.reportOf(id,week);
        h=keccak256(abi.encode(id,week,r.root,r.revision,isVoid(id,week)));
        if(!isVoid(id,week))for(uint8 m=1;m<=data.configOf(id).teams;m++)h=keccak256(abi.encode(h,m,totals[id][week][m]));
    }
    function opponent(bytes32 id,uint16 week,uint8 member) public view returns(uint8){
        uint8 n=data.configOf(id).teams;if(n%2!=0)revert Invalid();uint8[] memory circle=new uint8[](n);for(uint8 i;i<n;i++)circle[i]=i+1;
        for(uint16 r;r<(week-1)%(n-1);r++){uint8 last=circle[n-1];for(uint8 i=n-1;i>1;i--)circle[i]=circle[i-1];circle[1]=last;}
        for(uint8 i;i<n/2;i++){if(circle[i]==member)return circle[n-1-i];if(circle[n-1-i]==member)return circle[i];}revert Invalid();
    }
    function _compare(FantasySeasonData420.Totals memory a,FantasySeasonData420.Totals memory b,uint8 category,bool ae,bool be) private pure returns(int8 result,bool award){
        bool av=category<6||ae;bool bv=category<6||be;uint256 an;uint256 ad=1;uint256 bn;uint256 bd=1;
        if(category<8){an=a.metrics[category];bn=b.metrics[category];}
        else if(category==8){an=a.metrics[8];ad=a.metrics[9];bn=b.metrics[8];bd=b.metrics[9];av=av&&ad!=0;bv=bv&&bd!=0;}
        else{an=a.metrics[10];ad=a.metrics[11];bn=b.metrics[10];bd=b.metrics[11];av=av&&ad!=0;bv=bv&&bd!=0;}
        if(!av&&!bv)return(0,false);if(!av)return(-1,true);if(!bv)return(1,true);
        uint256 left=an*bd;uint256 right=bn*ad;
        result=left==right?int8(0):left>right?int8(1):int8(-1);if(category==9)result=-result;return(result,true);
    }
    /// LCM(1..12)=27720 preserves every possible roto tied-rank fraction exactly.
    function rank(bytes32 id,uint8 member) external view returns(int256 value){
        FantasySeasonData420.Config memory c=data.configOf(id);if(member==0||member>c.teams)revert Invalid();
        FantasySeasonData420.Totals[] memory aggregate=new FantasySeasonData420.Totals[](c.teams+1);uint256 minimum;uint256 periodCount;
        for(uint16 week=1;week<=c.periodCount;week++){
            if(!weekReady(id,week)||block.timestamp<data.periodOf(id,week).cutoff+1 days)revert Invalid();if(isVoid(id,week))continue;periodCount++;
            minimum+=data.periodOf(id,week).minimumStarts;
            if(c.mode==0){value+=totals[id][week][member].points;continue;}
            if(c.mode==1){int256 a=totals[id][week][member].points;int256 b=totals[id][week][opponent(id,week,member)].points;value+=a>b?int256(27720):a==b?int256(13860):int256(0);continue;}
            if(c.mode==2){
                FantasySeasonData420.Totals memory a=totals[id][week][member];FantasySeasonData420.Totals memory b=totals[id][week][opponent(id,week,member)];uint256 required=data.periodOf(id,week).minimumStarts;
                for(uint8 cat;cat<10;cat++){(int8 comparison,bool award)=_compare(a,b,cat,a.metrics[12]>=required,b.metrics[12]>=required);if(award)value+=comparison>0?int256(27720):comparison==0?int256(13860):int256(0);}
                continue;
            }
            for(uint8 m=1;m<=c.teams;m++)for(uint8 j;j<13;j++)aggregate[m].metrics[j]+=totals[id][week][m].metrics[j];
        }
        if(periodCount==0)revert Invalid();
        if(c.mode==3){
            FantasySeasonData420.Totals memory a=aggregate[member];
            for(uint8 cat;cat<10;cat++){
                (int8 ignored,bool valid)=_compare(a,a,cat,a.metrics[12]>=minimum,a.metrics[12]>=minimum);ignored;if(!valid)continue;
                uint256 better;uint256 tied;
                for(uint8 other=1;other<=c.teams;other++){
                    (int8 comp,)=_compare(a,aggregate[other],cat,a.metrics[12]>=minimum,aggregate[other].metrics[12]>=minimum);
                    if(comp<0)better++;else if(comp==0)tied++;
                }
                value+=int256((uint256(2*c.teams-2*better-tied+1)*27720)/2);
            }
        }
    }
}

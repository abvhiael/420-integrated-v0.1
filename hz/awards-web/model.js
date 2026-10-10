// Deterministic, public-data-only awards presentation fixture. No production authority.
const publication=(id,title,work,creator)=>({id,title,workId:work,creatorId:creator,rightsRef:"rights:"+work,status:"PUBLISHED",visibility:"PUBLIC"});
const recordings=[publication("recording-aurora","Aurora","work-aurora","creator-luna"),publication("recording-tides","Tides","work-tides","creator-river")];
export const fixture=()=>({
 program:{id:"hz-awards",name:"420Hz Awards"},
 season:{id:"season-2026",label:"2026 Awards",state:"NOMINATIONS_OPEN",nominationEnd:1793491200000,votingStart:1793491200000,votingEnd:1796083200000},
 categories:[{id:"song",name:"Song of the Year",version:1,targetType:"RECORDING",rules:"Published, public recordings. One submission per eligible account.",eligible:true},{id:"artist",name:"Artist of the Year",version:1,targetType:"CREATOR_PROFILE",rules:"Public creator with eligible published recordings.",eligible:true}],
 recordings,creators:[{id:"creator-luna",name:"Luna"},{id:"creator-river",name:"River"}],
 nominations:[],ballots:[{id:"ballot-song",categoryId:"song",state:"FROZEN",candidateIds:["recording-aurora","recording-tides"],votes:0}],
 results:[{id:"result-2025",seasonId:"season-2025",categoryId:"song",winnerIds:["recording-aurora"],commitment:"result:2025:aurora",status:"FINALIZED"}],
 badges:[{id:"badge-2025",resultId:"result-2025",targetId:"recording-aurora",label:"Song of the Year 2025"}],
 archive:[{id:"season-2025",label:"2025 Awards",status:"ARCHIVED",resultIds:["result-2025"]}],
 session:{account:"fixture-actor",canNominate:true,canVote:false},events:[]
});
const must=(condition,message)=>{if(!condition)throw Error(message);};
export function viewAwards(data,now){
 must(Number.isSafeInteger(now),"INVALID_TIME");const {season}=data;
 const publicRecordings=data.recordings.filter(x=>x.status==="PUBLISHED"&&x.visibility==="PUBLIC");
 const categories=data.categories.map(x=>({id:x.id,name:x.name,version:x.version,rules:x.rules,targetType:x.targetType}));
 const current={id:season.id,label:season.label,state:season.state,deadline:season.state==="NOMINATIONS_OPEN"?season.nominationEnd:season.votingEnd,countdownMs:Math.max(0,(season.state==="NOMINATIONS_OPEN"?season.nominationEnd:season.votingEnd)-now)};
 const results=data.results.filter(x=>x.status==="FINALIZED").map(r=>({id:r.id,seasonId:r.seasonId,categoryId:r.categoryId,winners:r.winnerIds.map(id=>publicRecordings.find(x=>x.id===id)).filter(Boolean).map(x=>({id:x.id,title:x.title,workId:x.workId,creatorId:x.creatorId,rightsRef:x.rightsRef})),commitment:r.commitment}));
 return {program:data.program,current,categories,nominations:data.nominations.filter(n=>n.actor===data.session.account).map(n=>({id:n.id,targetId:n.targetId,categoryId:n.categoryId})),eligibleTargets:publicRecordings.map(r=>({id:r.id,title:r.title})),ballots:data.ballots.map(b=>({id:b.id,categoryId:b.categoryId,state:b.state,candidateIds:b.candidateIds.filter(id=>publicRecordings.some(r=>r.id===id)),status:b.state==="OPEN"?"Voting open":b.state==="FROZEN"?"Awaiting voting":"Closed"})),results,badges:data.badges.filter(b=>results.some(r=>r.id===b.resultId)),archive:data.archive.map(a=>({id:a.id,label:a.label,status:a.status,resultIds:a.resultIds.filter(id=>results.some(r=>r.id===id))})),publicStatus:{state:season.state,nominationCount:data.nominations.length,ballotCount:data.ballots.length},canNominate:data.session.canNominate&&season.state==="NOMINATIONS_OPEN"&&now<=season.nominationEnd,canVote:data.session.canVote&&season.state==="VOTING_OPEN"};
}
export function fixtureNominate(data,{categoryId,targetId},now){
 const v=viewAwards(data,now);must(v.canNominate,"NOMINATIONS_CLOSED");
 must(v.categories.some(c=>c.id===categoryId&&c.targetType==="RECORDING"),"CATEGORY_UNAVAILABLE");
 must(v.eligibleTargets.some(x=>x.id===targetId),"INELIGIBLE_SOURCE");
 must(!data.nominations.some(n=>n.categoryId===categoryId&&n.targetId===targetId&&n.actor===data.session.account),"DUPLICATE_NOMINATION");
 const id="fixture-nomination-"+(data.nominations.length+1);data.nominations.push({id,actor:data.session.account,categoryId,targetId});return id;
}
export function fixtureVote(data,{ballotId,targetId},now){
 const v=viewAwards(data,now);must(v.canVote,"VOTING_UNAVAILABLE");
 const b=v.ballots.find(b=>b.id===ballotId);must(b?.state==="OPEN"&&b.candidateIds.includes(targetId),"INVALID_CHOICE");
 must(!data.events.some(e=>e.type==="VOTE"&&e.ballotId===ballotId&&e.actor===data.session.account),"VOTE_REPLAY");
 data.events.push({type:"VOTE",ballotId,targetId,actor:data.session.account});return "fixture-vote-recorded";
}

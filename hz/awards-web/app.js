import {fixture,viewAwards,fixtureNominate,fixtureVote} from "./model.js";
const state=fixture();const el=id=>document.getElementById(id);
const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
const show=(container,items,render)=>{container.replaceChildren();for(const item of items)container.append(render(item));};
const option=(id,label)=>{const x=document.createElement("option");x.value=id;x.textContent=label;return x;};
const section=(title,lines)=>{const card=document.createElement("article");card.className="card";card.append(node("h3",title));for(const line of lines)card.append(node("p",line));return card;};
function refresh(){
 const v=viewAwards(state,Date.now());el("season-heading").textContent=v.current.label;el("season-status").textContent="Status: "+v.current.state;
 el("countdown").textContent="Deadline: "+new Date(v.current.deadline).toLocaleString()+" · "+Math.ceil(v.current.countdownMs/86400000)+" days remaining";
 el("live").textContent="Public status: "+v.publicStatus.nominationCount+" fixture nominations; "+v.publicStatus.ballotCount+" ballots. No secret voting data published.";
 show(el("category-list"),v.categories,c=>section(c.name,["Version "+c.version,"Eligible target: "+c.targetType,c.rules]));
 show(el("nomination-category"),v.categories.filter(c=>c.targetType==="RECORDING"),c=>option(c.id,c.name));
 show(el("nomination-target"),v.eligibleTargets,t=>option(t.id,t.title));
 el("nominate-button").disabled=!v.canNominate;
 show(el("nominations-list"),v.nominations,n=>node("li",n.categoryId+" — "+n.targetId));
 show(el("ballot-list"),v.ballots,b=>section("Ballot "+b.id,["Category: "+b.categoryId,"Status: "+b.status,"Candidates: "+b.candidateIds.length]));
 show(el("vote-ballot"),v.ballots.filter(b=>b.state==="OPEN"),b=>option(b.id,b.id));
 syncChoices(v);
 el("vote-button").disabled=!v.canVote||!v.ballots.some(b=>b.state==="OPEN");
 show(el("result-list"),v.results,r=>{const card=section("Finalized "+r.seasonId,["Result commitment: "+r.commitment]);for(const w of r.winners){const p=node("p",w.title+" — "+w.creatorId);card.append(p);const links=document.createElement("p");for(const [label,href] of [["Recording", "#recording-"+w.id],["Work", "#work-"+w.workId],["Creator / rights", "#creator-"+w.creatorId]]){const a=node("a",label);a.href=href;links.append(a,document.createTextNode(" · "));}card.append(links);card.append(node("small","Provenance IDs: "+w.id+" → "+w.workId+" → "+w.creatorId+" → "+w.rightsRef));}for(const badge of v.badges.filter(b=>b.resultId===r.id))card.append(node("p","Award badge: "+badge.label));return card;});
 show(el("provenance-list"),state.recordings.filter(x=>x.visibility==="PUBLIC"&&x.status==="PUBLISHED"),r=>{const card=section(r.title,["Recording: "+r.id,"Work: "+r.workId,"Creator: "+r.creatorId,"Rights reference: "+r.rightsRef]);const anchors=[["recording-"+r.id,"Recording"],["work-"+r.workId,"Work"],["creator-"+r.creatorId,"Creator & rights"]];for(const [id,label] of anchors){const anchor=node("span",label);anchor.id=id;anchor.className="tag";anchor.style.marginRight="1rem";card.append(anchor);}return card;});
 show(el("archive-list"),v.archive,a=>section(a.label,["Status: "+a.status,"Finalized results: "+a.resultIds.join(", ")]));
}
function syncChoices(v){const b=v.ballots.find(x=>x.id===el("vote-ballot").value);show(el("vote-target"),b?.candidateIds||[],id=>option(id,id));}
el("nomination-form").addEventListener("submit",e=>{e.preventDefault();try{const id=fixtureNominate(state,{categoryId:el("nomination-category").value,targetId:el("nomination-target").value},Date.now());el("feedback").textContent="Demonstration nomination saved locally: "+id;}catch(err){el("feedback").textContent=err.message;}refresh();});
el("vote-form").addEventListener("submit",e=>{e.preventDefault();try{const id=fixtureVote(state,{ballotId:el("vote-ballot").value,targetId:el("vote-target").value},Date.now());el("feedback").textContent=id;}catch(err){el("feedback").textContent=err.message;}refresh();});
el("vote-ballot").addEventListener("change",()=>syncChoices(viewAwards(state,Date.now())));
refresh();

function setDemoPhase(phase){state.season.state=phase==="nomination"?"NOMINATIONS_OPEN":phase==="voting"?"VOTING_OPEN":"FINALIZED";state.session.canNominate=phase==="nomination";state.session.canVote=phase==="voting";state.ballots[0].state=phase==="nomination"?"FROZEN":phase==="voting"?"OPEN":"FINALIZED";el("feedback").textContent="Local demonstration phase: "+state.season.state;refresh();}
el("demo-nominations").addEventListener("click",()=>setDemoPhase("nomination"));
el("demo-voting").addEventListener("click",()=>setDemoPhase("voting"));
el("demo-results").addEventListener("click",()=>setDemoPhase("results"));

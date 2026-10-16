"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const code=fs.readFileSync(path.join(__dirname,"../services/complianceauth/authorweb/editor.js"),"utf8");
const model=require("../services/complianceauth/authorweb/editor.js");
const scope={tenant:"tenant-a",domain:"delivery",jurisdiction:"bc"};
function values() {return {"draft-id":"draft1",graph:"graph-v1","effective-from":"2026-01-01T00:00:00Z","effective-until":"",timezone:"America/Vancouver",start:"09:00",end:"17:00",overnight:false,actors:'[{"Role":"retailer","IssuerID":"issuer"}]',products:'[{"Class":"flower","Unit":"gram","EquivalencyNumerator":1,"EquivalencyDenominator":1}]',stages:'[{"Name":"handover","RequiredCredentials":["licence"],"RecipientVerification":"verified","PaymentPrerequisite":"permitted","ReturnDuty":"return","RecordObligation":"record"}]',records:'["record"]',citations:JSON.stringify([{source_id:"FED-ACT",digest:"a".repeat(64),locator:"section-1"}])};}
test("structured request is scoped by verified session and remains draft-only",()=>{
  const v=values();v.tenant="evil";v.jurisdiction="other";v.author_id="publisher";v.ReviewState="APPROVED";
  const r=model.makeRequest(v,scope,3);
  assert.equal(r.schema.LegalJurisdictionID,"bc");
  assert.equal(r.schema.ReviewState,"DRAFT_REVIEW_REQUIRED");
  assert.equal(r.expected_revision,3);
  assert.equal(r.schema.SourceDigest,"");
  assert.equal(r.schema.Stages[0].ReturnDuty,"return");
  assert.ok(!Object.hasOwn(r,"author_id"));
});
test("malformed arrays, oversized records and unsafe numeric precision are rejected",()=>{
  for(const text of ["{}", "[]", "[", JSON.stringify(Array(33).fill({})), '[{"EquivalencyNumerator":9007199254740993}]', '[{"EquivalencyNumerator":1.1}]']) assert.throws(()=>model.array(text));
  assert.throws(()=>model.makeRequest({...values(),"draft-id":"../private"},scope,0));
  assert.throws(()=>model.makeRequest(values(),scope,-1));
  assert.throws(()=>model.revision("0"));
  assert.throws(()=>model.revision("1&tenant=other"));
  assert.equal(model.revision("12"),12);
});
class Element {
  constructor(id){this.id=id;this.value="";this.checked=false;this.disabled=true;this.textContent="";this.children=[];this.handlers={};}
  addEventListener(name,fn){this.handlers[name]=fn;}
  replaceChildren(){this.children=[];}
  appendChild(child){this.children.push(child);}
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness(options={}) {
  const elements={};
  for(const id of [...Object.keys(values()),"from","to","load","save","preview","compare","logout","editor-fields","session-status","message","source-text","changes","revision"]) elements[id]=new Element(id);
  const calls=[],versions=[];
  let timer, revoked=false, failure=null, pending=null;
  const session={subject:"author-a",scope,csrf_token:"C".repeat(64),valid_until:new Date(Date.now()+60000).toISOString(),state:"AUTHOR_DRAFT_ONLY"};
  function respond(status,data){return {status,ok:status>=200&&status<300,json:async()=>data};}
  const ctx={document:{getElementById:id=>elements[id],createElement:tag=>new Element(tag)},AbortController,Date,
    setTimeout:fn=>{timer=fn;return 1;},clearTimeout:()=>{},
    fetch:async(url,init)=>{
      calls.push({url,init});
      if(pending) return pending;
      if(failure) return respond(failure,{error:"unavailable"});
      if(url==="/api/v1/author/session") return respond(options.anonymous?401:200,session);
      if(revoked)return respond(401,{error:"revoked"});
      if(url==="/api/v1/author/logout"){revoked=true;return respond(204,null);}
      if(url==="/api/v1/author/citations")return respond(200,{citations:[{source_id:"FED-ACT",digest:"a".repeat(64),locator:"section-1",excerpt:"<script>private source</script>"}]});
      if(url.includes("/compare"))return respond(200,{id:"draft1",from:1,to:2,changes:[{field:"Hours",before:{EndLocal:"17:00"},after:{EndLocal:"18:00"}}]});
      if(init.method==="PUT"){
        const r=JSON.parse(init.body);
        if(r.expected_revision!==versions.length)return respond(409,{error:"conflict"});
        const version={id:r.schema.PolicyID,author_id:"author-a",scope,revision:versions.length+1,document_digest:"b".repeat(64),schema:r.schema,citations:r.citations.map(x=>({...x,excerpt:"<script>private source</script>"}))};
        versions.push(version);return respond(200,version);
      }
      return versions.length?respond(200,versions.at(-1)):respond(404,{error:"missing"});
    }};
  vm.runInNewContext(code,ctx);
  return {elements,calls,versions,session,fill(){for(const [key,v]of Object.entries(values())){if(key==="overnight")elements[key].checked=v;else elements[key].value=v;}},expire(){timer();},fail(status){failure=status;},defer(p){pending=p;},respond,ctx};
}
test("anonymous bootstrap stays locked with no draft request or private values",async()=>{
  const h=harness({anonymous:true});await flush();
  assert.equal(h.elements["editor-fields"].disabled,true);
  assert.match(h.elements["session-status"].textContent,/No current authenticated/);
  assert.equal(h.calls.length,1);
});
test("save, source preview, load and compare use the actual controller and scoped endpoints",async()=>{
  const h=harness();await flush();h.fill();
  assert.equal(h.elements["editor-fields"].disabled,false);
  await h.elements.save.handlers.click();
  assert.equal(h.versions.length,1);
  assert.match(h.elements.revision.textContent,/Revision 1/);
  const save=h.calls.find(x=>x.init.method==="PUT");
  assert.equal(save.init.headers["X-CSRF-Token"],h.session.csrf_token);
  assert.equal(save.init.credentials,"same-origin");
  assert.equal(save.init.cache,"no-store");
  assert.equal(save.init.redirect,"error");
  assert.ok(!save.url.includes(h.session.csrf_token));
  await h.elements.preview.handlers.click();
  assert.equal(h.elements["source-text"].children[0].children[2].textContent,"<script>private source</script>");
  h.elements.end.value="18:00";await h.elements.save.handlers.click();
  h.elements.from.value="1";h.elements.to.value="2";await h.elements.compare.handlers.click();
  assert.match(h.elements.changes.textContent,/Hours/);
  await h.elements.load.handlers.click();
  assert.match(h.elements.revision.textContent,/Revision 2/);
});
test("conflict retains unsaved work, disables save and never retries automatically",async()=>{
  const h=harness();await flush();h.fill();await h.elements.save.handlers.click();
  h.versions.push({...h.versions[0],revision:2});
  h.elements.end.value="19:00";
  const before=h.calls.length;await h.elements.save.handlers.click();
  assert.equal(h.calls.length,before+1);
  assert.equal(h.elements.end.value,"19:00");
  assert.equal(h.elements.save.disabled,true);
  assert.match(h.elements.message.textContent,/Revision conflict/);
  await h.elements.load.handlers.click();
  assert.equal(h.elements.save.disabled,false);
});
test("expired session clears private fields, cited text and comparison output",async()=>{
  const h=harness();await flush();h.fill();await h.elements.save.handlers.click();
  h.elements.changes.textContent="private comparison";h.expire();
  assert.equal(h.elements["draft-id"].value,"");
  assert.equal(h.elements["source-text"].children.length,0);
  assert.equal(h.elements.changes.textContent,"No comparison loaded.");
  assert.equal(h.elements["editor-fields"].disabled,true);
});
test("revoked/forbidden/unavailable responses clear private state",async()=>{
  for(const status of [401,403,503]){
    const h=harness();await flush();h.fill();await h.elements.save.handlers.click();h.fail(status);
    await h.elements.load.handlers.click();
    assert.equal(h.elements["draft-id"].value,"");
    assert.equal(h.elements["source-text"].children.length,0);
    assert.equal(h.elements["editor-fields"].disabled,true);
  }
});
test("logout is server-directed and removes all private session state",async()=>{
  const h=harness();await flush();h.fill();await h.elements.save.handlers.click();
  await h.elements.logout.handlers.click();
  assert.ok(h.calls.some(x=>x.url==="/api/v1/author/logout"&&x.init.method==="POST"));
  assert.equal(h.elements["draft-id"].value,"");
  assert.equal(h.elements.logout.disabled,true);
});
test("late in-flight response cannot repopulate a cleared expired session",async()=>{
  const h=harness();await flush();h.fill();await h.elements.save.handlers.click();
  let resolve;h.defer(new Promise(r=>resolve=r));const work=h.elements.load.handlers.click();h.expire();
  resolve(h.respond(200,h.versions[0]));await work;
  assert.equal(h.elements["draft-id"].value,"");
  assert.equal(h.elements["source-text"].children.length,0);
});
test("cross-scope private response is rejected and cached private data cleared",async()=>{
  const h=harness();await flush();h.fill();await h.elements.save.handlers.click();
  h.versions[0]={...h.versions[0],scope:{...scope,tenant:"other"}};
  await h.elements.load.handlers.click();
  assert.equal(h.elements["draft-id"].value,"");
  assert.equal(h.elements["editor-fields"].disabled,true);
});
test("private renderer has no HTML injection, persistence, URL credentials or publication route",()=>{
  assert.doesNotMatch(code,/innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|document\.cookie|location\.|sendBeacon|\/api\/v1\/evaluate|\/publish|\/approve/);
});

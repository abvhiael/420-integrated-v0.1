(function (root) {
  "use strict";
  const fieldIDs = ["draft-id","graph","effective-from","effective-until","timezone","start","end","overnight","actors","products","stages","records","citations","from","to"];
  const idPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
  function array(text) {
    if (typeof text !== "string" || text.length > 32768) throw new Error("Invalid bounded JSON array");
    const result = JSON.parse(text);
    if (!Array.isArray(result) || result.length === 0 || result.length > 32) throw new Error("Nonempty bounded records required");
    function exact(value, depth) {
      if (depth > 32) throw new Error("Excessive record depth");
      if (typeof value === "number" && !Number.isSafeInteger(value)) throw new Error("Exact safe integers required");
      if (value && typeof value === "object") Object.values(value).forEach(item=>exact(item,depth+1));
    }
    exact(result,0);
    return result;
  }
  function revision(value) {
    if (!/^[1-9][0-9]{0,14}$/.test(value)) throw new Error("Choose a positive revision");
    const n = Number(value);
    if (!Number.isSafeInteger(n)) throw new Error("Invalid revision");
    return n;
  }
  function makeRequest(values, scope, expected) {
    if (!idPattern.test(values["draft-id"]) || !scope || !scope.jurisdiction || !Number.isSafeInteger(expected) || expected < 0) throw new Error("Invalid draft or revision");
    return {expected_revision: expected, schema: {
      Version: "420compliance-policy-schema/v1", PolicyID: values["draft-id"],
      AuthorityGraphVersion: values.graph, LegalJurisdictionID: scope.jurisdiction, SourceDigest: "",
      EffectiveFrom: values["effective-from"], EffectiveUntil: values["effective-until"] || "0001-01-01T00:00:00Z",
      Actors: array(values.actors), Products: array(values.products), Stages: array(values.stages),
      Hours: {Timezone: values.timezone, StartLocal: values.start, EndLocal: values.end, Overnight: values.overnight === true},
      RequiredRecords: array(values.records), ReviewState: "DRAFT_REVIEW_REQUIRED"
    }, citations: array(values.citations)};
  }
  const api = Object.freeze({makeRequest, array, revision});
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  const doc = root.document;
  if (!doc) return;
  const el = id => doc.getElementById(id);
  let session = null, current = {id:"", revision:0}, generation = 0, timer = null, conflicted = false, busy = false;
  const controllers = new Set();
  function controls(enabled) {el("editor-fields").disabled = !enabled; el("logout").disabled = !session; el("save").disabled = !enabled || conflicted;}
  function clearPrivate() {
    for (const id of fieldIDs) {
      if (id === "overnight") el(id).checked = false;
      else el(id).value = ["actors","products","stages","records","citations"].includes(id) ? "[]" : "";
    }
    el("source-text").replaceChildren();
    el("changes").textContent = "No comparison loaded.";
    el("revision").textContent = "No draft loaded.";
    current = {id:"",revision:0};
  }
  function lock(message) {
    generation++;
    session = null;
    if (timer !== null) root.clearTimeout(timer);
    for (const c of controllers) c.abort();
    controllers.clear();
    clearPrivate();
    controls(false);
    el("session-status").textContent = message;
  }
  async function request(path, method = "GET", body) {
    if (!/^\/api\/v1\/author\//.test(path) || (path !== "/api/v1/author/session" && !session)) throw new Error("No author session");
    const g = generation, controller = new root.AbortController();
    controllers.add(controller);
    try {
      const headers = {Accept:"application/json"};
      if (method !== "GET") {headers["Content-Type"]="application/json"; headers["X-CSRF-Token"]=session.csrf_token;}
      const response = await root.fetch(path,{method,headers,body:body === undefined ? undefined : JSON.stringify(body),credentials:"same-origin",cache:"no-store",redirect:"error",signal:controller.signal});
      if (g !== generation) throw new Error("Session ended");
      if ([401,403,503].includes(response.status)) {lock("Author session or required service unavailable. Private data cleared."); throw new Error("Author access unavailable");}
      if (!response.ok) {const error = new Error(response.status === 409 ? "Revision conflict. Reload latest before saving; your unsaved edits are retained." : "Draft request rejected; check scope, structured fields and pinned citations."); error.status=response.status; throw error;}
      if (response.status === 204) return null;
      const result = await response.json();
      if (g !== generation) throw new Error("Session ended");
      return result;
    } catch (error) {
      if (!error.status && g === generation && session) lock("Author service unavailable. Private data cleared; reconnect through the configured sign-in service.");
      throw error;
    } finally {controllers.delete(controller);}
  }
  function values() {return Object.fromEntries(fieldIDs.map(id=>[id,id==="overnight" ? el(id).checked : el(id).value]));}
  function id() {const value=el("draft-id").value; if(!idPattern.test(value)) throw new Error("Choose a valid draft ID"); return value;}
  function citations(items) {
    el("source-text").replaceChildren();
    for (const source of items) {
      const article=doc.createElement("article"); article.className="citation";
      const heading=doc.createElement("h3"); heading.textContent=source.source_id+" / "+source.locator;
      const state=doc.createElement("p"); state.textContent="Pinned snapshot "+source.digest+" — parsed, pending independent review.";
      const quote=doc.createElement("p"); quote.textContent=source.excerpt;
      article.appendChild(heading); article.appendChild(state); article.appendChild(quote); el("source-text").appendChild(article);
    }
  }
  function loadVersion(v) {
    if (!session || v.id !== id() || v.author_id !== session.subject || v.scope.tenant !== session.scope.tenant || v.scope.domain !== session.scope.domain || v.scope.jurisdiction !== session.scope.jurisdiction || v.schema.PolicyID !== v.id || v.schema.LegalJurisdictionID !== session.scope.jurisdiction || !Number.isSafeInteger(v.revision) || v.revision < 1 || v.schema.ReviewState !== "DRAFT_REVIEW_REQUIRED") {lock("Invalid private draft response. Private data cleared."); throw new Error("Invalid private draft response");}
    const s=v.schema; current={id:v.id,revision:v.revision}; conflicted=false;
    for (const [key,value] of Object.entries({graph:s.AuthorityGraphVersion,"effective-from":s.EffectiveFrom,"effective-until":s.EffectiveUntil==="0001-01-01T00:00:00Z"?"":s.EffectiveUntil,timezone:s.Hours.Timezone,start:s.Hours.StartLocal,end:s.Hours.EndLocal,actors:JSON.stringify(s.Actors,null,2),products:JSON.stringify(s.Products,null,2),stages:JSON.stringify(s.Stages,null,2),records:JSON.stringify(s.RequiredRecords,null,2),citations:JSON.stringify(v.citations.map(x=>({source_id:x.source_id,digest:x.digest,locator:x.locator})),null,2)})) el(key).value=value;
    el("overnight").checked=s.Hours.Overnight;
    el("revision").textContent="Revision "+v.revision+" / "+v.document_digest+" / DRAFT_REVIEW_REQUIRED";
    citations(v.citations);
  }
  async function action(work) {
    if (!session || busy) return;
    busy=true; controls(false);
    try {await work(); el("message").textContent="Draft operation completed. No review, approval or publication occurred.";}
    catch(error) {if(error.status===409)conflicted=true; if(error.status===404)clearPrivate(); el("message").textContent=error.message;}
    finally {busy=false; controls(!!session);}
  }
  el("load").addEventListener("click",()=>action(async()=>loadVersion(await request("/api/v1/author/drafts/"+id()))));
  el("save").addEventListener("click",()=>action(async()=>{const key=id();const expected=current.id===key?current.revision:0;loadVersion(await request("/api/v1/author/drafts/"+key,"PUT",makeRequest(values(),session.scope,expected)));}));
  el("preview").addEventListener("click",()=>action(async()=>{const data=await request("/api/v1/author/citations","POST",{citations:array(el("citations").value)}); citations(data.citations);}));
  el("compare").addEventListener("click",()=>action(async()=>{const data=await request("/api/v1/author/drafts/"+id()+"/compare?from="+revision(el("from").value)+"&to="+revision(el("to").value));el("changes").textContent=JSON.stringify(data,null,2);}));
  el("logout").addEventListener("click",async()=>{if(!session)return;try{await request("/api/v1/author/logout","POST",{});lock("Author session ended. Reauthenticate through the configured identity service.");}catch{lock("Private data cleared. Server sign-out could not be confirmed; use the identity service to revoke the session.");}});
  controls(false);
  request("/api/v1/author/session").then(data=>{
    if (!data || data.state!=="AUTHOR_DRAFT_ONLY" || !data.scope || !data.scope.tenant || !data.scope.domain || !data.scope.jurisdiction || !/^[A-Za-z0-9_-]{32,128}$/.test(data.csrf_token) || !Number.isFinite(Date.parse(data.valid_until)) || Date.parse(data.valid_until)<=Date.now()) throw new Error("No current author session");
    session=data;
    el("session-status").textContent="Author draft access / "+data.scope.tenant+" / "+data.scope.domain+" / "+data.scope.jurisdiction;
    controls(true);
    timer=root.setTimeout(()=>lock("Author session expired. Private data cleared."),Date.parse(data.valid_until)-Date.now());
  }).catch(()=>lock("No current authenticated author session. Use the independently configured sign-in service."));
})(typeof globalThis!=="undefined"?globalThis:this);

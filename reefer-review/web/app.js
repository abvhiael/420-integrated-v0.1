"use strict";

const state = {
  route: "latest",
  routeID: "",
  sessionToken: "",
  sessionSubject: "",
  sessionCapabilities: [],
  source: "",
  topic: "",
  newsCursor: "",
  originalsCursor: "",
  editorialCursor: "",
  newsItems: [],
  originalItems: [],
  sources: [],
  topics: [],
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function setStatus(message, isError = false) {
  const node = $("#app-status");
  node.textContent = message || "";
  node.classList.toggle("error", Boolean(isError));
}

function authHeaders(extra = {}) {
  return state.sessionToken ? { Authorization: `Bearer ${state.sessionToken}`, ...extra } : { ...extra };
}

function clearSession() {
  state.sessionToken = "";
  state.sessionSubject = "";
  state.sessionCapabilities = [];
  $("#session-state").textContent = "Not connected. Session credentials stay in memory and are never written to browser storage.";
  $("#session-connect").disabled = false;
  $("#session-scope").disabled = false;
  $("#session-disconnect").disabled = true;
}

async function connectWalletSession() {
  const gateway = window.ReeferReviewWalletSession;
  if (!gateway || typeof gateway.requestSession !== "function") {
    setStatus("A qualified 420 Wallet authentication gateway is not available in this deployment.", true);
    return;
  }
  try {
    const requestedCapability = $("#session-scope").value;
    const session = await gateway.requestSession({
      audience: "420/service/reefer-review/v1",
      capabilities: [requestedCapability],
    });
    const token = typeof session?.token === "string" ? session.token.trim() : "";
    if (!token || /[\s,]/.test(token)) throw new Error("invalid session token");
    state.sessionToken = token;
    state.sessionSubject = typeof session?.subject === "string" ? session.subject.trim() : "";
    state.sessionCapabilities = Array.isArray(session?.capabilities) ? session.capabilities.filter((v)=>typeof v==="string") : [];
    $("#session-state").textContent = state.sessionSubject
      ? `Connected as ${state.sessionSubject}. Session is memory-only.`
      : "Verified Wallet session connected. Session is memory-only.";
    $("#session-connect").disabled = true;
    $("#session-scope").disabled = true;
    $("#session-disconnect").disabled = false;
    setStatus("Verified ReeferReview session connected.");
    if (state.route === "editorial" || state.route === "moderation" || state.route === "article") refreshRoute();
  } catch (error) {
    clearSession();
    setStatus(`Wallet session failed: ${error.message || "authentication unavailable"}`, true);
  }
}

async function getJSON(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { Accept: "application/json", ...(options.headers || {}) },
  });
  let body = {};
  try { body = await response.json(); } catch { body = {}; }
  if (!response.ok) {
    const error = new Error(body.error || "REQUEST_FAILED");
    error.status = response.status;
    throw error;
  }
  return body;
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function formatDate(value) {
  const date = safeDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(undefined, { year:"numeric", month:"short", day:"numeric", hour:"numeric", minute:"2-digit" }).format(date);
}
function textElement(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value || "";
  return node;
}
function emptyCard(message) { return textElement("p", "empty", message); }
function button(label, className = "") {
  const node = textElement("button", className, label);
  node.type = "button";
  return node;
}
function renderList(container, items, cardFactory, emptyMessage, append = false) {
  if (!append) container.replaceChildren();
  if (!items.length && !append) { container.append(emptyCard(emptyMessage)); return; }
  items.forEach((item) => container.append(cardFactory(item)));
}

function topicButton(topic) {
  const node = button(topic, "topic-chip");
  node.addEventListener("click", () => {
    state.topic = topic;
    $("#topic-filter").value = topic;
    location.hash = "news";
  });
  return node;
}

function externalNewsCard(item) {
  const article = document.createElement("article");
  article.className = "story-card";
  article.dataset.kind = "external-news";
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.append(textElement("span","badge","External news"), textElement("span","",item.source_name || item.source_id || "Source"));
  const date = formatDate(item.published_at || item.discovered_at);
  if (date) meta.append(textElement("time","",date));
  article.append(meta, textElement("h3","",item.title || "Untitled"));
  if (item.summary) article.append(textElement("p","",item.summary));
  if (Array.isArray(item.topics) && item.topics.length) {
    const topics = document.createElement("div");
    topics.className = "topics"; topics.setAttribute("aria-label","Topics");
    item.topics.forEach((topic) => topics.append(topicButton(topic)));
    article.append(topics);
  }
  const actions = document.createElement("div");
  actions.className = "actions";
  if (item.canonical_url) {
    const link = textElement("a","read-original","Read original ↗");
    link.href = item.canonical_url; link.target = "_blank"; link.rel = "noopener noreferrer external";
    link.referrerPolicy = "strict-origin-when-cross-origin";
    link.setAttribute("aria-label", `Read original article at ${item.source_name || "publisher"} (opens in a new tab)`);
    actions.append(link);
  }
  article.append(actions, textElement("small","attribution",item.attribution || `Source: ${item.source_name || item.source_id || "publisher"}`));
  return article;
}

function originalCard(item) {
  const article = document.createElement("article");
  article.className = "story-card";
  article.dataset.kind = "reefer-review-original";
  const meta = document.createElement("div"); meta.className = "meta";
  meta.append(textElement("span","badge","ReeferReview Original"));
  if (item.author) meta.append(textElement("span","",item.author));
  const date = formatDate(item.published_at || item.created_at);
  if (date) meta.append(textElement("time","",date));
  article.append(meta, textElement("h3","",item.title || "Untitled"));
  if (item.summary) article.append(textElement("p","",item.summary));
  const actions = document.createElement("div"); actions.className = "actions";
  const link = textElement("a","read-original","Read article");
  link.href = `#article/${encodeURIComponent(item.id)}`;
  actions.append(link); article.append(actions);
  article.append(textElement("small","attribution",`Published inside ReeferReview • revision ${item.revision || 1}`));
  return article;
}

function newsQuery(cursor = "", query = "") {
  const params = new URLSearchParams({ limit:"20" });
  if (cursor) params.set("cursor",cursor);
  if (state.source) params.set("source",state.source);
  if (state.topic) params.set("topic",state.topic);
  if (query) params.set("q",query);
  return params;
}

async function loadNews({append=false}={}) {
  try {
    setStatus("Loading cannabis news…");
    const page = await getJSON(`/v1/news?${newsQuery(append ? state.newsCursor : "").toString()}`);
    const items = Array.isArray(page.items) ? page.items : [];
    state.newsCursor = page.next_cursor || "";
    renderList($("#news-feed"),items,externalNewsCard,"No cannabis news matches these filters yet.",append);
    $("#news-more").hidden = !state.newsCursor;
    setStatus(items.length ? `Loaded ${items.length} cannabis news item${items.length===1?"":"s"}.` : "No matching cannabis news.");
  } catch (error) {
    if (!append) renderList($("#news-feed"),[],externalNewsCard,"Cannabis news is temporarily unavailable.");
    setStatus(`Cannabis news unavailable: ${error.message}`,true);
  }
}

async function loadOriginals({append=false}={}) {
  try {
    const params = new URLSearchParams({limit:"20"});
    if (append && state.originalsCursor) params.set("cursor",state.originalsCursor);
    const page = await getJSON(`/v1/publications?${params.toString()}`);
    const items = Array.isArray(page.items) ? page.items : [];
    state.originalsCursor = page.next_cursor || "";
    renderList($("#originals-feed"),items,originalCard,"No public ReeferReview Originals yet.",append);
    $("#originals-more").hidden = !state.originalsCursor;
    setStatus(items.length ? `Loaded ${items.length} ReeferReview Original${items.length===1?"":"s"}.` : "No public ReeferReview Originals yet.");
  } catch (error) {
    if (!append) renderList($("#originals-feed"),[],originalCard,"ReeferReview Originals are temporarily unavailable.");
    setStatus(`Originals unavailable: ${error.message}`,true);
  }
}

function latestTimestamp(entry) {
  const value = entry.kind === "news" ? (entry.item.published_at || entry.item.discovered_at) : (entry.item.published_at || entry.item.created_at);
  return safeDate(value)?.getTime() || 0;
}
async function loadLatest() {
  try {
    const [news, originals] = await Promise.all([getJSON(`/v1/news?${newsQuery().toString()}`), getJSON("/v1/publications?limit=20")]);
    const combined = [
      ...(Array.isArray(news.items)?news.items:[]).map((item)=>({kind:"news",item})),
      ...(Array.isArray(originals.items)?originals.items:[]).map((item)=>({kind:"original",item})),
    ].sort((a,b)=>latestTimestamp(b)-latestTimestamp(a)).slice(0,30);
    const container=$("#latest-feed"); container.replaceChildren();
    if (!combined.length) container.append(emptyCard("No coverage is available yet."));
    else combined.forEach((entry)=>container.append(entry.kind==="news"?externalNewsCard(entry.item):originalCard(entry.item)));
    setStatus(combined.length?`Loaded ${combined.length} latest item${combined.length===1?"":"s"}.`:"No coverage is available yet.");
  } catch (error) {
    renderList($("#latest-feed"),[],externalNewsCard,"Latest coverage is temporarily unavailable.");
    setStatus(`Latest coverage unavailable: ${error.message}`,true);
  }
}

async function loadArticle(id) {
  const container=$("#article-content"); container.replaceChildren();
  try {
    const data=await getJSON(`/v1/publications/${encodeURIComponent(id)}`,{headers:authHeaders()});
    const p=data.publication || {};
    container.append(textElement("p","eyebrow","ReeferReview Original"),textElement("h2","",p.title || "Article"));
    const meta=document.createElement("div"); meta.className="article-meta";
    meta.append(textElement("span","",p.author || ""),textElement("span","revision-label",`Revision ${p.revision || 1}`));
    const date=formatDate(p.published_at || p.updated_at);
    if (date) meta.append(textElement("time","",date));
    meta.append(textElement("span","badge",p.visibility || ""));
    container.append(meta);
    if (p.summary) container.append(textElement("p","section-note",p.summary));
    container.append(textElement("div","article-body",data.body || ""));
    setStatus(`Loaded “${p.title || "article"}”.`);
  } catch(error) {
    container.append(emptyCard("This article is unavailable to the current reader."));
    setStatus(`Article unavailable: ${error.message}`,true);
  }
}

async function loadSourcesAndTopics() {
  const [sourcesResult,topicsResult]=await Promise.allSettled([getJSON("/v1/news/sources"),getJSON("/v1/news/topics")]);
  if (sourcesResult.status==="fulfilled") {
    state.sources=Array.isArray(sourcesResult.value.sources)?sourcesResult.value.sources:[];
    const select=$("#source-filter"); select.querySelectorAll("option:not(:first-child)").forEach((o)=>o.remove());
    state.sources.forEach((source)=>{const o=document.createElement("option");o.value=source.id;o.textContent=source.name;select.append(o);});
  }
  if (topicsResult.status==="fulfilled") {
    state.topics=Array.isArray(topicsResult.value.topics)?topicsResult.value.topics:[];
    const select=$("#topic-filter"); select.querySelectorAll("option:not(:first-child)").forEach((o)=>o.remove());
    state.topics.forEach((topic)=>{const o=document.createElement("option");o.value=topic;o.textContent=topic;select.append(o);});
    renderTopics();
  }
}
function renderTopics() {
  const container=$("#topic-list"); container.replaceChildren();
  if (!state.topics.length) {container.append(emptyCard("No topics are available yet."));return;}
  state.topics.forEach((topic)=>container.append(topicButton(topic)));
}

async function runSearch(query) {
  const q=query.trim(), container=$("#search-results"); container.replaceChildren();
  if (q.length<2) {container.append(emptyCard("Enter at least two characters to search."));return;}
  const [newsResult,originalsResult]=await Promise.allSettled([getJSON(`/v1/news?${newsQuery("",q).toString()}`),getJSON("/v1/publications?limit=100")]);
  const news=newsResult.status==="fulfilled"&&Array.isArray(newsResult.value.items)?newsResult.value.items:[];
  const lower=q.toLowerCase();
  const originals=originalsResult.status==="fulfilled"&&Array.isArray(originalsResult.value.items)
    ? originalsResult.value.items.filter((item)=>`${item.title||""}\n${item.summary||""}\n${item.author||""}`.toLowerCase().includes(lower)):[];
  const combined=[...news.map((item)=>({kind:"news",item})),...originals.map((item)=>({kind:"original",item}))].sort((a,b)=>latestTimestamp(b)-latestTimestamp(a));
  if(!combined.length) container.append(emptyCard(`No results for “${q}”.`));
  else combined.forEach((entry)=>container.append(entry.kind==="news"?externalNewsCard(entry.item):originalCard(entry.item)));
  setStatus(`${combined.length} result${combined.length===1?"":"s"} for “${q}”.`);
}

function editorialCard(item, moderation=false) {
  const article=document.createElement("article"); article.className="story-card";
  const meta=document.createElement("div"); meta.className="meta";
  meta.append(textElement("span","badge",item.status||""),textElement("span","",item.author||""),textElement("span","revision-label",`Revision ${item.revision||1}`));
  article.append(meta,textElement("h3","",item.title||"Untitled"));
  if(item.summary) article.append(textElement("p","",item.summary));
  const actions=document.createElement("div"); actions.className="editorial-actions";
  const read=textElement("a","read-original","Read"); read.href=`#article/${encodeURIComponent(item.id)}`; actions.append(read);
  if(!moderation) {
    if(item.status==="DRAFT"||item.status==="PUBLISHED") {
      const edit=button("Edit","secondary"); edit.addEventListener("click",()=>selectForEdit(item.id)); actions.append(edit);
    }
    if(item.status==="DRAFT") {
      const publish=button("Publish"); publish.addEventListener("click",()=>publishPublication(item.id)); actions.append(publish);
    }
    if(item.status!=="TOMBSTONED") {
      const tombstone=button("Tombstone","secondary"); tombstone.addEventListener("click",()=>tombstonePublication(item.id)); actions.append(tombstone);
    }
    const revisions=button("Revisions","secondary"); revisions.addEventListener("click",()=>showRevisions(item.id)); actions.append(revisions);
  } else {
    const reason=document.createElement("input"); reason.className="reason-field"; reason.placeholder="Moderation reason"; reason.setAttribute("aria-label",`Moderation reason for ${item.title}`);
    article.append(reason);
    if(item.status==="PUBLISHED") {
      const hide=button("Hide"); hide.addEventListener("click",()=>moderatePublication(item.id,"HIDE",reason.value)); actions.append(hide);
    }
    if(item.status==="HIDDEN") {
      const restore=button("Restore"); restore.addEventListener("click",()=>moderatePublication(item.id,"RESTORE",reason.value)); actions.append(restore);
    }
    const history=button("History","secondary"); history.addEventListener("click",()=>showModerationHistory(item.id)); actions.append(history);
  }
  article.append(actions); return article;
}

async function loadEditorial({moderation=false,append=false}={}) {
  const container=moderation?$("#moderation-list"):$("#editorial-list");
  if(!state.sessionSubject) {renderList(container,[],editorialCard,"Connect a verified Wallet session first.");return;}
  try {
    const params=new URLSearchParams({limit:"40"});
    if(append&&state.editorialCursor) params.set("cursor",state.editorialCursor);
    const page=await getJSON(`/v1/editorial/publications?${params.toString()}`,{headers:authHeaders()});
    const items=Array.isArray(page.items)?page.items:[];
    state.editorialCursor=page.next_cursor||"";
    renderList(container,items,(item)=>editorialCard(item,moderation),"No editorial records are available.",append);
    if(!moderation) $("#editorial-more").hidden=!state.editorialCursor;
    setStatus(`Loaded ${items.length} editorial record${items.length===1?"":"s"}.`);
  } catch(error) {
    renderList(container,[],editorialCard,"Editorial workspace is unavailable to this actor.");
    setStatus(`Editorial workspace unavailable: ${error.message}`,true);
  }
}

async function selectForEdit(id) {
  try {
    const data=await getJSON(`/v1/publications/${encodeURIComponent(id)}`,{headers:authHeaders()});
    const p=data.publication;
    $("#edit-id").value=p.id; $("#edit-title").value=p.title||""; $("#edit-summary").value=p.summary||"";
    $("#edit-body").value=data.body||""; $("#edit-visibility").value=p.visibility||"PUBLIC";
    $("#edit-title").focus(); setStatus(`Editing “${p.title}” revision ${p.revision||1}.`);
  } catch(error) { setStatus(`Cannot edit: ${error.message}`,true); }
}
function clearEdit() {
  $("#edit-id").value=""; $("#edit-title").value=""; $("#edit-summary").value=""; $("#edit-body").value=""; $("#edit-visibility").value="PUBLIC";
}
async function publishPublication(id) {
  try {
    await getJSON(`/v1/publications/${encodeURIComponent(id)}/publish`,{method:"POST",headers:authHeaders()});
    setStatus("Publication published."); state.editorialCursor=""; loadEditorial();
  } catch(error) { setStatus(`Publish failed: ${error.message}`,true); }
}
async function tombstonePublication(id) {
  const reason="Tombstoned from editorial workspace";
  try {
    await getJSON(`/v1/publications/${encodeURIComponent(id)}/tombstone`,{
      method:"POST",headers:authHeaders({"Content-Type":"application/json"}),body:JSON.stringify({reason})
    });
    setStatus("Publication tombstoned."); state.editorialCursor=""; loadEditorial();
  } catch(error) { setStatus(`Tombstone failed: ${error.message}`,true); }
}
async function showRevisions(id) {
  try {
    const data=await getJSON(`/v1/publications/${encodeURIComponent(id)}/revisions`,{headers:authHeaders()});
    const rows=Array.isArray(data.items)?data.items:[];
    setStatus(rows.map((r)=>`r${r.number} • ${r.editor} • ${formatDate(r.created_at)} • ${r.body_digest}`).join(" | ")||"No revision history.");
  } catch(error) { setStatus(`Revision history unavailable: ${error.message}`,true); }
}
async function moderatePublication(id,action,reason) {
  try {
    await getJSON(`/v1/publications/${encodeURIComponent(id)}/moderate`,{
      method:"POST",headers:authHeaders({"Content-Type":"application/json"}),body:JSON.stringify({action,reason})
    });
    setStatus(`${action} completed.`); loadEditorial({moderation:true});
  } catch(error) { setStatus(`Moderation failed: ${error.message}`,true); }
}
async function showModerationHistory(id) {
  const container=$("#moderation-history"); container.replaceChildren();
  try {
    const data=await getJSON(`/v1/publications/${encodeURIComponent(id)}/moderation`,{headers:authHeaders()});
    const rows=Array.isArray(data.items)?data.items:[];
    if(!rows.length) {container.append(emptyCard("No moderation events."));return;}
    rows.forEach((event)=>{
      const row=document.createElement("div"); row.className="history-row";
      row.append(textElement("strong","",`${event.action}: ${event.from_status} → ${event.to_status}`));
      row.append(textElement("small","",`${event.actor} • ${formatDate(event.created_at)}`));
      if(event.reason) row.append(textElement("p","",event.reason));
      container.append(row);
    });
  } catch(error) { container.append(emptyCard(`History unavailable: ${error.message}`)); }
}

function parseRoute() {
  const raw=location.hash.replace(/^#/,"")||"latest";
  const [route,...rest]=raw.split("/");
  if(route==="article"&&rest[0]) return {route:"article",id:decodeURIComponent(rest[0])};
  const allowed=["latest","news","originals","topics","search","editorial","moderation","news-admin"];
  return {route:allowed.includes(route)?route:"latest",id:""};
}
function newsAdminHeaders(extra={}) {
  const secret=$("#news-admin-key").value;
  if (secret && secret.length>=32) return {Authorization:`Bearer ${secret}`,...extra};
  return authHeaders(extra);
}
let editingNewsSource = "";

async function loadNewsAdmin() {
  const status = $("#news-admin-status"), list = $("#news-admin-list");
  list.replaceChildren();
  if (!state.sessionToken && !$("#news-admin-key").value) { status.textContent="Provide a standalone news admin key or connect a verified moderator session."; return; }
  try {
    const response = await getJSON("/v1/admin/news/sources",{headers:newsAdminHeaders()});
    const healthResponse = await getJSON("/v1/admin/news/health",{headers:newsAdminHeaders()}).catch(()=>({health:[]}));
    const healthByID=new Map((Array.isArray(healthResponse.health)?healthResponse.health:[]).map((h)=>[h.source_id,h]));
    const sources = Array.isArray(response.sources) ? response.sources : [];
    status.textContent = `${sources.length} configured publisher sources. Disabled sources are not fetched.`;
    for (const source of sources) {
      const item = document.createElement("article");
      item.className="news-admin-source";
      item.append(textElement("strong","",source.name),textElement("p","",`${source.id} · ${source.category} · ${source.enabled ? "Enabled" : "Disabled"} · every ${source.poll_interval_minutes} min`));
      const health=healthByID.get(source.id);
      if (health) item.append(textElement("p","",`Last success: ${health.last_success || "Never"} · failures: ${health.consecutive_failures || 0} · ${health.last_error || "No reported error"}`));
      const button=document.createElement("button");button.type="button";button.textContent="Edit source";
      button.addEventListener("click",()=>{
        editingNewsSource=source.id;
        $("#news-admin-id").value=source.id;
        $("#news-admin-id").readOnly=true;
        $("#news-admin-name").value=source.name;
        $("#news-admin-feed").value=source.feed_url;
        $("#news-admin-home").value=source.home_url;
        $("#news-admin-category").value=source.category;
        $("#news-admin-interval").value=source.poll_interval_minutes;
        $("#news-admin-attribution").value=source.attribution;
        $("#news-admin-enabled").checked=Boolean(source.enabled);
        $("#news-admin-form").scrollIntoView({block:"nearest"});
      });
      item.append(button);list.append(item);
    }
  } catch (error) { status.textContent=`Source management unavailable: ${error.message}`; }
}

function resetNewsAdmin() {
  editingNewsSource="";
  $("#news-admin-form").reset();
  $("#news-admin-id").readOnly=false;
}
$("#news-admin-refresh").addEventListener("click",loadNewsAdmin);
$("#news-admin-new").addEventListener("click",resetNewsAdmin);
$("#news-admin-form").addEventListener("submit",async(e)=>{
  e.preventDefault();
  const status=$("#news-admin-status");
  if (!state.sessionToken && !$("#news-admin-key").value) {status.textContent="Admin credential required.";return;}
  const id=$("#news-admin-id").value.trim();
  const source={
    id,name:$("#news-admin-name").value.trim(),feed_url:$("#news-admin-feed").value.trim(),
    home_url:$("#news-admin-home").value.trim(),enabled:editingNewsSource ? $("#news-admin-enabled").checked : false,
    category:$("#news-admin-category").value,language:"en",
    poll_interval_minutes:Number($("#news-admin-interval").value),
    allow_excerpt:false,allow_image:false,attribution:$("#news-admin-attribution").value.trim()
  };
  try {
    await getJSON("/v1/admin/news/sources",{method:editingNewsSource?"PUT":"POST",
      headers:newsAdminHeaders({"Content-Type":"application/json"}),body:JSON.stringify({source})});
    status.textContent=`Source ${id} saved. ${source.enabled?"Enabled":"Disabled"}.`;
    resetNewsAdmin();await loadNewsAdmin();await loadSourcesAndTopics();
  } catch (error) {status.textContent=`Source save rejected: ${error.message}`;}
});

function showRoute(route,id="") {
  state.route=route; state.routeID=id;
  $$(".view").forEach((view)=>{view.hidden=view.dataset.view!==route;});
  $$("[data-route]").forEach((link)=>{if(link.dataset.route===route)link.setAttribute("aria-current","page");else link.removeAttribute("aria-current");});
  if(route==="latest") loadLatest();
  if(route==="news") loadNews();
  if(route==="originals") loadOriginals();
  if(route==="article") loadArticle(id);
  if(route==="topics") renderTopics();
  if(route==="search") $("#search-query").focus();
  if(route==="editorial") {state.editorialCursor="";loadEditorial();}
  if(route==="moderation") {state.editorialCursor="";loadEditorial({moderation:true});}
  if(route==="news-admin") loadNewsAdmin();
}
function refreshRoute(){const parsed=parseRoute();showRoute(parsed.route,parsed.id);}

$("#session-connect").addEventListener("click", connectWalletSession);
$("#session-disconnect").addEventListener("click", ()=>{
  const gateway = window.ReeferReviewWalletSession;
  if (gateway && typeof gateway.endSession === "function") {
    try { gateway.endSession(); } catch {}
  }
  clearSession();
  setStatus("Signed out.");
  if(state.route==="editorial"||state.route==="moderation"||state.route==="article") refreshRoute();
});
$("[data-news-section]").forEach((button)=>button.addEventListener("click",()=>{state.topic=button.dataset.newsSection;state.newsCursor="";const filter=$("#topic-filter");filter.value=state.topic; if(filter.value!==state.topic) filter.value=""; $("[data-news-section]").forEach((b)=>b.setAttribute("aria-pressed",String(b===button)));location.hash="news";refreshRoute();}));
$("#source-filter").addEventListener("change",(e)=>{state.source=e.target.value;state.newsCursor="";refreshRoute();});
$("#topic-filter").addEventListener("change",(e)=>{state.topic=e.target.value;state.newsCursor="";refreshRoute();});
$("#clear-filters").addEventListener("click",()=>{state.source="";state.topic="";$("#source-filter").value="";$("#topic-filter").value="";state.newsCursor="";refreshRoute();});
$("#news-more").addEventListener("click",()=>loadNews({append:true}));
$("#originals-more").addEventListener("click",()=>loadOriginals({append:true}));
$("#editorial-more").addEventListener("click",()=>loadEditorial({append:true}));
$("#editorial-refresh").addEventListener("click",()=>{state.editorialCursor="";loadEditorial();});
$("#moderation-refresh").addEventListener("click",()=>{state.editorialCursor="";loadEditorial({moderation:true});});
$("#edit-clear").addEventListener("click",clearEdit);
$$("[data-refresh]").forEach((node)=>node.addEventListener("click",()=>{
  if(node.dataset.refresh==="latest")loadLatest();
  if(node.dataset.refresh==="news"){state.newsCursor="";loadNews();}
  if(node.dataset.refresh==="originals"){state.originalsCursor="";loadOriginals();}
}));
$("#search-form").addEventListener("submit",(e)=>{e.preventDefault();runSearch($("#search-query").value);});

$("#draft-form").addEventListener("submit",async(e)=>{
  e.preventDefault();
  if(!state.sessionSubject){setStatus("Connect a verified Wallet session first.",true);return;}
  try {
    const result=await getJSON("/v1/publications",{
      method:"POST",headers:authHeaders({"Content-Type":"application/json"}),
      body:JSON.stringify({
        idempotency_key:crypto.randomUUID(),title:$("#draft-title").value,summary:$("#draft-summary").value,
        body:$("#draft-body").value,visibility:$("#visibility").value
      })
    });
    $("#draft-status").textContent=JSON.stringify(result,null,2);
    e.target.reset(); state.editorialCursor=""; loadEditorial();
  } catch(error){$("#draft-status").textContent=`Draft creation failed: ${error.message}`;}
});
$("#edit-form").addEventListener("submit",async(e)=>{
  e.preventDefault();
  const id=$("#edit-id").value;
  if(!state.sessionSubject||!id){setStatus("Connect a verified Wallet session and select a publication to edit.",true);return;}
  try {
    await getJSON(`/v1/publications/${encodeURIComponent(id)}`,{
      method:"PUT",headers:authHeaders({"Content-Type":"application/json"}),
      body:JSON.stringify({title:$("#edit-title").value,summary:$("#edit-summary").value,body:$("#edit-body").value,visibility:$("#edit-visibility").value})
    });
    setStatus("Revision saved."); clearEdit(); state.editorialCursor=""; loadEditorial();
  } catch(error){setStatus(`Revision failed: ${error.message}`,true);}
});

window.addEventListener("hashchange",refreshRoute);
document.addEventListener("DOMContentLoaded",async()=>{await loadSourcesAndTopics();refreshRoute();});

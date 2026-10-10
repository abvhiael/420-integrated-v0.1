// Browser-level, dependency-free Chromium acceptance for 420Grow's private mobile UX.
// Requires a real installed Chromium/Chrome binary. Missing browser is a FAILURE.
import assert from "node:assert/strict";
import {createServer} from "node:https";
import {readFileSync,existsSync,mkdtempSync,rmSync} from "node:fs";
import {join,resolve,dirname} from "node:path";
import {tmpdir} from "node:os";
import {spawn,execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {once} from "node:events";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const temp=mkdtempSync(join(tmpdir(),"grow-chrome-"));
const validForMs=300000;
let revoked=false;
const binary=[process.env.CHROME,"/usr/bin/google-chrome","/usr/bin/chromium","/usr/bin/chromium-browser"]
 .filter(Boolean).find(existsSync);
assert.ok(binary,"Chromium/Chrome is required for mobile browser qualification");
execFileSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes","-days","1",
 "-subj","/CN=localhost","-keyout",join(temp,"key.pem"),"-out",join(temp,"cert.pem")],{stdio:"ignore"});
const tls={key:readFileSync(join(temp,"key.pem")),cert:readFileSync(join(temp,"cert.pem"))};
let port;
const server=createServer(tls,(req,res)=>{
 const url=new URL(req.url,"https://localhost:"+port);
 res.setHeader("Cache-Control","no-store");
 res.setHeader("X-Content-Type-Options","nosniff");
 if(url.pathname==="/runtime-config.js"){
  res.setHeader("Content-Type","application/javascript");
  res.end('window.GROW420_PRIVATE_CONFIG={enabled:true,privateApiBaseUrl:"https://localhost:'+port+'/"};window.GROW420_CONFIG={enabled:false};');
  return;
 }
 if(url.pathname==="/v1/private/login"&&req.method==="POST"){
  revoked=false;res.writeHead(204);res.end();return;
 }
 if(url.pathname==="/v1/private/logout"&&req.method==="POST"){
  revoked=true;res.writeHead(204);res.end();return;
 }
 if(url.pathname==="/v1/private/session"){
  if(revoked){res.writeHead(401);res.end();return;}
  res.setHeader("Content-Type","application/json");
  res.end(JSON.stringify({version:"grow-private-v1",authenticated:true,tenantId:"tenant-a",
   subjectId:"operator",sections:["plants","inventory"],actions:["plants.create","inventory.export"],
   csrf:"a".repeat(64),expiresAt:new Date(Date.now()+validForMs).toISOString()}));
  return;
 }
 if(url.pathname==="/v1/private/dashboard/plants"){
  if(revoked){res.writeHead(401);res.end();return;}
  res.setHeader("Content-Type","application/json");
  res.end(JSON.stringify({version:"grow-private-v1",tenantId:"tenant-a",section:"plants",
   items:[{id:"plant-1",title:"<img src=x onerror=alert(1)>",summary:"Private lifecycle observation",
    tenantId:"tenant-a",state:"VEGETATIVE"}]}));
  return;
 }
 if(url.pathname==="/v1/private/dashboard/inventory"){
  res.setHeader("Content-Type","application/json");
  res.end(JSON.stringify({version:"grow-private-v1",tenantId:"tenant-a",section:"inventory",items:[]}));
  return;
 }
 if(url.pathname.startsWith("/v1/private/action/")&&req.method==="POST"){
  if(revoked||req.headers["x-csrf-token"]!=="a".repeat(64)){res.writeHead(403);res.end();return;}
  res.writeHead(204);res.end();return;
 }
 const assets={"/workspace.html":"text/html","/workspace.js":"application/javascript",
  "/workspace.css":"text/css","/styles.css":"text/css"};
 if(assets[url.pathname]){
  res.setHeader("Content-Type",assets[url.pathname]);
  res.end(readFileSync(join(root,url.pathname.slice(1))));return;
 }
 res.writeHead(404);res.end();
});
server.listen(0,"127.0.0.1");await once(server,"listening");port=server.address().port;
const proc=spawn(binary,["--headless=new","--no-sandbox","--disable-dev-shm-usage",
 "--disable-gpu","--ignore-certificate-errors","--remote-debugging-port=0",
 "--remote-allow-origins=*","--user-data-dir="+join(temp,"chrome"),"about:blank"],{stdio:"ignore"});
const active=join(temp,"chrome","DevToolsActivePort");
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function awaitValue(fn,ms=15000){
 const stop=Date.now()+ms;
 while(Date.now()<stop){const v=await fn();if(v)return v;await pause(120)}
 throw Error("Chromium browser condition timed out");
}
let ws;
try{
 await awaitValue(()=>existsSync(active));
 const [debugPort,debugPath]=readFileSync(active,"utf8").trim().split("\n");
 ws=new WebSocket("ws://127.0.0.1:"+debugPort+debugPath);
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 let serial=0;const pending=new Map();
 ws.onmessage=ev=>{
  const msg=JSON.parse(ev.data);
  if(!msg.id)return;
  const p=pending.get(msg.id);
  if(!p)return;
  pending.delete(msg.id);
  if(msg.error)p.reject(Error(JSON.stringify(msg.error)));else p.resolve(msg.result);
 };
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
  const id=++serial;pending.set(id,{resolve,reject});
  ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
 });
 const target=await send("Target.createTarget",{url:"about:blank"});
 const connection=await send("Target.attachToTarget",{targetId:target.targetId,flatten:true});
 const sid=connection.sessionId;
 const command=(method,params={})=>send(method,params,sid);
 await command("Runtime.enable");
 await command("Page.enable");
 await command("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await command("Page.navigate",{url:"https://localhost:"+port+"/workspace.html"});
 const evaluate=async expression=>{
  const answer=await command("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
  if(answer.exceptionDetails)throw Error(JSON.stringify(answer.exceptionDetails));
  return answer.result.value;
 };
 await awaitValue(async()=>await evaluate('document.querySelector("#workspace-status")?.textContent.includes("authorized records")'));
 let state=await evaluate(`({
  viewport:innerWidth,
  documentWidth:document.documentElement.scrollWidth,
  headings:[...document.querySelectorAll("h1,h2")].map(x=>x.textContent),
  records:document.querySelectorAll("#workspace article.workspace-card").length,
  imageNodes:document.querySelectorAll("#workspace img").length,
  forms:document.querySelectorAll("form.workspace-action").length,
  accessibility:[...document.querySelectorAll("#workspace-nav,[role=status]")].every(x=>x.hasAttribute("aria-label")||x.hasAttribute("aria-live")),
  inputsLabeled:[...document.querySelectorAll(".workspace-action input,.workspace-action select")].every(x=>x.closest("label")),
  skipFocusable:(()=>{document.querySelector(".skip").focus();return document.activeElement.classList.contains("skip")})()
 })`);
 assert.equal(state.viewport,390);
 assert.ok(state.documentWidth<=state.viewport+2,"mobile horizontal overflow");
 assert.equal(state.records,1);
 assert.equal(state.imageNodes,0,"untrusted title inserted as HTML");
 assert.ok(state.forms>=1,"authorized mobile form not rendered");
 assert.ok(state.accessibility&&state.inputsLabeled&&state.skipFocusable,"accessibility regression");
 const tree=await command("Accessibility.getFullAXTree");
 assert.ok(tree.nodes.some(n=>n.role?.value==="button"&&String(n.name?.value||"").includes("Sign out")),
  "accessible sign-out button missing");
 await command("Emulation.setDeviceMetricsOverride",{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 await pause(200);
 assert.ok(await evaluate("document.documentElement.scrollWidth<=innerWidth+2"),"desktop horizontal overflow");
 revoked=true;
 await evaluate('document.getElementById("workspace-refresh").click()');
 await awaitValue(async()=>await evaluate('document.querySelector("#workspace-status")?.textContent.includes("session expired")'));
 assert.equal(await evaluate('document.querySelectorAll("#workspace article.workspace-card").length'),0,
  "revoked session retained private cards");
 await evaluate('document.querySelector("#workspace-login").click()');
 await awaitValue(async()=>await evaluate('document.querySelector("#workspace-status")?.textContent.includes("authorized records")'));
 await evaluate('document.querySelector("#workspace-logout").click()');
 await awaitValue(async()=>await evaluate('document.querySelector("#workspace-status")?.textContent.includes("Signed out")'));
 assert.equal(await evaluate('document.querySelectorAll("#workspace article.workspace-card").length'),0,
  "signout left private data in page");
 console.log("GROW-V2-13 Chromium mobile/desktop, accessibility, XSS, revocation, login recovery and logout PASS");
}finally{
 if(ws&&ws.readyState===WebSocket.OPEN)ws.close();
 proc.kill("SIGKILL");server.close();rmSync(temp,{recursive:true,force:true});
}

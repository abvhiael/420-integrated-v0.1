import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"..");
const read=(p)=>fs.readFileSync(path.join(root,p),"utf8");
const errors=[];
const required=["index.html","styles.css","app.js","api-client.js","state.js","runtime-config.json","package.json"];
for(const f of required) if(!fs.existsSync(path.join(root,f))) errors.push(`missing ${f}`);

const html=read("index.html");
for(const token of [
  'id="entry"','id="profile"','id="discovery"','id="matches"','id="notifications"',
  'id="safety"','id="settings"','id="premium"','Skip to main content',
  'role="status"','aria-live="polite"','Block','Report','Unmatch','Request deletion'
]) if(!html.includes(token)) errors.push(`web MVP surface missing: ${token}`);

for(const pattern of [
  /name=["']walletAddress["']/i,/name=["']exactAddress["']/i,/name=["']latitude["']/i,
  /name=["']longitude["']/i,/name=["']gps["']/i,/name=["']wallet_address["']/i
]){
  if(pattern.test(html)) errors.push(`forbidden public client field: ${pattern}`);
}

const js=[read("app.js"),read("api-client.js"),read("state.js")].join("\n");
for(const forbidden of ["localStorage","sessionStorage","indexedDB","document.cookie"]){
  if(js.includes(forbidden)) errors.push(`persistent browser authority forbidden: ${forbidden}`);
}
for(const forbidden of ["forceMatch","forceUnblock","blockOverride","adminMatch","wallet_balance","token_balance","desirability_score"]){
  if(js.includes(forbidden)) errors.push(`forbidden client authority: ${forbidden}`);
}

const cfg=JSON.parse(read("runtime-config.json"));
if(cfg.deploymentStatus!=="repository-qualified-not-deployed") errors.push("web runtime must not claim live deployment");
if(typeof cfg.apiBase!=="string" || !cfg.apiBase.startsWith("/") || cfg.apiBase.includes("://")) errors.push("same-origin API base required");
if(cfg.cacheMode!=="memory-only") errors.push("client cache must remain memory-only");
if(cfg.authorityMode!=="server-revalidated") errors.push("server-revalidated authority mode required");

const pkg=JSON.parse(read("package.json"));
for(const script of ["check","test","build","qualify"]) if(!pkg.scripts?.[script]) errors.push(`package script missing: ${script}`);

if(errors.length){console.error(errors.join("\n"));process.exit(1)}
console.log("PB-11 web static checks: PASS");

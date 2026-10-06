import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";

const root=path.resolve(import.meta.dirname,"..");
execFileSync(process.execPath,[path.join(root,"scripts/check.mjs")],{stdio:"inherit"});
execFileSync("npm",["test"],{cwd:root,stdio:"inherit",shell:process.platform==="win32"});

const dist=path.join(root,"dist");
fs.rmSync(dist,{recursive:true,force:true});
fs.mkdirSync(dist,{recursive:true});
for(const name of ["index.html","styles.css","app.js","api-client.js","state.js","runtime-config.json"]){
  fs.copyFileSync(path.join(root,name),path.join(dist,name));
}
console.log("PB-11 static build: PASS");

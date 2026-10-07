import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"..");
const dist=path.join(root,"dist");
fs.rmSync(dist,{recursive:true,force:true});
fs.mkdirSync(dist,{recursive:true});
for(const name of ["index.html","styles.css","app.js","api-client.js","state.js","runtime-config.json","puffbuddies-favicon.png"]){
  if(!fs.existsSync(path.join(root,name))) throw new Error(`missing build source: ${name}`);
  fs.copyFileSync(path.join(root,name),path.join(dist,name));
}
console.log("PB-11 static build: PASS");

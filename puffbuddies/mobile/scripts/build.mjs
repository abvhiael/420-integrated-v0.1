import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root=path.resolve(import.meta.dirname,"..");
const dist=path.join(root,"dist");
fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist,{recursive:true});
const files=[
 "runtime-config.json","core/state.js","core/api-client.js","core/platform-adapters.js","core/screen-model.js","core/app-shell.js",
 "ios/project.yml","ios/PuffBuddies/Info.plist","ios/PuffBuddies/PuffBuddies.entitlements","ios/PuffBuddies/AuthorityPolicy.swift",
 "ios/PuffBuddies/SecureSessionStore.swift","ios/PuffBuddies/NativeBridge.swift","ios/PuffBuddies/PuffBuddiesApp.swift",
 "android/settings.gradle.kts","android/build.gradle.kts","android/app/build.gradle.kts","android/app/src/main/AndroidManifest.xml",
 "android/app/src/main/java/org/fourtwenty/puffbuddies/PuffBuddiesAuthorityPolicy.kt",
 "android/app/src/main/java/org/fourtwenty/puffbuddies/PuffBuddiesSecureSessionStore.kt",
 "android/app/src/main/java/org/fourtwenty/puffbuddies/MainActivity.kt"
];
const manifest={schema:"puffbuddies-mobile-repository-bundle-v1",distributionQualified:false,files:[]};
for(const file of files){
 const data=fs.readFileSync(path.join(root,file));manifest.files.push({path:file,sha256:crypto.createHash("sha256").update(data).digest("hex")});
}
fs.writeFileSync(path.join(dist,"bundle-manifest.json"),JSON.stringify(manifest,null,2)+"\n");
console.log("PB-12 repository mobile bundle build: PASS");

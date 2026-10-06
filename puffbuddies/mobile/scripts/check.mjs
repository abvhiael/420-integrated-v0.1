import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"..");
const errors=[];
const required=[
 "runtime-config.json","package.json",
 "core/state.js","core/api-client.js","core/platform-adapters.js","core/screen-model.js","core/app-shell.js",
 "ios/project.yml","ios/PuffBuddies/Info.plist","ios/PuffBuddies/PuffBuddies.entitlements",
 "ios/PuffBuddies/AuthorityPolicy.swift","ios/PuffBuddies/SecureSessionStore.swift",
 "ios/PuffBuddies/NativeBridge.swift","ios/PuffBuddies/PuffBuddiesApp.swift",
 "android/settings.gradle.kts","android/build.gradle.kts","android/app/build.gradle.kts",
 "android/app/src/main/AndroidManifest.xml",
 "android/app/src/main/java/org/fourtwenty/puffbuddies/PuffBuddiesAuthorityPolicy.kt",
 "android/app/src/main/java/org/fourtwenty/puffbuddies/PuffBuddiesSecureSessionStore.kt",
 "android/app/src/main/java/org/fourtwenty/puffbuddies/MainActivity.kt"
];
for(const file of required)if(!fs.existsSync(path.join(root,file)))errors.push(`missing native source: ${file}`);

const read=(p)=>fs.readFileSync(path.join(root,p),"utf8");
const runtime=JSON.parse(read("runtime-config.json"));
if(runtime.deploymentStatus!=="repository-qualified-not-deployed")errors.push("mobile must not claim live deployment");
if(runtime.apiBase!==null)errors.push("mobile repository config must not hardcode a live API");
if(runtime.apiPolicy!=="injected-https-only")errors.push("mobile API must be injected HTTPS");
if(runtime.sessionStorage!=="device-bound-secure-store")errors.push("device-bound secure session store required");
if(runtime.derivedCache!=="memory-only")errors.push("derived mobile cache must be memory-only");
if(runtime.pushStatus!=="not-live"||runtime.distributionStatus!=="not-store-qualified")errors.push("push/store distribution must remain unclaimed");

const iosStore=read("ios/PuffBuddies/SecureSessionStore.swift");
if(!iosStore.includes("kSecAttrAccessibleWhenUnlockedThisDeviceOnly"))errors.push("iOS session must be device-bound keychain");
if(!/SecItem(Add|CopyMatching|Delete)/.test(iosStore))errors.push("iOS keychain operations missing");

const androidStore=read("android/app/src/main/java/org/fourtwenty/puffbuddies/PuffBuddiesSecureSessionStore.kt");
if(!androidStore.includes("AndroidKeyStore"))errors.push("Android keystore required");
if(!androidStore.includes("AES/GCM/NoPadding"))errors.push("Android AES-GCM required");
if(!androidStore.includes("setUnlockedDeviceRequired(true)"))errors.push("Android unlocked-device requirement missing");

const manifest=read("android/app/src/main/AndroidManifest.xml");
if(!manifest.includes('android:usesCleartextTraffic="false"'))errors.push("Android cleartext traffic must be disabled");
if(!manifest.includes('android:autoVerify="true"')||!manifest.includes('android:scheme="https"'))errors.push("Android verified HTTPS app link required");
if(manifest.includes("READ_CONTACTS")||manifest.includes("ACCESS_FINE_LOCATION"))errors.push("unnecessary sensitive Android permission");

const info=read("ios/PuffBuddies/Info.plist");
if(!info.includes("NSCameraUsageDescription")||!info.includes("NSPhotoLibraryUsageDescription"))errors.push("iOS media privacy descriptions required");
if(/NSLocationAlways|NSLocationWhenInUse/.test(info))errors.push("native exact-location permission is not authorized");


const iosProject=read("ios/project.yml");
const androidBuild=read("android/app/build.gradle.kts");
if(!iosProject.includes("PRODUCT_BUNDLE_IDENTIFIER: org.fourtwenty.puffbuddies"))errors.push("stable iOS bundle identifier required");
if(!androidBuild.includes('applicationId = "org.fourtwenty.puffbuddies"'))errors.push("stable Android application id required");

const forbiddenArtifacts=[".jks",".keystore",".p12",".mobileprovision",".apk",".aab",".ipa","google-services.json","GoogleService-Info.plist"];
const walk=(dir)=>{
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()){if(entry.name!=="dist")walk(full);}
    else if(forbiddenArtifacts.some(s=>entry.name.endsWith(s)||entry.name===s))errors.push(`forbidden committed mobile secret/artifact: ${path.relative(root,full)}`);
  }
};
walk(root);

const native=[read("ios/PuffBuddies/AuthorityPolicy.swift"),read("ios/PuffBuddies/NativeBridge.swift"),
 read("android/app/src/main/java/org/fourtwenty/puffbuddies/PuffBuddiesAuthorityPolicy.kt"),
 read("android/app/src/main/java/org/fourtwenty/puffbuddies/MainActivity.kt")].join("\n");
for(const forbidden of ["privateKey","remoteSigner","FORCE_MATCH = true","blockOverride = true","walletAddress"]){
 if(native.includes(forbidden))errors.push(`forbidden native authority/material: ${forbidden}`);
}

const core=["core/state.js","core/api-client.js","core/platform-adapters.js","core/screen-model.js","core/app-shell.js"].map(read).join("\n");
for(const forbidden of ["localStorage","sessionStorage","indexedDB","document.cookie","wallet_balance","token_balance","desirability_score"]){
 if(core.includes(forbidden))errors.push(`forbidden mobile core state: ${forbidden}`);
}

if(errors.length){console.error(errors.join("\n"));process.exit(1)}
console.log("PB-12 mobile static checks: PASS");

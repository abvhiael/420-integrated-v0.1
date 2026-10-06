import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {MobileState} from "../core/state.js";
import {createMobileApi,MobileApiError} from "../core/api-client.js";
import {SecureSessionAdapter,validateDeviceMedia,validatePushRegistration,parseAppLink} from "../core/platform-adapters.js";
import {mobileScreens,isBaselineAction,assertNoClientAuthority} from "../core/screen-model.js";
import {PuffBuddiesMobileShell} from "../core/app-shell.js";

const root=path.resolve(import.meta.dirname,"..");

test("authority generation invalidates mobile derived caches",()=>{
 const s=new MobileState();s.discovery=[1];s.matches=[2];s.notifications=[3];s.premium=[4];
 s.applyGeneration(8);
 assert.deepEqual(s.discovery,[]);assert.deepEqual(s.matches,[]);assert.deepEqual(s.notifications,[]);assert.deepEqual(s.premium,[]);
 assert.throws(()=>s.applyGeneration(7),/stale authority generation/);
});

test("resume clears derived state before server revalidation",()=>{
 const s=new MobileState();s.discovery=[1];s.matches=[2];s.onResume();
 assert.deepEqual(s.discovery,[]);assert.deepEqual(s.matches,[]);
});

test("secure session adapter never exposes alternate persistence",async()=>{
 const store=new Map();
 const native={secureGet:async k=>store.get(k)||"",secureSet:async(k,v)=>store.set(k,v),secureDelete:async k=>store.delete(k)};
 const s=new SecureSessionAdapter(native);await s.save("secret");assert.equal(await s.load(),"secret");await s.clear();assert.equal(await s.load(),"");
});

test("mobile API requires injected HTTPS and fails closed",async()=>{
 assert.throws(()=>createMobileApi({apiBase:"http://example.com"}),/HTTPS/);
 const calls=[];
 const api=createMobileApi({apiBase:"https://api.example.invalid/pb",sessionProvider:async()=>"token",
  fetchImpl:async(url,opts)=>{calls.push({url,opts});return {ok:true,status:200,json:async()=>({authorityGeneration:1})}}});
 await api.eligibility();assert.equal(calls[0].url,"https://api.example.invalid/pb/eligibility");assert.equal(calls[0].opts.cache,"no-store");
 const denied=createMobileApi({apiBase:"https://api.example.invalid",sessionProvider:async()=>"",fetchImpl:async()=>({ok:false,status:403})});
 await assert.rejects(()=>denied.matches(),e=>e instanceof MobileApiError && e.status===403);
});

test("mobile screens cover complete web-equivalent MVP surfaces",()=>{
 const ids=new Set(mobileScreens().map(x=>x.id));
 for(const id of ["entry","profile","discovery","matches","notifications","safety","settings","premium"])assert.ok(ids.has(id),id);
 for(const action of ["BLOCK","REPORT","UNMATCH","DEACTIVATE","DELETE_REQUEST"])assert.equal(isBaselineAction(action),true);
});

test("client authority manufacturing is rejected",()=>{
 for(const action of ["FORCE_MATCH","FORCE_UNBLOCK","ADMIN_MATCH","BLOCK_OVERRIDE","UNSUSPEND","UNBAN"])assert.throws(()=>assertNoClientAuthority(action));
 assert.equal(assertNoClientAuthority("LIKE"),true);
});

test("device media and push inputs are bounded and opaque",()=>{
 assert.deepEqual(validateDeviceMedia({ref:"device-media:abc",mimeType:"image/jpeg",sizeBytes:1024}),
  {ref:"device-media:abc",mimeType:"image/jpeg",sizeBytes:1024});
 assert.throws(()=>validateDeviceMedia({ref:"/private/photo.jpg",mimeType:"image/jpeg",sizeBytes:1024}),/opaque/);
 assert.throws(()=>validateDeviceMedia({ref:"device-media:x",mimeType:"text/plain",sizeBytes:10}),/unsupported/);
 assert.deepEqual(validatePushRegistration({platform:"ios",deviceRef:"device:abcdefgh"}),{platform:"ios",deviceRef:"device:abcdefgh"});
 assert.throws(()=>validatePushRegistration({platform:"ios",deviceRef:"raw-apns-token"}),/opaque device reference/);
});

test("app links accept only verified HTTPS supported routes",()=>{
 assert.deepEqual(parseAppLink("https://puff.example/matches").route,"/matches");
 assert.throws(()=>parseAppLink("puffbuddies://matches"),/verified HTTPS/);
 assert.throws(()=>parseAppLink("https://puff.example/admin"),/unsupported/);
});

test("shell cannot operate network without deployed API config",async()=>{
 const native={secureGet:async()=>"",secureSet:async()=>{},secureDelete:async()=>{}};
 const shell=new PuffBuddiesMobileShell({runtime:{deploymentStatus:"repository-qualified-not-deployed",apiBase:null},nativeBridge:native});
 await assert.rejects(()=>shell.action("CHECK_ELIGIBILITY"),e=>e instanceof MobileApiError);
});

test("protected denial clears mobile derived state",async()=>{
 const native={secureGet:async()=>"t",secureSet:async()=>{},secureDelete:async()=>{}};
 const shell=new PuffBuddiesMobileShell({
  runtime:{deploymentStatus:"repository-qualified-not-deployed",apiBase:"https://api.example.invalid"},
  nativeBridge:native,fetchImpl:async()=>({ok:false,status:403})
 });
 shell.state.discovery=[1];shell.state.matches=[2];
 await assert.rejects(()=>shell.action("REFRESH_MATCHES"));
 assert.deepEqual(shell.state.discovery,[]);assert.deepEqual(shell.state.matches,[]);
});

test("native projects use device-bound secure storage and no precise-location permission",()=>{
 const ios=fs.readFileSync(path.join(root,"ios/PuffBuddies/SecureSessionStore.swift"),"utf8");
 const android=fs.readFileSync(path.join(root,"android/app/src/main/java/org/fourtwenty/puffbuddies/PuffBuddiesSecureSessionStore.kt"),"utf8");
 const manifest=fs.readFileSync(path.join(root,"android/app/src/main/AndroidManifest.xml"),"utf8");
 const info=fs.readFileSync(path.join(root,"ios/PuffBuddies/Info.plist"),"utf8");
 assert.match(ios,/kSecAttrAccessibleWhenUnlockedThisDeviceOnly/);assert.match(android,/AndroidKeyStore/);assert.match(android,/AES\/GCM\/NoPadding/);
 assert.doesNotMatch(manifest,/ACCESS_FINE_LOCATION/);assert.doesNotMatch(info,/NSLocationAlways|NSLocationWhenInUse/);
});

test("iOS and Android source expose baseline safety without premium condition",()=>{
 const ios=fs.readFileSync(path.join(root,"ios/PuffBuddies/PuffBuddiesApp.swift"),"utf8");
 const android=fs.readFileSync(path.join(root,"android/app/src/main/java/org/fourtwenty/puffbuddies/MainActivity.kt"),"utf8");
 for(const source of [ios,android]){assert.match(source,/Block/);assert.match(source,/Report/);assert.match(source,/Unmatch/);assert.match(source,/Delete/);}
});

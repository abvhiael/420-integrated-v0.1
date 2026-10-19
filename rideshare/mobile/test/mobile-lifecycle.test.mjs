import test from 'node:test';
import assert from 'node:assert/strict';
import {createMobileLifecycle} from '../src/mobile-lifecycle.mjs';
function setup({expiresAt=1100,failRefresh=false,denyRole=false}={}){
 let data=null,active=false,refreshes=0,revokes=0;
 const token={accessToken:'access-token-valid',refreshToken:'refresh-token-valid',expiresAt};
 const store={read:async()=>data,write:async v=>{data=v;},clear:async()=>{data=null;}};
 const session={begin:async()=>{active=false;},revalidate:async role=>{if(denyRole||role!=='rider')throw Error('ROLE_DENIED');active=true;return {role};},logout:async()=>{active=false;},getStatus:()=>active?{role:'rider'}:null};
 const identity={signIn:async()=>token,refresh:async()=>{refreshes++;if(failRefresh)throw Error('REFRESH_DENIED');return {...token,expiresAt:1200,refreshToken:'rotated-token-valid'};},revoke:async()=>{revokes++;}};
 const lifecycle=createMobileLifecycle({identity,session,store,clock:()=>1000});
 return {lifecycle,get:()=>data,refreshes:()=>refreshes,revokes:()=>revokes};
}
test('sign-in requires role decision, logout destroys credentials and attempts revocation',async()=>{const x=setup();assert.deepEqual(await x.lifecycle.signIn({role:'rider',accountId:'account01',deviceId:'device01'}),{role:'rider'});await x.lifecycle.logout();assert.equal(x.get(),null);assert.equal(x.revokes(),1);assert.equal(x.lifecycle.getStatus(),null);});
test('expired access token rotates refresh token before role authority',async()=>{const x=setup({expiresAt:1001});await x.lifecycle.signIn({role:'rider',accountId:'account01',deviceId:'device01'});assert.equal(x.refreshes(),1);assert.equal(x.get().refreshToken,'rotated-token-valid');});
test('denied role or failed refresh clears persisted credentials',async()=>{for(const options of [{denyRole:true},{expiresAt:1001,failRefresh:true}]){const x=setup(options);await assert.rejects(x.lifecycle.signIn({role:'rider',accountId:'account01',deviceId:'device01'}));assert.equal(x.get(),null);assert.equal(x.lifecycle.getStatus(),null);}});
test('recovery invalidates local session and requires reauthentication',async()=>{const x=setup();await x.lifecycle.signIn({role:'rider',accountId:'account01',deviceId:'device01'});assert.equal(await x.lifecycle.recover(),'REAUTHENTICATION_REQUIRED');assert.equal(x.get(),null);assert.equal(x.lifecycle.getStatus(),null);});

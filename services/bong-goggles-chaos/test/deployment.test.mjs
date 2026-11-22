import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {checkPublicChaos} from '../scripts/live-probe.mjs';

test('CCC production package uses a compatible pinned lockfile',async()=>{
 const root=resolve(import.meta.dirname,'..');
 const pkg=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
 const lock=JSON.parse(await readFile(resolve(root,'package-lock.json'),'utf8'));
 assert.equal(pkg.dependencies.pg,'8.16.3');
 assert.equal(lock.packages[''].dependencies.pg,pkg.dependencies.pg);
 assert.equal(lock.packages['node_modules/pg'].version,pkg.dependencies.pg);
 assert.equal(lock.lockfileVersion,3);
});
test('Dedicated Render service and DB authority are independent and secret-free',async()=>{
 const root=resolve(import.meta.dirname,'../../..');
 const yaml=await readFile(resolve(root,'deployments/bong-goggles-chaos/render.yaml'),'utf8');
 const grants=await readFile(resolve(root,'deployments/bong-goggles-chaos/chaos-role-grants.sql'),'utf8');
 assert.match(yaml,/rootDir: services\/bong-goggles-chaos/);
 assert.match(yaml,/healthCheckPath: \/healthz/);
 assert.match(yaml,/buildCommand: npm ci --omit=dev/);
 assert.match(yaml,/CHAOS_DATABASE_URL\n\s+sync: false/);
 assert.match(yaml,/CHAOS_PROXY_KEY\n\s+sync: false/);
 assert.doesNotMatch(yaml,/postgres(?:ql)?:\/\/[^\s]+|(?:(?:CHAOS_DATABASE_URL|CHAOS_PROXY_KEY):\s*\S+)/i);
 assert.match(grants,/GRANT UPDATE\(data,status,revision,updated_at\)/);
 assert.match(grants,/GRANT SELECT ON bg_account_social\.blocks/);
 assert.doesNotMatch(grants,/GRANT [^;]*(?:sessions|login_flows|moderation_events|DELETE|TRUNCATE)/i);
});
test('Public probe rejects unavailable social ingress and never replays a write',async()=>{
 const calls=[];
 const fetchImpl=async(url,init)=>{calls.push([url,init]);return new Response('{}',{status:url.endsWith('/social-api/healthz')?502:200});};
 await assert.rejects(checkPublicChaos({chaosOrigin:'https://approved-chaos.onrender.com',fetchImpl}),/Account Social health: HTTP 502/);
 assert.equal(calls.length,2);
 assert.ok(calls.every(([url,opts])=>opts.method==='GET'&&opts.credentials==='omit'&&opts.redirect==='manual'));
 await assert.rejects(checkPublicChaos({chaosOrigin:'http://approved-chaos.onrender.com',fetchImpl}),/exact verified HTTPS/);
});
test('Public probe permits only exact controlled SSO redirect and fails closed without flow cookie',async()=>{
 const urls=[];
 const fetchImpl=async(url)=>{urls.push(url);const status=url.includes('/auth/start')?303:url.includes('/v1/chaos/rooms')?401:200;
  return new Response('{}',{status,headers:status===303?{location:'https://auth.420integrated.org/sso/authorize?a=1'}:{'content-type':'application/json'}});};
 await assert.rejects(checkPublicChaos({chaosOrigin:'https://approved-chaos.onrender.com',fetchImpl}),/secure flow cookie missing/);
 assert.equal(urls.length,6);
});

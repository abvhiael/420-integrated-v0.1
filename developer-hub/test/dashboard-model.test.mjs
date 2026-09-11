import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadNetworkManifest420, discoverNetwork420 } from '../src/network-discovery.mjs';
import { createContractCatalogue420 } from '../src/contract-catalogue.mjs';
import { loadIntegrationGuideRegistry420, listIntegrationGuides420 } from '../src/integration-guides.mjs';
import { createDashboardSnapshot420, DashboardModelError420 } from '../src/dashboard-model.mjs';

const root=resolve(import.meta.dirname,'..');
async function fixture(){const network=discoverNetwork420(await loadNetworkManifest420(resolve(root,'manifests/local.example.json'))); const contracts=createContractCatalogue420(JSON.parse(await readFile(resolve(root,'catalogue/local.example.json'),'utf8'))); const guides=listIntegrationGuides420(await loadIntegrationGuideRegistry420(resolve(root,'guides/registry.json'))); return {network,contracts,guides};}

test('dashboard snapshot consumes canonical configuration but remains non-authoritative',async()=>{const data=createDashboardSnapshot420(await fixture()); assert.equal(data.schemaVersion,'1.0.0'); assert.equal(data.network.chainId,'420'); assert.equal(data.canonicalAuthority,false); assert.equal(data.generatedFromCanonicalConfiguration,true); assert.ok(data.contracts.length>0); assert.ok(data.guides.length>=5); assert.match(data.securityRule,/must not sign/i);});

test('dashboard exposes service configuration and authority-boundary surfaces',async()=>{const data=createDashboardSnapshot420(await fixture()); assert.equal(data.services.find(x=>x.name==='indexer').configured,true); assert.equal(data.surfaces.indexer.canonical,false); assert.equal(data.surfaces.deployment.executableHere,false); assert.equal(data.surfaces.publishing.executableHere,false);});

test('dashboard fails closed on network/catalogue chain mismatch',async()=>{const {network,contracts,guides}=await fixture(); const bad=Object.freeze({...contracts,chainIdDecimal:'421'}); assert.throws(()=>createDashboardSnapshot420({network,contracts:bad,guides}),DashboardModelError420);});

test('dashboard browser assets preserve read-only framing',async()=>{const html=await readFile(resolve(root,'dashboard/static/index.html'),'utf8'); const js=await readFile(resolve(root,'dashboard/static/app.js'),'utf8'); assert.match(html,/authority boundaries/i); assert.match(js,/projection only|handoff only/); assert.doesNotMatch(js,/privateKey|mnemonic|eth_sendRawTransaction/);});

import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {canonicalSeedChild} from '../src/seed-chain-reader.js';
test('JavaScript inheritance matches qualified Python model across every planned rare cross',()=>{
 const script=`import sys,json;sys.path.insert(0,'scripts/highcountry');import rare_genome_lifecycle as r\np=r.g.load('rare-breeding-plan.v1.json');c={e['genomeId']:e for e in r.g.load('common-reference-genomes.v1.json')['genomes']}\nprint(json.dumps([{'id':str(e['breedingEventId']),'entropy':r.g.k(('SEED05_TEST:'+str(i)).encode()),'a':c[e['parentAGenomeId']]['loci'],'b':c[e['parentBGenomeId']]['loci'],'expected':r.offspring(c[e['parentAGenomeId']]['loci'],c[e['parentBGenomeId']]['loci'],r.g.k(('SEED05_TEST:'+str(i)).encode()),e['breedingEventId'])[0]} for i,e in enumerate(p['events'])]))`;
 const run=spawnSync('python',['-c',script],{cwd:new URL('../../../',import.meta.url),encoding:'utf8'});assert.equal(run.status,0,run.stderr);for(const v of JSON.parse(run.stdout))assert.deepEqual(canonicalSeedChild(v.a,v.b,v.entropy,v.id),v.expected);
});


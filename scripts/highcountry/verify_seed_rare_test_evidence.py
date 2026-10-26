#!/usr/bin/env python3
"""Verify canonical derivation in clearly labeled disposable test evidence, never live admission."""
import json
from pathlib import Path
import common_reference_genomes as g
import rare_genome_lifecycle as r

def check(evidence,plan,commons):
    if evidence.get('schema')!='HC.SEED.04.TEST_EVIDENCE.V1' or evidence.get('environment')!='DISPOSABLE_CONTRACT_TEST' or evidence.get('liveRegistration') is not False or evidence.get('provider')!='TEST_ONLY_SIGNATURE_NOT_VRF':raise ValueError('test provenance label')
    if evidence.get('commonCount')!=23 or evidence.get('rareCount')!=26 or len(evidence.get('events',[]))!=26:raise ValueError('test evidence counts')
    refs={e['genomeId']:e for e in commons['genomes']};mutations=0;canonical=set()
    for i,(e,p) in enumerate(zip(evidence['events'],plan['events'])):
        if e['index']!=i or int(e['eventId'])!=p['breedingEventId'] or any(e[k]!=p[k] for k in ['childGenomeId','contextHash','localRequestId']):raise ValueError('test event binding')
        if e['canonicalRequestId'] in canonical:raise ValueError('canonical request replay')
        canonical.add(e['canonicalRequestId'])
        for k in ['canonicalRequestId','proofHash','entropy']:
            if int(e[k],16)==0:raise ValueError('missing proof/entropy')
        loci,trace=r.offspring(refs[p['parentAGenomeId']]['loci'],refs[p['parentBGenomeId']]['loci'],e['entropy'],p['breedingEventId'])
        if loci!=e['loci']:raise ValueError('test child inheritance mismatch')
        mutations+=sum(x['mutated'] for x in trace)
    return {'schema':'HC.SEED.04.QUALIFICATION_REPORT.V1','environment':'DISPOSABLE_CONTRACT_TEST','liveRegistration':False,'registeredInTest':49,'rareCrosses':26,'verifiedLoci':728,'mutationCount':mutations,'evidenceHash':g.commit(evidence),'planHash':g.commit(plan),'liveCloseout':'BLOCKED_UNRESOLVED_DEPLOYMENT'}

def main():
    path=g.ROOT/'artifacts/highcountry/hc-seed-04-test-evidence.json'
    out=check(json.loads(path.read_text()),g.load('rare-breeding-plan.v1.json'),g.load('common-reference-genomes.v1.json'))
    target=path.with_name('hc-seed-04-qualification-report.json');target.write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,sort_keys=True))
if __name__=='__main__':main()

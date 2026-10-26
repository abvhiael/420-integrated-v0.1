#!/usr/bin/env python3
"""HC-SEED-04 planning and canonical inheritance; no locally fabricated live outcomes."""
import argparse
import json
from pathlib import Path
import common_reference_genomes as g

DOMAIN=g.k(b'HC.RANDOM.BREEDING.V1')

def word(n):
    if type(n) is not int or not 0<=n<2**256:raise ValueError('uint256')
    return n.to_bytes(32,'big')

def raw(value):
    if not isinstance(value,str) or len(value)!=66 or not value.startswith('0x'):raise ValueError('bytes32')
    return bytes.fromhex(value[2:])

def context(event_id,parent_a,parent_b,child,line,metadata):
    if not 0<event_id<2**64:raise ValueError('uint64 event ID')
    return g.k(word(event_id)+b''.join(raw(x) for x in [parent_a,parent_b,child,line,metadata]))

def local_request(ctx):return g.k(raw(DOMAIN)+raw(ctx))

def offspring(a,b,entropy,event_id):
    if len(a)!=28 or len(b)!=28 or int(entropy,16)==0:raise ValueError('breeding input')
    out=[];trace=[]
    for i in range(28):
        draw=int(g.k(raw(entropy)+word(event_id)+word(i)),16)
        origin='A' if draw&1==0 else 'B'
        locus=(a if origin=='A' else b)[i]
        mutated=(draw>>8)&255<5
        if mutated:
            # abi.encode(string,bytes32,bytes32,uint64,uint256): five-word head.
            domain=b'HC.MUTATION.V1'
            locus=g.k(word(160)+raw(locus)+raw(entropy)+word(event_id)+word(i)+word(len(domain))+domain.ljust(32,b'\0'))
        out.append(locus);trace.append({'index':i,'parent':origin,'mutated':mutated})
    return out,trace

def generate(pairs,catalog,commons):
    expected={e['id']:e for e in catalog['cultivars'] if e['tier']=='rare'}
    refs={e['cultivarId']:e for e in commons['genomes']}
    if pairs.get('schema')!='HC.SEED.RARE_PARENT_PAIRS.V1' or pairs.get('version')!=1 or len(pairs['pairs'])!=26 or len(expected)!=26 or len(refs)!=23:raise ValueError('catalog cardinality')
    events=[];seen=set();event_ids=set()
    for pair in sorted(pairs['pairs'],key=lambda p:p['cultivarId']):
        cid=pair['cultivarId'];c=expected.get(cid)
        if c is None or cid in seen or c['name']!=pair['canonicalName'] or c['region']!=pair['canonicalRegion']:raise ValueError('rare identity')
        seen.add(cid)
        if pair['parentA']==pair['parentB'] or pair['parentA'] not in refs or pair['parentB'] not in refs:raise ValueError('parent identity')
        a,b=refs[pair['parentA']],refs[pair['parentB']]
        metadata={'schema':'HC.SEED.RARE_REFERENCE_METADATA.V1',**pair,'referenceVersion':1,'parentGenomeIds':[a['genomeId'],b['genomeId']],'parentReferenceManifestHash':g.commit(commons),'parentPairManifestHash':g.commit(pairs),'geneticSemantics':'canonical 28-locus recombination and mutation; traits not fabricated','history':'fictional HighCountry cross; not an asserted real-world cultivar pedigree'}
        mh=g.commit(metadata);line=g.commit(['HC.RARE.LINE.V1',cid])
        child=g.commit(['HC.RARE.GENOME.V1',cid,1,a['genomeId'],b['genomeId'],mh])
        event_id=int(g.commit(['HC.RARE.BREEDING_EVENT.V1',child])[2:18],16)
        if event_id==0 or event_id in event_ids:raise ValueError('event ID collision')
        event_ids.add(event_id)
        ctx=context(event_id,a['genomeId'],b['genomeId'],child,line,mh)
        events.append({**pair,'breedingEventId':event_id,'parentAGenomeId':a['genomeId'],'parentBGenomeId':b['genomeId'],'childGenomeId':child,'childLineId':line,'metadataHash':mh,'metadata':metadata,'contextHash':ctx,'localRequestId':local_request(ctx),'status':'PLANNED_NO_ENTROPY_OR_REGISTRATION','requiredChildRegistrar':'bound BreedingEngine only; never operator direct-register','loci':None,'entropy':None})
    if seen!=set(expected):raise ValueError('rare coverage')
    return {'schema':'HC.SEED.RARE_BREEDING_PLAN.V1','version':1,'commonsHash':g.commit(commons),'pairsHash':g.commit(pairs),'status':'PLANNED_NOT_REGISTERED','events':events}

def validate(plan,pairs,catalog,commons):
    if plan!=generate(pairs,catalog,commons):raise ValueError('breeding plan mismatch')
    return {'rareCrosses':26,'commonReferences':23,'status':plan['status'],'planHash':g.commit(plan)}

def inputs():return [g.load(n) for n in ['rare-parent-pairs.v1.json','seed-catalog.v1.json','common-reference-genomes.v1.json']]

def main():
    p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');a=p.parse_args()
    g.verify_engine_sources()
    pairs,catalog,commons=inputs();g.validate(commons,*g.inputs())
    path=g.DATA/'rare-breeding-plan.v1.json'
    if a.check:print(json.dumps(validate(json.loads(path.read_text()),pairs,catalog,commons),sort_keys=True))
    else:g.write_manifest(path,generate(pairs,catalog,commons))
if __name__=='__main__':main()

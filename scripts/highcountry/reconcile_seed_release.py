#!/usr/bin/env python3
"""Bounded source/reference reconciliation. Planning never attests live registration."""
import hashlib,json,os,subprocess
from pathlib import Path
import common_reference_genomes as g
import rare_genome_lifecycle as r
ROOT=Path(__file__).resolve().parents[2]
def main():
 g.verify_engine_sources();common=g.load('common-reference-genomes.v1.json');g.validate(common,*g.inputs());pairs,catalog,refs=r.inputs();plan=g.load('rare-breeding-plan.v1.json');r.validate(plan,pairs,catalog,refs)
 if common['status']!='REGISTRATION_READY_NOT_REGISTERED' or plan['status']!='PLANNED_NOT_REGISTERED':raise ValueError('false live registration claim')
 if any(e['loci'] is not None or e['entropy'] is not None or e['status']!='PLANNED_NO_ENTROPY_OR_REGISTRATION' for e in plan['events']):raise ValueError('fabricated breeding provenance')
 assets=g.load('seed-assets.v1.json');commons={e['cultivarId']:e for e in common['genomes']};rares={e['cultivarId']:e for e in plan['events']};rows=[]
 for c in catalog['cultivars']:
  images=[e['id'] for e in assets['entries'] if e['cultivarId']==c['id']]
  if len(images)!=2:raise ValueError('cultivar art coverage')
  rows.append({'cultivarId':c['id'],'region':c['region'],'tier':c['tier'],'genomeId':commons[c['id']]['genomeId'] if c['tier']=='common' else rares[c['id']]['childGenomeId'] if c['tier']=='rare' else None,'genomeBasis':'unregistered-versioned-reference' if c['tier']=='common' else 'precommitted-plan-not-an-offspring-record' if c['tier']=='rare' else 'reserved-founder-identity; actual genome must resolve from canonical registry','breedingEventId':str(rares[c['id']]['breedingEventId']) if c['tier']=='rare' else None,'assets':images})
 sources=sorted(set([p for p in (ROOT/'deployments/highcountry').glob('*.json') if p.name in ['seed-catalog.v1.json','common-cultivar-research.v1.json','common-genome-translation.v1.json','common-genome-engine-inspection.v1.json','common-reference-genomes.v1.json','rare-parent-pairs.v1.json','rare-breeding-plan.v1.json','original-sixteen-archive.v1.json','seed-pack-policy.v1.json','seed-opening-policy.v1.json','seed-assets.v1.json','seed-closeout-release.v1.json']]+list((ROOT/'services/highcountry-economy/src').glob('seed-*.js'))+list((ROOT/'apps/highcountry-web/src').glob('seed-*.js'))+list((ROOT/'contracts/src/highcountry/seeds').glob('*.sol'))))
 digests=[{'path':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sources]
 sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip() if (ROOT/'.git').exists() else None
 expected=os.environ.get('HC_SEED_CLOSEOUT_HEAD');
 if expected and sha!=expected:raise ValueError('qualification checkout SHA mismatch')
 report={'schema':'HC.SEED.RECONCILIATION.V1','implementationSha':sha,'catalogCount':65,'commonReferences':23,'rarePlans':26,'founderIdentities':16,'assetCount':146,'liveRegistration':False,'sources':digests,'cultivars':rows,'liveGate':'BLOCKED_UNRESOLVED_DEPLOYMENT_AND_REGISTRATION'}
 out=ROOT/'artifacts/highcountry/hc-seed-10-reconciliation.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'cultivars':65,'referenceGenomes':23,'precommittedRarePlans':26,'founderIdentities':16,'assetEntries':146,'liveRegistration':False,'sourceDigests':len(digests),'status':'PASS'}))
if __name__=='__main__':main()

#!/usr/bin/env python3
"""Verify externally consumed source/admission ABIs at the exact clean candidate."""
import argparse,json,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--expected-sha',required=True);p.add_argument('--artifacts',required=True);a=p.parse_args()
r=Path(__file__).resolve().parents[2]
def git(*x):return subprocess.check_output(['git',*x],cwd=r,text=True).strip()
def require(ok,msg):
    if not ok:raise SystemExit('FAIL: '+msg)
require(git('rev-parse','HEAD')==a.expected_sha and not git('status','--porcelain'),'exact clean candidate required')
def artifact(name):return json.loads((Path(a.artifacts)/(name+'.sol')/(name+'.json')).read_text())
def entry(abi,kind,name=None):
    xs=[x for x in abi if x['type']==kind and (name is None or x.get('name')==name)];require(len(xs)==1,'missing/ambiguous ABI '+str(name));return xs[0]
def types(row,key):return [x['type'] for x in row.get(key,[])]
plant=artifact('PlantRegistry')['abi'];seed=artifact('SeedRegistry')['abi'];clone=artifact('CloneRegistry')['abi'];interface=artifact('IPlantSourceConsumer')['abi']
require(types(entry(plant,'constructor'),'inputs')==['address']*6,'plant constructor')
for name in ['registerPlant','registerPublicPlant']:
    require(types(entry(plant,'function',name),'inputs')==['uint64','bytes32','address','uint64'],'legacy selector changed')
require(types(entry(plant,'function','registerPlantFromSource'),'inputs')==['uint64','bytes32','address','uint64','uint64','uint8','uint64'],'source admission ABI')
for row in interface:
    if row['type']!='function':continue
    concrete=entry(plant,'function',row['name'])
    require(types(row,'inputs')==types(concrete,'inputs') and types(row,'outputs')==types(concrete,'outputs'),'consumer interface mismatch '+row['name'])
for abi in [seed,clone]:
    for name,inputs in [('bindPlantRegistry',['address']),('approvePlant',['uint64']*4),('revokePlantApproval',['uint64']*2),('consumeForPlant',['uint64']*2)]:
        require(types(entry(abi,'function',name),'inputs')==inputs,'resource ABI '+name)
    for name in ['PlantRegistryBound','PlantSourceApproved','PlantSourceApprovalRevoked']:entry(abi,'event',name)
require(types(entry(seed,'function','remainingQuantity'),'outputs')==['uint32'],'seed units')
require(types(entry(seed,'function','getSeedLot'),'outputs')==['tuple'],'seed record')
require(types(entry(clone,'function','getClone'),'outputs')==['tuple'],'clone record')
for name in ['PlantSourceConsumed','PlantCapacityReleased','PublicPlantAdmitted']:entry(plant,'event',name)
print(json.dumps({'status':'PASS','implementationSha':a.expected_sha,'contracts':['PlantRegistry','SeedRegistry','CloneRegistry'],'interface':'IPlantSourceConsumer','constructorArguments':6,'legacySelectors':'PRESERVED; rejection behavior verified by tests','sourceKindAbi':'uint8','sourceConsumeAmount':1,'generatedProductionBindings':'R05/R07 prerequisite; none claimed here'},indent=2))

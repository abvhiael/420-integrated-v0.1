#!/usr/bin/env python3
"""Integrity/provenance catalogue, never a chain verifier or transfer authorizer."""
from __future__ import annotations
import argparse,fnmatch,hashlib,json,os,re,shutil,stat,subprocess,sys,tempfile
from pathlib import Path,PurePosixPath
ROOT=Path(__file__).resolve().parents[1]
DEFAULT=ROOT/'evidence/bridge'
REPOSITORY='abvhiael/420-integrated-v0.1'
ORIGINS={'HISTORICAL','DERIVED_HISTORICAL','CONTROLLED','RPC_OBSERVATION','PROVENANCE','EXPECTED_RESULTS','QUALIFICATION_RECORD'}
KINDS={'header','headers','block','blocks','transaction','transactions','signed_transaction','shielded_transaction','receipts','inclusion_proof','auxpow','validator_data','consensus_proof','checkpoint_candidate','negative_vector','controlled_proof','rpc_capture','untrusted_validator_data','runtime_code','issuer_message','issuer_attestation','issuer_protocol_record','issuer_key_observation','protocol_observation','token_state_observation','provenance','expected_results','qualification_record'}
RELATIONS={'UNRELATED','CONTROLLED','NATIVE_ISSUER_PROTOCOL'}
FORBIDDEN_CLAIMS={'complete_420_gateway_authorization','live_route_activation','current_validator_authority','current_canonical_tip','complete_archive_integrity','shielded_note_ownership'}

def require(ok,message):
    if not ok:raise ValueError(message)
def pairs(items):
    result={}
    for k,v in items:
        require(k not in result,'duplicate JSON key: '+k);result[k]=v
    return result
def read_json(path):return json.loads(Path(path).read_text(),object_pairs_hook=pairs)
def sha256(raw):return hashlib.sha256(raw).hexdigest()
def git_oid(raw):return hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
def relative(value):
    require(isinstance(value,str) and value and '\\' not in value and ':' not in value and not any(ord(c)<32 for c in value),'invalid relative path')
    p=PurePosixPath(value);require(not p.is_absolute() and all(x not in ('','..','.') for x in value.split('/')),'unsafe relative path');return p

def artifact_path(root,value):
    relative(value);root=Path(root).resolve();path=root
    for part in value.split('/'):
        path=path/part
        if path.exists() or path.is_symlink():require(not path.is_symlink(),'symlink in evidence path')
    require(path.resolve().is_relative_to(root),'evidence path escaped root');return path

def git(repo,*args):
    return subprocess.check_output(['git','--no-replace-objects','-c','core.hooksPath=/dev/null','-C',str(repo),*args],stderr=subprocess.PIPE)
def source_blob(repo,commit,path):
    require(re.fullmatch('[0-9a-f]{40}',commit) is not None,'unversioned source');relative(path)
    line=git(repo,'ls-tree',commit,'--',path).decode().strip().split('\t')
    require(len(line)==2 and line[1]==path,'source path missing: '+path)
    mode,kind,oid=line[0].split();require(kind=='blob' and mode in ('100644','100755'),'source is not a regular blob')
    raw=git(repo,'cat-file','blob',oid);require(git_oid(raw)==oid,'source Git object mismatch');return raw,oid

def capabilities(origin,kind,relation):
    allowed={'byte_integrity'}
    if origin in {'HISTORICAL','DERIVED_HISTORICAL'}:
        allowed.add('underlying_cryptographic_fixture')
        if kind in {'validator_data','consensus_proof','checkpoint_candidate'}:allowed.add('historical_consensus_data')
        if kind=='issuer_attestation' and relation=='NATIVE_ISSUER_PROTOCOL':allowed.add('issuer_attestation_fixture')
        if kind in {'issuer_message','issuer_protocol_record'} and relation=='NATIVE_ISSUER_PROTOCOL':allowed.add('native_issuer_protocol_fixture')
    if origin=='CONTROLLED':allowed.add('controlled_testing_only')
    if origin=='RPC_OBSERVATION':allowed.add('observation_only')
    if origin=='EXPECTED_RESULTS':allowed.add('retained_expected_results')
    if origin=='QUALIFICATION_RECORD':allowed.add('retained_qualification_record')
    if origin=='PROVENANCE':allowed.add('source_provenance')
    return sorted(allowed)

def source_lock(root):
    spec=read_json(Path(root)/'sources.json');require(spec.get('schema')=='420-bridge-evidence-sources-v1','source schema');require(spec.get('repository')==REPOSITORY,'unexpected source repository')
    require(isinstance(spec.get('datasets'),list) and spec['datasets'],'empty source set');ids=set()
    for d in spec['datasets']:
        require(re.fullmatch('[a-z][a-z0-9-]*',d['id']) is not None and d['id'] not in ids,'duplicate/invalid dataset');ids.add(d['id']);require(re.fullmatch('[0-9a-f]{40}',d['commit']) is not None,'mutable source revision');relative(d['prefix'])
        for rule in d['selection']:
            require(rule['origin'] in ORIGINS and rule['kind'] in KINDS and rule['gateway_relation'] in RELATIONS,'unknown classification')
        require(d['limitations'],'missing scope limitations')
    inventory=spec.get('inventory',[]);require(inventory,'missing source inventory');seen=set()
    for item in inventory:
        key=(item['dataset'],item['path']);require(key not in seen and item['dataset'] in ids,'invalid inventory identity');seen.add(key);relative(item['path']);require(re.fullmatch('[0-9a-f]{40}',item['git_blob_oid']) is not None,'invalid inventory object')
    return spec

def resolved_selections(repo,spec):
    result=[]
    for d in spec['datasets']:
        paths=git(repo,'ls-tree','-r','--name-only',d['commit'],d['prefix']).decode().splitlines();selected={}
        for path in paths:
            sub=path[len(d['prefix'])+1:];matches=[r for r in d['selection'] if fnmatch.fnmatchcase(sub,r['pattern'])]
            require(len(matches)<=1,'ambiguous classification: '+path)
            if matches:selected[path]=dict(matches[0],network=matches[0].get('network',d['network']))
        for field,origin,kind in [('provenance','PROVENANCE','provenance'),('expected','EXPECTED_RESULTS','expected_results'),('qualification','QUALIFICATION_RECORD','qualification_record')]:
            for sub in d[field]:selected[d['prefix']+'/'+sub]={'origin':origin,'kind':kind,'gateway_relation':'UNRELATED','network':d['network']}
        for path in d['extra_records']:selected[path]={'origin':'QUALIFICATION_RECORD','kind':'qualification_record','gateway_relation':'UNRELATED','network':d['network']}
        require(selected,'empty dataset: '+d['id'])
        for path,classification in sorted(selected.items()):result.append((d,path,classification))
    return result

def write_json(path,value):Path(path).write_text(json.dumps(value,indent=2,sort_keys=True)+'\n')
def build(repo,root,recovery_root=None):
    root=Path(root);spec=source_lock(root);records=[];count=0
    for d,path,c in resolved_selections(repo,spec):
        raw,oid=source_blob(repo,d['commit'],path);local='data/'+d['id']+'/'+path;target=artifact_path(root,local);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
        require(not ('controlled' in PurePosixPath(path).name.lower() or PurePosixPath(path).name.startswith('bad-')) or c['origin']=='CONTROLLED','controlled fixture mislabelled historical')
        record={'id':d['id']+':'+path,'dataset':d['id'],'network':c['network'],'kind':c['kind'],'origin':c['origin'],'gateway_relation':c['gateway_relation'],'historical_only':c['origin'] in {'HISTORICAL','DERIVED_HISTORICAL','RPC_OBSERVATION'},'local_path':local,'size_bytes':len(raw),'sha256':sha256(raw),'git_blob_oid':oid,'admissible_claims':capabilities(c['origin'],c['kind'],c['gateway_relation']),'source':{'kind':'PINNED_GIT_BLOB','repository':REPOSITORY,'commit':d['commit'],'path':path,'url':f'https://github.com/{REPOSITORY}/blob/{d["commit"]}/{path}'},'complete_420_gateway_authorization':False}
        records.append(record);count+=1
        if count%40==0:print('Pinned evidence files:',count,flush=True)
    by_id={d['id']:d for d in spec['datasets']}
    for recovery in spec.get('recoveries',[]):
        d=by_id[recovery['dataset']];pin_raw,pin_oid=source_blob(repo,recovery['original_commit'],recovery['checksum_manifest']);pins=json.loads(pin_raw,object_pairs_hook=pairs);name=PurePosixPath(recovery['original_path']).name;require(pins[name]==recovery['expected_sha256'],'recovery pin not in published checksum manifest')
        local='data/'+d['id']+'/recovered/'+name;bundled=artifact_path(root,local)
        if bundled.exists():raw=bundled.read_bytes()
        else:
            require(recovery_root is not None,'original retained log is required for initial recovery');raw=artifact_path(recovery_root,recovery['workspace_relative']).read_bytes()
        require(sha256(raw)==pins[name],'recovered bytes differ from original published checksum');bundled.parent.mkdir(parents=True,exist_ok=True);bundled.write_bytes(raw)
        records.append({'id':d['id']+':recovered:'+recovery['original_path'],'dataset':d['id'],'network':d['network'],'kind':'qualification_record','origin':'QUALIFICATION_RECORD','gateway_relation':'UNRELATED','historical_only':False,'local_path':local,'size_bytes':len(raw),'sha256':sha256(raw),'git_blob_oid':git_oid(raw),'admissible_claims':capabilities('QUALIFICATION_RECORD','qualification_record','UNRELATED'),'source':{'kind':'RECOVERED_ORIGINAL_RECORD','original_commit':recovery['original_commit'],'original_path':recovery['original_path'],'checksum_manifest':recovery['checksum_manifest'],'checksum_manifest_oid':pin_oid,'expected_sha256':pins[name],'original_path_absent_from_published_tree':True,'reason':recovery['reason']},'complete_420_gateway_authorization':False})
    records.sort(key=lambda r:r['id'])
    datasets=[]
    for d in spec['datasets']:
        refs=[r for r in records if r['dataset']==d['id']]
        datasets.append({k:d[k] for k in ['id','commit','pr','network','limitations','original_reproducer','ci_run_ids']}|{'provenance_refs':[r['id'] for r in refs if r['origin']=='PROVENANCE'],'expected_refs':[r['id'] for r in refs if r['origin']=='EXPECTED_RESULTS'],'qualification_refs':[r['id'] for r in refs if r['origin']=='QUALIFICATION_RECORD'],'artifact_count':len(refs),'complete_420_gateway_authorization':False})
    catalogue={'schema':'420-bridge-evidence-catalogue-v1','sources_sha256':sha256((root/'sources.json').read_bytes()),'base_main_sha':spec['base_main_sha'],'catalogued_on':spec['catalogued_on'],'timezone':spec['timezone'],'consensus_test_reruns':0,'production_route_activation':False,'datasets':datasets,'artifacts':records,'identity_checks':derive_identities(root,records),'original_checksum_checks':original_checksums(root,records)}
    write_json(root/'catalogue.json',catalogue);(root/'catalogue.sha256').write_text(sha256((root/'catalogue.json').read_bytes())+'\n');return validate(root)

def by_suffix(records,dataset,suffix):
    matches=[r for r in records if r['dataset']==dataset and r['source'].get('path','').endswith(suffix)];require(len(matches)==1,'ambiguous identity source '+dataset+'/'+suffix);return matches[0]
def derive_identities(root,records):
    checks=[]
    def raw(record):return artifact_path(root,record['local_path']).read_bytes()
    def header(dataset,suffix,offset,expected,encoding='binary'):
        r=by_suffix(records,dataset,suffix);payload=raw(r);payload=bytes.fromhex(payload.decode().strip().removeprefix('0x')) if encoding=='hex' else payload;h=payload[offset:offset+80] if dataset!='pirate' else payload
        require(len(h)>=80,'header truncated');value=hashlib.sha256(hashlib.sha256(h).digest()).digest()[::-1].hex();require(value==expected.removeprefix('0x'),'independent header ID differs from retained expected result')
        checks.append({'kind':'sha256d_header_identity','artifact':r['id'],'offset':offset,'length':len(h),'expected':value,'independent_method':'Python standard-library SHA256d; no bridge verifier or previous test suite executed'})
    btc=json.loads(raw(by_suffix(records,'bitcoin','/manifest.json')));header('bitcoin','/headers.bin',0,btc['genesis']);header('bitcoin','/headers.bin',btc['end']*80,btc['tip'])
    cure=json.loads(raw(by_suffix(records,'curecoin','/historical.json')));header('curecoin','/genesis-header.bin',0,cure['samples']['0']['hash'])
    bob=json.loads(raw(by_suffix(records,'dobbscoin','/historical.json')))
    for sample in bob['samples']:
        h=bytes.fromhex(sample['header']);value=hashlib.sha256(hashlib.sha256(h).digest()).digest()[::-1].hex();require(value==sample['block_hash'],'Dobbscoin sample header ID');checks.append({'kind':'sha256d_json_header_identity','artifact':by_suffix(records,'dobbscoin','/historical.json')['id'],'height':sample['height'],'expected':value})
    pirate=json.loads(raw(by_suffix(records,'pirate','/historical-inclusion.json')));header('pirate','/historical-header.hex',0,pirate['block_hash'],'hex')
    # This expected result explicitly refuses a stronger full-archive provenance claim.
    require(pirate['complete_archive_checksum_verified'] is False,'unexpected Pirate archive provenance claim')
    for r in records:
        if r['kind']=='issuer_message':
            msg=bytes.fromhex(raw(r).decode().strip().removeprefix('0x'));require(len(msg)>=376,'CCTP message too short');checks.append({'kind':'cctp_wire_binding','artifact':r['id'],'source_domain':int.from_bytes(msg[4:8],'big'),'destination_domain':int.from_bytes(msg[8:12],'big'),'nonce':'0x'+msg[12:44].hex(),'recipient':'0x'+msg[184:216].hex(),'amount':int.from_bytes(msg[216:248],'big'),'scope':'Original issuer-signature/native-execution qualification retained; parsing alone grants no authority.'})
    return checks

def original_checksums(root,records):
    """Compare retained artifacts with original manifests without refreshing old evidence."""
    indexed={(r['dataset'],r['source'].get('path')):r for r in records if r['source']['kind']=='PINNED_GIT_BLOB'}
    results=[]
    for manifest in records:
        source=manifest['source'];path=source.get('path','')
        if not PurePosixPath(path).name.startswith('SHA256SUMS'):continue
        raw=artifact_path(root,manifest['local_path']).read_text()
        if path.endswith('.json'):
            pins=json.loads(raw,object_pairs_hook=pairs)
            if not isinstance(pins,dict):continue
            entries=[(name,digest) for name,digest in pins.items() if isinstance(digest,str) and re.fullmatch('[0-9a-f]{64}',digest)]
        else:
            entries=[]
            for line in raw.splitlines():
                match=re.fullmatch(r'([0-9a-f]{64})\s+\*?(.+)',line)
                if match:entries.append((match[2],match[1]))
        for name,digest in entries:
            target=(PurePosixPath(path).parent/name).as_posix()
            record=indexed.get((manifest['dataset'],target)) or indexed.get((manifest['dataset'],name))
            if record:
                results.append({'manifest':manifest['id'],'artifact':record['id'],'expected_sha256':digest,'matches':record['sha256']==digest})
    return results

def expected_classification(spec,record):
    d=next((x for x in spec['datasets'] if x['id']==record['dataset']),None);require(d is not None,'unknown dataset')
    source=record['source']
    require(record['historical_only'] is (record['origin'] in {'HISTORICAL','DERIVED_HISTORICAL','RPC_OBSERVATION'}),'historical classification drift')
    if source['kind']=='RECOVERED_ORIGINAL_RECORD':
        matches=[x for x in spec.get('recoveries',[]) if x['dataset']==d['id'] and x['original_path']==source['original_path']];require(len(matches)==1,'unknown recovery');pin=matches[0];require(record['sha256']==pin['expected_sha256'] and source['expected_sha256']==pin['expected_sha256'] and source['original_commit']==pin['original_commit'],'recovery provenance drift');return d,'QUALIFICATION_RECORD','qualification_record','UNRELATED',d['network']
    matches=[x for x in spec['inventory'] if x['dataset']==d['id'] and x['path']==source.get('path')];require(len(matches)==1 and record['git_blob_oid']==matches[0]['git_blob_oid'],'source object substitution')
    require(record['local_path']=='data/'+d['id']+'/'+source['path'] and record['id']==d['id']+':'+source['path'],'source location substitution')
    require(source['kind']=='PINNED_GIT_BLOB' and source['repository']==REPOSITORY and source['commit']==d['commit'],'source identity drift');path=source['path'];relative(path)
    for field,origin,kind in [('provenance','PROVENANCE','provenance'),('expected','EXPECTED_RESULTS','expected_results'),('qualification','QUALIFICATION_RECORD','qualification_record')]:
        if path in [d['prefix']+'/'+p for p in d[field]]:return d,origin,kind,'UNRELATED',d['network']
    if path in d['extra_records']:return d,'QUALIFICATION_RECORD','qualification_record','UNRELATED',d['network']
    require(path.startswith(d['prefix']+'/'),'source prefix substitution');sub=path[len(d['prefix'])+1:];matches=[x for x in d['selection'] if fnmatch.fnmatchcase(sub,x['pattern'])];require(len(matches)==1,'unclassified source artifact');c=matches[0];return d,c['origin'],c['kind'],c['gateway_relation'],c.get('network',d['network'])

def validate_claim(record,claim):
    require(claim not in FORBIDDEN_CLAIMS,'evidence cannot establish '+claim)
    allowed=capabilities(record['origin'],record['kind'],record['gateway_relation']);require(claim in allowed and claim in record['admissible_claims'],'claim exceeds evidence scope');return True

def validate(root=DEFAULT):
    root=Path(root);spec=source_lock(root);catalogue=read_json(root/'catalogue.json');require(catalogue.get('schema')=='420-bridge-evidence-catalogue-v1','catalogue schema');require(sha256((root/'catalogue.json').read_bytes())==(root/'catalogue.sha256').read_text().strip(),'catalogue digest mismatch');require(catalogue['sources_sha256']==sha256((root/'sources.json').read_bytes()),'source lock drift');require(catalogue['production_route_activation'] is False and catalogue['consensus_test_reruns']==0,'unauthorized activation or test evidence claim')
    require(catalogue['base_main_sha']==spec['base_main_sha'] and catalogue['catalogued_on']==spec['catalogued_on'] and catalogue['timezone']==spec['timezone'],'catalogue provenance drift')
    require({d['id'] for d in catalogue['datasets']}=={d['id'] for d in spec['datasets']} and len(catalogue['datasets'])==len(spec['datasets']),'dataset inventory mismatch')
    actual={(r['dataset'],r['source'].get('path')) for r in catalogue['artifacts'] if r['source']['kind']=='PINNED_GIT_BLOB'};require(actual=={(x['dataset'],x['path']) for x in spec['inventory']},'source inventory incomplete')
    recoveries={(r['dataset'],r['source'].get('original_path')) for r in catalogue['artifacts'] if r['source']['kind']=='RECOVERED_ORIGINAL_RECORD'};require(recoveries=={(x['dataset'],x['original_path']) for x in spec.get('recoveries',[])},'recovered inventory incomplete')
    ids=set();paths=set();counts={};total=0
    require(isinstance(catalogue.get('artifacts'),list) and catalogue['artifacts'],'empty evidence catalogue')
    for r in catalogue['artifacts']:
        require(r['id'] not in ids and r['local_path'] not in paths,'duplicate evidence identity');ids.add(r['id']);paths.add(r['local_path']);require(r['origin'] in ORIGINS and r['kind'] in KINDS and r['gateway_relation'] in RELATIONS,'unknown evidence classification')
        d,origin,kind,relation,network=expected_classification(spec,r);require((r['origin'],r['kind'],r['gateway_relation'],r['network'])==(origin,kind,relation,network),'source classification escalation');require(r['admissible_claims']==capabilities(origin,kind,relation),'capability escalation');require(r['complete_420_gateway_authorization'] is False,'gateway authorization escalation')
        path=artifact_path(root,r['local_path']);require(path.exists() and stat.S_ISREG(path.stat().st_mode),'missing regular evidence file');payload=path.read_bytes();require(type(r['size_bytes']) is int and r['size_bytes']==len(payload),'evidence size mismatch');require(sha256(payload)==r['sha256'] and git_oid(payload)==r['git_blob_oid'],'evidence checksum mismatch')
        if r['source']['kind']=='RECOVERED_ORIGINAL_RECORD':
            pins=[x for x in catalogue['artifacts'] if x['source'].get('path')==r['source']['checksum_manifest'] and x['source'].get('commit')==r['source']['original_commit']];require(len(pins)==1,'missing original published recovery pin');manifest=read_json(artifact_path(root,pins[0]['local_path']));require(manifest[PurePosixPath(r['source']['original_path']).name]==r['sha256'],'recovery not bound to original published digest')
        counts[origin]=counts.get(origin,0)+1;total+=len(payload)
    for d in catalogue['datasets']:
        locked=next(x for x in spec['datasets'] if x['id']==d['id']);require(all(d[k]==locked[k] for k in ['commit','pr','network','limitations','original_reproducer','ci_run_ids']),'dataset scope or original evidence drift')
        require(d['complete_420_gateway_authorization'] is False and d['limitations'],'missing dataset scope boundary')
        group=[r for r in catalogue['artifacts'] if r['dataset']==d['id']];require(len(group)==d['artifact_count'],'dataset count mismatch')
        for key,origin in [('provenance_refs','PROVENANCE'),('expected_refs','EXPECTED_RESULTS'),('qualification_refs','QUALIFICATION_RECORD')]:
            require(set(d[key])=={r['id'] for r in group if r['origin']==origin},'cross-dataset or missing evidence linkage')
        require(d['provenance_refs'] or d['qualification_refs'],'dataset without provenance')
    require(catalogue['original_checksum_checks']==original_checksums(root,catalogue['artifacts']),'original checksum qualification drift')
    require(catalogue['identity_checks']==derive_identities(root,catalogue['artifacts']),'independent expected identities drift')
    # Unlisted payloads must not silently enter a qualification package.
    found={p.relative_to(root).as_posix() for p in (root/'data').rglob('*') if p.is_file() or p.is_symlink()};require(found==paths,'unlisted or missing evidence payload')
    return {'pass':True,'datasets':len(catalogue['datasets']),'artifacts':len(ids),'bytes':total,'origins':counts,'independent_identity_checks':len(catalogue['identity_checks']),'original_checksum_checks':len(catalogue['original_checksum_checks']),'original_checksum_conflicts':sum(not x['matches'] for x in catalogue['original_checksum_checks']),'recovered_original_logs':sum(r['source']['kind']=='RECOVERED_ORIGINAL_RECORD' for r in catalogue['artifacts']),'complete_420_gateway_authorizations':0,'consensus_test_suites_rerun':0,'catalogue_sha256':sha256((root/'catalogue.json').read_bytes())}

def materialize(root,destination,repository=None):
    validate(root);root=Path(root);destination=Path(destination);destination.mkdir(parents=True,exist_ok=True);require(not destination.is_symlink(),'destination symlink');catalogue=read_json(root/'catalogue.json')
    for filename in ['sources.json','catalogue.json','catalogue.sha256']:
        target=artifact_path(destination,filename);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((root/filename).read_bytes())
    for r in catalogue['artifacts']:
        if repository and r['source']['kind']=='PINNED_GIT_BLOB':payload,oid=source_blob(repository,r['source']['commit'],r['source']['path']);require(oid==r['git_blob_oid'],'reacquisition Git object changed')
        else:payload=artifact_path(root,r['local_path']).read_bytes()
        require(sha256(payload)==r['sha256'],'reacquisition SHA256 changed');target=artifact_path(destination,r['local_path']);target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(payload)
    return validate(destination)

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('command',choices=['build','verify','materialize','claim']);p.add_argument('--root',type=Path,default=DEFAULT);p.add_argument('--repository',type=Path);p.add_argument('--recovery-root',type=Path);p.add_argument('--destination',type=Path);p.add_argument('--artifact');p.add_argument('--capability');args=p.parse_args()
    try:
        if args.command=='build':require(args.repository is not None,'build needs a pinned source Git repository');result=build(args.repository,args.root,args.recovery_root)
        elif args.command=='verify':result=validate(args.root)
        elif args.command=='materialize':require(args.destination is not None,'destination required');result=materialize(args.root,args.destination,args.repository)
        else:
            validate(args.root);records=read_json(args.root/'catalogue.json')['artifacts'];record=next((r for r in records if r['id']==args.artifact),None);require(record is not None,'unknown artifact');validate_claim(record,args.capability);result={'pass':True,'artifact':record['id'],'permitted_capability':args.capability,'production_authorization':False}
        print(json.dumps(result,indent=2,sort_keys=True))
    except (ValueError,OSError,KeyError,TypeError,subprocess.CalledProcessError) as exc:
        print(json.dumps({'pass':False,'error':str(exc)},sort_keys=True),file=sys.stderr);raise SystemExit(2)
if __name__=='__main__':main()

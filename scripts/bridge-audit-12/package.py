#!/usr/bin/env python3
"""Deterministic Bridge compiler inventory and unsigned deployment preparation.
No signer, network connection, approval or route activation is performed here.
"""
import argparse, hashlib, json, re, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
CORE = ['VerifiedGateway420','BridgeVerifierRegistry420','BridgeChainRegistry420','BridgeAssetRegistry','BridgeRouteRegistry','BridgeRiskManager','BridgeTransferRegistry','BridgeAccountingRegistry','GatewayRouter420','CADCBridgeIntegration','BridgeValueCustody420']
LEGACY = {'ETHProofAdapter','BTCLightClientAdapter'}
REGISTRY = '0x0000000000000000000000000000000000000434'
GATEWAY = '0x0000000000000000000000000000000000000438'
CONFIG_HASH = '0xa3d526cc61fa265507d4e44da7c1b07a42ffd3fc308a167692c5dba6505ae07d'
def commitment():
    from eth_hash.auto import keccak
    obj=json.loads((ROOT/'contracts/config/genesis-config-commitment.json').read_text())
    assert obj['status']=='FROZEN_V2', 'noncanonical commitment version'
    assert obj['commitmentPayload']['domain']=='420/GENESIS/CONFIG/V2', 'noncanonical commitment domain'
    payload=json.dumps(obj['commitmentPayload'],sort_keys=True,separators=(',',':')).encode()
    assert obj['genesisConfigHash']==CONFIG_HASH=='0x'+keccak(payload).hex(), 'frozen configuration commitment'
    drift=[]
    for entry in obj['commitmentPayload']['authorityInputs']:
        actual=subprocess.check_output(['git','hash-object',entry['path']],cwd=ROOT,text=True).strip()
        if actual!=entry['gitBlobSha1']:drift.append({'path':entry['path'],'frozen_blob':entry['gitBlobSha1'],'current_blob':actual})
    return obj,drift
def dump(value): return json.dumps(value, sort_keys=True, indent=2)+'\n'
def sha(data): return hashlib.sha256(data).hexdigest()
def write(path, value): path.parent.mkdir(parents=True, exist_ok=True); path.write_text(dump(value))
def closure(paths):
    sources = {}
    pending = list(paths)
    while pending:
        f = pending.pop().resolve(); rel = str(f.relative_to(ROOT))
        if rel in sources: continue
        content = f.read_text(); sources[rel] = {'content': content}
        for dep in re.findall(r'(?:from\s+|import\s+)["\x27]([^"\x27]+)["\x27]', content): pending.append(f.parent/dep)
    return dict(sorted(sources.items()))
def namespace():
    assignments = json.loads((ROOT/'contracts/config/system-addresses.json').read_text())['assignments']
    frozen = {x['name']:x['address'].lower() for x in assignments}
    anchors = json.loads((ROOT/'contracts/config/genesis-canonical-addresses.json').read_text())['anchors']
    for a in anchors:
        if a['contract'] in ['ProtocolRegistry.sol','VerifiedGateway420.sol']:
            assert frozen[a['contract'][:-4]] == a['address'].lower(), 'conflicting frozen address'
    assert frozen['ProtocolRegistry'] == REGISTRY and frozen['VerifiedGateway420'] == GATEWAY
    return frozen

def build(solc, output):
    frozen = namespace()
    paths = sorted((ROOT/'contracts/src/bridge').rglob('*.sol')) + [ROOT/'contracts/src/apps/ProtocolRegistry.sol']
    sources = closure(paths)
    settings = {'evmVersion':'cancun','optimizer':{'enabled':True,'runs':200},'viaIR':True,'outputSelection':{'*':{'*':['abi','storageLayout','evm.bytecode','evm.deployedBytecode']}}}
    request = {'language':'Solidity','sources':sources,'settings':settings}
    version = subprocess.check_output([solc,'--version'],text=True)
    assert '0.8.24+commit.e11b9ed9' in version, 'wrong compiler'
    result = subprocess.run([solc,'--standard-json'],input=json.dumps(request),text=True,capture_output=True,check=True)
    response = json.loads(result.stdout)
    errors = [e for e in response.get('errors',[]) if e['severity']=='error']; assert not errors, errors
    output.mkdir(parents=True,exist_ok=True)
    write(output/'compiler-input.json',request)
    inventory = []
    for path, contracts in sorted(response['contracts'].items()):
        if not (path.startswith('contracts/src/bridge/') or path=='contracts/src/apps/ProtocolRegistry.sol'): continue
        for name, artifact in sorted(contracts.items()):
            bytecode = artifact['evm']['bytecode']; runtime = artifact['evm']['deployedBytecode']; code = runtime['object']
            constructor = next((a['inputs'] for a in artifact['abi'] if a['type']=='constructor'),[])
            classification = 'legacy_disabled' if name in LEGACY else 'core' if name in CORE else 'dependency_registry' if name=='ProtocolRegistry' else 'candidate'
            if not bytecode['object']: classification = 'interface_or_abstract'
            record = {'name':name,'source':path,'classification':classification,'frozen_address':frozen.get(name),'constructor':constructor,'runtime_bytes':len(code)//2,'artifact_sha256':sha(dump(artifact).encode())}
            assert record['runtime_bytes']<=24576, (name,'EIP-170',record['runtime_bytes'])
            assert not bytecode['linkReferences'] and not runtime['linkReferences'], (name,'unlinked library')
            write(output/'artifacts'/f'{name}.json',artifact); inventory.append(record)
    profiles = {}
    for f in sorted((ROOT/'contracts/config/bridge').rglob('*.json')):
        profiles[str(f.relative_to(ROOT))] = {'sha256':sha(f.read_bytes()),'configuration':json.loads(f.read_text())}
    write(output/'configuration.json',profiles)
    manifest = {'schema':'420-bridge-deployment-package-v1','baseline_main':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'compiler':version.strip(),'compiler_binary_sha256':sha(Path(solc).read_bytes()),'compiler_input_sha256':sha(dump(request).encode()),'settings':settings,'sources':{k:sha(v['content'].encode()) for k,v in sources.items()},'contracts':inventory,'configuration_sha256':sha(dump(profiles).encode()),'production_approvals':[],'route_activation':False,'frozen_gateway_strategy':'constructor execution followed by exact runtime/storage genesis materialization; never CREATE at reserved address','nonpredeploy_strategy':'unsigned CREATE transactions with explicit signer and nonce; registry resolved, candidate reservations are not fixed addresses'}
    write(output/'manifest.json',manifest)
    print(json.dumps({'pass':True,'source_closure':len(sources),'artifacts':len(inventory),'deployable':sum(x['classification']!='interface_or_abstract' for x in inventory),'max_runtime':max(x['runtime_bytes'] for x in inventory)}))

def abi_type(item):
    t=item['type']
    return '('+','.join(abi_type(x) for x in item['components'])+')'+t[5:] if t.startswith('tuple') else t

def make_plan(package, inputs):
    from eth_abi import encode
    from eth_hash.auto import keccak
    manifest=json.loads((package/'manifest.json').read_text())
    # Pin every package file before deriving any transaction from it.
    assert sha((package/'compiler-input.json').read_bytes())==manifest['compiler_input_sha256'], 'compiler input drift'
    assert sha((package/'configuration.json').read_bytes())==manifest['configuration_sha256'], 'configuration drift'
    records={x['name']:x for x in manifest['contracts']}
    assert inputs['registry'].lower()==REGISTRY, 'noncanonical Registry'
    assert re.fullmatch('0x[0-9a-fA-F]{40}',inputs['governance']) and int(inputs['governance'],16), 'governance'
    assert re.fullmatch('0x[0-9a-fA-F]{64}',inputs['genesis_config_hash']) and int(inputs['genesis_config_hash'],16), 'genesis commitment'
    assert type(inputs['chain_id']) is int and inputs['chain_id']>0, 'chain id'
    assert re.fullmatch('0x[0-9a-fA-F]{40}',inputs['deployer']) and int(inputs['deployer'],16), 'deployer'
    assert type(inputs['start_nonce']) is int and inputs['start_nonce']>=0, 'nonce'
    if inputs.get('environment')=='local_rehearsal':
        assert inputs['chain_id']==31337, 'controlled local chain id'
    else:
        assert inputs['governance'].lower()==namespace()['GovernanceTimelock'], 'noncanonical governance timelock'
        frozen,drift=commitment()
        assert inputs['genesis_config_hash']==frozen['genesisConfigHash'], 'noncanonical Genesis commitment'
        assert not drift, 'frozen authority drift: '+','.join(x['path'] for x in drift)
    for path, expected in manifest['sources'].items():
        assert sha((ROOT/path).read_bytes())==expected, 'source drift: '+path
    steps=[];nonce=inputs['start_nonce'];seen=set()
    component_keys=['VERIFIED_GATEWAY','VERIFIER_REGISTRY','CHAIN_REGISTRY','ASSET_REGISTRY','ROUTE_REGISTRY','RISK_MANAGER','TRANSFER_REGISTRY','ACCOUNTING_REGISTRY','GATEWAY_ROUTER','CADC_INTEGRATION','VALUE_CUSTODY']
    component_ids={name:keccak(('420/APP/420BRIDGE/'+key).encode()) for name,key in zip(CORE,component_keys)}
    def create_address(sender, n):
        raw=b'' if n==0 else n.to_bytes((n.bit_length()+7)//8,'big')
        encoded=raw if len(raw)==1 and raw[0]<128 else bytes([128+len(raw)])+raw
        payload=b'\x94'+bytes.fromhex(sender[2:])+encoded
        return '0x'+keccak(bytes([192+len(payload)])+payload)[-20:].hex()
    for entry in inputs['contracts']:
        name=entry['name']; r=records[name]
        assert name not in seen, 'duplicate deployment';seen.add(name)
        assert r['classification'] not in ['legacy_disabled','interface_or_abstract','dependency_registry'], 'ineligible deployment'
        assert name!='BridgeValueCustody420' or ('BridgeVerifierRegistry420' in seen or inputs.get('existing_qualification_registry')), 'custody requires published qualification registry'
        artifact=json.loads((package/'artifacts'/f'{name}.json').read_text());assert sha(dump(artifact).encode())==r['artifact_sha256'],'artifact drift'
        args=entry['args'];types=[abi_type(i) for i in r['constructor']]
        assert len(args)==len(types), 'constructor arity'
        for item,value in zip(r['constructor'],args):
            n=item['name'].lower()
            if n in ['registry_','registry']: assert value.lower()==REGISTRY,'constructor Registry'
            if n in ['gov','governance','timelock_','governance_','governancetimelock_']: assert value.lower()==inputs['governance'].lower(),'constructor governance'
            if n in ['genesisconfighash_','config']: assert value.lower()==inputs['genesis_config_hash'].lower(),'constructor configuration'
        def convert(item,value):
            t=item['type']
            if t.endswith(']'):
                base=t[:t.rindex('[')];child=dict(item,type=base)
                return [convert(child,v) for v in value]
            if t=='tuple':return tuple(convert(child,v) for child,v in zip(item['components'],value))
            return bytes.fromhex(value[2:]) if t.startswith('bytes') and isinstance(value,str) else value
        converted=[convert(item,value) for item,value in zip(r['constructor'],args)]
        data='0x'+artifact['evm']['bytecode']['object']+encode(types,converted).hex()
        frozen=r['frozen_address']
        assert not frozen or name=='VerifiedGateway420', 'foreign predeploy'
        if frozen:
            assert args[-1]=='0x'+'00'*20, 'frozen gateway must start disabled'
        target=frozen or create_address(inputs['deployer'],nonce)
        step={'name':name,'source':r['source'],'mode':'genesis_constructor_materialization' if frozen else 'create','address':target,'constructor_args':args,'artifact_sha256':r['artifact_sha256']}
        if frozen:step['genesis_initcode']=data
        else:
            step['transaction']={'chainId':inputs['chain_id'],'from':inputs['deployer'],'nonce':nonce,'value':0,'data':data};nonce+=1
        if name in component_ids:
            step['publication_transaction']={'chainId':inputs['chain_id'],'from':inputs['governance'],'to':REGISTRY,'value':0,'data':'0x'+(keccak(b'registerComponent(bytes32,address,(uint16,uint16,uint16),uint8)')[:4]+encode(['bytes32','address','(uint16,uint16,uint16)','uint8'],[component_ids[name],target,(1,0,0),2])).hex()}
            # GovernanceTimelock executes these calls through the existing ceremony. Only
            # a controlled local EOA rehearsal shares the deployer nonce stream.
            if inputs.get('environment')=='local_rehearsal':step['publication_transaction']['nonce']=nonce;nonce+=1
        steps.append(step)
    return {'schema':'420-bridge-unsigned-deployment-plan-v1','package_manifest_sha256':sha((package/'manifest.json').read_bytes()),'parameters':inputs,'steps':steps,'production_approvals':[],'routes_active':False,'registry_publication':'Governance registerComponent(componentId,address,protocolVersion,ACTIVE); publication alone does not authorize route execution'}

def main():
    p=argparse.ArgumentParser();sub=p.add_subparsers(dest='command',required=True)
    b=sub.add_parser('build');b.add_argument('--solc',required=True);b.add_argument('--output',type=Path,required=True)
    b=sub.add_parser('plan');b.add_argument('--package',type=Path,required=True);b.add_argument('--parameters',type=Path,required=True);b.add_argument('--output',type=Path,required=True)
    a=p.parse_args()
    if a.command=='build':build(a.solc,a.output)
    else:write(a.output,make_plan(a.package,json.loads(a.parameters.read_text())))
if __name__=='__main__':main()

#!/usr/bin/env python3
"""Chain-bound HC-SEED-04 lifecycle. External signer RPC; no keys or entropy injection."""
import argparse
import json
import os
from pathlib import Path
import time
import urllib.request
import common_reference_genomes as g
import rare_genome_lifecycle as r

NAMES=['GenomeRegistry','GenesisRegistry','HighCountryAuthorization','BreedingEngine','CanonicalBreedingRandomnessAdapter','RandomnessRouter420','EmergencyState']
ZERO='0x'+'0'*64

def address(value):
    if not isinstance(value,str) or len(value)!=42 or not value.startswith('0x') or int(value[2:],16)==0:raise ValueError('nonzero address required')
    return value.lower()

def aword(value):return bytes.fromhex(address(value)[2:]).rjust(32,b'\0')
def hword(value):return r.raw(value)
def selector(signature):return bytes.fromhex(g.k(signature.encode())[2:10])
def calldata(signature,words=()):return '0x'+(selector(signature)+b''.join(words)).hex()
def words(result):
    data=bytes.fromhex(result[2:])
    if len(data)%32:raise ValueError('malformed ABI result')
    return [data[i:i+32] for i in range(0,len(data),32)]
def hx(word):return '0x'+word.hex()
def integer(word):return int.from_bytes(word,'big')
def decoded_address(word):return address('0x'+word[-20:].hex())

def validate_runtime(config):
    if config.get('schema')!='HC.SEED.REGISTRATION_RUNTIME.V1' or config.get('state')!='APPROVED_DEPLOYMENT':raise ValueError('live registration blocked: deployment is unresolved/unapproved')
    if type(config.get('chainId')) is not int or config['chainId']<=0:raise ValueError('chain ID unresolved')
    address(config['operator']);r.raw(config['profileId'])
    if config['profileId']==ZERO or type(config.get('confirmations')) is not int or config['confirmations']<2:raise ValueError('profile/finality policy')
    policy=config.get('randomnessPolicy',{})
    if policy.get('minimumSecurityTier') not in [2,3] or not policy.get('approvedRoutes'):raise ValueError('approved proof-verified randomness routes required')
    for route in policy['approvedRoutes']:
        for field in ['routeId','verifierCodeHash','methodId']:r.raw(route[field])
        address(route['operator']);address(route['verifier'])
        if route['verifierCodeHash']==ZERO:raise ValueError('verifier code unresolved')
    seen=set()
    for name in NAMES:
        item=config['contracts'][name];a=address(item['address']);r.raw(item['codeHash'])
        if item['codeHash']==ZERO or a in seen:raise ValueError('contract code binding')
        seen.add(a)
    return config

class Rpc:
    def __init__(self,url):self.url=url
    def __call__(self,method,params):
        req=urllib.request.Request(self.url,data=json.dumps({'jsonrpc':'2.0','id':1,'method':method,'params':params}).encode(),headers={'Content-Type':'application/json'})
        with urllib.request.urlopen(req,timeout=30) as response:result=json.load(response)
        if 'error' in result:raise RuntimeError(str(result['error']))
        return result['result']

class Lifecycle:
    def __init__(self,config,rpc,commons,plan,journal):
        self.config=validate_runtime(config);self.rpc=rpc;self.commons=commons;self.plan=plan;self.journal=Path(journal)
        self.contracts={n:address(config['contracts'][n]['address']) for n in NAMES};self.operator=address(config['operator']);self.block=None
        self.records={'schema':'HC.SEED.REGISTRATION_JOURNAL.V1','chainId':config['chainId'],'runtimeHash':g.commit(config),'planHash':g.commit(plan),'transactions':[]}
        if self.journal.exists():
            previous=json.loads(self.journal.read_text())
            if any(previous.get(k)!=self.records[k] for k in ['schema','chainId','runtimeHash','planHash']):raise ValueError('journal deployment mismatch')
            self.records=previous
    def call(self,name,signature,args=()):
        return words(self.rpc('eth_call',[{'to':self.contracts[name],'data':calldata(signature,args)},self.block or 'latest']))
    def same_address(self,name,signature,expected):
        if decoded_address(self.call(name,signature)[0])!=self.contracts[expected]:raise ValueError('contract dependency mismatch: '+name+'.'+signature)
    def preflight(self):
        if int(self.rpc('eth_chainId',[]),16)!=self.config['chainId']:raise ValueError('wrong chain')
        head=int(self.rpc('eth_blockNumber',[]),16);self.block=hex(max(0,head-self.config['confirmations']+1))
        for name,item in self.config['contracts'].items():
            if name not in NAMES:continue
            code=self.rpc('eth_getCode',[item['address'],self.block])
            if code=='0x' or g.k(bytes.fromhex(code[2:]))!=item['codeHash']:raise ValueError('untrusted code: '+name)
        if integer(self.call('GenesisRegistry','finalized()')[0])!=1:raise ValueError('Genesis not finalized')
        for name in ['GenomeRegistry','GenesisRegistry','BreedingEngine','CanonicalBreedingRandomnessAdapter','EmergencyState']:
            self.same_address(name,'authorization()','HighCountryAuthorization')
        for signature,target in [('genesisRegistry()','GenesisRegistry')]:self.same_address('GenomeRegistry',signature,target)
        for signature,target in [('genomeRegistry()','GenomeRegistry'),('randomness()','CanonicalBreedingRandomnessAdapter'),('emergencyState()','EmergencyState')]:self.same_address('BreedingEngine',signature,target)
        self.same_address('CanonicalBreedingRandomnessAdapter','router()','RandomnessRouter420')
        self.same_address('CanonicalBreedingRandomnessAdapter','breedingEngine()','BreedingEngine')
        if hx(self.call('CanonicalBreedingRandomnessAdapter','profileId()')[0])!=self.config['profileId']:raise ValueError('profile mismatch')
        self.block=None
    def authorized(self,principal,module,action,scope):
        result=self.call('HighCountryAuthorization','isAuthorized((address,bytes32,bytes32,bytes32,uint256))',[aword(principal),hword(g.k(('HC.MODULE.'+module).encode())),hword(g.k(('HC.ACTION.'+action).encode())),hword(scope),r.word(0)])
        if not result or integer(result[0])!=1:raise ValueError('missing exact capability: '+action)
    def genome(self,gid):
        if integer(self.call('GenomeRegistry','exists(bytes32)',[hword(gid)])[0])==0:return None
        out=self.call('GenomeRegistry','getGenome(bytes32)',[hword(gid)])
        if len(out)!=33:raise ValueError('genome ABI')
        return {'genomeId':hx(out[0]),'lineId':hx(out[1]),'metadataHash':hx(out[2]),'loci':[hx(x) for x in out[3:31]],'founding':bool(integer(out[31])),'exists':bool(integer(out[32]))}
    def receipt(self,tx_hash):
        receipt=self.rpc('eth_getTransactionReceipt',[tx_hash])
        if receipt is None:return None
        if int(receipt['status'],16)!=1:raise ValueError('transaction reverted')
        block=self.rpc('eth_getBlockByNumber',[receipt['blockNumber'],False])
        if block['hash']!=receipt['blockHash']:raise ValueError('receipt reorganized')
        head=int(self.rpc('eth_blockNumber',[]),16)
        if head-int(receipt['blockNumber'],16)+1<self.config['confirmations']:return None
        return receipt
    def persist(self):
        self.journal.parent.mkdir(parents=True,exist_ok=True)
        temp=self.journal.with_suffix(self.journal.suffix+'.tmp');temp.write_text(json.dumps(self.records,indent=2)+'\n');temp.replace(self.journal)
    def send(self,name,signature,args,send=False,timeout=180):
        tx={'from':self.operator,'to':self.contracts[name],'data':calldata(signature,args),'value':'0x0'}
        if not send:return {'unsignedTransaction':tx}
        existing=next((e for e in self.records['transactions'] if e['transaction']==tx),None)
        if existing is None:
            self.rpc('eth_call',[tx,'latest'])
            tx_hash=self.rpc('eth_sendTransaction',[tx])
            existing={'transaction':tx,'transactionHash':tx_hash,'receipt':None}
            self.records['transactions'].append(existing);self.persist()
        deadline=time.monotonic()+timeout
        while time.monotonic()<deadline:
            got=self.receipt(existing['transactionHash'])
            if got:
                actual=self.rpc('eth_getTransactionByHash',[existing['transactionHash']])
                if address(actual['from'])!=self.operator or address(actual['to'])!=tx['to'] or actual['input'].lower()!=tx['data'].lower():raise ValueError('transaction calldata mismatch')
                existing['receipt']=got;self.persist();return existing
            time.sleep(2)
        raise TimeoutError('transaction pending; resume from journal without reroll')
    def verified_common(self,e):
        stored=self.genome(e['genomeId'])
        if stored is None or any(stored[k]!=e[k] for k in ['genomeId','lineId','metadataHash','loci','founding']):raise ValueError('common on-chain mismatch or missing')
        return stored
    def common(self,e,send=False):
        stored=self.genome(e['genomeId'])
        if stored:
            if any(stored[k]!=e[k] for k in ['genomeId','lineId','metadataHash','loci','founding']):raise ValueError('common on-chain mismatch')
            return {'status':'verified-existing-common','genomeId':e['genomeId']}
        self.authorized(self.operator,'GENOME_REGISTRY','GENOME_REGISTRY.REGISTER',e['genomeId'])
        out=self.send('GenomeRegistry','registerGenome(bytes32,bytes32,bytes32,bytes32[28])',[hword(e['genomeId']),hword(e['lineId']),hword(e['metadataHash']),*[hword(x) for x in e['loci']]],send)
        if send and self.genome(e['genomeId']) is None:raise ValueError('missing registered common')
        return out
    def event(self,e):
        # Unknown events revert. Do not convert a transport error into an absence.
        out=self.call('BreedingEngine','getBreedingEvent(uint64)',[r.word(e['breedingEventId'])])
        if len(out)!=11:raise ValueError('breeding ABI')
        expected=[e['breedingEventId'],e['parentAGenomeId'],e['parentBGenomeId'],e['childGenomeId'],e['childLineId'],e['metadataHash'],e['contextHash'],e['localRequestId']]
        for i,value in enumerate(expected):
            if (integer(out[i]) if i==0 else hx(out[i]))!=value:raise ValueError('breeding event mismatch')
        if integer(out[10])!=1:raise ValueError('event missing')
        return {'entropy':hx(out[8]),'finalized':integer(out[9])==1}
    def request(self,e,send=False):
        for key in ['parentAGenomeId','parentBGenomeId']:
            reference=next(x for x in self.commons['genomes'] if x['genomeId']==e[key])
            existing=self.genome(e[key])
            if existing is None or any(existing[k]!=reference[k] for k in ['genomeId','lineId','metadataHash','loci','founding']):raise ValueError('parent not registered exactly')
        if integer(self.call('BreedingEngine','cancelled(uint64)',[r.word(e['breedingEventId'])])[0]):raise ValueError('cancelled plan cannot reroll; explicit new catalog version required')
        pending=integer(self.call('BreedingEngine','pendingChildOwner(bytes32)',[hword(e['childGenomeId'])])[0])
        if pending==e['breedingEventId']:return {'status':'verified-existing-request',**self.event(e)}
        if pending!=0:raise ValueError('child already reserved by another event')
        if self.genome(e['childGenomeId']):return {'status':'verified-existing-child',**self.audit(e)}
        scope='0x'+r.word(e['breedingEventId']).hex()
        self.authorized(self.operator,'BREEDING_ENGINE','BREEDING_ENGINE.REQUEST',scope)
        self.authorized(self.contracts['BreedingEngine'],'GENOME_REGISTRY','GENOME_REGISTRY.REGISTER',e['childGenomeId'])
        return self.send('BreedingEngine','requestBreeding(uint64,bytes32,bytes32,bytes32,bytes32,bytes32)',[r.word(e['breedingEventId']),*[hword(e[k]) for k in ['parentAGenomeId','parentBGenomeId','childGenomeId','childLineId','metadataHash']]],send)
    def randomness(self,e):
        p=self.call('CanonicalBreedingRandomnessAdapter','pending(bytes32)',[hword(e['localRequestId'])])
        if len(p)!=5 or hx(p[0])==ZERO or hx(p[1])!=r.DOMAIN or hx(p[2])!=e['contextHash'] or integer(p[3])!=0:raise ValueError('adapter provenance')
        canonical=hx(p[0]);bound=self.call('RandomnessRouter420','request(bytes32)',[hword(canonical)])
        if len(bound)!=21 or decoded_address(bound[0])!=self.contracts['CanonicalBreedingRandomnessAdapter'] or hx(bound[1])!=self.config['profileId'] or hx(bound[3])!=r.DOMAIN or hx(bound[4])!=e['contextHash'] or integer(bound[20])!=3:raise ValueError('canonical randomness not fulfilled/bound')
        minimum=self.config['randomnessPolicy']['minimumSecurityTier']
        if integer(bound[18])<minimum:raise ValueError('randomness security tier')
        registry=decoded_address(self.call('RandomnessRouter420','randomnessRegistry()')[0])
        record=words(self.rpc('eth_call',[{'to':registry,'data':calldata('record(bytes32)',[hword(canonical)])},self.block or 'latest']))
        if len(record)!=8 or integer(record[6])!=1 or integer(record[7])!=1:raise ValueError('canonical randomness record missing')
        route_id=hx(record[3]);approved=next((x for x in self.config['randomnessPolicy']['approvedRoutes'] if x['routeId']==route_id),None)
        if approved is None:raise ValueError('unapproved randomness route')
        if route_id==hx(bound[5]):operator,verifier,method=bound[9],bound[11],bound[13]
        elif route_id==hx(bound[6]):operator,verifier,method=bound[10],bound[12],bound[14]
        else:raise ValueError('result route not request-bound')
        if decoded_address(operator)!=address(approved['operator']) or decoded_address(verifier)!=address(approved['verifier']) or hx(method)!=approved['methodId']:raise ValueError('provider binding mismatch')
        code=self.rpc('eth_getCode',[approved['verifier'],self.block or 'latest'])
        if code=='0x' or g.k(bytes.fromhex(code[2:]))!=approved['verifierCodeHash']:raise ValueError('untrusted randomness verifier')
        result=self.call('RandomnessRouter420','result(bytes32)',[hword(canonical)])
        if len(result)!=2 or hx(result[0])==ZERO or hx(result[1])==ZERO or result[0]!=record[1] or result[1]!=record[2]:raise ValueError('unverified canonical result')
        return {'canonicalRequestId':canonical,'entropy':hx(result[0]),'proofHash':hx(result[1]),'consumed':integer(p[4])==1}
    def finalize(self,e,send=False):
        event=self.event(e)
        if event['finalized']:return self.audit(e)
        self.randomness(e)
        self.authorized(self.operator,'BREEDING_ENGINE','BREEDING_ENGINE.FINALIZE','0x'+r.word(e['breedingEventId']).hex())
        out=self.send('BreedingEngine','finalizeBreeding(uint64)',[r.word(e['breedingEventId'])],send)
        return self.audit(e) if send else out
    def audit(self,e):
        head=int(self.rpc('eth_blockNumber',[]),16)
        self.block=hex(max(0,head-self.config['confirmations']+1))
        try:return self._audit_at_confirmed_block(e)
        finally:self.block=None
    def _audit_at_confirmed_block(self,e):
        ev=self.event(e);rng=self.randomness(e);child=self.genome(e['childGenomeId'])
        refs={x['genomeId']:x for x in self.commons['genomes']}
        self.verified_common(refs[e['parentAGenomeId']]);self.verified_common(refs[e['parentBGenomeId']])
        expected,trace=r.offspring(refs[e['parentAGenomeId']]['loci'],refs[e['parentBGenomeId']]['loci'],ev['entropy'],e['breedingEventId'])
        if not ev['finalized'] or not rng['consumed'] or ev['entropy']!=rng['entropy'] or child is None or child['loci']!=expected or child['lineId']!=e['childLineId'] or child['metadataHash']!=e['metadataHash'] or child['founding']:raise ValueError('unproven rare registration')
        return {'cultivarId':e['cultivarId'],'breedingEventId':e['breedingEventId'],'child':child,'randomness':rng,'inheritance':trace,'status':'independently-read-on-chain'}

def main():
    p=argparse.ArgumentParser();p.add_argument('--runtime',default=str(g.DATA/'seed-registration-runtime.v1.json'));p.add_argument('--phase',choices=['preflight','commons','request','finalize','audit'],default='preflight');p.add_argument('--send',action='store_true');p.add_argument('--journal',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    config=validate_runtime(json.loads(Path(a.runtime).read_text()))
    g.verify_engine_sources();commons=g.load('common-reference-genomes.v1.json');g.validate(commons,*g.inputs());plan=g.load('rare-breeding-plan.v1.json');r.validate(plan,*r.inputs())
    rpc=Rpc(os.environ['HC_SEED_RPC_URL']);life=Lifecycle(config,rpc,commons,plan,a.journal);life.preflight()
    result={'schema':'HC.SEED.REGISTRATION_READBACK.V1','chainId':config['chainId'],'runtimeHash':g.commit(config),'planHash':g.commit(plan),'phase':a.phase,'records':[]}
    if a.phase=='audit':result['commonRecords']=[life.verified_common(e) for e in commons['genomes']]
    if a.phase=='commons':result['records']=[life.common(e,a.send) for e in commons['genomes']]
    elif a.phase in ['request','finalize','audit']:result['records']=[getattr(life,a.phase)(e,**({'send':a.send} if a.phase!='audit' else {})) for e in plan['events']]
    Path(a.output).write_text(json.dumps(result,indent=2)+'\n')
if __name__=='__main__':main()

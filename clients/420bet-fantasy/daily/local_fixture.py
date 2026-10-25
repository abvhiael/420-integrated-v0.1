"""Real Anvil deployments and synthetic NHL fixtures, exclusively on chain 31337."""
import json
import os
import subprocess
from pathlib import Path
import sys
from eth_account import Account
from Crypto.PublicKey import ECC
from Crypto.Random import get_random_bytes
from web3 import Web3
from eth_abi import encode
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from nhl import k256,stat_leaf,merkle,FIELDS
from chain import hx,b32,Chain


class LocalFixture:
    def __init__(self,rpc,build,private,asset_kind="erc20"):
        self.asset_kind=asset_kind
        if asset_kind not in ("erc20","wrapped-native"):raise ValueError("unsupported qualification asset")
        self.w3=Web3(Web3.HTTPProvider(rpc));self.build=Path(build);self.private=Path(private);self.private.mkdir(parents=True,exist_ok=True)
        if self.w3.eth.chain_id!=31337 or not rpc.startswith('http://127.0.0.1:'):raise ValueError("fixture refuses non-local chain")
        self.accounts=self.w3.eth.accounts;self.admin=self.accounts[0];self.nonce=0;self.contracts={};self.oracle_nonce=0;self.prepared={}
    def tx(self,fn,who=None,value=0):
        tx=fn.transact({"from":who or self.admin,"value":value,"gas":20000000});r=self.w3.eth.wait_for_transaction_receipt(tx)
        if r.status!=1:raise RuntimeError("local canonical transaction reverted")
        return r
    def deploy(self,name,*args):
        artifact=json.loads((self.build/(name+'.sol')/(name+'.json')).read_text());factory=self.w3.eth.contract(abi=artifact['abi'],bytecode=artifact['bytecode']['object'])
        receipt=self.tx(factory.constructor(*args));c=self.w3.eth.contract(address=receipt.contractAddress,abi=artifact['abi']);self.contracts[name]=c;return c
    def grant(self,principal,action,scope,valid_until=None):
        now=self.w3.eth.get_block('latest').timestamp
        end=now+7*86400 if valid_until is None else int(valid_until)
        if not now<end<=now+7*86400:raise ValueError('local authority must be a bounded lease')
        self.nonce+=1;return self.tx(self.cap.functions.createGrant(k256(encode(['string','uint256'],['daily-local-grant',self.nonce])),principal,k256(b'420.BET.CORE'),action,scope,0,0,0,now,end))
    def advance(self,timestamp):
        current=self.w3.eth.get_block('latest').timestamp
        if timestamp>current:self.w3.provider.make_request('evm_increaseTime',[timestamp-current])
        self.w3.provider.make_request('evm_mine',[])
    def setup(self):
        self.cap=self.deploy('CapabilityRegistry420');self.tx(self.cap.functions.registerProtocolComponent(k256(b'420.BET.CORE'),self.admin))
        self.auth=self.deploy('BetAuthorization420',self.cap.address);self.identity=self.deploy('Identity420',self.admin)
        self.issuer=k256(b'daily-local-verified-issuer');self.user_type=k256(b'daily-local-user');self.resolver_type=k256(b'daily-local-resolver')
        self.tx(self.identity.functions.setIssuer(self.issuer,self.admin,k256(b'public synthetic local issuer'),True))
        self.profiles=[]
        for i,name in enumerate(['Platform','Alice','Bob','Charlie','Resolver']):
            subject=k256(('daily-local-'+name).encode());credential=k256(('daily-local-credential-'+name).encode());person=k256(('person-'+name).encode())
            self.tx(self.identity.functions.createProfile(subject,k256(name.encode())),self.accounts[i]);self.tx(self.identity.functions.issueCredential(credential,self.issuer,subject,self.user_type,person,0))
            self.profiles.append({'name':name,'subject':hx(subject),'credential':hx(credential),'account':self.accounts[i]})
        rcred=k256(b'local resolver credential');self.tx(self.identity.functions.issueCredential(rcred,self.issuer,b32(self.profiles[4]['subject']),self.resolver_type,k256(b'resolver-attestation'),0));self.profiles[4]['resolverCredential']=hx(rcred)
        self.providers=self.deploy('OracleProviderRegistry420',self.admin);self.feeds=self.deploy('OracleFeedRegistry420',self.admin,self.providers.address);self.risk=self.deploy('OracleRiskPolicy420',self.admin)
        self.router=self.deploy('OracleRouter420',self.admin,self.providers.address,self.feeds.address,self.risk.address)
        for i in range(2):self.tx(self.providers.functions.setProvider(k256(('daily-operator-'+str(i)).encode()),self.accounts[5+i],k256(b'synthetic fixture; shared source'),bytes(32),True))
        if self.asset_kind=='wrapped-native':
            self.token=self.deploy('Wrapped420');self.tx(self.token.functions.deposit(),value=500*10**18)
        else:self.token=self.deploy('ERC20Template420','Local qualification $420','$420',self.admin,1000000*10**18,0,False,False,False,False,k256(b'local $420'))
        for address in self.accounts[1:5]:self.tx(self.token.functions.transfer(address,100*10**18))
        self.disputes=self.deploy('FantasyDisputeController420',self.auth.address,self.identity.address,self.router.address,self.resolver_type,self.token.address,self.accounts[9])
        self.book=self.deploy('FantasySlateBook420',self.auth.address,self.router.address);self.scorer=self.deploy('FantasyNHLScoring420');self.vault=self.deploy('DevelopmentCompensationVault420',self.cap.address,self.accounts[8])
        self.engine=self.deploy('FantasyContestEngine420',self.disputes.address,self.book.address,self.scorer.address,self.vault.address,self.issuer,self.user_type)
        validator=Account.create();publisher=Account.create();encryption=ECC.generate(curve='Curve25519')
        for name,data in [('validator.key',validator.key.hex()),('publisher.key',publisher.key.hex()),('encryption.pem',encryption.export_key(format='PEM'))]:
            (self.private/name).write_text(data,encoding='utf-8');os.chmod(self.private/name,0o600)
        (self.private/'storage.key').write_bytes(get_random_bytes(32));os.chmod(self.private/'storage.key',0o600)
        self.w3.eth.wait_for_transaction_receipt(self.w3.eth.send_transaction({'from':self.admin,'to':publisher.address,'value':10**18}))
        self.w3.eth.wait_for_transaction_receipt(self.w3.eth.send_transaction({'from':self.admin,'to':validator.address,'value':10**18}))
        custodian_subject=k256(b'daily-local-verified-custodian');custodian_credential=k256(b'daily-local-custodian-credential');custodian_person=k256(b'daily-local-custodian-person')
        tx=self.identity.functions.createProfile(custodian_subject,k256(b'local custodian profile')).build_transaction({'from':validator.address,'nonce':0,'chainId':31337,'gas':500000})
        receipt=self.w3.eth.wait_for_transaction_receipt(self.w3.eth.send_raw_transaction(validator.sign_transaction(tx).raw_transaction))
        if receipt.status!=1:raise RuntimeError('actual custodian controller profile failed')
        self.tx(self.identity.functions.issueCredential(custodian_credential,self.issuer,custodian_subject,self.user_type,custodian_person,0))
        self.tx(self.engine.functions.registerIdentity(custodian_subject,custodian_credential))
        self.validator_profile={'subject':hx(custodian_subject),'credential':hx(custodian_credential),'account':validator.address}
        custodian_key=k256(encode(['bytes32','bytes32'],[self.issuer,custodian_person]))
        self.start=self.w3.eth.get_block('latest').timestamp+3600;self.slates={};self.athletes=[]
        for i in range(1,22):
            pos=[1,2,4,8,8,16,1][(i-1)%7];name=['Center','Left wing','Right wing','Defense','Defense','Goalie','Flex'][(i-1)%7]+' '+str(i)
            self.athletes.append({'id':i,'name':name,'positions':pos})
        for index,lock in enumerate([self.start,self.start+4*86400]):
            sid=k256(('daily-local-slate-'+str(index)).encode());game=k256(('daily-local-game-'+str(index)).encode());feed=k256(('daily-local-feed-'+str(index)).encode());self.feed(feed)
            self.grant(self.admin,self.book.functions.PUBLISH().call(),self.auth.functions.scopeForContest(sid).call());self.grant(validator.address,self.book.functions.VALIDATE_LINEUP().call(),self.auth.functions.scopeForContest(sid).call())
            module=(Path(__file__).resolve().parent.parent/'slate-time.mjs').as_uri()
            script="import {cutoffForSlate} from "+json.dumps(module)+";console.log(cutoffForSlate([Number(process.argv[1])]).cutoff)"
            cutoff=int(subprocess.check_output(['node','--input-type=module','-e',script,str(lock)],text=True))
            self.tx(self.book.functions.publish(sid,feed,k256(encryption.public_key().export_key(format='raw')),custodian_key,validator.address,cutoff,[(game,lock)],[(a['id'],game,a['positions']) for a in self.athletes]));self.tx(self.book.functions.sealSlate(sid))
            self.slates[hx(sid)]={'name':'Local NHL slate '+str(index+1),'athletes':self.athletes,'game':hx(game),'lockAt':lock,'feed':hx(feed)}
        self.pools=[hx(k256(('daily-local-pool-'+str(i)).encode())) for i in range(6)];candidate={}
        self.grant(self.admin,self.engine.functions.CREATE().call(),self.auth.functions.scopeGlobal().call())
        for profile in [self.profiles[0],self.profiles[4]]:self.tx(self.engine.functions.registerIdentity(b32(profile['subject']),b32(profile['credential'])))
        for pid in self.pools:
            scope=self.auth.functions.scopeForContest(b32(pid)).call();self.grant(self.engine.address,self.disputes.functions.REGISTER().call(),scope);self.grant(self.admin,self.engine.functions.INVITE().call(),scope)
            for actor in self.accounts[1:5]:self.grant(actor,k256(b'BET_FANTASY_ENTER'),scope)
            feed=k256(('candidate-'+pid).encode());self.feed(feed);candidate[pid]=hx(feed)
        config={'assetKind':self.asset_kind,'rpc':self.w3.provider.endpoint_uri,'chainID':31337,'localQualification':True,'engine':self.engine.address,'asset':self.token.address,'deploymentBlock':0,'profiles':self.profiles,'slates':self.slates,'plannedPools':self.pools,'candidateFeed':candidate[self.pools[0]],'candidateFeeds':candidate,'codeHashes':{c.address:hx(Web3.keccak(self.w3.eth.get_code(c.address))) for c in self.contracts.values()}}
        # Include constructor-created module identities in the pinned client config.
        for address in [self.engine.functions.admission().call(),self.engine.functions.rankings().call(),self.engine.functions.payoutPolicy().call()]:config['codeHashes'][address]=hx(Web3.keccak(self.w3.eth.get_code(address)))
        (self.private/'application.json').write_text(json.dumps(config,indent=2)+'\n',encoding='utf-8');self.config=config
        return config
    def feed(self,feed):
        self.tx(self.feeds.functions.setFeed(feed,k256(b'420/ORACLE/FEED/OUTCOME/V1'),k256(b'420/ORACLE/AGGREGATION/QUORUM_EQUAL/V1'),7*86400,0,2,k256(b'synthetic local test source policy'),True))
        for i in range(2):self.tx(self.feeds.functions.setSource(feed,k256(('daily-operator-'+str(i)).encode()),True))
    def report(self,feed,digest):
        # Honest operators agree on an explicit synthetic test statement; no mocks.
        self.advance(self.w3.eth.get_block('latest').timestamp+1)
        for i in range(2):
            self.oracle_nonce+=1;now=self.w3.eth.get_block('latest').timestamp
            self.tx(self.router.functions.submitObservation(feed,k256(('daily-operator-'+str(i)).encode()),k256(encode(['string','uint256'],['local observation',self.oracle_nonce])),0,digest,k256(b'public synthetic qualification data'),now,10000),self.accounts[5+i])
    def score(self,pool,revision=1,bob_wins=False,prepare_only=False):
        config=self.engine.functions.configOf(b32(pool)).call();sid=hx(config[0]);slate=self.slates[sid];game=b32(slate['game']);lock=slate['lockAt']
        if not self.book.functions.slateOf(config[0]).call()[7]:
            end=lock+100;self.advance(end);results=[(game,lock,end,end,True,True,False)];evidence=k256(b'explicit synthetic game disposition')
            self.report(b32(slate['feed']),self.book.functions.resultDigest(config[0],results,evidence).call());self.tx(self.book.functions.resolve(config[0],results,evidence))
        key=(pool,revision)
        if key not in self.prepared:
            asof=self.w3.eth.get_block('latest').timestamp
            stats=[]
            for a in self.athletes:
                row={f:0 for f in FIELDS[:8]};row.update({f:False for f in FIELDS[8:]});row.update(played=True,complete=True)
                if a['id']==(8 if bob_wins else 15):row.update(goals=2 if bob_wins else 1,shots=2 if bob_wins else 1)
                if a['positions']==16:row.update(saves=10,goalsAgainst=1)
                stats.append(row)
            root,proofs=merkle([stat_leaf(config[0],revision,a['id'],game,s) for a,s in zip(self.athletes,stats)])
            evidence=k256(encode(['string','uint64'],['synthetic scoring revision',revision]));report=(root,evidence,revision,asof)
            self.report(b32(slate['feed']),self.book.functions.statDigest(config[0],report).call())
            self.prepared[key]=(stats,root,proofs,report)
        stats,root,proofs,report=self.prepared[key]
        if prepare_only:return {'asOf':report[3],'root':hx(root)}
        self.tx(self.engine.functions.beginRevision(b32(pool),report))
        from nhl import points
        rows=[]
        for entry in range(1,self.engine.functions.poolOf(b32(pool)).call()[3]+1):
            lineup=self.engine.functions.entryOf(b32(pool),entry).call()[7];value=sum(points(stats[i-1],self.athletes[i-1]['positions']==16) for i in lineup);rows.append((entry,lineup,value))
        rows.sort(key=lambda r:(-r[2],r[0]));previous=0
        for entry,lineup,value in rows:
            witness=encode(['('+','.join(['uint16']*8+['bool']*7)+')[7]','bytes32[][7]'],[[[stats[i-1][f] for f in FIELDS] for i in lineup],[proofs[i-1] for i in lineup]])
            self.tx(self.engine.functions.scoreEntry(b32(pool),entry,witness,previous,0));previous=entry
        rankings=Chain(self.config).rankings;count=len(rows)
        self.tx(rankings.functions.walk(b32(pool),revision,count));self.tx(rankings.functions.allocate(b32(pool),revision,count))
        candidate=self.engine.functions.candidateOf(b32(pool)).call();self.report(config[1],self.disputes.functions.candidateDigest(b32(pool),candidate).call());self.tx(self.engine.functions.publishCandidate(b32(pool)))
        return rows

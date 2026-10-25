"""Actual Wrapped420/canonical-oracle funded flows on isolated Anvil only."""
import json
import sys
from pathlib import Path
from Crypto.PublicKey import ECC
from eth_abi import encode
from eth_account import Account
from eth_account.messages import encode_defunct
from web3 import Web3
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'daily'))
from local_fixture import LocalFixture
from chain import b32,hx
from nhl import k256,merkle,FIELDS
from formats.client import FormatClient,FormatCustodian,contract
from formats.publisher import publish,legal_assignment
from formats.approved import salary_rules
from formats.core import Athlete
from formats.core import allocate
from formats.source import format_leaf

STAT='('+','.join(['uint16']*8+['bool']*7)+')'
FACT='('+STAT+',uint32,bool)'


class FundedFormats(LocalFixture):
    def tx(self,fn,who=None,value=0):
        tx=fn.transact({'from':who or self.admin,'value':value,'gas':20000000});receipt=self.w3.eth.wait_for_transaction_receipt(tx)
        if receipt.status!=1:raise RuntimeError('actual EVM transaction reverted: '+fn.fn_name+'; context='+str(getattr(self,'execution_context',''))+'; gas='+str(receipt.gasUsed))
        return receipt
    def deploy(self,name,*args):
        path=self.build/(name+'.sol')/(name+'.json')
        if not path.exists():
            matches=list(self.build.glob('*/'+name+'.json'))
            if len(matches)!=1:raise ValueError('ambiguous compiled artifact '+name)
            path=matches[0]
        artifact=json.loads(path.read_text());runtime=artifact['deployedBytecode']['object']
        if len(bytes.fromhex(runtime.removeprefix('0x')))>24576:raise ValueError('production runtime size exceeded: '+name)
        factory=self.w3.eth.contract(abi=artifact['abi'],bytecode=artifact['bytecode']['object']);r=self.tx(factory.constructor(*args))
        c=self.w3.eth.contract(address=r.contractAddress,abi=artifact['abi']);self.contracts[name]=c;return c

    def export_execution(self,out):
        """Public transactions, proofs and deployed identities; never custody keys."""
        out=Path(out);transactions=[];gas=0
        for height in range(self.w3.eth.block_number+1):
            block=self.w3.eth.get_block(height,full_transactions=True)
            for tx in block.transactions:
                receipt=self.w3.eth.get_transaction_receipt(tx.hash)
                if receipt.status!=1:raise AssertionError('failed transaction in accepted local execution')
                gas=max(gas,receipt.gasUsed)
                transactions.append({'block':height,'timestamp':block.timestamp,'hash':tx.hash.hex(),'from':tx['from'],'to':tx.to,'input':tx.input.hex(),'value':tx.value,'receipt':json.loads(self.w3.to_json(receipt))})
        identities=[];seen=set()
        for name,c in self.contracts.items():
            if c.address in seen:continue
            seen.add(c.address);code=self.w3.eth.get_code(c.address)
            identities.append({'contract':name,'address':c.address,'runtimeBytes':len(code),'runtimeKeccak256':self.w3.keccak(code).hex(),'runtime':code.hex()})
        (out/'execution.json').write_text(json.dumps({'chainId':self.w3.eth.chain_id,'asset':'canonical Wrapped420','syntheticSportsFacts':True,'independentProviderControlAccepted':False,'transactions':transactions,'deployments':identities,'maximumTransactionGas':gas},indent=2)+'\n',encoding='utf-8')

    def setup_formats(self):
        self.setup();self.formatbook=self.deploy('FantasyFormatBook420',self.book.address,self.scorer.address)
        self.grant(self.admin,k256(b'BET_FANTASY_BIND_FORMAT_DISPUTES.V1'),self.auth.functions.scopeGlobal().call());self.tx(self.formatbook.functions.bindDisputes(self.disputes.address))
        self.peer=self.deploy('FantasyFormatEscrow420',self.formatbook.address,self.disputes.address,self.engine.functions.admission().call(),self.vault.address)
        self.house=self.deploy('FantasyHouseEscrow420',self.formatbook.address,self.disputes.address,self.engine.functions.admission().call(),self.vault.address)
        self.admission=contract(self.w3,self.build,'FantasyAdmission420',self.engine.functions.admission().call())
        self.cases=[];self.events=[];self.rejections=[];self.outcomes=[]
        self.validator=Account.from_key(bytes.fromhex((self.private/'validator.key').read_text().strip()))
        self.encryption=ECC.import_key((self.private/'encryption.pem').read_bytes())
        for p in self.profiles:self.tx(self.admission.functions.registerIdentity(b32(p['subject']),b32(p['credential'])))
        for host in (self.peer,self.house):
            self.grant(self.admin,host.functions.CREATE().call(),self.auth.functions.scopeGlobal().call())
            for actor in self.accounts[:5]:self.tx(self.token.functions.approve(host.address,2**255),actor)
        self.snapshots={};self.make_slate('multi',3);self.make_slate('single',1)
        return self

    def reject(self,name,fn,actor=None):
        try:fn.call({'from':actor or self.admin})
        except Exception as e:
            self.rejections.append({'case':name,'execution':'eth_call EVM revert','errorType':type(e).__name__});return
        raise AssertionError('required rejection accepted: '+name)

    def make_slate(self,label,count):
        sid=k256(('approved-slate-'+label).encode());feed=k256(('approved-slate-feed-'+label).encode());self.feed(feed)
        lock=self.start+1000;schedule=[(k256((label+'game'+str(i)).encode()),lock+i*60) for i in range(count)]
        rows=[]
        for i in range(1,28):
            position=[1,1,6,6,6,8,8,16,15][(i-1)%9];rows.append((i,schedule[(i-1)%count][0],position))
        for i in range(28,31):rows.append((i,schedule[(i-1)%count][0],16))
        module=(Path(__file__).resolve().parents[1]/'slate-time.mjs').as_uri()
        script='import {cutoffForSlate} from '+json.dumps(module)+';console.log(cutoffForSlate(JSON.parse(process.argv[1])).cutoff)'
        import subprocess
        cutoff=int(subprocess.check_output(['node','--input-type=module','-e',script,json.dumps([t for _,t in schedule])],text=True))
        custodian_key=self.book.functions.slateOf(b32(next(iter(self.slates)))).call()[3]
        self.grant(self.admin,self.book.functions.PUBLISH().call(),self.auth.functions.scopeForContest(sid).call())
        self.grant(self.validator.address,self.book.functions.VALIDATE_LINEUP().call(),self.auth.functions.scopeForContest(sid).call())
        self.tx(self.book.functions.publish(sid,feed,k256(self.encryption.public_key().export_key(format='raw')),custodian_key,self.validator.address,cutoff,schedule,rows));self.tx(self.book.functions.sealSlate(sid))
        # Synthetic retained historical records passed through the actual approved publisher.
        athletes=[];groups={};history=[];cohort={'F':0,'D':0,'G':0};cut=self.w3.eth.get_block('latest').timestamp
        for aid,_,pos in rows:
            g='G' if pos==16 else 'D' if pos==8 else 'F';idx=cohort[g];cohort[g]+=1
            positions=frozenset(p for p,mask in [('C',1),('LW',2),('RW',4),('D',8),('G',16)] if pos&mask)
            athletes.append(Athlete(str(aid),'team'+str((aid-1)%3),positions,0,g=='G'));groups[str(aid)]=g
            for j in range(5):
                s=self.stat(g=='G',idx)
                history.append({'athlete':str(aid),'game':f'past-{j}','appearanceAt':cut-10000-j*100,'completedAt':cut-9000-j*100,'availableAt':cut-8000-j*100,'seasonType':'regular','revision':1,'stats':s})
        published=publish(athletes,groups,history,cut,'synthetic-history-v1',[hx(g) for g,_ in schedule],lock)
        self.snapshots[label]={'sid':sid,'feed':feed,'schedule':schedule,'rows':rows,'lock':lock,'cutoff':cutoff,'salary':published}

    @staticmethod
    def stat(goalie,number=0):
        row={f:0 for f in FIELDS[:8]};row.update({f:False for f in FIELDS[8:]});row.update(played=True,complete=True)
        if goalie:row.update(saves=10+number,goalsAgainst=1)
        else:row.update(shots=number)
        return row

    def make_case(self,label,kind,slate_label,users=2,stake=100,prize=0,card_size=2,indices=None,user_indices=None,void_aids=()):
        s=self.snapshots[slate_label];fid=k256(('format-'+label).encode());feed=k256(('format-feed-'+label).encode());self.feed(feed)
        table=[];board=[]
        if kind in (1,2):
            name='salary-cap' if kind==1 else 'captain';snapshot=s['salary']['snapshots'][name];p=salary_rules(name).parameters
            lineup=legal_assignment(snapshot.athletes,p['slots'],p['salaryCap'],p['captainIndex'],p['minimumTeams'],p['maximumPerTeam'])
            selection=encode(['uint32[]'],[[int(a) for a in lineup]])
            table=[(int(aid),k256(a.team.encode()),a.salary) for aid,a in snapshot.athletes.items()]
        else:
            # Distinct athletes; index i corresponds to athlete i+1 except goalie market.
            selected_aids=[1,2,3,4,5,6,7,9]
            board=[(aid,25,2) for aid in selected_aids]
            chosen=indices or list(range(card_size));selection=encode(['uint32[]','bool[]'],[chosen,[True]*card_size])
        config=(kind,s['sid'],feed,bytes.fromhex(s['salary']['hash']) if table else bytes(32),k256(b'synthetic official NHL-wide schedule') if board else bytes(32),len(s['schedule']),card_size if board else 0)
        self.grant(self.admin,self.formatbook.functions.PUBLISH().call(),self.auth.functions.scopeForContest(fid).call())
        self.report(feed,self.formatbook.functions.snapshotDigest(fid,config,table,board).call())
        self.tx(self.formatbook.functions.publish(fid,config,table,board,selection))
        host=self.house if kind==4 else self.peer;pid=k256(('pool-'+label).encode());candidate_feed=k256(('candidate-'+label).encode());self.feed(candidate_feed)
        if kind!=4:self.grant(host.address,self.disputes.functions.REGISTER().call(),self.auth.functions.scopeForContest(pid).call())
        else:
            for index in range(1,users+1):self.grant(host.address,self.disputes.functions.REGISTER().call(),self.auth.functions.scopeForContest(host.functions.houseDisputeId(pid,index).call()).call())
        bands=encode(['(uint64,uint64,uint16[])[]'],[[(3,4,[10000])]])
        bankroll=stake*6*users if kind==4 else 0
        self.tx(host.functions.create(pid,b32(self.profiles[0]['subject']),(fid,candidate_feed,stake,prize,4,stake*6*users if kind==4 else 0),bands,bankroll))
        hashes={c.address:Web3.keccak(self.w3.eth.get_code(c.address)).hex() for c in self.contracts.values()}
        client=FormatClient(self.w3,self.build,host.address,hashes);custodian=FormatCustodian(client,self.private)
        case={'label':label,'kind':kind,'snapshot':s,'format':fid,'feed':feed,'host':host,'pool':pid,'candidateFeed':candidate_feed,'selection':selection,'client':client,'custodian':custodian,'users':users,'stake':stake,'prize':prize,'entries':[],'selections':[],'void_aids':set(void_aids)}
        for i in range(1,users+1):
            p=self.profiles[i];actor=p['account'];subject=b32(p['subject']);credential=b32(p['credential']);self.grant(actor,k256(b'BET_FANTASY_ENTER'),self.auth.functions.scopeForContest(pid).call())
            chosen=encode(['uint32[]','bool[]'],[user_indices[i-1],[True]*card_size]) if user_indices else selection
            case['selections'].append(chosen)
            salt=k256(('test-salt-'+label+str(i)).encode());request=client.prepare(pid,subject,credential,actor,chosen,salt,self.encryption.public_key().export_key(format='raw'))
            signature=self.w3.eth.sign(actor,text=request['message']);receipt=custodian.attest(request,signature)
            self.tx(host.functions.enter(pid,subject,credential,receipt),actor);case['entries'].append((actor,subject,credential,receipt))
            if i==1:self.reject(label+' duplicate canonical user',host.functions.enter(pid,subject,credential,receipt),actor)
        self.cases.append(case);return case

    def resolve(self):
        self.advance(self.start+1000)
        for c in self.cases:
            for fn in c['custodian'].due():self.tx(fn)
        self.advance(self.start+2000)
        for s in self.snapshots.values():
            results=[(g,t,t+100,t+100,True,True,False) for g,t in s['schedule']];evidence=k256(b'public synthetic official game dispositions')
            self.report(s['feed'],self.book.functions.resultDigest(s['sid'],results,evidence).call());self.tx(self.book.functions.resolve(s['sid'],results,evidence))

    def score_case(self,c,revision=1):
        host=c['host'];s=c['snapshot'];fid=c['format']
        if revision==1:self.tx(host.functions.begin(c['pool']))
        statrows=[];leaves=[]
        for aid,_,pos in s['rows']:
            row=self.stat(pos==16,4 if aid%2 else 1)
            if aid in c['void_aids']:
                row={f:0 if i<8 else False for i,f in enumerate(FIELDS)};row['complete']=True
            fact=([row[f] for f in FIELDS],0 if aid in c['void_aids'] else 100,pos==16 and aid not in c['void_aids'])
            leaf=format_leaf(self.w3.eth.chain_id,self.formatbook.address,fid,self.formatbook.functions.manifest(fid).call(),revision,aid,fact)
            if leaf!=self.formatbook.functions.factLeaf(fid,revision,aid,fact).call():raise AssertionError('contract-derived format statement/export incompatibility')
            statrows.append(fact);leaves.append(leaf)
        root,proofs=merkle(leaves);now=self.w3.eth.get_block('latest').timestamp;report=(root,k256(b'public synthetic actual NHL stat witness'),revision,now)
        if revision>1:
            statrows,root,proofs,report=c['retained2'];context=host.functions.houseDisputeId(c['pool'],1).call() if c['kind']==4 else c['pool']
            self.tx(self.formatbook.functions.correctStats(fid,context,report))
        else:
            self.report(c['feed'],self.formatbook.functions.statDigest(fid,report).call());self.tx(self.formatbook.functions.updateStats(fid,report))
        from eth_abi import decode
        witnesses=[];expected=[]
        from nhl import points
        for selection in c['selections']:
            if c['kind'] in (1,2):
                aids=decode(['uint32[]'],selection)[0];value=sum(points(dict(zip(FIELDS,statrows[a-1][0])),s['rows'][a-1][2]==16)*(3 if c['kind']==2 and i==0 else 2) for i,a in enumerate(aids));qualifies=True;multiplier=0
            else:
                selected=decode(['uint32[]','bool[]'],selection)[0];aids=[self.formatbook.functions.marketOf(fid,i).call()[0] for i in selected]
                active=[a for a in aids if a not in c['void_aids']];wins=sum(statrows[a-1][0][2]*10>25 for a in active);qualifies=len(active)>=2;value=wins*6//len(active) if qualifies else 0;multiplier=1 if not qualifies else (3 if len(active)==2 else 5) if wins==len(active) else 0
            witness=encode(['('+FACT+'[],bytes32[][])'],[([statrows[i-1] for i in aids],[proofs[i-1] for i in aids])]);witnesses.append(witness);expected.append((value,qualifies,multiplier))
            actual=self.formatbook.functions.calculate(fid,selection,witness).call()
            if tuple(actual)!=(value,qualifies,multiplier):raise AssertionError('independent rule-score mismatch '+c['label'])
        witness=witnesses[0];c['expected']=expected
        bad=bytearray(witness);bad[-1]^=1
        self.reject(c['label']+' altered proof',self.formatbook.functions.calculate(fid,c['selection'],bytes(bad)))
        self.reject(c['label']+' premature settlement',host.functions.settleHouse(c['pool'],1) if c['kind']==4 else host.functions.settle(c['pool']))
        c['witness']=witness
        if c['kind']==4:
            for i in range(1,c['users']+1):
                if revision>1 and i!=1:
                    self.tx(host.functions.refreshUnchangedHouse(c['pool'],i,witnesses[i-1]));continue
                self.tx(host.functions.prepareHouse(c['pool'],i,witnesses[i-1]));candidate=host.functions.houseCandidateOf(c['pool'],i).call();child=host.functions.houseDisputeId(c['pool'],i).call()
                self.report(c['candidateFeed'],self.disputes.functions.candidateDigest(child,candidate).call());self.tx(host.functions.publishHouse(c['pool'],i))
        else:
            self.tx(host.functions.beginRevision(c['pool']))
            for w in witnesses:self.tx(host.functions.calculateNext(c['pool'],w))
            if sum(q for _,q,_ in expected)<2:
                self.tx(host.functions.recover(c['pool']));c['canceled']=True;c['precredited']={self.admin:c['prize']};return
            self.tx(host.functions.initializeRanking(c['pool']));ranking=contract(self.w3,self.build,'FantasyRankingBook420',host.functions.rankings().call())
            rows=[host.functions.entryOf(c['pool'],i).call() for i in range(1,c['users']+1)];order=sorted((i for i in range(1,c['users']+1) if rows[i-1][10]),key=lambda i:(-rows[i-1][8],i));previous=0
            for i in order:self.tx(host.functions.rankEntry(c['pool'],i,previous,0));previous=rows[i-1][9]
            self.tx(ranking.functions.walk(c['pool'],revision,64));self.tx(ranking.functions.allocate(c['pool'],revision,64))
            candidate=host.functions.candidateOf(c['pool']).call();self.report(c['candidateFeed'],self.disputes.functions.candidateDigest(c['pool'],candidate).call());self.tx(host.functions.publishCandidate(c['pool']))
        if revision==1 and c.get('dispute')=='upheld':
            import copy
            corrected=copy.deepcopy(statrows);corrected[1][0][2]=10
            root2,proofs2=merkle([self.formatbook.functions.factLeaf(fid,2,aid,f).call() for (aid,_,_),f in zip(s['rows'],corrected)])
            retained=(root2,k256(b'corrected synthetic data actually prepared before cutoff'),2,self.w3.eth.get_block('latest').timestamp)
            c['retained2']=(corrected,root2,proofs2,retained)
            # Anchor genuine corrected material before the correction cutoff, then
            # deliberately exercise its challenged late ingestion, not a backdated capture.
            self.report(c['feed'],self.formatbook.functions.statDigest(fid,retained).call())
            child=host.functions.houseDisputeId(c['pool'],1).call() if c['kind']==4 else c['pool'];candidate_hash=self.disputes.functions.poolOf(child).call()[8]
            if host.functions.candidateIsCurrent(child,candidate_hash).call():raise AssertionError('new authenticated unconsumed revision did not block finality')

    def signed_tx(self,fn,account):
        tx=fn.build_transaction({'from':account.address,'nonce':self.w3.eth.get_transaction_count(account.address),'chainId':31337,'gas':20000000})
        r=self.w3.eth.wait_for_transaction_receipt(self.w3.eth.send_raw_transaction(account.sign_transaction(tx).raw_transaction))
        if r.status!=1:raise RuntimeError('actual signed canonical transaction reverted: '+fn.fn_name)
        return r

    def neutral_resolver(self):
        if hasattr(self,'neutral'):return self.neutral
        self.neutral=self.verified_reviewer('neutral');return self.neutral

    def verified_reviewer(self,label,person=None):
        account=Account.create();self.w3.eth.wait_for_transaction_receipt(self.w3.eth.send_transaction({'from':self.admin,'to':account.address,'value':10**18}))
        subject=k256(('local '+label+' resolver').encode());user=k256(('local '+label+' user credential').encode());resolver=k256(('local '+label+' resolver credential').encode())
        self.signed_tx(self.identity.functions.createProfile(subject,k256(b'public synthetic neutral reviewer')),account)
        self.tx(self.identity.functions.issueCredential(user,self.issuer,subject,self.user_type,person or k256(('local person '+label).encode()),0));self.tx(self.identity.functions.issueCredential(resolver,self.issuer,subject,self.resolver_type,k256(b'neutral resolver role'),0))
        self.tx(self.admission.functions.registerIdentity(subject,user));return account,subject,resolver

    def exercise_disputes(self):
        selected=[c for c in self.cases if c.get('dispute')]
        if not selected:return
        neutral,subject,credential=self.neutral_resolver()
        self.advance(max(self.disputes.functions.poolOf(c['host'].functions.houseDisputeId(c['pool'],1).call() if c['kind']==4 else c['pool']).call()[1] for c in selected)+1)
        for c in selected:
            host=c['host'];child=host.functions.houseDisputeId(c['pool'],1).call() if c['kind']==4 else c['pool'];evidence=k256((c['label']+' actual challenge evidence').encode())
            actor=c['entries'][0][0];challenger=c['entries'][0][1];self.tx(self.token.functions.approve(self.disputes.address,2**255),actor)
            fn=self.disputes.functions.challenge(child,challenger,evidence);claim=fn.call({'from':actor});self.tx(fn,actor);c['claim']=claim
            self.reject(c['label']+' duplicate challenge with changed evidence',self.disputes.functions.challenge(child,challenger,k256(b'changed challenge evidence')),actor)
            self.reject(c['label']+' pending dispute cannot finalize',self.disputes.functions.finalize(child))
            d=self.disputes.functions.poolOf(child).call();scope=self.disputes.functions.claimScope(claim).call();reason=k256((c['label']+' evidence-backed synthetic verdict').encode())
            self.grant(neutral.address,self.disputes.functions.RESOLVE().call(),scope,valid_until=d[3])
            if c['dispute']=='timeout':continue
            epoch=0
            if c['dispute']=='delegated':
                if not self.disputes.functions.delegationEnabled().call():self.grant(self.admin,self.disputes.functions.ENABLE_DELEGATION().call(),self.auth.functions.scopeGlobal().call());self.tx(self.disputes.functions.enableDelegation())
                self.grant(self.admin,self.disputes.functions.DELEGATE().call(),scope,valid_until=d[3]);self.tx(self.disputes.functions.delegateResolver(claim,subject,credential,d[3]));epoch=self.disputes.functions.delegationEpoch(claim).call()
                self.reject(c['label']+' unaccepted delegation',self.disputes.functions.resolve(claim,False,reason,d[8],subject,credential,epoch),neutral.address)
                self.signed_tx(self.disputes.functions.acceptDelegation(claim,epoch),neutral)
            c['verdictArgs']=(claim,c['dispute']=='upheld',reason,d[8],subject,credential,epoch)
            self.reject(c['label']+' resolution cannot close challenge window early',self.disputes.functions.resolve(*c['verdictArgs']),neutral.address)
        self.advance(max(self.disputes.functions.poolOf(c['host'].functions.houseDisputeId(c['pool'],1).call() if c['kind']==4 else c['pool']).call()[4] for c in selected)+1)
        for c in selected:
            if c['dispute']=='timeout':continue
            if not hasattr(self,'staff_checked'):
                staff,staff_subject,staff_credential=self.verified_reviewer('known staff');key=self.admission.functions.currentUserKey(staff_subject).call();host=c['host'];child=host.functions.houseDisputeId(c['pool'],1).call() if c['kind']==4 else c['pool']
                if host.functions.isInterested(child,staff_subject).call():raise AssertionError('neutral fixture unexpectedly conflicted before declaration')
                self.grant(self.admin,k256(b'BET_FANTASY_RECORD_FORMAT_CONFLICT.V1'),self.auth.functions.scopeForContest(c['format']).call());self.tx(self.formatbook.functions.recordConflict(c['format'],key))
                self.grant(staff.address,self.disputes.functions.RESOLVE().call(),self.disputes.functions.claimScope(c['claim']).call(),valid_until=self.disputes.functions.poolOf(child).call()[3])
                args=c['verdictArgs'];self.reject('known staff cannot resolve despite verified credential and scoped authority',self.disputes.functions.resolve(args[0],args[1],args[2],args[3],staff_subject,staff_credential,0),staff.address)
                alias,alias_subject,alias_credential=self.verified_reviewer('staff alias',k256(b'local person known staff'))
                self.grant(alias.address,self.disputes.functions.RESOLVE().call(),self.disputes.functions.claimScope(c['claim']).call(),valid_until=self.disputes.functions.poolOf(child).call()[3])
                if not host.functions.isInterested(child,alias_subject).call():raise AssertionError('staff person-key alias bypassed conflict detection')
                self.reject('staff alias cannot bypass conflict exclusion',self.disputes.functions.resolve(args[0],args[1],args[2],args[3],alias_subject,alias_credential,0),alias.address);self.staff_checked=True
            self.signed_tx(self.disputes.functions.resolve(*c['verdictArgs']),neutral)
            child=c['host'].functions.houseDisputeId(c['pool'],1).call() if c['kind']==4 else c['pool']
            beneficiary=c['entries'][0][0] if c['dispute']=='upheld' else self.accounts[9]
            prior=self.disputes.functions.credit(beneficiary).call();bond=self.disputes.functions.bondFor(child).call()
            self.tx(self.disputes.functions.collectBond(c['claim']))
            if self.disputes.functions.credit(beneficiary).call()-prior!=bond:raise AssertionError('challenge bond beneficiary/amount mismatch')
            self.reject(c['label']+' duplicate bond collection',self.disputes.functions.collectBond(c['claim']))
        for c in selected:
            if c['dispute']=='upheld':self.score_case(c,2)
        timed=[c for c in selected if c['dispute']=='timeout']
        if timed:
            self.advance(max(self.disputes.functions.poolOf(c['host'].functions.houseDisputeId(c['pool'],1).call() if c['kind']==4 else c['pool']).call()[3] for c in timed)+1)
            for c in timed:
                if c['kind']==4:
                    self.tx(c['host'].functions.recoverHouse(c['pool'],1));c['houseCanceled']=True;c['precredited']={c['entries'][0][0]:c['stake']}
                else:self.tx(c['host'].functions.recover(c['pool']));c['canceled']=True;c['precredited']={self.admin:c['prize']}
                self.tx(self.disputes.functions.collectBond(c['claim']))

    def finish(self):
        self.advance(self.start+2000+2*86400+2000)
        for c in self.cases:
            host=c['host']
            before={a:host.functions.credit(a).call() for a in self.accounts}
            if c['kind']==4:
                for i in range(1,c['users']+1):
                    if not c.get('houseCanceled'):
                        child=host.functions.houseDisputeId(c['pool'],i).call();self.tx(self.disputes.functions.finalize(child));self.tx(host.functions.settleHouse(c['pool'],i));self.reject(c['label']+' duplicate house settlement',host.functions.settleHouse(c['pool'],i))
                    if host.functions.entryOf(c['pool'],i).call()[16]!=c['stake']*(1 if c.get('houseCanceled') else c['expected'][i-1][2]):raise AssertionError('quoted gross payout/refund mismatch')
                self.tx(host.functions.releaseHouseBankroll(c['pool']))
                expected_credit={row[0]:c['stake']*(1 if c.get('houseCanceled') else c['expected'][i][2]) for i,row in enumerate(c['entries'])}
                development=0 if c.get('houseCanceled') else 3*(c['stake']*sum(q for _,q,_ in c['expected']))//100
                expected_credit[self.accounts[8]]=development
                expected_credit[self.admin]=c['stake']*6*c['users']+c['stake']*c['users']-sum(expected_credit.values())
            else:
                if not c.get('canceled'):
                    self.tx(self.disputes.functions.finalize(c['pool']));self.tx(host.functions.settle(c['pool']))
                for i in range(1,c['users']+1):self.tx(host.functions.collect(c['pool'],i));self.reject(c['label']+' duplicate collection',host.functions.collect(c['pool'],i))
                if c.get('canceled'):
                    expected_credit={row[0]:c['stake'] for row in c['entries']};expected_credit[self.admin]=c['prize']
                else:
                    valid={str(i+1):score for i,(score,q,_) in enumerate(c['expected']) if q}
                    expected=allocate(valid,c['prize']+c['stake']*len(valid),300 if c['stake'] else 0,[10000],True)
                    expected_credit={row[0]:expected['payouts'][str(i+1)] if q else c['stake'] for i,(row,(_,q,_)) in enumerate(zip(c['entries'],c['expected']))}
                    expected_credit[self.accounts[8]]=expected['fee']
            for account in self.accounts:
                if host.functions.credit(account).call()-before[account]!=expected_credit.get(account,0)-c.get('precredited',{}).get(account,0):raise AssertionError('independent beneficiary/fee/refund allocation mismatch '+c['label'])
            self.outcomes.append({'case':c['label'],'kind':c['kind'],'entries':c['users'],'pool':'0x'+c['pool'].hex(),'host':host.address,'candidateAuthenticated':True})
            c['custodian'].close()
        for host in (self.peer,self.house):
            for actor in self.accounts:
                if host.functions.credit(actor).call():self.tx(host.functions.withdrawCredit(),actor)
            if host.functions.totalLiability().call()!=0 or self.token.functions.balanceOf(host.address).call()!=0:raise AssertionError('funded host residual balance/liability')
        for actor in self.accounts:
            if self.disputes.functions.credit(actor).call():self.tx(self.disputes.functions.withdrawCredit(),actor)
        if self.token.functions.balanceOf(self.disputes.address).call()!=self.disputes.functions.totalLiability().call():raise AssertionError('bond conservation')

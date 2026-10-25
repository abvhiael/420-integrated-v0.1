"""Funded season execution against actual canonical modules and genuine entropy proofs."""
from datetime import datetime,timedelta,time
from fractions import Fraction
from pathlib import Path
from zoneinfo import ZoneInfo
from eth_abi import encode
from nhl import k256,merkle,FIELDS
from .funded_flow import FundedFormats,STAT
from .client import contract
from .season_client import SeasonClient,SeasonCustodian
from .timing import weekly_periods
from .approved import ApprovedSeason
from .core import Athlete,Snapshot
from .source import season_leaf

WFACT='(uint32,bool,bytes32[],'+STAT+'[],uint32[],bool[],uint16[])'


class FundedSeasons(FundedFormats):
    def setup_seasons(self):
        self.setup();self.rejections=[];self.outcomes=[];self.cases=[]
        self.admission=contract(self.w3,self.build,'FantasyAdmission420',self.engine.functions.admission().call())
        for p in self.profiles:self.tx(self.admission.functions.registerIdentity(bytes.fromhex(p['subject'][2:]),bytes.fromhex(p['credential'][2:])))
        self.randomprofiles=self.deploy('RandomnessProfileRegistry420',self.admin);self.routes=self.deploy('RandomnessRouteRegistry420',self.admin);self.randomregistry=self.deploy('RandomnessRegistry',self.admin)
        self.randomrouter=self.deploy('RandomnessRouter420',self.randomprofiles.address,self.routes.address,self.randomregistry.address);self.tx(self.randomregistry.functions.bindRouter(self.randomrouter.address))
        self.entropy=self.deploy('FantasyDraftEntropy420',self.randomrouter.address,self.accounts[5],self.accounts[6]);route=k256(b'local genuine committed entropy');self.randomprofile=k256(b'local verified draft profile')
        self.tx(self.routes.functions.setRoute(route,self.accounts[7],self.entropy.address,k256(b'420.RANDOM.METHOD.COMMIT_REVEAL.V1'),bytes(32),k256(b'synthetic independently signed provider addresses; no independence claim'),True))
        self.tx(self.randomprofiles.functions.setProfile(self.randomprofile,route,bytes(32),3600,86400,1,0,k256(b'public local draft timeout policy'),True))
        self.data=self.deploy('FantasySeasonData420',self.auth.address,self.router.address,self.scorer.address)
        self.rosters=self.deploy('FantasySeasonRoster420',self.data.address);self.seasonscores=self.deploy('FantasySeasonScores420',self.data.address,self.rosters.address)
        self.transactions=self.deploy('FantasySeasonTransactions420',self.data.address,self.rosters.address)
        self.actions=self.deploy('FantasySeasonActions420',self.data.address,self.rosters.address,self.admission.address,self.transactions.address)
        self.season=self.deploy('FantasySeasonEscrow420',self.data.address,self.rosters.address,self.seasonscores.address,self.disputes.address,self.admission.address,self.randomrouter.address,self.vault.address,self.actions.address)
        self.grant(self.admin,k256(b'BET_FANTASY_BIND_SEASON_HOST.V1'),self.auth.functions.scopeGlobal().call())
        for module in (self.data,self.rosters,self.transactions,self.actions):self.tx(module.functions.bindHost(self.season.address))
        self.grant(self.admin,self.season.functions.CREATE().call(),self.auth.functions.scopeGlobal().call())
        for actor in self.accounts[:5]:self.tx(self.token.functions.approve(self.season.address,2**255),actor)
        self.now=self.w3.eth.get_block('latest').timestamp;self.funding_end=self.now+3600;self.draft_start=self.now+7200
        day=datetime.fromtimestamp(self.now,ZoneInfo('America/New_York')).date();self.monday=day+timedelta(days=(7-day.weekday())%7 or 7)
        self.players=[(i+1,[1,2,4,8,8,16,1,1,2,4,8,16][i%12]) for i in range(48)]+[(49+i,p) for i,p in enumerate([1,2,4,8,16])]
        from eth_account import Account
        from Crypto.PublicKey import ECC
        self.validator=Account.from_key(bytes.fromhex((self.private/'validator.key').read_text().strip()));self.encryption=ECC.import_key((self.private/'encryption.pem').read_bytes())
        return self

    def make_season(self,label,mode=0,users=4,stake=100,prize=0):
        id=k256(('funded-season-'+label).encode());self.grant(self.admin,self.data.functions.PUBLISH().call(),self.auth.functions.scopeForContest(id).call())
        ranking=[a for a,_ in self.players];rankhash=k256(encode(['uint32[]'],[ranking]));custodian_key=self.book.functions.slateOf(bytes.fromhex(next(iter(self.slates))[2:])).call()[3]
        draft_start=self.draft_start+len(self.cases)*1800
        config=(4,mode,2,self.funding_end,draft_start,int(datetime.combine(self.monday+timedelta(days=13),time(23),ZoneInfo('America/New_York')).timestamp()),self.randomprofile,rankhash,k256(b'user-approved V1 synthetic replay profile'),self.validator.address,k256(self.encryption.public_key().export_key(format='raw')),custodian_key)
        self.tx(self.data.functions.publish(id,config,self.players[:200]))
        for offset in range(200,len(self.players),200):self.tx(self.data.functions.appendAthletes(id,self.players[offset:offset+200]))
        schedule=[]
        for week in range(2):
            for offset in (0,2):
                t=int(datetime.combine(self.monday+timedelta(days=7*week+offset),time(19),ZoneInfo('America/New_York')).timestamp());schedule.append({'id':f'{label}-w{week+1}-g{offset}','originalStart':t})
        calendar=weekly_periods(self.monday.isoformat(),2,schedule);periods={}
        for week in (1,2):
            pid='week-'+str(week);pt=calendar['periods'][week-1];w=calendar['windows'][pid];feed=k256((label+'-week-feed-'+str(week)).encode());self.feed(feed);candidate_feed=k256((label+'-week-candidate-'+str(week)).encode());self.feed(candidate_feed)
            rows=[(k256(g['id'].encode()),g['originalStart']) for g in schedule if calendar['assignment'][g['id']]==pid]
            processing=pt[1]-3600;claim_cutoff=processing-3600
            period=(pt[1],pt[2],w['resolution'],claim_cutoff,processing,w['minimumStarts'],feed,candidate_feed,k256(b'explicit NY calendar/DST version'))
            self.report(feed,self.data.functions.periodDigest(id,week,period,rows).call());self.tx(self.data.functions.publishPeriod(id,week,period,rows));periods[week]={'config':period,'games':rows,'feed':feed,'candidateFeed':candidate_feed}
        self.tx(self.data.functions.seal(id))
        if len(ranking)<=200:self.tx(self.rosters.functions.configure(id,ranking))
        else:
            for offset in range(0,len(ranking),200):self.tx(self.rosters.functions.appendRanking(id,ranking[offset:offset+200]))
            self.tx(self.rosters.functions.sealRanking(id))
        for child in [self.season.functions.weekDisputeId(id,w).call() for w in (1,2)]:self.grant(self.season.address,self.disputes.functions.REGISTER().call(),self.auth.functions.scopeForContest(child).call())
        self.grant(self.validator.address,k256(b'BET_FANTASY_VALIDATE_SEASON_PRIVATE.V1'),self.auth.functions.scopeForContest(id).call())
        self.tx(self.season.functions.create(id,bytes.fromhex(self.profiles[0]['subject'][2:]),stake,prize,encode(['(uint64,uint64,uint16[])[]'],[[(3,4,[5000,3000,2000])]])))
        for m in range(1,users+1):
            p=self.profiles[m];subject=bytes.fromhex(p['subject'][2:]);credential=bytes.fromhex(p['credential'][2:]);self.grant(p['account'],k256(b'BET_FANTASY_ENTER'),self.auth.functions.scopeForContest(id).call());self.tx(self.season.functions.join(id,subject,credential),p['account'])
            if m==1:self.reject(label+' duplicate season identity',self.season.functions.join(id,subject,credential),p['account'])
        pins={c.address:self.w3.keccak(self.w3.eth.get_code(c.address)).hex() for c in self.contracts.values()};client=SeasonClient(self.w3,self.build,self.season.address,pins);custodian=SeasonCustodian(client,self.private)
        case={'id':id,'label':label,'mode':mode,'draftStart':draft_start,'periods':periods,'calendar':calendar,'client':client,'custodian':custodian,'users':users,'stake':stake,'prize':prize}
        if users==4:
            subject=bytes.fromhex(self.profiles[1]['subject'][2:]);preferences=list(range(1,1501)) if label=='full-nhl-inventory' else [1]
            root,payload,_=client.preference(id,1,preferences,[k256(('private draft salt '+str(a)).encode()) for a in preferences])
            request=client.prepare(id,subject,0,root,len(preferences),payload,self.encryption.public_key().export_key(format='raw'));sig=self.w3.eth.sign(self.accounts[1],text=request['message']);receipt=custodian.attest(request,sig)
            self.tx(self.actions.functions.setPrivate(id,subject,0,receipt),self.accounts[1]);case['preferenceReceipt']=receipt
            self.reject(label+' wrong preference wallet',self.actions.functions.setPrivate(id,subject,0,receipt),self.accounts[2])
        self.cases.append(case);return case

    def commit_entropy(self,c):
        purpose=self.season.functions.draftPurpose(c['id']).call();secrets=[k256((c['label']+'provider'+str(i)).encode()) for i in (0,1)]
        for i in (0,1):self.tx(self.entropy.functions.commit(purpose,self.entropy.functions.commitment(purpose,self.accounts[5+i],secrets[i]).call()),self.accounts[5+i])
        c['secrets']=secrets;c['purpose']=purpose

    def start_drafts(self,cases):
        self.advance(self.funding_end)
        for c in cases:
            id=c['id'];self.tx(self.season.functions.requestDraft(id));request=self.season.functions.poolOf(id).call()[8]
            proof=encode(['bytes32','bytes32'],c['secrets']);entropy=k256(encode(['bytes32','bytes32','bytes32','bytes32'],[self.entropy.functions.DOMAIN().call(),c['purpose'],*c['secrets']]))
            self.reject(c['label']+' forged entropy',self.randomrouter.functions.fulfillRandomness(request,bytes(32),proof),self.accounts[7])
            self.tx(self.randomrouter.functions.fulfillRandomness(request,entropy,proof),self.accounts[7]);self.tx(self.season.functions.startDraft(id));c['request']=request
            players=[Athlete(str(aid),'synthetic-NHL-team',frozenset(p for p,mask in [('C',1),('LW',2),('RW',4),('D',8),('G',16)] if pos&mask),0,pos==16) for aid,pos in self.players]
            snapshot=Snapshot('NHL',1,players,c['periods'][1]['config'][0],['0x'+g.hex() for p in c['periods'].values() for g,_ in p['games']])
            mode=['total-points','h2h-points','h2h-categories','roto'][c['mode']]
            periods=[('week-'+str(w),p['config'][0],p['config'][1],p['config'][2]+86400) for w,p in c['periods'].items()]
            order=[str(m) for m in self.rosters.functions.orderOf(id).call()]
            c['reference']=ApprovedSeason(c['label'],snapshot,list(map(str,range(1,5))),periods,mode,c['draftStart'],self.data.functions.configOf(id).call()[5],order,{'week-1':2,'week-2':2},list(map(str,range(1,54))),{pid:{'resolution':c['periods'][i+1]['config'][2]} for i,(pid,_,_,_) in enumerate(periods)})
            c['reference'].set_preferences('1',['1'],c['draftStart']-1)
        self.advance(self.draft_start)
        for c in cases:
            self.advance(c['draftStart'])
            id=c['id'];counts={m:0 for m in range(1,5)};used_auto=False
            while self.rosters.functions.actor(id).call():
                m=self.rosters.functions.actor(id).call();actor=self.accounts[m];subject=bytes.fromhex(self.profiles[m]['subject'][2:])
                if m==1 and not used_auto:
                    turn=self.rosters.functions.leagueOf(id).call()[2];self.advance(turn+60);self.tx(c['custodian'].autopick(id));used_auto=True
                    if c['reference'].autopick('1',self.w3.eth.get_block('latest').timestamp)!='1':raise AssertionError('independent autopick mismatch')
                else:
                    self.execution_context=(c['label'],'draft',m,counts[m]);self.tx(self.actions.functions.pick(id,subject,(m-1)*12+counts[m]+1),actor)
                    c['reference'].draft(str(m),str((m-1)*12+counts[m]+1),self.w3.eth.get_block('latest').timestamp)
                counts[m]+=1
            if any(len(self.rosters.functions.rosterOf(id,m).call())!=12 for m in range(1,5)):raise AssertionError('twelve roster positions not drafted')
            for m in range(1,5):
                if c['reference'].rosters[str(m)]!=set(map(str,self.rosters.functions.rosterOf(id,m).call())):raise AssertionError('independent drafted ownership mismatch')
            self.reject(c['label']+' late preference',self.actions.functions.setPrivate(id,bytes.fromhex(self.profiles[1]['subject'][2:]),0,c['preferenceReceipt']),self.accounts[1])
            self.reject(c['label']+' premature final payout',self.season.functions.settle(id))

    def prepare_transactions(self,c):
        id=c['id'];client=c['client'];custodian=c['custodian']
        # Trade bench centers, preserve fixed-size rosters and period-one history.
        self.tx(self.actions.functions.proposeTrade(id,bytes.fromhex(self.profiles[1]['subject'][2:]),2,[8],[20]),self.accounts[1])
        self.tx(self.actions.functions.acceptTrade(id,bytes.fromhex(self.profiles[2]['subject'][2:]),0),self.accounts[2])
        c['reference'].propose_trade('t','1','2',['8'],['20'],self.w3.eth.get_block('latest').timestamp)
        c['reference'].accept_trade('t','2',self.w3.eth.get_block('latest').timestamp)
        c['queues']={}
        for m,claims in [(4,[(49,37),(50,38)]),(3,[(49,25),(51,27)])]:
            subject=bytes.fromhex(self.profiles[m]['subject'][2:]);root,payload=client.waiver(id,2,m,claims,k256((c['label']+'waiver'+str(m)).encode()))
            req=client.prepare(id,subject,2,root,len(claims),payload,self.encryption.public_key().export_key(format='raw'));sig=self.w3.eth.sign(self.accounts[m],text=req['message']);receipt=custodian.attest(req,sig)
            self.tx(self.actions.functions.setPrivate(id,subject,2,receipt),self.accounts[m])
            c['queues'][str(m)]=[(str(a),str(d)) for a,d in claims]
        try:custodian.waivers_due(id,2)
        except ValueError:pass
        else:raise AssertionError('private waivers leaked before cutoff')

    def prepare_early_start(self,c,week):
        id=c['id'];lock=c['periods'][week]['config'][0]
        self.advance(lock-(1800 if week==1 else 9000))
        member=1 if week==1 else 4;subject=bytes.fromhex(self.profiles[member]['subject'][2:])
        self.grant(self.accounts[member],k256(b'BET_FANTASY_ENTER'),self.auth.functions.scopeForContest(id).call())
        if week==1:
            selected=[1,2,3,4,5,6,7]
            self.tx(self.actions.functions.setLineup(id,subject,week,selected),self.accounts[member])
            c['reference'].set_lineup('1','week-1',list(map(str,selected)),self.w3.eth.get_block('latest').timestamp)
        else:
            self.grant(self.validator.address,k256(b'BET_FANTASY_VALIDATE_SEASON_PRIVATE.V1'),self.auth.functions.scopeForContest(id).call())
            claims=[(49,37),(50,38)];root,payload=c['client'].waiver(id,week,member,claims,k256(b'late private queue salt'))
            req=c['client'].prepare(id,subject,week,root,len(claims),payload,self.encryption.public_key().export_key(format='raw'))
            receipt=c['custodian'].attest(req,self.w3.eth.sign(self.accounts[member],text=req['message']))
            self.tx(self.actions.functions.setPrivate(id,subject,week,receipt),self.accounts[member])
        c['earlyWeek']=week

    def lock_first(self,c):
        self.advance(c['periods'][1]['config'][0]);self.tx(self.rosters.functions.lock(c['id'],1))
        c['reference'].lock_period('week-1',self.w3.eth.get_block('latest').timestamp)
        for m in range(1,5):
            selected=self.rosters.functions.lineupOf(c['id'],1,m).call();self.reject(c['label']+' late lineup edit',self.actions.functions.setLineup(c['id'],bytes.fromhex(self.profiles[m]['subject'][2:]),1,selected),self.accounts[m])

    def second_week(self,c,phase):
        id=c['id'];p=c['periods'][2]['config']
        if phase=='reveal':
            self.advance(p[3])
            for fn in c['custodian'].waivers_due(id,2):self.tx(fn)
            self.reject(c['label']+' early roster processing',self.transactions.functions.process(id,2))
        elif phase=='process':
            self.advance(p[4]);self.tx(self.transactions.functions.process(id,2));now=self.w3.eth.get_block('latest').timestamp
            c['reference'].execute_trade('t',now,p[0]);c['reference'].process_waivers(c['queues'],now,p[0])
            if self.rosters.functions.owner(id,8).call()!=2 or self.rosters.functions.owner(id,20).call()!=1:raise AssertionError('accepted trade did not execute before waivers')
            for m in range(1,5):
                if c['reference'].rosters[str(m)]!=set(map(str,self.rosters.functions.rosterOf(id,m).call())):raise AssertionError('independent trade/waiver ownership mismatch')
        elif phase=='lock':
            self.advance(p[0]);self.tx(self.rosters.functions.lock(id,2));c['reference'].lock_period('week-2',self.w3.eth.get_block('latest').timestamp)
            for m in range(1,5):
                if tuple(map(str,self.rosters.functions.lineupOf(id,2,m).call()))!=c['reference'].lineups[('week-2',str(m))]:raise AssertionError('independent carry-forward/fallback mismatch')

    def score_week(self,c,week):
        id=c['id'];p=c['periods'][week];self.advance(p['config'][2]);revision=1;rows=[];leaves=[]
        for aid,pos in self.players:
            goalie=pos==16;stats=[self.stat(goalie,4 if aid%2 else 1) for _ in p['games']]
            row=(aid,True,[g for g,_ in p['games']],[[s[f] for f in FIELDS] for s in stats],[100]*len(stats),[goalie]*len(stats),[0]*len(stats))
            leaf=season_leaf(self.w3.eth.chain_id,self.data.address,id,self.data.functions.manifest(id).call(),week,revision,row)
            if leaf!=self.data.functions.factLeaf(id,week,revision,row).call():raise AssertionError('contract-derived season statement/export incompatibility')
            rows.append(row);leaves.append(leaf)
        root,proofs=merkle(leaves);report=(root,k256(b'explicit synthetic per-game complete season facts'),revision,self.w3.eth.get_block('latest').timestamp)
        dispositions=[(g,0,0,False,True) if c.get('allVoid') else (g,t-(3600 if week==1 else 10800) if c.get('earlyWeek')==week else t,t+100,True,False) for g,t in p['games']]
        period_void=c.get('allVoid') or c.get('earlyWeek')==week
        self.report(p['feed'],self.data.functions.reportDigest(id,week,report,dispositions).call());self.tx(self.data.functions.update(id,week,report,dispositions))
        if c.get('earlyWeek')==week and not self.seasonscores.functions.isVoid(id,week).call():raise AssertionError('late accepted intent failed to void early-start week')
        for m in ([] if period_void else range(1,5)):
            lineup=self.rosters.functions.lineupOf(id,week,m).call();witness=encode([WFACT+'[7]','bytes32[][7]'],[[rows[a-1] for a in lineup],[proofs[a-1] for a in lineup]])
            if m==1:
                bad=bytearray(witness);bad[-1]^=1;self.reject(c['label']+' altered weekly witness',self.seasonscores.functions.score(id,week,m,bytes(bad)))
            self.tx(self.seasonscores.functions.score(id,week,m,witness))
        reference_facts={}
        for aid,pos in self.players:
            selected=[]
            for game,stat_values,seconds_,started,powerplay in zip(rows[aid-1][2],rows[aid-1][3],rows[aid-1][4],rows[aid-1][5],rows[aid-1][6]):
                s=dict(zip(FIELDS,stat_values));goalie=pos==16
                metrics={'goals':0 if goalie else s['goals'],'assists':0 if goalie else s['assists'],'shots':0 if goalie else s['shots'],'blocks':0 if goalie else s['blocks'],'powerplay':0 if goalie else powerplay,'shorthanded':0 if goalie else s['shorthanded'],
                         'wins':int(s['win']),'shutouts':int(s['shutout']),'saves':s['saves'],'shotsAgainst':s['saves']+s['goalsAgainst'],'goalsAgainst':s['goalsAgainst'],'seconds':seconds_ if goalie else 0,'starts':int(started)}
                selected.append({'id':'0x'+game.hex(),'stats':s,'metrics':metrics})
            reference_facts[str(aid)]={'games':selected}
        if period_void:c['reference'].void_period('week-'+str(week))
        else:
            required={a for m in c['reference'].members for a in c['reference'].lineups[('week-'+str(week),m)]}
            c['reference'].score_period('week-'+str(week),revision,{a:reference_facts[a] for a in required},report[3],c['reference'].snapshot.hash)
        candidate=self.season.functions.weekCandidate(id,week).call();child=self.season.functions.weekDisputeId(id,week).call()
        self.report(p['candidateFeed'],self.disputes.functions.candidateDigest(child,candidate).call());self.tx(self.season.functions.publishWeek(id,week))
        c.setdefault('weekCandidates',{})[week]=candidate

    def finalize_week(self,c,week):
        self.advance(c['periods'][week]['config'][2]+2*86400+1);self.tx(self.disputes.functions.finalize(self.season.functions.weekDisputeId(c['id'],week).call()))

    def finish_season(self,c):
        id=c['id'];expected=c['reference'].rank(self.w3.eth.get_block('latest').timestamp)
        for m in range(1,5):
            actual=self.seasonscores.functions.rank(id,m).call();want=expected[str(m)]*(1 if c['mode']==0 else 27720)
            if actual!=want:raise AssertionError('independent final standings mismatch: '+str((c['mode'],m,actual,want)))
        self.tx(self.season.functions.initializeFinal(id));order=sorted(range(1,5),key=lambda m:(-self.seasonscores.functions.rank(id,m).call(),m));previous=0
        for m in order:self.tx(self.season.functions.rankMember(id,m,previous,0));previous=m
        ranking=contract(self.w3,self.build,'FantasyRankingBook420',self.season.functions.rankings().call());self.tx(ranking.functions.walk(id,1,64));self.tx(ranking.functions.allocate(id,1,64))
        self.tx(self.season.functions.publishFinal(id));self.tx(self.season.functions.settle(id))
        for m in range(1,5):self.tx(self.season.functions.collect(id,m));self.reject(c['label']+' duplicate final claim',self.season.functions.collect(id,m))
        self.outcomes.append({'case':c['label'],'mode':c['mode'],'users':4,'weeklyCanonicalFinality':True,'randomnessRequest':'0x'+c['request'].hex(),'pool':'0x'+id.hex()});c['custodian'].close()

    def collect_refunds(self,c,reason):
        id=c['id'];before={a:self.season.functions.credit(a).call() for a in self.accounts}
        if self.season.functions.stateOf(id).call()!=5:self.tx(self.season.functions.recover(id))
        for m in range(1,c['users']+1):
            self.tx(self.season.functions.collect(id,m));self.reject(c['label']+' duplicate refund',self.season.functions.collect(id,m))
            if self.season.functions.credit(self.accounts[m]).call()-before[self.accounts[m]]!=c['stake']:raise AssertionError('original season entry not fully refunded')
        if self.season.functions.credit(self.accounts[8]).call()!=before[self.accounts[8]]:raise AssertionError('canceled season charged development fee')
        if self.season.functions.credit(self.admin).call()-before[self.admin]!=c['prize']:raise AssertionError('launcher prize refund mismatch')
        for week in (1,2):self.tx(self.season.functions.collectCanceledBond(id,week))
        self.outcomes.append({'case':c['label'],'users':c['users'],'canceled':True,'reason':reason,'pool':'0x'+id.hex()});c['custodian'].close()

    def official_cancel(self,c):
        evidence=k256(b'explicit synthetic official NHL season cancellation');self.report(c['periods'][1]['feed'],self.data.functions.cancellationDigest(c['id'],evidence).call());self.tx(self.data.functions.cancelSeason(c['id'],evidence))
        self.collect_refunds(c,'canonical official season cancellation')

    def challenge_week(self,c,denied=False):
        id=c['id'];child=self.season.functions.weekDisputeId(id,1).call();d=self.disputes.functions.poolOf(child).call();self.advance(d[1]+1)
        actor=self.accounts[1];subject=bytes.fromhex(self.profiles[1]['subject'][2:]);self.tx(self.token.functions.approve(self.disputes.address,2**255),actor)
        fn=self.disputes.functions.challenge(child,subject,k256((c['label']+' weekly challenge evidence').encode()));claim=fn.call({'from':actor});self.tx(fn,actor);c['claim']=claim
        self.reject(c['label']+' unresolved weekly result blocks final ranking',self.season.functions.initializeFinal(id))
        if denied:
            neutral,resolver_subject,credential=self.neutral_resolver();reason=k256(b'evidence-backed synthetic denied free-pool claim')
            self.grant(neutral.address,self.disputes.functions.RESOLVE().call(),self.disputes.functions.claimScope(claim).call(),valid_until=d[3])
            self.reject(c['label']+' cannot resolve before challenge close',self.disputes.functions.resolve(claim,False,reason,d[8],resolver_subject,credential,0),neutral.address)
            self.advance(d[4]+1);self.signed_tx(self.disputes.functions.resolve(claim,False,reason,d[8],resolver_subject,credential,0),neutral)
            before=self.disputes.functions.credit(self.accounts[9]).call();self.tx(self.disputes.functions.collectBond(claim))
            expected=(c['stake']+1)//2 if c['stake'] else (c['prize']+9)//10
            if self.disputes.functions.credit(self.accounts[9]).call()-before!=expected:raise AssertionError('free/paid season challenge bond formula/beneficiary')

    def timeout_week(self,c):
        child=self.season.functions.weekDisputeId(c['id'],1).call();self.advance(self.disputes.functions.poolOf(child).call()[3]+1)
        self.collect_refunds(c,'unresolved weekly result at fixed deadline');before=self.disputes.functions.credit(self.accounts[1]).call();self.tx(self.disputes.functions.collectBond(c['claim']))
        if self.disputes.functions.credit(self.accounts[1]).call()-before!=(c['stake']+1)//2:raise AssertionError('unresolved weekly bond not returned')

    def assert_conservation(self):
        for actor in self.accounts:
            if self.season.functions.credit(actor).call():self.tx(self.season.functions.withdrawCredit(),actor)
        if self.season.functions.totalLiability().call()!=0 or self.token.functions.balanceOf(self.season.address).call()!=0:raise AssertionError('season escrow balance/liability not zero')
        for actor in self.accounts:
            if self.disputes.functions.credit(actor).call():self.tx(self.disputes.functions.withdrawCredit(),actor)
        if self.disputes.functions.totalLiability().call()!=0 or self.token.functions.balanceOf(self.disputes.address).call()!=0:raise AssertionError('season challenge bond balance/liability not zero')

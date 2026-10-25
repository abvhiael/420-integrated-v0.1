"""Executable user-approved V1 policies. Production activation stays external."""
from fractions import Fraction
import copy
from .core import Rules,Unresolved,integer,digest,allocate
from .drafts import draft
from .publisher import legal_assignment
from .salary import SalaryContest
from .season import SeasonLeague

SKATERS=['C','LW','RW','D']
CATEGORIES=[{'id':name,'numerator':field,'denominator':den,'direction':direction,'minimumDenominator':0}
    for name,field,den,direction in [('goals','goals',None,'higher'),('assists','assists',None,'higher'),('shots','shots',None,'higher'),
    ('blocks','blocks',None,'higher'),('powerplay','powerplay',None,'higher'),('shorthanded','shorthanded',None,'higher'),
    ('wins','wins',None,'higher'),('shutouts','shutouts',None,'higher'),('savePercentage','saves','shotsAgainst','higher'),('GAA','goalsAgainstScaled','seconds','lower')]]
GOALIE_CATEGORIES={'wins','shutouts','savePercentage','GAA'}


def salary_rules(kind):
    if kind not in ('salary-cap','captain'):raise ValueError('salary variant required')
    c=draft(kind).config;c.update(id='NHL-'+kind.upper()+'-APPROVED-V1',status='test-only')
    return Rules.freeze(c)


class ApprovedSalary(SalaryContest):
    def __init__(self,contest_id,kind,snapshot):
        super().__init__(contest_id,salary_rules(kind),snapshot)
        if kind=='captain' and len(snapshot.events)!=1:raise ValueError('captain is single game')
        p=self.rules.parameters
        self.feasible=legal_assignment(snapshot.athletes,p['slots'],p['salaryCap'],p['captainIndex'],p['minimumTeams'],p['maximumPerTeam'])


def round_robin(members,weeks):
    members=sorted(members)
    if len(members)%2:raise ValueError('even H2H membership required')
    cycle=[];circle=list(members)
    for _ in range(len(circle)-1):
        cycle.append(tuple((circle[i],circle[-i-1]) for i in range(len(circle)//2)))
        circle=[circle[0],circle[-1],*circle[1:-1]]
    return tuple(cycle[i%len(cycle)] for i in range(weeks))


class ApprovedSeason(SeasonLeague):
    def __init__(self,league_id,snapshot,members,periods,mode,draft_start,trade_deadline,random_order,minimums,platform_ranking,windows=None):
        if not 4<=len(members)<=12 or len(set(members))!=len(members):raise ValueError('4-12 distinct teams required')
        if set(random_order)!=set(members) or len(random_order)!=len(members):raise ValueError('complete verified draft permutation required')
        config=draft('season-long',members=members,mode=mode).config
        config.update(id='NHL-SEASON-'+mode.upper()+'-APPROVED-V1',status='test-only')
        config['parameters'].update(draftStart=draft_start,tradeDeadline=trade_deadline,draftOrder=list(random_order),waiverPriority=list(reversed(random_order)),categories=copy.deepcopy(CATEGORIES) if mode in ('h2h-categories','roto') else [])
        super().__init__(league_id,Rules.freeze(config),snapshot,members,periods)
        if len(set(platform_ranking))!=len(platform_ranking) or set(platform_ranking)!=set(snapshot.athletes):raise ValueError('complete frozen fallback ranking required')
        if set(minimums)!={p[0] for p in periods} or any(type(v) is not int or v not in (1,2) for v in minimums.values()):raise ValueError('published weekly start minima required')
        self.minimums=dict(minimums);self.platform_ranking=tuple(platform_ranking);self.preferences={};self.voided=set();self.starts={}
        self.windows=copy.deepcopy(windows) if windows is not None else {p[0]:{'resolution':p[2]} for p in periods}
        if set(self.windows)!={p[0] for p in periods}:raise ValueError('period window inventory')
        self.trades={};self.batch=0;self.available_after={};self.last_processing=-1
        if mode.startswith('h2h-'):
            for period,pairs in zip(periods,round_robin(members,len(periods))):self.schedule(period[0],pairs,draft_start)

    def set_preferences(self,actor,ranking,now):
        if actor not in self.rosters or integer(now)>=self.rules.parameters['draftStart'] or len(set(ranking))!=len(ranking) or not set(ranking)<=set(self.snapshot.athletes):raise ValueError('preference freeze/identity')
        self.preferences[actor]=tuple(ranking)

    def _fillable(self,roster):
        return legal_assignment({a:self.snapshot.athletes[a] for a in roster},self.rules.parameters['activeSlots'])

    def _matching_size(self,slots,available):
        assigned={}
        def augment(slot,seen):
            for aid in available(slot):
                if aid in seen:continue
                seen.add(aid)
                if aid not in assigned or augment(assigned[aid],seen):assigned[aid]=slot;return True
            return False
        return sum(augment(slot,set()) for slot in slots)

    def _owned_rank(self,roster):
        slots=self.rules.parameters['activeSlots']
        return self._matching_size(list(range(7)),lambda i:sorted(a for a in roster if self.snapshot.athletes[a].positions.intersection(slots[i])))

    def _draft_feasible(self,actor,athlete):
        if athlete in self.owner:raise ValueError('athlete already owned')
        rosters={m:set(v)|({athlete} if m==actor else set()) for m,v in self.rosters.items()}
        slots=self.rules.parameters['activeSlots'];free=set(self.snapshot.athletes)-set().union(*rosters.values())
        for roster in rosters.values():
            if 7-self._owned_rank(roster)>12-len(roster):raise ValueError('remaining picks cannot fill active lineup')
        allslots=[(m,i) for m in self.members for i in range(7)]
        def candidates(slot):
            m,i=slot
            return sorted(a for a in rosters[m]|free if self.snapshot.athletes[a].positions.intersection(slots[i]))
        if self._matching_size(allslots,candidates)!=len(allslots):raise ValueError('shared league supply cannot fill every manager')

    def draft(self,actor,athlete,now):
        if actor not in self.rosters or athlete not in self.snapshot.athletes:raise ValueError('draft identity')
        self._draft_feasible(actor,athlete);super().draft(actor,athlete,now)

    def autopick(self,actor,now):
        if actor!=self.draft_actor() or actor is None or not self._draft_turn_started+60<=integer(now)<self.periods[0][1]:raise ValueError('autopick turn/timeout')
        ordered=list(dict.fromkeys(self.preferences.get(actor,())+self.platform_ranking))
        rank=self._owned_rank(self.rosters[actor])
        for aid in ordered:
            if aid in self.owner or (rank<7 and self._owned_rank(self.rosters[actor]|{aid})<=rank):continue
            try:self._draft_feasible(actor,aid)
            except ValueError:continue
            self.rosters[actor].add(aid);self._picks+=1;self._draft_turn_started=now;return aid
        raise Unresolved('no legal autopick')

    def lock_period(self,pid,now):
        if integer(now)<self._period(pid)[1] or self.draft_actor() is not None:raise ValueError('period/draft not ready')
        for actor in self.members:
            if (pid,actor) in self.lineups:continue
            previous=[p for p in self.periods if p[1]<self._period(pid)[1] and (p[0],actor) in self.lineups]
            preferred=self.lineups[(previous[-1][0],actor)] if previous else ()
            self.lineups[(pid,actor)]=legal_assignment({a:self.snapshot.athletes[a] for a in self.rosters[actor]},self.rules.parameters['activeSlots'],preferred=preferred)

    def propose_trade(self,trade_id,a,b,give,receive,now):
        if trade_id in self.trades or a==b or a not in self.rosters or b not in self.rosters or integer(now)>=self.rules.parameters['tradeDeadline']:raise ValueError('trade identity/deadline')
        give=tuple(give);receive=tuple(receive)
        if not give or len(give)!=len(receive) or len(set(give))!=len(give) or len(set(receive))!=len(receive):raise ValueError('equal unique player exchange required')
        self.trades[trade_id]={'a':a,'b':b,'give':give,'receive':receive,'accepted':{a},'acceptedAt':None,'challenged':False,'closed':False}

    def accept_trade(self,trade_id,actor,now):
        t=self.trades[trade_id]
        if t['closed'] or actor!=t['b'] or t['acceptedAt'] is not None or integer(now)>=self.rules.parameters['tradeDeadline']:raise ValueError('trade acceptance')
        t['accepted'].add(actor);t['acceptedAt']=now

    def execute_trade(self,trade_id,now,cutoff):
        t=self.trades[trade_id]
        if t['closed'] or t['acceptedAt'] is None:raise ValueError('trade not mutually accepted')
        if integer(now)>=integer(cutoff) or now>=self.rules.parameters['tradeDeadline']:t['closed']=True;return False
        if t['challenged'] or now<t['acceptedAt']+86400:raise Unresolved('trade review not complete')
        a,b=t['a'],t['b'];give,receive=set(t['give']),set(t['receive'])
        self._fillable((self.rosters[a]-give)|receive);self._fillable((self.rosters[b]-receive)|give)
        super().trade(a,b,t['give'],t['receive'],[a,b],now);t['closed']=True;return True

    def process_waivers(self,queues,now,cutoff):
        self._between(now)
        if self.draft_actor() is not None or integer(now)>=integer(cutoff) or now<=self.last_processing:raise ValueError('waiver cutoff/order')
        if any(not t['closed'] and t['acceptedAt'] is not None for t in self.trades.values()):raise Unresolved('process accepted trades before waivers')
        if set(queues)-set(self.members):raise ValueError('unknown claimant')
        work={m:list(queues.get(m,())) for m in self.members};initially_owned=set(self.owner);success=[];self.batch+=1
        while any(work.values()):
            progress=False
            for actor in tuple(self._priority):
                while work[actor]:
                    add,drop=work[actor].pop(0)
                    if add not in self.snapshot.athletes or add in initially_owned or add in self.owner or drop not in self.rosters[actor] or self.available_after.get(add,0)>self.batch:continue
                    roster=(self.rosters[actor]-{drop})|{add}
                    try:self._fillable(roster)
                    except ValueError:continue
                    self.rosters[actor]=roster;self.available_after[drop]=self.batch+1;self._priority.remove(actor);self._priority.append(actor)
                    self._invalidate_future([actor],now);success.append((actor,add,drop));progress=True;break
            if not progress:break
        self.last_processing=now;return success

    def void_period(self,pid):
        self._period(pid);self.voided.add(pid);self.results.pop(pid,None);self.starts.pop(pid,None)

    def score_period(self,pid,revision,facts,now,snapshot_hash,registry=None):
        from .core import SportRegistry
        integer(revision,1);period=self._period(pid)
        if pid in self.voided or snapshot_hash!=self.snapshot.hash or not self.windows[pid]['resolution']<=integer(now)<period[3] or revision<=self.revisions.get(pid,0):raise ValueError('period/revision/correction context')
        self.lock_period(pid,now)
        required={a for m in self.members for a in self.lineups[(pid,m)]}
        if set(facts)!=required:raise Unresolved('exact active-player fact inventory required')
        registry=registry or SportRegistry();category_mode=self.rules.parameters['mode'] in ('h2h-categories','roto');result={};starts={}
        fields={'goals','assists','shots','blocks','powerplay','shorthanded','wins','shutouts','saves','shotsAgainst','goalsAgainst','seconds','starts'}
        for m in self.members:
            points=Fraction();raw_total={k:0 for k in fields}
            for aid in self.lineups[(pid,m)]:
                games=facts[aid].get('games',[facts[aid]])
                if not isinstance(games,list) or (not games and facts[aid].get('complete') is not True):raise Unresolved('complete per-game records required')
                if len({g.get('id',str(i)) for i,g in enumerate(games)})!=len(games):raise Unresolved('duplicate athlete game')
                goalie=self.snapshot.athletes[aid].goalie
                for g in games:
                    # Milestones are awarded per game, never on weekly aggregated shots/goals.
                    points+=registry.score(self.snapshot.sport,self.rules.config['scoring'],self.snapshot.athletes[aid],g['stats'])
                    if not category_mode:continue
                    raw=g['metrics']
                    if set(raw)!=fields:raise Unresolved('complete category fields required')
                    for value in raw.values():integer(value)
                    if raw['starts']>1 or raw['wins']>1 or raw['shutouts']>1:raise Unresolved('per-game goalie flags required')
                    comparable=('saves','goalsAgainst') if goalie else ('goals','assists','shots','blocks','shorthanded')
                    if any(raw[k]!=g['stats'][k] for k in comparable):raise Unresolved('category/daily-stat mismatch')
                    if goalie and any(raw[k] for k in ('goals','assists','shots','blocks','powerplay','shorthanded')):raise Unresolved('skater category fields on goalie')
                    if raw['wins']!=int(g['stats']['win']) or raw['shutouts']!=int(g['stats']['shutout']) or raw['powerplay']>raw['goals']+raw['assists']:raise Unresolved('category decision mismatch')
                    if not goalie and any(raw[k] for k in ('wins','shutouts','saves','shotsAgainst','goalsAgainst','seconds','starts')):raise Unresolved('goalie fields on skater')
                    if goalie and raw['shotsAgainst']!=raw['saves']+raw['goalsAgainst']:raise Unresolved('goalie shot conservation')
                    for k,v in raw.items():raw_total[k]+=v
            categories={}
            raw_total['goalsAgainstScaled']=3600*raw_total['goalsAgainst']
            for c in self.rules.parameters['categories']:
                categories[c['id']]=(Fraction(raw_total[c['numerator']]),Fraction(raw_total[c['denominator']]) if c['denominator'] else Fraction(1))
            result[m]={'points':points,'categories':categories};starts[m]=raw_total['starts']
        statement=digest({'domain':'420.FANTASY.SEASON.APPROVED.RESULT.V1','league':self.id,'profile':self.rules.hash,'snapshot':self.snapshot.hash,'period':pid,'revision':revision,'lineups':{m:self.lineups[(pid,m)] for m in self.members},'facts':facts,'result':result})
        self.results[pid]=result;self.revisions[pid]=revision;self.starts[pid]=starts;return statement

    def rank(self,now):
        active=[p for p in self.periods if p[0] not in self.voided]
        if not active:raise Unresolved('no eligible weeks; full refund')
        if any(integer(now)<p[3] or p[0] not in self.results for p in active):raise Unresolved('period/corrections incomplete')
        mode=self.rules.parameters['mode'];values={m:Fraction() for m in self.members}
        if mode=='total-points':return {m:sum((self.results[p[0]][m]['points'] for p in active),Fraction()) for m in self.members}
        def category(row,c,eligible):
            if c['id'] in GOALIE_CATEGORIES and not eligible:return None
            n,d=row['categories'][c['id']]
            return n/d if c['denominator'] and d>0 else None if c['denominator'] else n
        if mode=='roto':
            total={m:{'categories':{c['id']:(Fraction(),Fraction()) for c in CATEGORIES}} for m in self.members}
            for p in active:
                for m in self.members:
                    for cid,(n,d) in self.results[p[0]][m]['categories'].items():
                        a,b=total[m]['categories'][cid];total[m]['categories'][cid]=(a+n,b+d)
            required=sum(self.minimums[p[0]] for p in active)
            for c in CATEGORIES:
                rows=[(m,category(total[m],c,sum(self.starts[p[0]][m] for p in active)>=required)) for m in self.members];rows=[v for v in rows if v[1] is not None]
                rows.sort(key=lambda v:v[1],reverse=c['direction']=='higher');i=0
                while i<len(rows):
                    j=i+1
                    while j<len(rows) and rows[j][1]==rows[i][1]:j+=1
                    points=sum((Fraction(len(self.members)-r) for r in range(i,j)),Fraction())/(j-i)
                    for m,_ in rows[i:j]:values[m]+=points
                    i=j
            return values
        for p in active:
            for a,b in self.matchups[p[0]]:
                if mode=='h2h-points':pairs=[(self.results[p[0]][a]['points'],self.results[p[0]][b]['points'],'higher')]
                else:pairs=[(category(self.results[p[0]][a],c,self.starts[p[0]][a]>=self.minimums[p[0]]),category(self.results[p[0]][b],c,self.starts[p[0]][b]>=self.minimums[p[0]]),c['direction']) for c in CATEGORIES]
                for x,y,direction in pairs:
                    if x is None and y is None:continue
                    if x==y:values[a]+=Fraction(1,2);values[b]+=Fraction(1,2)
                    elif y is None or (x is not None and ((x>y)==(direction=='higher'))):values[a]+=1
                    else:values[b]+=1
        return values

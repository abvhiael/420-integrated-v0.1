"""Approved-rule golden vectors, adversarial transitions and conservation checks."""
import copy
import itertools
from datetime import datetime,timezone
from fractions import Fraction as F
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from formats.core import Athlete,Snapshot,Unresolved,digest
from formats.publisher import publish,price,legal_assignment
from formats.approved import ApprovedSalary,ApprovedSeason,round_robin
from formats.selection import Board,ApprovedCard,ApprovedPeer,ApprovedHouse
from formats.pickem import Market
from formats.timing import weekly_periods,resolve_games
from formats.source import normalise_extended,week_facts
from test_sportradar_scoring import fixture as source_fixture,ASOF,CUTOFF
from sportradar import CaptureError
from nhl import FIELDS


def stats(goalie=False,**updates):
    s={k:0 if i<8 else False for i,k in enumerate(FIELDS)};s.update(complete=True,played=True)
    if goalie:s.update(saves=10,goalsAgainst=1)
    s.update(updates);return s


def salary_inputs():
    athletes=[];groups={};history=[];cutoff=2000000000
    for group,pos in [('F','C'),('D','D'),('G','G')]:
        for i in range(6):
            aid=group+str(i);athletes.append(Athlete(aid,'team'+str(i%3),frozenset([pos]),0,group=='G'));groups[aid]=group
            for j in range(5 if i<5 else 2):
                history.append({'athlete':aid,'game':f'g{j}','appearanceAt':cutoff-10000-j*100,'completedAt':cutoff-9000-j*100,'availableAt':cutoff-8000-j*100,'seasonType':'regular','revision':1,'stats':stats(group=='G',shots=i if group!='G' else 0)})
    return athletes,groups,history,cutoff


def board(games=3):
    # Explicit synthetic official NHL-wide schedule; not a real provider capture.
    start=int(datetime(2030,1,7,23,tzinfo=timezone.utc).timestamp());schedule=[('g'+str(i),start+i*60) for i in range(games)]
    markets=[]
    for i in range(6):
        markets.append(Market('m'+str(i),'g'+str(i%games),'a'+str(i),'shots' if i<5 else 'saves',F(5,2),start,'unused'))
    return Board('2030-01-07',schedule,markets,{'a5'},start-1000)


def card(b,ids=('m0','m1'),sides=None):return ApprovedCard(b,list(zip(ids,sides or ['over']*len(ids))),len(ids),b.lock_at-10)


def facts(b,values=None,started=True):
    return {m.id:{'marketHash':digest(m.statement),'final':True,'eligible':True,'iceSeconds':100,'started':started if m.subject in b.goalies else False,'value':(values or {}).get(m.id,3)} for m in b.markets}


def selected_facts(c,all_facts):return {m.id:all_facts[m.id] for m,_ in c.legs}


def league(mode='total-points',draft_now=True):
    members=list('abcd');athletes=[];rosters={}
    for m in members:
        rosters[m]=[]
        for i,pos in enumerate(['C','LW','RW','D','D','G','C','C','LW','RW','D','G']):
            aid=m+f'{i:02}';rosters[m].append(aid);athletes.append(Athlete(aid,m,frozenset([pos]),0,pos=='G'))
    # Extra waiver replacements are available for every position.
    for i,pos in enumerate(['C','LW','RW','D','G']):athletes.append(Athlete('z'+str(i),'extra',frozenset([pos]),0,pos=='G'))
    s=Snapshot('NHL',1,athletes,10000,['g'])
    l=ApprovedSeason('season',s,members,[('p1',10000,20000,30000),('p2',40000,50000,60000)],mode,1000,45000,members,{'p1':2,'p2':1},sorted(s.athletes),{'p1':{'resolution':21000},'p2':{'resolution':51000}})
    if draft_now:
        counts={m:0 for m in members};now=1001
        while l.draft_actor() is not None:
            actor=l.draft_actor();l.draft(actor,rosters[actor][counts[actor]],now);counts[actor]+=1;now+=1
    return l


def period_facts(l,pid,starts=2):
    l.lock_period(pid,l._period(pid)[1]);f={}
    for m in l.members:
        for aid in l.lineups[(pid,m)]:
            goalie=l.snapshot.athletes[aid].goalie
            metrics={k:0 for k in ('goals','assists','shots','blocks','powerplay','shorthanded','wins','shutouts','saves','shotsAgainst','goalsAgainst','seconds','starts')}
            if goalie:metrics.update(saves=10,shotsAgainst=11,goalsAgainst=1,seconds=1800,starts=1 if starts else 0)
            else:metrics.update(goals=1,shots=2,blocks=1,powerplay=1)
            f[aid]={'games':[{'id':'game-'+str(i),'stats':stats(goalie,goals=0 if goalie else 1,shots=0 if goalie else 2,blocks=0 if goalie else 1),'metrics':copy.deepcopy(metrics)} for i in range(2 if starts==2 else 1)]}
    return f


class PublisherTests(unittest.TestCase):
    def test_exact_ties_and_approved_median_prices(self):
        self.assertEqual(price(F(2),list(map(F,range(5))),2500,9000),5800)
        self.assertEqual(price(F(2),list(map(F,range(5))),2000,12000),7000)
    def test_limited_history_does_not_join_reference(self):
        a,g,h,c=salary_inputs();result=publish(a,g,h,c,'rev1',['g'],c+100)
        self.assertEqual(result['statement']['salaries']['salary-cap']['F5'],5800)
        self.assertEqual(set(result['statement']['fallback']),{'F5','D5','G5'})
    def test_future_correction_does_not_reprice(self):
        a,g,h,c=salary_inputs();old=publish(a,g,h,c,'rev1',['g'],c+100)['hash']
        future=copy.deepcopy(h[0]);future.update(revision=2,availableAt=c+1);future['stats']['shots']=100
        self.assertEqual(publish(a,g,h+[future],c,'rev1',['g'],c+100)['hash'],old)
    def test_missing_stats_not_fallback(self):
        a,g,h,c=salary_inputs();del h[0]['stats']['shots']
        with self.assertRaises(ValueError):publish(a,g,h,c,'r',['g'],c+100)
    def test_old_and_playoff_appearances_excluded(self):
        a,g,h,c=salary_inputs()
        for r in h:
            if r['athlete']=='F0':r['seasonType']='playoff'
        with self.assertRaises(Unresolved):publish(a,g,h,c,'r',['g'],c+100)
    def test_group_mismatch_rejected(self):
        a,g,h,c=salary_inputs();g['F0']='G'
        with self.assertRaises(ValueError):publish(a,g,h,c,'r',['g'],c+100)
    def test_feasibility_handles_dual_position_greedy_trap(self):
        a={'1':Athlete('1','t',frozenset(['C','D']),100),'2':Athlete('2','t',frozenset(['C']),100)}
        self.assertEqual(legal_assignment(a,[['C'],['D']]),('2','1'))
    def test_fallback_preserves_later_survivor_before_filling_empty_slot(self):
        a={str(i):Athlete(str(i),'t',frozenset(['C']),100) for i in (1,2,3)}
        # Slot zero lost athlete 9; athlete 1 survives in FLEX. Do not steal it.
        self.assertEqual(legal_assignment(a,[['C'],['C']],preferred=('9','1')),('2','1'))
    def test_budget_and_diversity_not_just_position_matching(self):
        a={'1':Athlete('1','t',frozenset(['C']),100),'2':Athlete('2','t',frozenset(['D']),100)}
        with self.assertRaises(Unresolved):legal_assignment(a,[['C'],['D']],199)
        with self.assertRaises(Unresolved):legal_assignment(a,[['C'],['D']],minimum_teams=2)


class SelectionTests(unittest.TestCase):
    def test_all_house_win_loss_void_outcomes_conserve_collateral(self):
        for size in (2,3):
            b=board();c=card(b,tuple('m'+str(i) for i in range(size)))
            for stake in (1,17,100,101):
                for outcomes in itertools.product('WLV',repeat=size):
                    reserve=stake*(3 if size==2 else 5)+(3*stake+99)//100
                    h=ApprovedHouse(b,size,stake,reserve);h.fund(reserve-stake);h.accept('a',c,stake,b.lock_at-1)
                    f=facts(b)
                    for i,outcome in enumerate(outcomes):
                        if outcome=='V':f['m'+str(i)].update(eligible=False,value=None,iceSeconds=0)
                        else:f['m'+str(i)]['value']=3 if outcome=='W' else 1
                    r=h.settle_candidate('a',selected_facts(c,f),b.lock_at);active=sum(v!='V' for v in outcomes)
                    expected=stake if active<2 else stake*(3 if active==2 else 5) if 'L' not in outcomes else 0
                    self.assertEqual(r['payout'],expected);self.assertGreaterEqual(h.available,0)
                    self.assertEqual(h.available+h.development+sum(h.credits.values())+h.reserved,h.cash)
    def test_three_game_day_no_same_game(self):
        b=board(3)
        with self.assertRaises(ValueError):card(b,('m0','m3'))
    def test_one_game_two_and_three_skater_whitelist(self):
        b=board(1);self.assertEqual(card(b,('m0','m1','m2')).size,3)
        self.assertEqual(card(b,('m0','m1')).size,2)
    def test_short_schedule_never_allows_goalie_sharing(self):
        b=board(1)
        with self.assertRaises(ValueError):card(b,('m0','m5'))
    def test_official_count_not_selected_board_count(self):
        b=board(3);subset=Board(b.day,b.schedule,[b.markets[0],b.markets[3]],set(),b.lock_at-100)
        with self.assertRaises(ValueError):card(subset,('m0','m3'))
    def test_relief_goalie_is_void_even_when_played(self):
        b=board(3);c=card(b,('m0','m5'));f=facts(b,started=False)
        self.assertEqual(c.grade(selected_facts(c,f),b.lock_at)['active'],1)
    def test_early_exit_still_counts(self):
        b=board();c=card(b);f=facts(b);f['m0']['iceSeconds']=1
        self.assertEqual(c.grade(selected_facts(c,f),b.lock_at)['multiplier'],3)
    def test_missing_value_not_loss(self):
        b=board();c=card(b);f=facts(b,{'m0':None})
        with self.assertRaises(Unresolved):c.grade(selected_facts(c,f),b.lock_at)
    def test_three_reduces_to_two_then_refunds_below_two(self):
        b=board();c=card(b,('m0','m1','m2'));f=facts(b);f['m0'].update(eligible=False,value=None)
        self.assertEqual(c.grade(selected_facts(c,f),b.lock_at)['multiplier'],3)
        f['m1'].update(eligible=False,value=None);self.assertEqual(c.grade(selected_facts(c,f),b.lock_at)['multiplier'],1)
    def test_peer_two_of_two_ties_three_of_three_after_void(self):
        b=board(2);p=ApprovedPeer('p',b,3,100,0,{3:[10000]});a=card(b,('m0','m1','m2'));d=card(b,('m2','m3','m4'))
        p.enter('a',a,100,b.lock_at-10);p.enter('b',d,100,b.lock_at-10);f=facts(b);f['m0'].update(eligible=False,value=None)
        required={m.id for c in (a,d) for m,_ in c.legs};r=p.settle_candidate({k:f[k] for k in required},b.lock_at)
        self.assertEqual(r['payouts'],{'a':97,'b':97});self.assertEqual(r['fee'],6)
    def test_peer_invalid_card_full_refund_fee_only_valid_stakes(self):
        b=board(2);p=ApprovedPeer('p',b,3,101,0,{3:[10000]});a=card(b,('m0','m1','m2'));d=card(b,('m2','m3','m4'))
        p.enter('a',a,101,b.lock_at-10);p.enter('b',d,101,b.lock_at-10);p.enter('c',d,101,b.lock_at-10)
        f=facts(b);f['m0'].update(eligible=False,value=None);f['m1'].update(eligible=False,value=None)
        r=p.settle_candidate({k:f[k] for k in ('m0','m1','m2','m3','m4')},b.lock_at)
        self.assertEqual(r['refunds'],{'a':101});self.assertEqual(sum(r['payouts'].values())+r['fee']+sum(r['refunds'].values()),303)
    def test_house_five_x_plus_fee_reserve(self):
        b=board();c=card(b,('m0','m1','m2'));h=ApprovedHouse(b,3,100,503);h.fund(402)
        with self.assertRaises(ValueError):h.accept('a',c,100,b.lock_at-10)
        h.fund(1);h.accept('a',c,100,b.lock_at-10);self.assertEqual(h.reserved,503)
        with self.assertRaises(ValueError):h.withdraw_house(1)
        r=h.settle_candidate('a',selected_facts(c,facts(b)),b.lock_at);self.assertEqual(r['payout'],500);self.assertEqual(h.development,3)
        self.assertEqual(h.claim('a'),500);self.assertEqual(h.cash,3)
    def test_house_fractional_fee_floor_once_over_retained(self):
        b=board();c=card(b);h=ApprovedHouse(b,2,17,10000);h.fund(1000)
        for user in ('a','b','c'):h.accept(user,c,17,b.lock_at-10)
        f=selected_facts(c,facts(b,{'m0':0}))
        for user in ('a','b','c'):h.settle_candidate(user,f,b.lock_at)
        self.assertEqual(h.development,1);self.assertEqual(h.available+h.development,h.cash)
    def test_house_no_fee_on_refund(self):
        b=board();c=card(b);h=ApprovedHouse(b,2,100,1000);h.fund(203);h.accept('a',c,100,b.lock_at-10)
        f=facts(b);f['m0'].update(eligible=False,value=None);r=h.settle_candidate('a',selected_facts(c,f),b.lock_at)
        self.assertTrue(r['refund']);self.assertEqual(h.development,0);self.assertEqual(h.claim('a'),100)
    def test_edits_do_not_take_second_payment(self):
        b=board();c=card(b);p=ApprovedPeer('p',b,2,100,0,{2:[10000]});p.enter('a',c,100,b.lock_at-20)
        p.enter('a',c,0,b.lock_at-10,2)
        with self.assertRaises(ValueError):p.enter('a',c,100,b.lock_at-5,3)


class SeasonTests(unittest.TestCase):
    def test_milestones_apply_per_game_not_per_week(self):
        l=league();l.lock_period('p1',10000);f={}
        target=l.lineups[('p1','a')][0]
        for m in l.members:
            for aid in l.lineups[('p1',m)]:
                zero={k:0 if i<8 else False for i,k in enumerate(FIELDS)};zero['complete']=True
                value=stats(shots=4) if aid==target else zero
                f[aid]={'games':[{'id':str(i),'stats':copy.deepcopy(value)} for i in range(2)]}
        l.score_period('p1',1,f,21000,l.snapshot.hash);l.void_period('p2')
        self.assertEqual(l.rank(60000)['a'],120)
    def test_real_twelve_round_snake_and_legality(self):
        l=league();self.assertTrue(all(len(r)==12 for r in l.rosters.values()));l.lock_period('p1',10000)
        self.assertTrue(all(len(l.lineups[('p1',m)])==7 for m in l.members))
    def test_preference_freeze_and_timeout(self):
        l=league(draft_now=False);l.set_preferences('a',['a00'],999)
        with self.assertRaises(ValueError):l.set_preferences('a',['a01'],1000)
        with self.assertRaises(ValueError):l.autopick('a',1059)
        self.assertEqual(l.autopick('a',1060),'a00')
    def test_carry_forward_and_deterministic_repair(self):
        l=league();l.lock_period('p1',10000);old=l.lineups[('p1','a')]
        l.lock_period('p2',40000);self.assertEqual(l.lineups[('p2','a')],old)
    def test_round_robin_balanced(self):
        pairs=round_robin(list('abcdef'),10);counts={}
        for week in pairs:
            self.assertEqual(len({m for p in week for m in p}),6)
            for a,b in week:key=tuple(sorted((a,b)));counts[key]=counts.get(key,0)+1
        self.assertEqual(set(counts.values()),{2})
    def test_multi_round_waivers_and_no_same_batch_recycling(self):
        l=league();w=l.process_waivers({'d':[('z0','d00'),('z1','d01')],'c':[('z0','c00'),('d00','c00'),('z2','c02')]},21000,30000)
        self.assertEqual(w,[('d','z0','d00'),('c','z2','c02'),('d','z1','d01')]);self.assertNotIn('d00',l.rosters['c'])
    def test_trade_requires_review_and_blocks_waivers_until_processed(self):
        l=league();l.propose_trade('t','a','b',['a00'],['b00'],1001);l.accept_trade('t','b',1002)
        with self.assertRaises(Unresolved):l.execute_trade('t',21000,30000)
        with self.assertRaises(Unresolved):l.process_waivers({},21000,30000)
        self.assertFalse(l.execute_trade('t',30000,30000))
    def test_all_four_modes_execute(self):
        for mode in ('total-points','h2h-points','h2h-categories','roto'):
            l=league(mode)
            for pid,now in [('p1',21000),('p2',51000)]:l.score_period(pid,1,period_facts(l,pid),now,l.snapshot.hash)
            values=l.rank(60000);self.assertEqual(len(set(values.values())),1)
            if mode=='h2h-points':self.assertEqual(values['a'],1)
            if mode=='h2h-categories':self.assertEqual(values['a'],10)
            if mode=='roto':self.assertEqual(values['a'],25)
    def test_goalie_minimum_forfeits_all_four_categories(self):
        l=league('h2h-categories');f=period_facts(l,'p1')
        for aid in l.lineups[('p1','a')]:
            if l.snapshot.athletes[aid].goalie:f[aid]['games'][1]['metrics']['starts']=0
        l.score_period('p1',1,f,21000,l.snapshot.hash);l.void_period('p2');v=l.rank(60000)
        opponent=next(b if a=='a' else a for a,b in l.matchups['p1'] if 'a' in (a,b));self.assertEqual(v[opponent]-v['a'],4)
    def test_missing_category_is_not_zero(self):
        l=league('roto');f=period_facts(l,'p1');del next(iter(f.values()))['games'][0]['metrics']['powerplay']
        with self.assertRaises(Unresolved):l.score_period('p1',1,f,21000,l.snapshot.hash)
        self.assertNotIn('p1',l.results)
    def test_cannot_score_before_game_cutoff(self):
        l=league()
        with self.assertRaises(ValueError):l.score_period('p1',1,{},20000,l.snapshot.hash)
    def test_no_eligible_weeks_requires_refund(self):
        l=league();l.void_period('p1');l.void_period('p2')
        with self.assertRaises(Unresolved):l.rank(60000)


class CalendarTests(unittest.TestCase):
    def test_empty_original_week_is_publishable_for_void_handling(self):
        r=weekly_periods('2030-03-04',1,[]);self.assertEqual(r['assignment'],{});self.assertEqual(len(r['periods']),1)
    def test_dst_week_preserves_local_calendar(self):
        ts=lambda s:int(datetime.fromisoformat(s).timestamp())
        schedule=[{'id':'a','originalStart':ts('2030-03-04T19:00:00-05:00')},{'id':'b','originalStart':ts('2030-03-11T19:00:00-04:00')}]
        result=weekly_periods('2030-03-04',2,schedule)
        self.assertEqual(result['windows']['week-2']['resolution']-result['windows']['week-1']['resolution'],7*86400)
        self.assertEqual(result['assignment'],{'a':'week-1','b':'week-2'})
    def test_incomplete_game_not_exclusion(self):
        with self.assertRaises(Unresolved):resolve_games([{'id':'a','originalStart':100}],{'a':{'final':False,'conclusiveExcluded':False,'actualStart':100,'completedAt':0}},200,50)
    def test_early_edit_voids_affected_period(self):
        r=resolve_games([{'id':'a','originalStart':100}],{'a':{'final':True,'conclusiveExcluded':False,'actualStart':90,'completedAt':150}},200,95)
        self.assertTrue(r['void']);self.assertTrue(r['earlyViolation'])


class ExtendedSourceTests(unittest.TestCase):
    def setUp(self):
        self.records,self.mapping=source_fixture()
        for kind,(_,body) in self.records.items():
            for side in ('home','away'):
                for p in body[side]['players']:
                    p['statistics']['powerplay']={'goals':0,'assists':0}
                    if p['primary_position']=='G':p['starter']=p.get('played') is True
    def test_actual_extended_normalization(self):
        r=normalise_extended(self.records,self.mapping,ASOF,CUTOFF)
        self.assertEqual(sum(row['metrics']['starts'] for row in r['rows']),2)
        self.assertTrue(all('iceSeconds' in row for row in r['rows']))
        self.assertFalse(r['oracleAccepted'])
    def test_missing_starter_does_not_infer_from_play(self):
        del self.records['summary'][1]['home']['players'][5]['starter']
        with self.assertRaises(CaptureError):normalise_extended(self.records,self.mapping,ASOF,CUTOFF)
    def test_missing_powerplay_not_zero(self):
        del self.records['summary'][1]['home']['players'][0]['statistics']['powerplay']
        with self.assertRaises(CaptureError):normalise_extended(self.records,self.mapping,ASOF,CUTOFF)
    def test_powerplay_crosscheck_against_events(self):
        p=self.records['summary'][1]['home']['players'][0];p['statistics']['powerplay']['goals']=1
        with self.assertRaises(CaptureError):normalise_extended(self.records,self.mapping,ASOF,CUTOFF)
        for period in self.records['pbp'][1]['periods']:
            for e in period['events']:
                for s in e.get('statistics',[]):s['strength']='powerplay'
        self.assertEqual(normalise_extended(self.records,self.mapping,ASOF,CUTOFF)['rows'][0]['metrics']['powerplay'],1)
    def test_missing_weekly_capture_blocks_complete_fact(self):
        with self.assertRaises(Unresolved):week_facts([1],{'g':1},{'g':{'eligible':True}},{},100)
    def test_never_appeared_in_closed_rosters_is_complete_empty_week(self):
        report=normalise_extended(self.records,self.mapping,ASOF,CUTOFF);g=report['game']
        result=week_facts([999],{g:report['scheduled']},{g:{'eligible':True}},{g:report},CUTOFF)
        self.assertEqual(result[999],{'games':[],'complete':True})


class PrivateTransportScaleTests(unittest.TestCase):
    def test_full_nhl_preference_encryption_and_tamper(self):
        from Crypto.PublicKey import ECC
        from eth_abi import encode
        from formats.client import encrypt,decrypt
        key=ECC.generate(curve='Curve25519');payload=encode(['uint32[]','bytes32[]'],[list(range(1,1501)),[bytes([i%256])*32 for i in range(1500)]])
        context=b'fixed chain/host/pool/subject/nonce binding';salt=b's'*32
        envelope=encrypt(key.public_key().export_key(format='raw'),payload,salt,context)
        self.assertLessEqual(len(envelope),131072);self.assertEqual(decrypt(key,envelope,context),(payload,salt))
        bad=bytearray(envelope);bad[-1]^=1
        with self.assertRaises(ValueError):decrypt(key,bytes(bad),context)
        with self.assertRaises(ValueError):decrypt(key,envelope,b'other pool')
    def test_middle_week_cannot_claim_shortened_goalie_minimum(self):
        with self.assertRaises(ValueError):weekly_periods('2026-10-26',3,[],shortened=['week-2'])


if __name__=='__main__':unittest.main(verbosity=2)

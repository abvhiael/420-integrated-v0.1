"""Independent arithmetic vectors and adversarial domain integration tests."""
import copy
from fractions import Fraction as F
import sys
from pathlib import Path
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from nhl import FIELDS
from formats.core import Athlete,Snapshot,Rules,SportRegistry,Unresolved,allocate,digest,ratio
from formats.salary import SalaryContest
from formats.season import SeasonLeague
from formats.pickem import Market,Card,HouseLiability,PeerPool
from formats.transport import context,encrypt,decrypt
from formats.drafts import draft
from Crypto.PublicKey import ECC


def profile(kind,p,sport='NHL',scoring='NHL_DAILY_V1'):
    return Rules.freeze({'id':'DRAFT-'+kind,'version':1,'sport':sport,'format':kind,'scoring':scoring,'status':'draft','parameters':p})


def stats(**changes):
    s={k:0 if i<8 else False for i,k in enumerate(FIELDS)};s.update(played=True,complete=True);s.update(changes);return s


def snapshot():
    return Snapshot('NHL',1,[Athlete(str(i),'A' if i%2 else 'B',frozenset(['C','W']),100+i) for i in range(1,9)],100,['game-1','game-2'])


def salary(kind='salary-cap',**changes):
    p={'slots':[['C'],['W']],'salaryCap':1000,'captainIndex':0 if kind=='captain' else None,'captainSalaryMultiplier':[3,2] if kind=='captain' else 1,'captainScoreMultiplier':[3,2] if kind=='captain' else 1,'minimumTeams':2,'maximumPerTeam':1,'entryLimit':1};p.update(changes)
    return SalaryContest('s1',profile(kind,p),snapshot())


def season(mode='total-points',categories=None):
    p={'rosterSize':2,'activeSlots':[['C']],'waiverPriority':['a','b'],'draftOrder':['a','b'],'tradeDeadline':250,'draftStart':0,'draftPickSeconds':30,'mode':mode,'categories':categories or []}
    league=SeasonLeague('league',profile('season-long',p),snapshot(),['a','b'],[('p1',100,150,175),('p2',200,250,275)])
    for actor,aid in [('a','1'),('b','2'),('b','3'),('a','4')]:league.draft(actor,aid,10)
    return league


def picks(**changes):
    p={'minimumLegs':1,'maximumLegs':2,'push':'void','dnp':'void','allowCorrelated':False,'payoutTable':[{'active':a,'wins':w,'multiplier':3 if a==w else 0} for a in (1,2) for w in range(a+1)]};p.update(changes)
    return profile('pickem',p)


def markets(): return [Market('m1','g1','a1','shots',F(5,2),100,'g1-a1'),Market('m2','g2','a2','shots',F(3),100,'g2-a2')]


def card(sides=('over','over'),rules=None): return Card(rules or picks(),markets(),list(zip(['m1','m2'],sides)),10)


def facts(values=(3,4),played=(True,True)):
    return {m.id:{'marketHash':digest(m.statement),'final':True,'played':p,'value':v} for m,v,p in zip(markets(),values,played)}


class CoreTests(unittest.TestCase):
    def test_all_discussion_presets_remain_drafts(self):
        for kind in ('salary-cap','captain','pickem'):
            self.assertEqual(draft(kind).config['status'],'draft')
        for mode in ('total-points','h2h-points','h2h-categories','roto'):
            self.assertEqual(draft('season-long',members=['a','b'],mode=mode).config['status'],'draft')
    def test_profile_defensive_copy(self):
        c=salary();p=c.rules.parameters;p['salaryCap']=1;self.assertEqual(c.validate(['1','2']),203)
    def test_snapshot_is_immutable(self):
        s=snapshot()
        with self.assertRaises(AttributeError):s._lock=1
        a=s.athletes;a.clear();self.assertEqual(len(s.athletes),8)
    def test_no_manufactured_approval(self):
        c=salary().rules.config;c['status']='approved'
        with self.assertRaises(ValueError):Rules.freeze(c)
    def test_no_float_money(self):
        with self.assertRaises(ValueError):ratio(1.5)
    def test_tie_spans_paid_unpaid(self):
        r=allocate({'a':9,'b':5,'c':5},101,0,[6000,4000],True)
        self.assertEqual(r['payouts'],{'a':61,'b':20,'c':20})
    def test_two_entrant_wta_fee(self):
        self.assertEqual(allocate({'a':1,'b':0},200,300,[5000,5000],True)['payouts'],{'a':194,'b':0})
    def test_conservation_grid(self):
        for gross in range(1,100):
            for scores in ({'a':1,'b':1,'c':1},{'a':2,'b':1,'c':1},{'a':3,'b':2,'c':1}):
                r=allocate(scores,gross,300,[6000,3000,1000],True);self.assertEqual(sum(r['payouts'].values())+r['fee'],gross)
    def test_second_sport_uses_same_roster_engine(self):
        registry=SportRegistry();registry.register_linear('SYNTHETIC','TEST1',['touches'],{'touches':[1,2]})
        p=salary().rules.config;p.update(sport='SYNTHETIC',scoring='TEST1');p['parameters']['minimumTeams']=1;p['parameters']['slots']=[['X']];p['parameters']['maximumPerTeam']=1
        s=Snapshot('SYNTHETIC',1,[Athlete('x','t',frozenset(['X']),5)],100,['e'])
        c=SalaryContest('other-sport',Rules.freeze(p),s);c.submit('u',['x'],10,1)
        self.assertEqual(c.score('u',{'x':{'touches':3}},s.hash,100,registry)['score'],F(3,2))


class SalaryTests(unittest.TestCase):
    def test_nine_and_six_slot_draft_layouts(self):
        for kind,count in [('salary-cap',9),('captain',6)]:
            c=salary(kind,slots=[['C']]*count,minimumTeams=1,maximumPerTeam=count,salaryCap=10000)
            c.snapshot=Snapshot('NHL',1,[Athlete(str(i),'A',frozenset(['C']),100) for i in range(count)],100,['g'])
            c.submit('u',[str(i) for i in range(count)],1,1)
            self.assertEqual(c.validate([str(i) for i in range(count)]),count*100+(50 if kind=='captain' else 0))
    def test_generator_lineup_not_consumed_on_validation(self):
        c=salary();c.submit('u',(x for x in ['1','2']),1,1);self.assertEqual(c.entries['u'][1],('1','2'))
    def test_nhl_special_teams_and_milestones(self):
        c=salary();c.submit('u',['1','2'],99,1)
        # 3*85 + 5*15 + 20 SH + hat-trick/shot/three-point bonuses = 440.
        self.assertEqual(c.score('u',{'1':stats(goals=3,shots=5,shorthanded=1),'2':stats()},c.snapshot.hash,100)['score'],440)
    def test_captain_exact_fraction(self):
        c=salary('captain');c.submit('u',['1','2'],1,1)
        r=c.score('u',{'1':stats(shots=1),'2':stats()},c.snapshot.hash,100)
        self.assertEqual((r['score'],r['salary']),(F(45,2),F(507,2)))
    def test_duplicate_and_position_rejected(self):
        c=salary()
        with self.assertRaises(ValueError):c.validate(['1','1'])
        with self.assertRaises(ValueError):c.validate(['1','missing'])
    def test_salary_and_team_limits(self):
        with self.assertRaises(ValueError):salary(salaryCap=202).validate(['1','2'])
        with self.assertRaises(ValueError):salary().validate(['1','3'])
    def test_edit_nonce_and_lock(self):
        c=salary();c.submit('u',['1','2'],1,1);c.submit('u',['3','4'],99,2)
        self.assertEqual(len(c.entries),1)
        with self.assertRaises(ValueError):c.submit('u',['1','2'],99,2)
        with self.assertRaises(ValueError):c.submit('u',['1','2'],100,3)
    def test_missing_stats_and_wrong_context(self):
        c=salary();c.submit('u',['1','2'],1,1)
        with self.assertRaises(Unresolved):c.score('u',{'1':stats()},c.snapshot.hash,100)
        with self.assertRaises(Unresolved):c.score('u',{},'another-snapshot',100)
    def test_incomplete_nhl_facts_fail_closed(self):
        c=salary();c.submit('u',['1','2'],1,1);s=stats();del s['complete']
        with self.assertRaises(ValueError):c.score('u',{'1':s,'2':stats()},c.snapshot.hash,100)


class SeasonTests(unittest.TestCase):
    def test_autopick_cannot_front_run_timeout(self):
        l=season();l._picks=0;l._draft_turn_started=10;l.rosters={'a':set(),'b':set()}
        with self.assertRaises(ValueError):l.autopick('a',['1'],39)
        with self.assertRaises(ValueError):l.autopick('b',['1'],40)
        self.assertEqual(l.autopick('a',['1'],40),'1')
    def test_post_cutoff_correction_rejected(self):
        l=season()
        with self.assertRaises(ValueError):l.score_period('p1',1,{},175,l.snapshot.hash)
    def test_zero_denominator_ineligible(self):
        cat=[{'id':'ratio','numerator':'saves','denominator':'shots','direction':'higher','minimumDenominator':20}]
        self.assertEqual(self._complete('roto',cat).rank(275),{'a':0,'b':0})
    def test_negative_denominator_rejected_atomically(self):
        cat=[{'id':'ratio','numerator':'saves','denominator':'shots','direction':'higher','minimumDenominator':1}]
        l=season('roto',cat);l.set_lineup('a','p1',['1'],90);l.set_lineup('b','p1',['2'],90)
        with self.assertRaises(ValueError):l.score_period('p1',1,{'1':{'metrics':{'saves':1,'shots':-1}},'2':{'metrics':{'saves':1,'shots':1}}},150,l.snapshot.hash)
        self.assertNotIn('p1',l.results)
    def test_snake_draft_exclusive_ownership(self):
        l=season();self.assertIsNone(l.draft_actor());self.assertEqual(l.rosters,{'a':{'1','4'},'b':{'2','3'}})
    def test_wrong_turn_and_autopick(self):
        l=season();l._picks=0;l.rosters={'a':set(),'b':set()}
        with self.assertRaises(ValueError):l.draft('b','1',10)
        self.assertEqual(l.autopick('a',['missing','2'],40),'2')
    def test_waiver_priority_and_atomic_validation(self):
        l=season();self.assertEqual(l.waivers([('b','5','2'),('a','5','1')],20),['a'])
        before=copy.deepcopy(l.rosters)
        with self.assertRaises(ValueError):l.waivers([('a','6','4'),('b','7','missing')],21)
        self.assertEqual(l.rosters,before)
    def test_trade_consent_lock_and_future_lineup_invalidation(self):
        l=season();l.set_lineup('a','p2',['1'],20)
        with self.assertRaises(ValueError):l.trade('a','b',['1'],['2'],['a'],20)
        with self.assertRaises(ValueError):l.trade('a','b',['1'],['2'],['a','b'],100)
        l.trade('a','b',['1'],['2'],['a','b'],175);self.assertNotIn(('p2','a'),l.lineups)
    def test_locked_historical_lineup_survives_trade(self):
        l=season();l.set_lineup('a','p1',['1'],99);l.trade('a','b',['1'],['2'],['a','b'],150)
        self.assertEqual(l.lineups[('p1','a')],('1',))
    def test_schedule_lock(self):
        with self.assertRaises(ValueError):season().schedule('p1',[('a','b')],100)
    def test_points_corrections_and_finality(self):
        l=season()
        for pid in ('p1','p2'):
            l.set_lineup('a',pid,['1'],90);l.set_lineup('b',pid,['2'],90)
        f={'1':{'stats':stats(goals=1,shots=1)},'2':{'stats':stats(shots=1)}}
        l.score_period('p1',1,f,150,l.snapshot.hash)
        with self.assertRaises(ValueError):l.score_period('p1',1,f,151,l.snapshot.hash)
        l.score_period('p1',2,f,174,l.snapshot.hash);l.score_period('p2',1,f,250,l.snapshot.hash)
        with self.assertRaises(Unresolved):l.rank(274)
        self.assertEqual(l.rank(275),{'a':200,'b':30})
    def test_h2h_points(self):
        l=self._complete('h2h-points');self.assertEqual(l.rank(275),{'a':2,'b':0})
    def _complete(self,mode,categories=None):
        l=season(mode,categories)
        for pid,end in [('p1',150),('p2',250)]:
            l.set_lineup('a',pid,['1'],90);l.set_lineup('b',pid,['2'],90);l.schedule(pid,[('a','b')],90)
            metric_a={'saves':9,'shots':10} if pid=='p1' else {'saves':0,'shots':1}
            l.score_period(pid,1,{'1':{'stats':stats(shots=2),'metrics':metric_a},'2':{'stats':stats(shots=1),'metrics':{'saves':4,'shots':5}}},end,l.snapshot.hash)
        return l
    def test_ratio_aggregates_numerators_not_averages(self):
        cat=[{'id':'savePct','numerator':'saves','denominator':'shots','direction':'higher','minimumDenominator':1}]
        l=self._complete('roto',cat)
        # A=9/11 > B=8/10; averaging A's .9 and 0 would incorrectly lose.
        self.assertEqual(l.rank(275),{'a':2,'b':1})
    def test_h2h_categories(self):
        cat=[{'id':'savePct','numerator':'saves','denominator':'shots','direction':'higher','minimumDenominator':1}]
        self.assertEqual(self._complete('h2h-categories',cat).rank(275),{'a':1,'b':1})
    def test_missing_period_prevents_finality(self):
        with self.assertRaises(Unresolved):season().rank(300)


class PickemTests(unittest.TestCase):
    def test_peer_all_void_cancels_without_fee(self):
        p=PeerPool('p',100,100,0,300,[10000]);p.enter('a',card(),100,1);p.enter('b',card(),100,1)
        r=p.settle_candidate(facts((None,None),(False,False)),100)
        self.assertEqual(r,{'cancelled':True,'refunds':{'entrants':{'a':100,'b':100},'launcher':0}})
    def test_quote_is_immutable(self):
        c=card()
        with self.assertRaises(AttributeError):c.max_multiplier=1
    def test_peer_rejects_changed_lines(self):
        p=PeerPool('p',100,100,0,0,[10000]);p.enter('a',card(),100,1)
        m=markets();m[0]=Market('m1','g1','a1','shots',100,100,'g1-a1')
        c=Card(picks(),m,[('m1','over'),('m2','over')],1)
        with self.assertRaises(ValueError):p.enter('b',c,100,1)
    def test_draft_loss_policies(self):
        c=card(rules=picks(push='loss',dnp='loss'))
        self.assertEqual(c.grade(facts((None,3),(False,True)),100)['grades'],['loss','loss'])
    def test_house_void_refund_and_fractional_ceiling(self):
        p=picks();d=p.config
        for r in d['parameters']['payoutTable']:r['multiplier']=[3,2] if r['active']==r['wins'] else 0
        c=card(rules=Rules.freeze(d));h=HouseLiability();h.fund(1);h.accept('t','u',c,1,1)
        self.assertEqual(h.reserved,2);self.assertEqual(h.settle_candidate('t',facts((None,None),(False,False)),100)['payout'],1)
        self.assertEqual(h.claim('u'),1);self.assertEqual(h.available,1)
    def test_exact_line_win_push_and_void_reduction(self):
        r=card().grade(facts((3,3)),100);self.assertEqual((r['wins'],r['active'],r['multiplier']),(1,1,3))
    def test_all_void_refunds_stake(self):
        self.assertEqual(card().grade(facts((None,None),(False,False)),100)['multiplier'],1)
    def test_missing_is_not_dnp(self):
        with self.assertRaises(Unresolved):card().grade(facts((None,4)),100)
    def test_nonfinal_and_wrong_market_rejected(self):
        f=facts();f['m1']['final']=False
        with self.assertRaises(Unresolved):card().grade(f,100)
        f=facts();f['m1']['marketHash']='wrong'
        with self.assertRaises(Unresolved):card().grade(f,100)
    def test_duplicate_opposite_and_correlation_rejected(self):
        with self.assertRaises(ValueError):Card(picks(),markets(),[('m1','over'),('m1','under')],1)
        m=markets();m[1]=Market('m2','g1','a1','goals',1,100,'g1-a1')
        with self.assertRaises(ValueError):Card(picks(),m,[('m1','over'),('m2','under')],1)
    def test_market_lock_and_complete_payout_table(self):
        with self.assertRaises(ValueError):Card(picks(),markets(),[('m1','over')],100)
        with self.assertRaises(ValueError):card(rules=picks(payoutTable=[{'active':2,'wins':2,'multiplier':3}]))
    def test_house_gross_reserve_and_no_overwithdraw(self):
        h=HouseLiability()
        with self.assertRaises(ValueError):h.accept('t','u',card(),100,10)
        h.fund(200);h.accept('t','u',card(),100,10);self.assertEqual((h.cash,h.reserved,h.available),(300,300,0))
        with self.assertRaises(ValueError):h.withdraw_house(1)
        self.assertEqual(h.settle_candidate('t',facts(),100)['payout'],300);self.assertEqual(h.available,0)
        self.assertEqual(h.claim('u'),300);self.assertEqual(h.cash,0)
        with self.assertRaises(ValueError):h.settle_candidate('t',facts(),100)
    def test_house_correlation_does_not_net_reserves(self):
        h=HouseLiability();h.fund(400);h.accept('t1','a',card(),100,1);h.accept('t2','b',card(),100,1)
        self.assertEqual(h.reserved,600)
        with self.assertRaises(ValueError):h.accept('t3','c',card(),100,1)
    def test_unresolved_preserves_reserve(self):
        h=HouseLiability();h.fund(200);h.accept('t','a',card(),100,1)
        with self.assertRaises(Unresolved):h.settle_candidate('t',facts((None,4)),100)
        self.assertEqual(h.reserved,300);self.assertFalse(h.tickets['t']['closed'])
    def test_peer_two_entrants_wta_and_fee(self):
        p=PeerPool('p',100,100,0,300,[5000,5000]);p.enter('a',card(),100,1);p.enter('b',card(('under','under')),100,1)
        r=p.settle_candidate(facts(),100);self.assertEqual((r['payouts'],r['fee']),({'a':194,'b':0},6))
    def test_peer_free_prize_and_full_cancellation(self):
        p=PeerPool('p',100,0,99,0,[10000]);p.enter('a',card(),0,1)
        with self.assertRaises(Unresolved):p.settle_candidate(facts(),100)
        self.assertEqual(p.cancel(),{'entrants':{'a':0},'launcher':99})
    def test_peer_one_entry_and_exact_funding(self):
        p=PeerPool('p',100,100,0,300,[10000]);p.enter('a',card(),100,1)
        with self.assertRaises(ValueError):p.enter('a',card(),100,1)
        with self.assertRaises(ValueError):p.enter('b',card(),99,1)


class CryptoTests(unittest.TestCase):
    def setUp(self):
        self.key=ECC.generate(curve='Curve25519');self.aad=context('pool','profile','snapshot','user',1)
        self.envelope=encrypt(self.key.public_key().export_key(format='raw'),[str(i) for i in range(9)],b'1'*32,self.aad)
    def test_actual_nine_player_encryption(self):self.assertEqual(decrypt(self.key,self.envelope,self.aad)['lineup'],[str(i) for i in range(9)])
    def test_context_replay_rejected(self):
        with self.assertRaises(ValueError):decrypt(self.key,self.envelope,context('other','profile','snapshot','user',1))
    def test_wrong_private_key_rejected(self):
        with self.assertRaises(ValueError):decrypt(ECC.generate(curve='Curve25519'),self.envelope,self.aad)
    def test_ciphertext_tamper_rejected(self):
        e=dict(self.envelope);e['ciphertext']='00'+e['ciphertext'][2:]
        with self.assertRaises(ValueError):decrypt(self.key,e,self.aad)
    def test_commitment_tamper_rejected(self):
        e=dict(self.envelope);e['commitment']='0'*64
        with self.assertRaises(ValueError):decrypt(self.key,e,self.aad)


class IntegrationTests(unittest.TestCase):
    def test_encrypted_captain_to_rank_allocation(self):
        c=salary('captain');key=ECC.generate(curve='Curve25519');public=key.public_key().export_key(format='raw')
        for user,ids in [('a',['1','2']),('b',['3','4'])]:
            aad=context(c.id,c.rules.hash,c.snapshot.hash,user,1)
            envelope=encrypt(public,ids,b'a'*32,aad);opened=decrypt(key,envelope,aad)
            c.submit(user,opened['lineup'],99,1)
        scores={}
        for user in ('a','b'):
            ids=c.entries[user][1];scores[user]=c.score(user,{aid:stats(shots=2 if user=='a' else 1) for aid in ids},c.snapshot.hash,100)['score']
        allocation=allocate(scores,200,300,[10000],True)
        self.assertEqual(scores,{'a':75,'b':F(75,2)});self.assertEqual(allocation['payouts'],{'a':194,'b':0})


if __name__=='__main__':unittest.main(verbosity=2)

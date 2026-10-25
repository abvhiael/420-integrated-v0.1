"""Approved 5C.1 reference-state tests; no funded or cryptographic acceptance claim."""
import copy,random,unittest
from lifecycle import Policy,Lifecycle
C='chain:31337/registry/policy/version/event'
BASE=dict(mode='freezeout',start='scheduled',seats=9,tables=1,minimum=2,target=2,cap=9,buy_in=100,stack=1000,sponsor=0,opens=100,deadline=200,readiness=600,late=3600,extra=0,extra_cap=0,late_level=0,extra_level=0,payout_policy='frozen-payout',recovery_policy='frozen-recovery',blind_policy='frozen-blinds')
def model(**kw):return Lifecycle(Policy(**(BASE|kw)),C)
def started(**kw):
    m=model(**kw);m.register(C,'a','A',1,m.p.price,100);m.register(C,'b','B',1,m.p.price,101);m.observe_first_hand(C,200,['a','b']);return m
class LifecycleTests(unittest.TestCase):
    def test_scheduled_locks_original_time(self):
        m=model();m.register(C,'a','A',1,103,100);m.register(C,'b','B',1,103,101);m.tick(205);self.assertEqual((m.state,m.ready_at),('STARTING',200))
    def test_sng_locks_at_target_before_general_deadline(self):
        m=model(start='sng');m.register(C,'a','A',1,103,100);m.register(C,'b','B',1,103,101);self.assertEqual((m.state,m.ready_at),('STARTING',101))
    def test_underfill_one_grace_without_lowering_target(self):
        m=model(start='sng',target=3,cap=3);m.register(C,'a','A',1,103,100);m.tick(200);self.assertEqual(m.state,'DELAYED');m.register(C,'b','B',1,103,201);self.assertEqual(m.state,'DELAYED');m.tick(2000);self.assertEqual(m.credits,{'A':103,'B':103,'sponsor':0})
    def test_underfill_threshold_met_starts_during_grace(self):
        m=model();m.register(C,'a','A',1,103,100);m.tick(200);m.register(C,'b','B',1,103,210);self.assertEqual((m.state,m.ready_at),('STARTING',210))
    def test_late_processing_cannot_extend_technical_grace(self):
        m=model();m.register(C,'a','A',1,103,100);m.register(C,'b','B',1,103,101);m.tick(800);self.assertEqual(m.state,'CANCELLED');self.assertEqual(m.credits['A'],103)
    def test_longer_technical_grace_is_not_confused_with_underfill(self):
        m=model(technical=5000);m.register(C,'a','A',1,103,100);m.register(C,'b','B',1,103,101);m.tick(2100);self.assertEqual((m.state,m.ready_at),('STARTING',200))
    def test_free_prefunded_prize_returned_at_failed_start(self):
        m=model(buy_in=0,sponsor=10000);m.register(C,'a','A',1,0,100);m.tick(2000);self.assertEqual((m.state,m.credits['sponsor'],m.fees),('CANCELLED',10000,0));m.assert_conservation()
    def test_prelock_withdraw_full_fee_and_capacity_release(self):
        m=model(cap=2);m.register(C,'a','A',1,103,100);m.unregister(C,'a','A',2,101);m.register(C,'b','B',1,103,102);m.register(C,'c','C',1,103,103);self.assertEqual(m.credits['A'],103);self.assertNotIn('a',m.members)
    def test_withdraw_cannot_win_race_against_scheduled_lock(self):
        m=model();m.register(C,'a','A',1,103,100);m.register(C,'b','B',1,103,101)
        with self.assertRaises(ValueError):m.unregister(C,'a','A',2,200)
        self.assertEqual(m.state,'STARTING')
    def test_context_and_nonce_replay(self):
        m=model();m.register(C,'a','A',1,103,100)
        with self.assertRaises(ValueError):m.unregister('other','a','A',2,101)
        with self.assertRaises(ValueError):m.unregister(C,'a','A',1,101)
        with self.assertRaises(ValueError):m.unregister(C,'a','wrong-wallet',2,101)
        self.assertEqual(m.initial['a'],103)
    def test_duplicate_person_alias_cannot_create_second_stack(self):
        m=model();m.register(C,'a','A',1,103,100)
        with self.assertRaises(ValueError):m.register(C,'a','alias',2,103,101)
    def test_non_integer_payment_and_time_rejected(self):
        m=model(buy_in=0)
        with self.assertRaises(ValueError):m.register(C,'a','A',1,False,100)
        with self.assertRaises(ValueError):m.tick(True)
    def test_observation_clock_cannot_rewind_after_cutoff(self):
        m=started(late=10);m.tick(210)
        with self.assertRaises(ValueError):m.register(C,'c','C',1,103,209)
    def test_readiness_requires_entire_initial_roster(self):
        m=model();m.register(C,'a','A',1,103,100);m.register(C,'b','B',1,103,101)
        with self.assertRaises(ValueError):m.observe_first_hand(C,200,['a'])
    def test_exact_late_time_boundary_rejected(self):
        m=started(late=10)
        with self.assertRaises(ValueError):m.register(C,'c','C',1,103,210)
    def test_late_level_boundary_can_close_earlier(self):
        m=started(late=100,late_level=4);m.observe_level(C,4)
        with self.assertRaises(ValueError):m.register(C,'c','C',1,103,201)
    def test_sng_late_registration_supported(self):
        m=started(start='sng',target=2,cap=3);m.register(C,'c','C',1,103,201);self.assertIn('c',m.pending)
    def test_last_slot_reserved_atomically(self):
        m=started(cap=3);m.register(C,'c','C',1,103,201)
        with self.assertRaises(ValueError):m.register(C,'d','D',1,103,202)
    def test_unseated_purchase_refunded_and_not_counted(self):
        m=started(readiness=10);m.register(C,'c','C',1,103,201);m.tick(211);self.assertEqual(m.credits['C'],103);self.assertEqual(len(m.played),2);self.assertNotIn('c',m.members)
    def test_paid_before_cutoff_can_activate_after_it(self):
        m=started(late=10,readiness=20);m.register(C,'c','C',1,103,209);m.activate(C,'c',211,['a','b']);self.assertEqual(len(m.played),3)
    def test_safe_boundary_preserves_live_hand(self):
        m=started();m.begin_hand(C,'h',['a','b'],5,10);m.register(C,'c','C',1,103,201)
        with self.assertRaises(ValueError):m.activate(C,'c',202,['a','b'])
        self.assertEqual(m.hands['h']['stacks'],{'a':1000,'b':1000})
    def test_target_table_capacity_and_duplicates_checked(self):
        m=started(seats=2,tables=2,cap=4);m.register(C,'c','C',1,103,201)
        with self.assertRaises(ValueError):m.activate(C,'c',202,['a','b'])
        with self.assertRaises(ValueError):m.activate(C,'c',202,['a','a'])
    def test_zero_mid_hand_does_not_authorize_rebuy(self):
        m=started(mode='rebuy',extra=1000,extra_cap=2);m.begin_hand(C,'h',['a','b'],5,10)
        with self.assertRaises(ValueError):m.extra_purchase(C,'a','A',2,103,201)
    def test_zero_only_rebuy_same_stack_and_generation(self):
        m=started(mode='rebuy',extra=1000,extra_cap=2);m.begin_hand(C,'h',['a','b'],5,10);m.observe_finalized_hand(C,'h',{'a':0,'b':2000},201);m.extra_purchase(C,'a','A',2,103,202);m.activate(C,'a',203,['a','b']);self.assertEqual((m.members['a']['stack'],m.members['a']['generation'],len(m.played),m.prize,m.fees),(1000,1,2,300,9))
    def test_reentry_fresh_generation_without_duplicate_finish(self):
        m=started(mode='reentry',extra=1000,extra_cap=1);m.begin_hand(C,'h',['a','b'],5,10);m.observe_finalized_hand(C,'h',{'a':0,'b':2000},201);m.extra_purchase(C,'a','A',2,103,202);m.activate(C,'a',203,['a','b']);self.assertEqual((m.members['a']['generation'],len(m.played)),(2,2))
    def test_duplicate_queued_rebuy_and_caps(self):
        m=started(mode='rebuy',extra=1000,extra_cap=1);m.begin_hand(C,'h',['a','b'],5,10);m.observe_finalized_hand(C,'h',{'a':0,'b':2000},201);m.extra_purchase(C,'a','A',2,103,202)
        with self.assertRaises(ValueError):m.extra_purchase(C,'a','A',3,103,203)
        m.activate(C,'a',204,['a','b']);m.begin_hand(C,'h2',['a','b'],5,10);m.observe_finalized_hand(C,'h2',{'a':0,'b':3000},205)
        with self.assertRaises(ValueError):m.extra_purchase(C,'a','A',3,103,206)
    def test_rebuy_exact_choice_deadline_eliminates(self):
        m=started(mode='rebuy',extra=1000,extra_cap=1,choice=60);m.begin_hand(C,'h',['a','b'],5,10);m.observe_finalized_hand(C,'h',{'a':0,'b':2000},201)
        with self.assertRaises(ValueError):m.extra_purchase(C,'a','A',2,103,261)
    def test_rebuy_overall_cutoff_can_shorten_choice(self):
        m=started(mode='rebuy',extra=10,extra_cap=1,choice=60);m.begin_hand(C,'h',['a','b'],5,10);m.observe_finalized_hand(C,'h',{'a':0,'b':2000},201)
        with self.assertRaises(ValueError):m.extra_purchase(C,'a','A',2,103,210)
    def test_level_cutoff_ends_pending_choice(self):
        m=started(mode='rebuy',extra=1000,extra_cap=1,extra_level=4);m.begin_hand(C,'h',['a','b'],5,10);m.observe_finalized_hand(C,'h',{'a':0,'b':2000},201);m.observe_level(C,4);m.tick(202);self.assertEqual(m.members['a']['status'],'ELIMINATED')
    def test_failed_extra_refunds_fee_without_consuming_chip_purchase(self):
        m=started(mode='reentry',extra=1000,extra_cap=1,readiness=5);m.begin_hand(C,'h',['a','b'],5,10);m.observe_finalized_hand(C,'h',{'a':0,'b':2000},201);m.extra_purchase(C,'a','A',2,103,202);m.tick(207);self.assertEqual((m.credits['A'],m.members['a']['used'],m.nonces['a']),(103,0,2));m.extra_purchase(C,'a','A',3,103,208)
    def test_hand_receipts_cannot_repeat_or_mint_or_charge_hand_rake(self):
        m=started();m.begin_hand(C,'h',['a','b'],5,10)
        with self.assertRaises(ValueError):m.observe_finalized_hand(C,'h',{'a':1000,'b':1001},201)
        m.observe_finalized_hand(C,'h',{'a':1000,'b':1000},202)
        with self.assertRaises(ValueError):m.observe_finalized_hand(C,'h',{'a':1000,'b':1000},203)
        with self.assertRaises(ValueError):m.begin_hand(C,'h',['a','b'],5,10)
    def test_blind_level_snapshot_never_changes_within_hand(self):
        m=started();m.begin_hand(C,'h',['a','b'],5,10);m.observe_level(C,4);self.assertEqual((m.hands['h']['level'],m.hands['h']['big']),(1,10))
    def test_disconnect_keeps_stack_and_showdown_participation(self):
        m=started();m.begin_hand(C,'h',['a','b'],5,10);m.presence(C,'a','A',False);self.assertEqual(m.timeout_action(C,'a',0),'CHECK');self.assertEqual(m.timeout_action(C,'a',10),'FOLD');m.observe_finalized_hand(C,'h',{'a':2000,'b':0},201);self.assertEqual(m.members['a']['stack'],2000)
    def test_pause_keeps_deadlines_running_and_blocks_purchases(self):
        m=started(late=10);m.pause(C,201)
        with self.assertRaises(ValueError):m.register(C,'c','C',1,103,202)
        m.observe_recovered(C,211)
        with self.assertRaises(ValueError):m.register(C,'c','C',1,103,212)
    def test_repeated_pause_cannot_reset_original_recovery_clock(self):
        m=started(recovery=10);m.pause(C,201);m.observe_recovered(C,205);m.pause(C,206);m.tick(211);self.assertEqual(m.state,'RECOVERY_REQUIRED');self.assertEqual(m.prize,200)
    def test_finish_waits_for_choices_then_closes_even_long_window(self):
        m=started(mode='rebuy',extra=1000,extra_cap=1);m.begin_hand(C,'h',['a','b'],5,10);m.observe_finalized_hand(C,'h',{'a':0,'b':2000},201)
        with self.assertRaises(ValueError):m.finish_candidate(C,202)
        result=m.finish_candidate(C,261);self.assertEqual(result['survivor'],'b');self.assertTrue(result['requires_later_canonical_finality_and_prize_executor']);self.assertEqual(m.state,'FINALIZING')
        with self.assertRaises(ValueError):m.register(C,'c','C',1,103,262)
    def test_no_cashout_prize_or_proof_verifier_api(self):
        m=started();self.assertFalse(any(hasattr(m,n) for n in ['cashout','pay_prizes','verify_proof','operator_set_winner']));self.assertEqual(m.fees,6)
    def test_snapshot_does_not_mutate_frozen_policy_or_members(self):
        m=started();s=m.snapshot();s['members']['a']['stack']=999;self.assertEqual(m.members['a']['stack'],1000)
        with self.assertRaises(Exception):m.p.buy_in=10
    def test_malformed_observation_and_identifier_types_rejected(self):
        with self.assertRaises(ValueError):Lifecycle(Policy(**BASE),True)
        m=started()
        for small,big in [(True,2),(0.5,1.0),(1,2**256)]:
            with self.assertRaises(ValueError):m.begin_hand(C,'bad',['a','b'],small,big)
    def test_zero_start_clock_is_reserved_as_unstarted(self):
        with self.assertRaises(ValueError):model(opens=0)
    def test_no_implicit_launch_configuration(self):
        with self.assertRaises(TypeError):Policy()
    def test_model_matches_native_integer_bounds(self):
        for kw in ({'buy_in':2**128},{'stack':2**128},{'cap':2**32},{'late':2**32},{'extra_cap':65536},{'tables':65536},{'deadline':2**64}):
            with self.assertRaises(ValueError):model(**kw)
    def test_randomized_prestart_refund_conservation(self):
        rng=random.Random(420)
        for i in range(1000):
            stake=rng.randrange(0,10**20);m=model(buy_in=stake,sponsor=rng.randrange(0,10**20));m.register(C,'a','A',1,m.p.price,100);m.unregister(C,'a','A',2,101);m.tick(2000);m.assert_conservation();self.assertEqual(sum(m.credits.values()),m.cash)
if __name__=='__main__':unittest.main(verbosity=2)

"""5C.1 deterministic reference rules. No tokens, signatures or proof verification.

A future qualified host supplies authenticated identities, seating, hand and level
observations. This model checks their business-state consequences; its outputs
are never permission to move funds, accept a card proof or declare a live winner.
"""
from dataclasses import dataclass
import copy


@dataclass(frozen=True)
class Policy:
    # All event settings are explicit. Only the four user-approved grace defaults
    # are supplied here; test fixtures are not deployable launch presets.
    mode:str
    start:str
    seats:int
    tables:int
    minimum:int
    target:int
    cap:int
    buy_in:int
    stack:int
    sponsor:int
    opens:int
    deadline:int
    readiness:int
    late:int
    extra:int
    extra_cap:int
    late_level:int
    extra_level:int
    payout_policy:str
    recovery_policy:str
    blind_policy:str
    underfill:int=1800
    technical:int=600
    choice:int=60
    recovery:int=86400
    def __post_init__(self):
        if self.mode not in ('freezeout','reentry','rebuy') or self.start not in ('scheduled','sng'):raise ValueError('format')
        for k,v in self.__dict__.items():
            if k not in ('mode','start','payout_policy','recovery_policy','blind_policy') and (type(v) is not int or v<0):raise ValueError('unsigned typed policy')
        if not 2<=self.seats<=9 or not self.tables or not 2<=self.minimum<=self.target<=self.cap<=self.seats*self.tables:raise ValueError('field')
        if any(not isinstance(getattr(self,k),str) or not getattr(self,k) for k in ('payout_policy','recovery_policy','blind_policy')):raise ValueError('policy references')
        if not 0<self.opens<self.deadline or not all((self.stack,self.underfill,self.technical,self.readiness,self.choice,self.recovery,self.payout_policy,self.recovery_policy,self.blind_policy)):raise ValueError('clocks and references')
        for k in ('buy_in','stack','sponsor'):
            if getattr(self,k)>2**128-1:raise ValueError('uint128 bound')
        for k in ('opens','deadline'):
            if getattr(self,k)>2**64-1:raise ValueError('uint64 bound')
        for k in ('minimum','target','cap','underfill','technical','readiness','choice','recovery','late','extra'):
            if getattr(self,k)>2**32-1:raise ValueError('uint32 bound')
        for k in ('tables','late_level','extra_level','extra_cap'):
            if getattr(self,k)>65535:raise ValueError('uint16 bound')
        if self.deadline+self.underfill+self.technical>2**64-1:raise ValueError('deadline overflow')
        if self.late_level and not self.late:raise ValueError('hard cutoff mandatory')
        if self.mode=='freezeout' and any((self.extra,self.extra_cap,self.extra_level)):raise ValueError('freezeout')
        if self.mode!='freezeout' and not (self.extra and self.extra_cap):raise ValueError('finite extras')
    @property
    def fee(self):return self.buy_in*3//100
    @property
    def price(self):return self.buy_in+self.fee


class Lifecycle:
    """Noncustodial, trusted-host reference model; explicitly not an authenticator."""
    def __init__(self,policy,context):
        if not isinstance(context,(str,bytes)) or not context:raise ValueError('bound context required')
        self.p=policy;self.context=context;self.state='REGISTRATION';self.members={};self.nonces={};self.played=set();self.pending={};self.hands={};self.used_hands=set();self.level=1
        self.threshold_at=None;self.last_time=policy.opens;self.ready_at=None;self.started=None;self.first_pause=None;self.credits={};self.cash=policy.sponsor;self.initial={};self.prize=policy.sponsor;self.fees=0
    def _context(self,context):
        if context!=self.context:raise ValueError('cross-context request')
    def _nonce(self,person,nonce):
        if not isinstance(person,(str,bytes)) or not person or type(nonce) is not int or nonce!=self.nonces.get(person,0)+1:raise ValueError('identity/nonce')
    def _member(self,person,actor):
        if person not in self.members or self.members[person]['actor']!=actor:raise ValueError('controller')
        return self.members[person]
    def _window(self,duration,level,now):return self.started is not None and duration>0 and self.started<=now<self.started+duration and (not level or self.level<level)
    def _credit(self,who,amount):self.credits[who]=self.credits.get(who,0)+amount
    def _threshold(self):return self.p.target if self.p.start=='sng' else self.p.minimum
    def _cancel_unstarted(self):
        if self.started is not None:raise ValueError('post-start recovery must use frozen qualified policy')
        for person,amount in self.initial.items():self._credit(self.members[person]['actor'],amount)
        self.initial.clear();self._credit('sponsor',self.p.sponsor);self.prize=0;self.state='CANCELLED';self.assert_conservation()
    def tick(self,now):
        if type(now) is not int or now<self.p.opens or now<self.last_time:raise ValueError('typed monotonic host clock')
        self.last_time=now
        if self.state in ('REGISTRATION','DELAYED'):
            threshold=len(self.initial)>=self._threshold()
            if threshold and (self.p.start=='sng' or now>=self.p.deadline):
                self.ready_at=self.threshold_at if self.p.start=='sng' else max(self.p.deadline,self.threshold_at)
                self.state='STARTING'
            elif now>=self.p.deadline+self.p.underfill:self._cancel_unstarted();return
            elif now>=self.p.deadline:self.state='DELAYED'
        if self.state=='STARTING' and now>=self.ready_at+self.p.technical:self._cancel_unstarted()
        if self.state=='PAUSED' and now>=self.first_pause+self.p.recovery:self.state='RECOVERY_REQUIRED'
        for person in list(self.pending):
            if now>=self.pending[person]['deadline']:self._expire(person)
        for m in self.members.values():
            if m['status']=='CHOICE' and (now>=m['choice_until'] or not self._window(self.p.extra,self.p.extra_level,now)):m['status']='ELIMINATED'
    def _new_member(self,actor):return {'actor':actor,'stack':self.p.stack,'status':'ACTIVE','used':0,'generation':1,'hand':None,'choice_until':0,'connected':True}
    def register(self,context,person,actor,nonce,amount,now):
        self._context(context);self._nonce(person,nonce)
        # Preflight clocks are evaluated before accepting payment or consuming a nonce.
        self.tick(now)
        if self.state not in ('REGISTRATION','DELAYED','RUNNING') or type(amount) is not int or amount!=self.p.price or not isinstance(actor,(str,bytes)) or not actor:raise ValueError('registration state/payment')
        if person in self.members or person in self.pending:raise ValueError('duplicate active identity')
        if len(self.members)+sum(x['new'] for x in self.pending.values())>=self.p.cap:raise ValueError('field cap')
        if self.state=='RUNNING':
            if not self._window(self.p.late,self.p.late_level,now):raise ValueError('late cutoff')
            self.pending[person]={'actor':actor,'deadline':now+self.p.readiness,'new':True,'generation':1}
        else:
            self.members[person]=self._new_member(actor);self.initial[person]=amount
            if len(self.initial)>=self._threshold() and self.threshold_at is None:self.threshold_at=now
        self.nonces[person]=nonce;self.cash+=amount
        if self.state in ('REGISTRATION','DELAYED'):self.tick(now)
        self.assert_conservation()
    def unregister(self,context,person,actor,nonce,now):
        self._context(context);self._nonce(person,nonce);self.tick(now);self._member(person,actor)
        if self.state not in ('REGISTRATION','DELAYED') or person not in self.initial:raise ValueError('roster locked')
        self._credit(actor,self.initial.pop(person));del self.members[person];self.nonces[person]=nonce
        if len(self.initial)<self._threshold():self.threshold_at=None
        self.assert_conservation()
    def observe_first_hand(self,context,now,ready_people):
        """Replay an ALREADY authenticated host start observation, not a proof API."""
        self._context(context);self.tick(now)
        if self.state!='STARTING' or set(ready_people)!=set(self.initial):raise ValueError('readiness')
        self.started=now;self.state='RUNNING';self.played.update(self.initial)
        self.prize+=len(self.initial)*self.p.buy_in;self.fees+=len(self.initial)*self.p.fee;self.initial.clear();self.assert_conservation()
    def observe_level(self,context,level):
        self._context(context)
        if self.state not in ('RUNNING','PAUSED') or type(level) is not int or level<self.level:raise ValueError('level state/rollback')
        self.level=level
    def begin_hand(self,context,hand,people,small,big):
        self._context(context)
        if self.state!='RUNNING' or not hand or hand in self.used_hands or not 2<=len(set(people))<=self.p.seats or len(set(people))!=len(people) or type(small) is not int or type(big) is not int or not 0<small<big<2**256 or big!=small*2:raise ValueError('hand snapshot')
        for person in people:
            m=self.members[person]
            if m['status']!='ACTIVE' or m['stack']<=0 or m['hand'] is not None:raise ValueError('hand participant')
        self.hands[hand]={'stacks':{p:self.members[p]['stack'] for p in people},'level':self.level,'small':small,'big':big}
        self.used_hands.add(hand)
        for person in people:self.members[person]['hand']=hand
    def observe_finalized_hand(self,context,hand,stacks,now):
        """Domain consequences of verified settlement; does not verify cards/results."""
        self._context(context);self.tick(now)
        if hand not in self.hands:raise ValueError('hand replay/unknown')
        previous=self.hands[hand]['stacks']
        if set(stacks)!=set(previous) or any(type(v) is not int or v<0 for v in stacks.values()) or sum(stacks.values())!=sum(previous.values()):raise ValueError('chip conservation/no hand rake')
        del self.hands[hand]
        for person,value in stacks.items():
            m=self.members[person];m['stack']=value;m['hand']=None
            if value==0:
                eligible=self.p.mode=='rebuy' and m['used']<self.p.extra_cap and self._window(self.p.extra,self.p.extra_level,now)
                m['status']='CHOICE' if eligible else 'ELIMINATED';m['choice_until']=min(now+self.p.choice,self.started+self.p.extra) if eligible else now
    def extra_purchase(self,context,person,actor,nonce,amount,now):
        self._context(context);self._nonce(person,nonce);self.tick(now);m=self._member(person,actor)
        if self.state!='RUNNING' or self.p.mode=='freezeout' or not self._window(self.p.extra,self.p.extra_level,now) or type(amount) is not int or amount!=self.p.price:raise ValueError('extra cutoff/state/payment')
        if person in self.pending or m['hand'] is not None or m['stack']!=0 or m['used']>=self.p.extra_cap:raise ValueError('one active stack/cap/final hand')
        if self.p.mode=='rebuy' and (m['status']!='CHOICE' or now>=m['choice_until']):raise ValueError('choice expired')
        if self.p.mode=='reentry' and m['status']!='ELIMINATED':raise ValueError('not eliminated')
        self.pending[person]={'actor':actor,'deadline':now+self.p.readiness,'new':False,'generation':m['generation']+(self.p.mode=='reentry')}
        self.nonces[person]=nonce;self.cash+=amount;self.assert_conservation()
    def activate(self,context,person,now,table_people):
        self._context(context);self.tick(now)
        if self.state!='RUNNING' or person not in self.pending or len(set(table_people))!=len(table_people) or len(set(table_people)-{person})>=self.p.seats or any(self.members[p]['hand'] is not None for p in table_people):raise ValueError('safe-boundary activation')
        p=self.pending.pop(person)
        if p['new']:self.members[person]=self._new_member(p['actor']);self.played.add(person)
        else:
            m=self.members[person];m.update(stack=self.p.stack,status='ACTIVE',used=m['used']+1,generation=p['generation'])
        self.prize+=self.p.buy_in;self.fees+=self.p.fee;self.assert_conservation()
    def _expire(self,person):
        p=self.pending.pop(person);self._credit(p['actor'],self.p.price)
        if not p['new']:self.members[person]['status']='ELIMINATED'
        self.assert_conservation()
    def presence(self,context,person,actor,connected):
        self._context(context);m=self._member(person,actor)
        if self.state not in ('STARTING','RUNNING','PAUSED'):raise ValueError('presence lifecycle')
        if type(connected) is not bool:raise ValueError('presence flag')
        m['connected']=connected
    def timeout_action(self,context,person,to_call):
        self._context(context)
        if self.members[person]['hand'] is None or type(to_call) is not int or to_call<0:raise ValueError('turn observation')
        return 'CHECK' if to_call==0 else 'FOLD'
    def pause(self,context,now):
        self._context(context)
        self.tick(now)
        if self.state!='RUNNING':raise ValueError('pause state')
        if self.first_pause is None:self.first_pause=now
        self.state='PAUSED'
    def observe_recovered(self,context,now):
        self._context(context);self.tick(now)
        if self.state!='PAUSED':raise ValueError('recovery deadline')
        self.state='RUNNING'
    def finish_candidate(self,context,now):
        self._context(context);self.tick(now)
        if self.state!='RUNNING' or self.hands or self.pending or any(m['status']=='CHOICE' for m in self.members.values()):raise ValueError('pending hand/purchase/choice')
        survivors=[p for p,m in self.members.items() if m['status']=='ACTIVE' and m['stack']>0]
        if len(survivors)!=1:raise ValueError('not sole survivor')
        self.state='FINALIZING';return {'survivor':survivors[0],'unique_players':len(self.played),'payout_policy':self.p.payout_policy,'recovery_policy':self.p.recovery_policy,'requires_later_canonical_finality_and_prize_executor':True}
    def snapshot(self):return copy.deepcopy({'state':self.state,'members':self.members,'pending':self.pending,'played':sorted(self.played),'prize':self.prize,'fees':self.fees,'credits':self.credits,'cash':self.cash})
    def assert_conservation(self):
        assert self.cash==self.prize+self.fees+sum(self.initial.values())+len(self.pending)*self.p.price+sum(self.credits.values()),'nominal accounting conservation'

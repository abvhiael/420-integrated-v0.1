"""Approved fixed-board picks, participation, peer ranking and gross reserves."""
from fractions import Fraction
import copy
from datetime import datetime
from zoneinfo import ZoneInfo
from .core import Unresolved,digest,integer,allocate
from .pickem import Market

METRICS={'goals','assists','shots','blocks','saves'}


class Board:
    def __setattr__(self,name,value):
        if getattr(self,'_sealed',False):raise AttributeError('board is immutable')
        object.__setattr__(self,name,value)

    def __init__(self,day,schedule,markets,goalies,published_at):
        # NHL-wide schedule, not selected-market games. Host authenticates this snapshot.
        schedule=tuple(sorted(schedule));markets=tuple(markets);goalies=frozenset(goalies)
        if not schedule or len(set(g for g,_ in schedule))!=len(schedule):raise ValueError('unique official daily games required')
        if any(datetime.fromtimestamp(integer(t,1),ZoneInfo('America/New_York')).date().isoformat()!=day for _,t in schedule):raise ValueError('official New York schedule date mismatch')
        lock=min(t for _,t in schedule)
        if integer(published_at)>=lock:raise ValueError('publish before entry/lock')
        if not markets or len({m.id for m in markets})!=len(markets):raise ValueError('unique markets required')
        for m in markets:
            if m.event not in {g for g,_ in schedule} or m.metric not in METRICS or m.line<0 or m.lock_at!=lock:raise ValueError('market/schedule/whole-slate lock mismatch')
            if (m.metric=='saves')!=(m.subject in goalies):raise ValueError('goalie-only saves and skater-only other markets')
        self.day=day;self.schedule=schedule;self.markets=markets;self.goalies=goalies;self.lock_at=lock
        self.hash=digest({'domain':'420.FANTASY.PICKEM.BOARD.V1','date':day,'officialSchedule':schedule,'markets':[m.statement for m in markets],'goalies':sorted(goalies),'publishedAt':published_at})
        self._sealed=True


class ApprovedCard:
    def __setattr__(self,name,value):
        if getattr(self,'_sealed',False):raise AttributeError('card immutable')
        object.__setattr__(self,name,value)

    def __init__(self,board,selections,size,now):
        selections=tuple(tuple(s) for s in selections)
        if size not in (2,3) or len(selections)!=size or integer(now)>=board.lock_at:raise ValueError('card count/lock')
        inventory={m.id:m for m in board.markets};legs=[]
        for mid,side in selections:
            if mid not in inventory or side not in ('over','under'):raise ValueError('invalid board selection')
            legs.append((inventory[mid],side))
        if len({m.subject for m,_ in legs})!=size:raise ValueError('one selection per athlete')
        for m,_ in legs:
            sharing=[other for other,_ in legs if other.event==m.event]
            if len(sharing)>1 and (len(board.schedule)>=3 or any(other.metric not in ('shots','blocks') or other.subject in board.goalies for other in sharing)):raise ValueError('same-game whitelist violation')
        self.board=board;self.legs=tuple(legs);self.size=size;self.lock_at=board.lock_at;self.max_multiplier=3 if size==2 else 5
        self.hash=digest({'domain':'420.FANTASY.PICKEM.APPROVED.CARD.V1','board':board.hash,'size':size,'legs':[(m.id,s) for m,s in legs]})
        self._sealed=True

    def grade(self,facts,now):
        if integer(now)<self.lock_at or set(facts)!={m.id for m,_ in self.legs}:raise Unresolved('locked complete facts required')
        grades=[]
        for m,side in self.legs:
            f=facts[m.id]
            if set(f)!={'marketHash','final','eligible','iceSeconds','started','value'} or f['marketHash']!=digest(m.statement):raise Unresolved('complete bound market facts required')
            if f['final'] is not True or type(f['eligible']) is not bool or type(f['started']) is not bool:raise Unresolved('conclusive final eligibility required')
            integer(f['iceSeconds'])
            if f['value'] is not None:integer(f['value'])
            if f['iceSeconds']==0 and f['value'] not in (None,0):raise Unresolved('statistics without participation')
            participates=f['started'] if m.subject in self.board.goalies else f['iceSeconds']>0
            if not f['eligible'] or not participates:
                grade='void'
            else:
                if f['value'] is None:raise Unresolved('missing statistic cannot be loss')
                value=integer(f['value']);grade='void' if value==m.line else 'win' if ((value>m.line)==(side=='over')) else 'loss'
            grades.append(grade)
        active=sum(g!='void' for g in grades);wins=grades.count('win')
        multiplier=1 if active<2 else (3 if active==2 else 5) if active==wins else 0
        return {'active':active,'wins':wins,'grades':grades,'multiplier':multiplier,'statement':digest({'card':self.hash,'facts':facts,'grades':grades})}


class ApprovedPeer:
    def __init__(self,pool_id,board,size,entry_fee,prize,bands):
        integer(entry_fee);integer(prize)
        if not pool_id or size not in (2,3) or (entry_fee and prize):raise ValueError('paid entries or launcher-funded free prize')
        self.id=pool_id;self.board=board;self.size=size;self.entry_fee=entry_fee;self.prize=prize;self.bands=copy.deepcopy(bands);self.entries={};self.closed=False

    def enter(self,user,card,amount,now,nonce=1):
        previous=self.entries.get(user)
        if self.closed or not user or integer(now)>=self.board.lock_at or card.board.hash!=self.board.hash or card.size!=self.size:raise ValueError('admission context/lock')
        if integer(nonce,1)!=(previous[0]+1 if previous else 1) or amount!=(0 if previous else self.entry_fee):raise ValueError('entry/edit nonce or payment')
        integer(amount);self.entries[user]=(nonce,card)

    def cancel(self):
        if self.closed:raise ValueError('closed pool')
        self.closed=True;return {'refunds':{u:self.entry_fee for u in self.entries},'launcherRefund':self.prize,'fee':0}

    def settle_candidate(self,facts,now):
        if self.closed or integer(now)<self.board.lock_at:raise ValueError('pool state')
        required={m.id for _,card in self.entries.values() for m,_ in card.legs}
        if set(facts)!=required:raise Unresolved('exact selected-market facts required')
        grades={u:c.grade({m.id:facts[m.id] for m,_ in c.legs},now) for u,(_,c) in self.entries.items()}
        valid={u:Fraction(g['wins'],g['active']) for u,g in grades.items() if g['active']>=2}
        if len(valid)<2:return self.cancel()
        if len(valid) not in self.bands and len(valid)!=2:raise ValueError('published payout band required')
        weights=[10000] if len(valid)==2 else self.bands[len(valid)]
        allocation=allocate(valid,self.prize+self.entry_fee*len(valid),300 if self.entry_fee else 0,weights,True)
        allocation['refunds']={u:self.entry_fee for u in self.entries if u not in valid}
        allocation['statement']=digest({'pool':self.id,'board':self.board.hash,'cards':{u:c.hash for u,(_,c) in self.entries.items()},'facts':facts,'allocation':allocation})
        self.closed=True;return allocation


class ApprovedHouse:
    def __init__(self,board,size,stake,maximum_liability):
        if size not in (2,3):raise ValueError('card size')
        integer(stake,1);integer(maximum_liability,1)
        self.board=board;self.size=size;self.stake=stake;self.maximum_liability=maximum_liability
        self.cash=0;self.reserved=0;self.credits={};self.tickets={};self.retained=0;self.development=0;self.suspended=False

    @property
    def available(self):return self.cash-self.reserved-sum(self.credits.values())-self.development

    def fund(self,amount):self.cash+=integer(amount,1)

    def accept(self,user,card,amount,now,nonce=1):
        previous=self.tickets.get(user)
        if self.suspended or not user or card.board.hash!=self.board.hash or card.size!=self.size or integer(now)>=self.board.lock_at:raise ValueError('house admission context/lock')
        if previous:
            if previous['closed'] or nonce!=previous['nonce']+1 or amount!=0:raise ValueError('house edit nonce/payment')
            previous.update(card=card,nonce=nonce);return
        if nonce!=1 or amount!=self.stake:raise ValueError('house entry stake/nonce')
        fee_reserve=(3*self.stake+99)//100;reserve=self.stake*(3 if self.size==2 else 5)+fee_reserve
        if self.reserved+reserve>self.maximum_liability or self.available+self.stake<reserve:raise ValueError('gross liability/fee reserve insufficient')
        self.cash+=self.stake;self.reserved+=reserve;self.tickets[user]={'card':card,'nonce':1,'reserve':reserve,'closed':False}

    def settle_candidate(self,user,facts,now):
        t=self.tickets[user]
        if t['closed']:raise ValueError('ticket already closed')
        grade=t['card'].grade(facts,now);refund=grade['active']<2
        payout=self.stake if refund else self.stake*grade['multiplier']
        if not refund:
            self.retained+=self.stake;self.development=self.retained*3//100
        self.reserved-=t['reserve'];t['closed']=True;self.credits[user]=self.credits.get(user,0)+payout
        return {'payout':payout,'refund':refund,'development':self.development,'statement':grade['statement']}

    def cancel_candidate(self,user):
        t=self.tickets[user]
        if t['closed']:raise ValueError('ticket already closed')
        t['closed']=True;self.reserved-=t['reserve'];self.credits[user]=self.credits.get(user,0)+self.stake

    def withdraw_house(self,amount):
        if integer(amount,1)>self.available:raise ValueError('protected reserves/credits/development')
        self.cash-=amount

    def claim(self,user):
        value=self.credits.pop(user,0);self.cash-=value;return value

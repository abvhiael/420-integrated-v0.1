"""Frozen pick cards and separate peer/house liability ledgers.

These deterministic reference ledgers do not hold tokens or authenticate feeds.
Every monetary integer is in smallest token units. A chain host must independently
authorize facts and enforce disputes before committing a candidate allocation.
"""
from dataclasses import dataclass
from fractions import Fraction
from .core import Unresolved, allocate, canonical, digest, integer, ratio


@dataclass(frozen=True)
class Market:
    id: str
    event: str
    subject: str
    metric: str
    line: Fraction
    lock_at: int
    correlation_group: str

    def __post_init__(self):
        if any(not isinstance(v,str) or not v for v in (self.id,self.event,self.subject,self.metric,self.correlation_group)): raise ValueError('complete market identity required')
        integer(self.lock_at,1)
        object.__setattr__(self,'line',ratio(self.line))

    @property
    def statement(self): return {'id':self.id,'event':self.event,'subject':self.subject,'metric':self.metric,'line':self.line,'lock':self.lock_at,'correlation':self.correlation_group}


class Card:
    def __setattr__(self,name,value):
        if getattr(self,'_sealed',False): raise AttributeError('card quote is immutable')
        object.__setattr__(self,name,value)

    def __init__(self, rules, markets, selections, now):
        if rules.config['format'] != 'pickem': raise ValueError('pickem profile required')
        p=rules.parameters
        if set(p) != {'minimumLegs','maximumLegs','push','dnp','allowCorrelated','payoutTable'}: raise ValueError('explicit pickem policy required')
        integer(p['minimumLegs'],1); integer(p['maximumLegs'],p['minimumLegs'])
        if p['maximumLegs'] > 32 or p['push'] not in ('void','loss') or p['dnp'] not in ('void','loss') or type(p['allowCorrelated']) is not bool: raise ValueError('invalid grading policy')
        if not p['payoutTable']: raise ValueError('explicit gross multiplier table required')
        table={}
        for row in p['payoutTable']:
            if set(row) != {'active','wins','multiplier'}: raise ValueError('invalid payout table')
            active=integer(row['active'],1); wins=integer(row['wins']); multiplier=ratio(row['multiplier'])
            if wins>active or active>p['maximumLegs'] or multiplier<0 or (active,wins) in table: raise ValueError('ambiguous payout table')
            table[(active,wins)]=multiplier
        # Every void-reduced outcome must have a published price; never reprice later.
        if any((a,w) not in table for a in range(1,p['maximumLegs']+1) for w in range(a+1)): raise ValueError('incomplete void-reduction table')
        inventory=tuple(markets)
        if len({m.id for m in inventory}) != len(inventory): raise ValueError('duplicate market identity')
        by_id={m.id:m for m in inventory}; selections=tuple(tuple(s) for s in selections)
        if not p['minimumLegs'] <= len(selections) <= p['maximumLegs'] or len({s[0] for s in selections}) != len(selections): raise ValueError('card size/duplicate selection')
        legs=[]
        for mid,side in selections:
            if mid not in by_id or side not in ('over','under'): raise ValueError('invalid selection')
            market=by_id[mid]
            if integer(now) >= market.lock_at: raise ValueError('market locked')
            legs.append((market,side))
        if not p['allowCorrelated'] and len({m.correlation_group for m,_ in legs}) != len(legs): raise ValueError('correlated selections prohibited')
        self.rules=rules; self.legs=tuple(legs); self._table=tuple(table.items())
        self.market_set_hash=digest(sorted((m.statement for m in inventory),key=lambda v:v['id']))
        self.hash=digest({'domain':'420.FANTASY.PICKEM.CARD.V1','profile':rules.hash,'legs':[(m.statement,s) for m,s in legs]})
        self.max_multiplier=max(Fraction(1),*table.values())
        self._sealed=True

    @property
    def lock_at(self): return min(m.lock_at for m,_ in self.legs)

    def grade(self, facts, now):
        if integer(now) < max(m.lock_at for m,_ in self.legs): raise Unresolved('events not locked')
        if set(facts) != {m.id for m,_ in self.legs}: raise Unresolved('exact complete market facts required')
        active=wins=0; grades=[]; p=self.rules.parameters
        for m,side in self.legs:
            fact=facts[m.id]
            if set(fact) != {'marketHash','final','played','value'} or fact['marketHash'] != digest(m.statement): raise Unresolved('fact/market context mismatch')
            if fact['final'] is not True or type(fact['played']) is not bool: raise Unresolved('final participation required')
            if not fact['played']:
                if fact['value'] is not None: raise Unresolved('DNP value must be explicitly absent')
                grade=p['dnp']
            else:
                if fact['value'] is None: raise Unresolved('missing metric')
                value=ratio(fact['value'])
                grade=p['push'] if value==m.line else ('win' if ((value>m.line)==(side=='over')) else 'loss')
            grades.append(grade)
            if grade!='void': active+=1; wins+=grade=='win'
        multiplier=dict(self._table)[(active,wins)] if active else Fraction(1)
        return {'active':active,'wins':wins,'grades':grades,'multiplier':multiplier,'statement':digest({'card':self.hash,'facts':facts,'grades':grades,'multiplier':multiplier})}


class HouseLiability:
    """Gross reserve model, including stake refunds; conservative across correlation."""
    def __init__(self): self.cash=0; self.reserved=0; self.tickets={}; self.credits={}

    @property
    def available(self): return self.cash-self.reserved-sum(self.credits.values())

    def fund(self, amount): self.cash+=integer(amount,1)

    def accept(self, ticket_id, user, card, stake, now):
        integer(stake,1)
        if not ticket_id or not user or ticket_id in self.tickets or integer(now)>=card.lock_at: raise ValueError('duplicate/locked ticket')
        exact=stake*card.max_multiplier; reserve=(exact.numerator+exact.denominator-1)//exact.denominator
        if self.available+stake<reserve: raise ValueError('insufficient independently funded gross liability')
        self.cash+=stake; self.reserved+=reserve
        # Freeze a defensive copy of grading state against caller repricing/mutation.
        import copy
        self.tickets[ticket_id]={'user':user,'card':copy.deepcopy(card),'stake':stake,'reserve':reserve,'closed':False}
        return digest({'ticket':ticket_id,'user':user,'card':card.hash,'stake':stake,'reserve':reserve})

    def settle_candidate(self, ticket_id, facts, now):
        t=self.tickets[ticket_id]
        if t['closed']: raise ValueError('ticket already closed')
        grade=t['card'].grade(facts,now); exact=t['stake']*grade['multiplier']; payout=exact.numerator//exact.denominator
        if payout>t['reserve']: raise AssertionError('liability under-reserved')
        t['closed']=True; self.reserved-=t['reserve']; self.credits[t['user']]=self.credits.get(t['user'],0)+payout
        return {'payout':payout,'statement':grade['statement']}

    def withdraw_house(self, amount):
        integer(amount,1)
        if amount>self.available: raise ValueError('reserved capital cannot be withdrawn')
        self.cash-=amount

    def claim(self,user):
        amount=self.credits.pop(user,0); self.cash-=amount; return amount


class PeerPool:
    """Only entry stakes and launcher prize funding; no house payout promise."""
    def __init__(self,pool_id,lock_at,entry_fee,prize,fee_bps,weights,two_entrant_wta=True):
        if not pool_id: raise ValueError('pool identity required')
        integer(lock_at,1); integer(entry_fee); integer(prize); integer(fee_bps)
        if fee_bps>10000 or (not entry_fee and fee_bps): raise ValueError('invalid peer fee')
        if type(two_entrant_wta) is not bool or not weights or any(type(w) is not int or w<0 for w in weights) or sum(weights)!=10000: raise ValueError('invalid peer payout policy')
        self.id=pool_id; self.lock_at=lock_at; self.entry_fee=entry_fee; self.prize=prize
        self.fee_bps=fee_bps; self.weights=tuple(weights); self.two_entrant_wta=two_entrant_wta
        self.entries={}; self.closed=False

    def enter(self,user,card,amount,now):
        if self.closed or not user or user in self.entries or amount!=self.entry_fee or integer(now)>=min(self.lock_at,card.lock_at): raise ValueError('peer admission rejected')
        integer(amount)
        if self.entries:
            reference=next(iter(self.entries.values()))
            if card.rules.hash!=reference.rules.hash or card.market_set_hash!=reference.market_set_hash or len(card.legs)!=len(reference.legs): raise ValueError('mixed peer scoring profiles/market lines/card sizes')
        import copy
        self.entries[user]=copy.deepcopy(card)

    def settle_candidate(self,facts,now):
        if self.closed or integer(now)<self.lock_at: raise ValueError('peer pool closed/not locked')
        if len(self.entries)<2: raise Unresolved('minimum two entrants; cancel for full refunds')
        required={m.id for card in self.entries.values() for m,_ in card.legs}
        if set(facts)!=required: raise Unresolved('complete exact peer market facts required')
        grades={u:card.grade({m.id:facts[m.id] for m,_ in card.legs},now) for u,card in self.entries.items()}
        if all(g['active']==0 for g in grades.values()): return {'cancelled':True,'refunds':self.cancel()}
        scores={u:g['wins'] for u,g in grades.items()}
        result=allocate(scores,self.prize+self.entry_fee*len(scores),self.fee_bps,self.weights,self.two_entrant_wta)
        result['statement']=digest({'pool':self.id,'cards':{u:c.hash for u,c in self.entries.items()},'facts':facts,'allocation':result})
        self.closed=True; return result

    def cancel(self):
        if self.closed: raise ValueError('pool already closed')
        self.closed=True
        return {'entrants':{u:self.entry_fee for u in self.entries},'launcher':self.prize}

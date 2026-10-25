"""Season roster/draft/waiver/trade/period engines and exact ranking modes."""
from fractions import Fraction
from .core import Unresolved, SportRegistry, digest, integer, ratio


class SeasonLeague:
    def __init__(self, league_id, rules, snapshot, members, periods):
        if not league_id or rules.config["format"] != "season-long" or rules.config["sport"] != snapshot.sport:
            raise ValueError("league/profile mismatch")
        p = rules.parameters
        if set(p) != {"rosterSize", "activeSlots", "waiverPriority", "draftOrder", "tradeDeadline", "mode", "categories", "draftStart", "draftPickSeconds"}:
            raise ValueError("explicit season policy required")
        if len(set(members)) != len(members) or len(members) < 2: raise ValueError("distinct league members required")
        if set(p["waiverPriority"]) != set(members) or len(p["waiverPriority"]) != len(members) or set(p["draftOrder"]) != set(members) or len(p["draftOrder"]) != len(members):
            raise ValueError("explicit complete draft/waiver orders required")
        if p["mode"] not in ("total-points", "h2h-points", "h2h-categories", "roto"): raise ValueError("unknown season mode")
        if p['mode'].startswith('h2h-') and len(members)%2: raise ValueError('initial H2H policy requires even membership; byes need a new version')
        integer(p["rosterSize"], 1); integer(p["tradeDeadline"], 1)
        integer(p['draftStart']); integer(p['draftPickSeconds'],1)
        if not p["activeSlots"] or len(p["activeSlots"]) > p["rosterSize"] or any(not s for s in p["activeSlots"]): raise ValueError("invalid active roster")
        if p["mode"] in ("h2h-categories", "roto") and not p["categories"]: raise ValueError("category definitions required")
        for c in p["categories"]:
            if set(c) != {"id", "numerator", "denominator", "direction", "minimumDenominator"} or c["direction"] not in ("higher", "lower"):
                raise ValueError("invalid exact category policy")
            integer(c["minimumDenominator"])
        if len({c['id'] for c in p['categories']}) != len(p['categories']): raise ValueError('duplicate category')
        periods = tuple(tuple(v) for v in periods)
        if not periods or len({v[0] for v in periods}) != len(periods): raise ValueError("unique periods required")
        for i, v in enumerate(periods):
            if len(v) != 4 or not integer(v[1]) < integer(v[2]) <= integer(v[3]) or (i and periods[i-1][2] > v[1]):
                raise ValueError("nonoverlapping UTC lock/end/correction boundaries required")
        self.id = league_id; self.rules = rules; self.snapshot = snapshot; self.members = tuple(members); self.periods = periods
        self.rosters = {m: set() for m in members}; self._picks = 0; self._priority = list(p["waiverPriority"])
        self.lineups = {}; self.revisions = {}; self.results = {}; self.matchups = {}
        self._draft_turn_started = p['draftStart']

    def _invalidate_future(self, actors, now):
        for pid, lock, _, _ in self.periods:
            if now < lock:
                for actor in actors: self.lineups.pop((pid, actor), None)

    @property
    def owner(self): return {a: m for m, roster in self.rosters.items() for a in roster}

    def _period(self, pid):
        try: return next(p for p in self.periods if p[0] == pid)
        except StopIteration: raise ValueError("unknown period") from None

    def _between(self, now):
        integer(now)
        if any(p[1] <= now < p[2] for p in self.periods): raise ValueError("roster transactions are closed during active periods")

    def draft_actor(self):
        order = self.rules.parameters["draftOrder"]; round_no, offset = divmod(self._picks, len(order))
        if round_no >= self.rules.parameters["rosterSize"]: return None
        return order[offset if round_no % 2 == 0 else len(order)-1-offset]

    def draft(self, actor, athlete, now):
        if not self._draft_turn_started <= integer(now) < min(self.periods[0][1], self._draft_turn_started+self.rules.parameters['draftPickSeconds']) or actor != self.draft_actor() or actor is None: raise ValueError("draft turn/lock mismatch")
        if athlete not in self.snapshot.athletes or athlete in self.owner: raise ValueError("athlete unavailable")
        self.rosters[actor].add(athlete); self._picks += 1
        self._draft_turn_started=now

    def autopick(self, actor, ordered_available, now):
        if actor != self.draft_actor() or actor is None or not self._draft_turn_started+self.rules.parameters['draftPickSeconds'] <= integer(now) < self.periods[0][1]: raise ValueError('autopick requires expired active turn')
        for aid in ordered_available:
            if aid in self.snapshot.athletes and aid not in self.owner:
                self.rosters[actor].add(aid); self._picks+=1; self._draft_turn_started=now; return aid
        raise Unresolved("no eligible autopick candidate")

    def waivers(self, claims, now):
        self._between(now)
        if self.draft_actor() is not None: raise ValueError("draft must complete before waivers")
        if len({c[0] for c in claims}) != len(claims): raise ValueError("one ranked claim per member per batch")
        ranked = sorted(claims, key=lambda c: self._priority.index(c[0]) if c[0] in self._priority else -1)
        # Validate the whole batch before changing any ownership.
        for actor, add, drop in ranked:
            if actor not in self.rosters or add not in self.snapshot.athletes or (drop is not None and drop not in self.rosters[actor]): raise ValueError("invalid waiver claim")
            if drop is None and len(self.rosters[actor]) >= self.rules.parameters["rosterSize"]: raise ValueError("roster capacity")
        winners = []
        initially_owned = set(self.owner)
        for actor, add, drop in ranked:
            if add in initially_owned or add in self.owner: continue
            if drop is not None: self.rosters[actor].remove(drop)
            self.rosters[actor].add(add); winners.append(actor)
            self._priority.remove(actor); self._priority.append(actor)
        self._invalidate_future(winners, now)
        return winners

    def trade(self, actor, counterparty, give, receive, accepted_by, now):
        self._between(now)
        if self.draft_actor() is not None or now >= self.rules.parameters["tradeDeadline"] or actor == counterparty or set(accepted_by) != {actor, counterparty}:
            raise ValueError("trade needs both parties before deadline")
        if actor not in self.rosters or counterparty not in self.rosters or len(set(give)) != len(give) or len(set(receive)) != len(receive): raise ValueError('invalid trade parties/items')
        give, receive = set(give), set(receive)
        if not give or not receive or not give <= self.rosters[actor] or not receive <= self.rosters[counterparty]: raise ValueError("invalid ownership")
        a = (self.rosters[actor]-give)|receive; b = (self.rosters[counterparty]-receive)|give
        if max(len(a),len(b)) > self.rules.parameters["rosterSize"]: raise ValueError("trade capacity")
        self.rosters[actor], self.rosters[counterparty] = a,b
        self._invalidate_future((actor,counterparty), now)

    def set_lineup(self, actor, pid, ids, now):
        p = self._period(pid); ids = tuple(ids)
        if actor not in self.rosters or integer(now) >= p[1]: raise ValueError("lineup lock")
        slots = self.rules.parameters["activeSlots"]
        if len(ids) != len(slots) or len(set(ids)) != len(ids) or not set(ids) <= self.rosters[actor]: raise ValueError("lineup ownership/count")
        if any(not self.snapshot.athletes[aid].positions.intersection(slots[i]) for i, aid in enumerate(ids)): raise ValueError("lineup position")
        self.lineups[(pid,actor)] = ids

    def schedule(self, pid, pairs, now):
        if integer(now) >= self._period(pid)[1]: raise ValueError('schedule lock')
        pairs = tuple(tuple(v) for v in pairs)
        flat = [m for pair in pairs for m in pair]
        if any(len(pair) != 2 for pair in pairs) or len(flat) != len(set(flat)) or set(flat) != set(self.members): raise ValueError("one opponent per member required")
        if pid in self.matchups or pid in self.revisions: raise ValueError("schedule is immutable")
        self.matchups[pid] = pairs

    def score_period(self, pid, revision, facts, now, snapshot_hash, registry=None):
        p = self._period(pid); integer(revision,1)
        if snapshot_hash != self.snapshot.hash or not p[2] <= integer(now) < p[3] or revision <= self.revisions.get(pid,0): raise ValueError("revision/correction window mismatch")
        if any((pid,m) not in self.lineups for m in self.members): raise Unresolved("all period lineups required")
        required = {aid for m in self.members for aid in self.lineups[(pid,m)]}
        if set(facts) != required: raise Unresolved("complete statistics required")
        registry = registry or SportRegistry(); result = {}
        for member in self.members:
            ids = self.lineups[(pid,member)]
            score = (sum((registry.score(self.snapshot.sport,self.rules.config['scoring'],self.snapshot.athletes[aid],facts[aid]['stats']) for aid in ids), Fraction())
                     if self.rules.parameters['mode'] in ('total-points','h2h-points') else Fraction())
            metrics = {}
            for c in self.rules.parameters['categories']:
                fields = [c['numerator']] + ([c['denominator']] if c['denominator'] else [])
                for field in fields:
                    if any(field not in facts[aid]['metrics'] for aid in ids): raise Unresolved('missing category numerator/denominator')
                n = sum((ratio(facts[aid]['metrics'][c['numerator']]) for aid in ids),Fraction())
                d = sum((ratio(facts[aid]['metrics'][c['denominator']]) for aid in ids),Fraction()) if c['denominator'] else Fraction(1)
                if c['denominator'] and any(ratio(facts[aid]['metrics'][c['denominator']]) < 0 for aid in ids): raise ValueError('negative participation denominator')
                metrics[c['id']] = (n,d)
            result[member] = {'points':score,'categories':metrics}
        self.results[pid] = result; self.revisions[pid] = revision
        return digest({'domain':'420.FANTASY.SEASON.RESULT.V1','league':self.id,'profile':self.rules.hash,'snapshot':self.snapshot.hash,'period':pid,'revision':revision,'lineups':{m:self.lineups[(pid,m)] for m in self.members},'facts':facts,'result':result})

    def totals(self, now):
        if any(now < p[3] or p[0] not in self.results for p in self.periods): raise Unresolved('season/corrections incomplete')
        out = {m:{'points':Fraction(),'categories':{c['id']:(Fraction(),Fraction()) for c in self.rules.parameters['categories']}} for m in self.members}
        for pid,_,_,_ in self.periods:
            for m in self.members:
                out[m]['points'] += self.results[pid][m]['points']
                for cid,(n,d) in self.results[pid][m]['categories'].items():
                    a,b = out[m]['categories'][cid]; out[m]['categories'][cid]=(a+n,b+d)
        return out

    def rank(self, now):
        totals = self.totals(now); mode = self.rules.parameters['mode']
        if mode == 'total-points': return {m:v['points'] for m,v in totals.items()}
        categories = self.rules.parameters['categories']; values = {m:Fraction() for m in self.members}
        def category_value(row,c):
            n,d = row['categories'][c['id']]
            if c['denominator']:
                if d <= 0 or d < c['minimumDenominator']: return None
                return n/d
            return n
        if mode == 'roto':
            for c in categories:
                valid = [(m,category_value(v,c)) for m,v in totals.items()]; valid = [(m,v) for m,v in valid if v is not None]
                valid.sort(key=lambda pair:pair[1],reverse=c['direction']=='higher');i=0
                while i < len(valid):
                    j=i+1
                    while j<len(valid) and valid[j][1]==valid[i][1]:j+=1
                    points = sum((Fraction(len(self.members)-r) for r in range(i,j)),Fraction())/(j-i)
                    for m,_ in valid[i:j]:values[m]+=points
                    i=j
            return values
        for pid,_,_,_ in self.periods:
            if pid not in self.matchups: raise Unresolved('period matchups missing')
            for a,b in self.matchups[pid]:
                if mode=='h2h-points':pairs=[(self.results[pid][a]['points'],self.results[pid][b]['points'],'higher')]
                else:pairs=[(category_value(self.results[pid][a],c),category_value(self.results[pid][b],c),c['direction']) for c in categories]
                for x,y,direction in pairs:
                    if x is None and y is None:continue
                    if x==y:values[a]+=Fraction(1,2);values[b]+=Fraction(1,2)
                    elif y is None or (x is not None and ((x>y)==(direction=='higher'))):values[a]+=1
                    else:values[b]+=1
        return values

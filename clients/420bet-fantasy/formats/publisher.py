"""Approved V1 historical salary calculation; caller authenticates source evidence."""
from dataclasses import dataclass
from fractions import Fraction
from .core import Athlete, Snapshot, Unresolved, canonical, digest, integer
from nhl import points

YEAR=365*86400


def id_order(value):
    text=str(value)
    return (0,int(text)) if text.isdecimal() and str(int(text))==text else (1,text)


def median(values):
    values=sorted(values)
    if not values: raise Unresolved('empty pricing group')
    n=len(values);return values[n//2] if n%2 else (values[n//2-1]+values[n//2])/2


def price(average, reference, low, high):
    if len(reference)<5: raise Unresolved('five established players required per pricing group')
    percentile=Fraction(2*sum(v<average for v in reference)+sum(v==average for v in reference),2*len(reference))
    exact=low+percentile*(high-low)
    return 100*((exact.numerator+100*exact.denominator-1)//(100*exact.denominator))


def publish(athletes, groups, history, cutoff, source_revision, game_ids, lock_at):
    """History: authenticated revisions available at cutoff, not future corrections.

    Each row commits athlete/game, actual appearance time, completion time,
    availability timestamp, season type, revision and full inherited NHL stats.
    NHL-wide group membership is supplied independently of the selected slate.
    """
    integer(cutoff,1);integer(lock_at,cutoff+1)
    roster={a.id:a for a in athletes}
    if len(roster)!=len(athletes) or set(groups)!=set(roster) or not source_revision: raise ValueError('complete unique NHL pricing registry required')
    for aid,g in groups.items():
        a=roster[aid]
        if g not in ('F','D','G') or (g=='G')!=a.goalie or not a.positions.intersection({'F':{'C','LW','RW'},'D':{'D'},'G':{'G'}}[g]): raise ValueError('invalid published pricing group')
    latest={};seen=set()
    for row in history:
        if set(row)!={'athlete','game','appearanceAt','completedAt','availableAt','seasonType','revision','stats'}: raise Unresolved('complete historical record required')
        aid=row['athlete'];revision=integer(row['revision'],1)
        if aid not in roster or not row['game']: raise ValueError('unknown history identity')
        for field in ('appearanceAt','completedAt','availableAt'): integer(row[field],1)
        if row['completedAt']<row['appearanceAt'] or row['availableAt']<row['completedAt']: raise Unresolved('inconsistent historical timestamps')
        identity=(aid,row['game'],revision)
        if identity in seen: raise Unresolved('duplicate historical revision')
        seen.add(identity)
        if row['availableAt']>cutoff or row['completedAt']>cutoff or not cutoff-YEAR<=row['appearanceAt']<cutoff or row['seasonType']!='regular': continue
        key=(aid,row['game'])
        if key not in latest or revision>latest[key]['revision']:latest[key]=row
    averages={};references={g:[] for g in ('F','D','G')};inputs={}
    for aid,a in roster.items():
        rows=sorted((r for (who,_),r in latest.items() if who==aid),key=lambda r:(-r['appearanceAt'],r['game']))
        appearances=[]
        for r in rows:
            value=points(r['stats'],a.goalie) # Missing is never DNP/fallback.
            if r['stats']['played']: appearances.append((r,value))
        appearances=appearances[:10];inputs[aid]=[r for r,_ in appearances]
        if len(appearances)>=5:
            average=Fraction(sum(v for _,v in appearances),len(appearances));averages[aid]=average;references[groups[aid]].append(average)
    if any(len(v)<5 for v in references.values()):raise Unresolved('insufficient established pricing cohort')
    salaries={'salary-cap':{},'captain':{}};fallback=[]
    for aid in roster:
        g=groups[aid];average=averages.get(aid)
        if average is None:average=median(references[g]);fallback.append(aid)
        salaries['salary-cap'][aid]=price(average,references[g],6500 if g=='G' else 2500,8500 if g=='G' else 9000)
        salaries['captain'][aid]=price(average,references[g],2000,12000)
    statement={'domain':'420.FANTASY.SALARIES.APPROVED.V1','cutoff':cutoff,'sourceRevision':source_revision,'groups':groups,
               'inputs':inputs,'fallback':sorted(fallback),'salaries':salaries}
    return {'statement':statement,'hash':digest(statement),'snapshots':{kind:Snapshot('NHL',1,[Athlete(a.id,a.team,a.positions,table[a.id],a.goalie) for a in athletes],lock_at,game_ids) for kind,table in salaries.items()}}


def legal_assignment(athletes,slots,cap=None,captain=None,minimum_teams=1,maximum_per_team=32,preferred=()):
    """Deterministic feasibility search with exact captain cost and no greedy dead end."""
    athletes=dict(athletes);slots=tuple(tuple(s) for s in slots);preferred=tuple(preferred)
    choices=[]
    for i,slot in enumerate(slots):
        eligible=[aid for aid,a in athletes.items() if a.positions.intersection(slot)]
        eligible.sort(key=id_order)
        choices.append(eligible)
    fixed={}
    def visit(index,used,teams,cost,lineup):
        if index==len(slots):return tuple(lineup) if len(teams)>=minimum_teams else None
        if len(teams)+len(slots)-index<minimum_teams:return None
        if cap is not None:
            lower=Fraction()
            for j in range(index,len(slots)):
                available=[athletes[a].salary*(Fraction(3,2) if j==captain else 1) for a in choices[j] if a not in used and teams.get(athletes[a].team,0)<maximum_per_team]
                if not available:return None
                lower+=min(available)
            if cost+lower>cap:return None
        for aid in ([fixed[index]] if index in fixed else choices[index]):
            a=athletes[aid];next_cost=cost+a.salary*(Fraction(3,2) if index==captain else 1)
            if aid in used or teams.get(a.team,0)>=maximum_per_team or (cap is not None and next_cost>cap):continue
            counts=dict(teams);counts[a.team]=counts.get(a.team,0)+1
            result=visit(index+1,used|{aid},counts,next_cost,lineup+[aid])
            if result is not None:return result
        return None
    # Preserve surviving old slots before choosing replacements for empty slots.
    for i,aid in enumerate(preferred[:len(slots)]):
        if aid not in choices[i] or aid in fixed.values():continue
        fixed[i]=aid
        if visit(0,set(),{},Fraction(),[]) is None:del fixed[i]
    result=visit(0,set(),{},Fraction(),[])
    if result is None:raise Unresolved('no legally fillable lineup')
    return result

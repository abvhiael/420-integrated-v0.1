"""Additional NHL v7 fields required by the approved season and pick'em rules.

Schema: https://developer.sportradar.com/ice-hockey/reference/nhl-game-summary
Uses inherited complete summary/PBP/ice-time validation; never infers a start from play.
"""
from collections import Counter
from sportradar_scoring import normalise,roster,seconds,uint,fail
from .core import digest,Unresolved
from eth_abi import encode
from nhl import FIELDS,STATS_ABI,k256,merkle,checked_stats
from sportradar import load_capture

FORMAT_DOMAIN=k256(b'420.FANTASY.APPROVED.FORMATS.V1')
SEASON_DOMAIN=k256(b'420.FANTASY.SEASON.DATA.V1')
FORMAT_FACT='('+STATS_ABI+',uint32,bool)'
SEASON_FACT='(uint32,bool,bytes32[],'+STATS_ABI+'[],uint32[],bool[],uint16[])'


def format_leaf(chain,book,id,manifest,revision,athlete,fact):
    return k256(k256(encode(['bytes32','uint256','address','bytes32','bytes32','uint64','uint32',FORMAT_FACT],[FORMAT_DOMAIN,chain,book,id,manifest,revision,athlete,fact])))


def season_leaf(chain,data,id,manifest,week,revision,fact):
    return k256(k256(encode(['bytes32','uint256','address','bytes32','bytes32','uint16','uint64',SEASON_FACT],[SEASON_DOMAIN,chain,data,id,manifest,week,revision,fact])))


def normalized_format_tree(chain,book,id,manifest,revision,rows):
    seen=set();facts={};leaves=[]
    for row in sorted(rows,key=lambda r:r['athlete']):
        aid=row['athlete']
        if aid in seen or type(aid) is not int or not 0<aid<2**32:raise Unresolved('unique canonical athlete IDs required')
        seen.add(aid);checked_stats(row['stats'],row['positions']==16)
        ice=row['iceSeconds'];started=row['started']
        if type(ice) is not int or not 0<=ice<=8*3600 or type(started) is not bool or row['stats']['played']!=(ice>0) or started and (row['positions']!=16 or not row['stats']['played']):raise Unresolved('typed verified participation required')
        fact=([row['stats'][f] for f in FIELDS],ice,started);facts[aid]=fact;leaves.append(format_leaf(chain,book,id,manifest,revision,aid,fact))
    if not leaves:raise Unresolved('complete normalized rows required')
    root,proofs=merkle(leaves);return {'root':root,'facts':facts,'proofs':dict(zip(sorted(facts),proofs))}


def normalise_extended_captures(summary,pbp,ice,mapping,as_of,cutoff):
    records={kind:load_capture(path) for kind,path in [('summary',summary),('pbp',pbp),('time-on-ice',ice)]}
    return normalise_extended(records,mapping,as_of,cutoff)


def normalise_extended(records,mapping,as_of,cutoff):
    result=normalise(records,mapping,as_of,cutoff);summary=records['summary'][1];pbp=records['pbp'][1]
    players={};sideof={};starts=Counter();powerplay=Counter()
    for side in ('home','away'):
        for pid,p in roster(summary,side).items():players[pid]=p;sideof[pid]=side
    for period in pbp['periods']:
        if period['type']=='shootout':continue
        for event in period['events']:
            for stat in event.get('statistics',[]):
                if stat.get('type')=='assist' or (stat.get('type')=='shot' and stat.get('goal') is True):
                    strength=stat.get('strength')
                    if strength not in ('even','powerplay','shorthanded'):fail('explicit scoring-event strength required')
                    pid=stat.get('player',{}).get('id')
                    if pid in players and strength=='powerplay':powerplay[pid]+=1
    rows={r['athlete']:r for r in result['rows']};provider={r['athlete']:r['providerID'] for r in mapping['rows']}
    for aid,row in rows.items():
        pid=provider[aid];p=players[pid];goalie=row['positions']==16;s=row['stats'];played=s['played']
        ice=seconds(p.get('time_on_ice',{}).get('total')) if played else 0
        started=False
        if goalie:
            if type(p.get('starter')) is not bool:fail('explicit official goalie starter flag required')
            started=p['starter']
            if started and not played:fail('goalie start contradicts participation')
            starts[sideof[pid]]+=started
        else:
            pp=p.get('statistics',{}).get('powerplay')
            if not isinstance(pp,dict):fail('explicit powerplay group required')
            if uint(pp.get('goals'))+uint(pp.get('assists'))!=powerplay[pid]:fail('powerplay summary/PBP mismatch')
        if powerplay[pid]>s['goals']+s['assists']:fail('powerplay exceeds ordinary points')
        metrics={'goals':s['goals'] if not goalie else 0,'assists':s['assists'] if not goalie else 0,'shots':s['shots'] if not goalie else 0,'blocks':s['blocks'] if not goalie else 0,
                 'powerplay':powerplay[pid] if not goalie else 0,'shorthanded':s['shorthanded'] if not goalie else 0,
                 'wins':int(s['win']),'shutouts':int(s['shutout']),'saves':s['saves'],'shotsAgainst':s['saves']+s['goalsAgainst'],
                 'goalsAgainst':s['goalsAgainst'],'seconds':ice if goalie else 0,'starts':int(started)}
        row.update(iceSeconds=ice,started=started,powerplay=powerplay[pid],metrics=metrics)
    if starts!={'home':1,'away':1}:fail('exactly one official starting goalie per team required')
    result['extendedEvidence']=digest({'domain':'420.FANTASY.NHL.EXTENDED.V1','dailyEvidence':result['evidence'],'rows':result['rows']})
    result['oracleAccepted']=False;return result


def week_facts(athletes,assigned_games,dispositions,normalized,cutoff):
    """Complete closed-roster inventory; output excludes no selected game silently."""
    if set(dispositions)!=set(assigned_games):raise Unresolved('complete weekly disposition inventory')
    eligible={g for g,d in dispositions.items() if d['eligible']}
    if set(normalized)!=eligible:raise Unresolved('every eligible game requires normalized source evidence')
    facts={a:{'games':[],'complete':True} for a in athletes}
    for game in sorted(eligible):
        report=normalized[game]
        if report['game']!=game or report['finalAt']>cutoff or report['scheduled']!=assigned_games[game] or 'extendedEvidence' not in report:raise Unresolved('weekly game/cutoff/context mismatch')
        seen=set()
        for row in report['rows']:
            aid=row['athlete']
            if aid in seen:raise Unresolved('duplicate weekly athlete/game')
            seen.add(aid)
            if aid in facts:facts[aid]['games'].append({'id':game,'stats':dict(row['stats']),'metrics':dict(row['metrics']),'iceSeconds':row['iceSeconds'],'started':row['started'],'powerplay':row['powerplay']})
    return facts

"""Frozen regular-season schedules, DST-aware UTC periods and fixed recovery clocks."""
from datetime import date,datetime,time,timedelta
from zoneinfo import ZoneInfo
from .core import digest,integer,Unresolved

NY=ZoneInfo('America/New_York')


def weekly_periods(start_monday,weeks,schedule,shortened=()):
    day=date.fromisoformat(start_monday)
    if day.weekday()!=0 or type(weeks) is not int or not 1<=weeks<=40:raise ValueError('Monday and bounded weeks required')
    if not set(shortened)<={'week-1',f'week-{weeks}'}:raise ValueError('only first or last week may have a shortened minimum')
    if len({g['id'] for g in schedule})!=len(schedule):raise ValueError('unique official games')
    periods=[];windows={};assignment={}
    for i in range(weeks):
        first=datetime.combine(day+timedelta(days=7*i),time(),NY);end=first+timedelta(days=7)
        cutoff=datetime.combine(end.date(),time(23,59),NY)
        games=[g for g in schedule if int(first.timestamp())<=g['originalStart']<int(end.timestamp())]
        pid=f'week-{i+1}'
        lock=min(g['originalStart'] for g in games) if games else int(first.timestamp());resolution=int(cutoff.timestamp())
        periods.append((pid,lock,int(end.timestamp()),resolution+86400))
        windows[pid]={'resolution':resolution,'correctionEnd':resolution+86400,'challengeEnd':resolution+2*86400,'deadline':resolution+5*86400,'minimumStarts':1 if pid in shortened else 2}
        for g in games:assignment[g['id']]=pid
    return {'periods':periods,'windows':windows,'assignment':assignment,'hash':digest({'start':start_monday,'weeks':weeks,'schedule':schedule,'shortened':sorted(shortened)})}


def resolve_games(schedule,results,cutoff,last_accepted):
    """Facts must be authenticated before invocation; unknown is not exclusion."""
    integer(cutoff);integer(last_accepted)
    if set(results)!={g['id'] for g in schedule}:raise Unresolved('complete game dispositions required')
    eligible=[];early=False
    for g in schedule:
        r=results[g['id']]
        if set(r)!={'final','conclusiveExcluded','actualStart','completedAt'} or type(r['final']) is not bool or type(r['conclusiveExcluded']) is not bool:raise Unresolved('typed game disposition required')
        actual=integer(r['actualStart']);completed=integer(r['completedAt'])
        if actual and actual<g['originalStart'] and last_accepted>=actual:early=True
        if r['final']:
            if r['conclusiveExcluded'] or not actual or completed<actual:raise Unresolved('inconsistent final game')
            if completed<=cutoff:eligible.append(g['id'])
        elif not r['conclusiveExcluded']:raise Unresolved('unresolved game cannot be excluded')
    return {'eligible':tuple(eligible),'void':not eligible or early,'earlyViolation':early}

"""BNB-2.3 half-open inventory and local-time conversion rules."""
from datetime import datetime, timezone, timedelta, time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def peak_used(intervals, start, end):
    """Intervals (start,end,quantity), events at end execute before starts."""
    events=[]
    for left,right,quantity in intervals:
        left=max(left,start)
        right=min(right,end)
        if left < right:
            events.extend([(left,1,int(quantity)),(right,0,-int(quantity))])
    used=peak=0
    for _,_,change in sorted(events):
        used+=change
        peak=max(peak,used)
    return peak


def strict_local_instant(wall, zone_id, fold=None):
    """Resolve wall-clock time, rejecting DST gaps and ambiguous folds."""
    if wall.tzinfo is not None:
        raise ValueError("EXPECTED_NAIVE_LOCAL_TIME")
    try: zone=ZoneInfo(zone_id)
    except (KeyError,ValueError,ZoneInfoNotFoundError): raise ValueError("INVALID_IANA_TIMEZONE")
    variants=[]
    for f in (0,1):
        aware=wall.replace(tzinfo=zone,fold=f)
        utc=aware.astimezone(timezone.utc)
        if utc.astimezone(zone).replace(tzinfo=None)==wall:
            if utc not in variants: variants.append(utc)
    if not variants:raise ValueError("NONEXISTENT_LOCAL_TIME")
    if len(variants)>1 and fold is None:raise ValueError("AMBIGUOUS_LOCAL_TIME")
    if fold is not None:
        if fold not in (0,1):raise ValueError("INVALID_FOLD")
        chosen=wall.replace(tzinfo=zone,fold=fold).astimezone(timezone.utc)
        if chosen not in variants:raise ValueError("INVALID_FOLD")
        return chosen
    return variants[0]


def local_stay_window(checkin, checkout, zone_id, arrival_hour=15, departure_hour=11):
    """Date-only check-in/out with strict DST conversion and minimum one night."""
    if checkout<=checkin:raise ValueError("MINIMUM_NIGHTS")
    start=strict_local_instant(datetime.combine(checkin,time(arrival_hour)),zone_id)
    end=strict_local_instant(datetime.combine(checkout,time(departure_hour)),zone_id)
    if end<=start:raise ValueError("INVALID_WINDOW")
    return start,end,(checkout-checkin).days

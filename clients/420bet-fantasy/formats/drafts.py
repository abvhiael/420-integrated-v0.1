"""Reviewable DISCUSSION presets. None is an approved launch configuration."""
from .core import Rules


def draft(kind, *, members=(), mode='total-points'):
    skaters=['C','LW','RW','D']; all_positions=skaters+['G']
    scoring='NHL_DAILY_V1'
    if kind in ('salary-cap','captain'):
        parameters={'slots':[['C'],['C'],['LW','RW'],['LW','RW'],['LW','RW'],['D'],['D'],['G'],skaters] if kind=='salary-cap' else [all_positions]*6,
                    'salaryCap':50000,'captainIndex':None if kind=='salary-cap' else 0,
                    'captainSalaryMultiplier':1 if kind=='salary-cap' else [3,2],
                    'captainScoreMultiplier':1 if kind=='salary-cap' else [3,2],
                    'minimumTeams':3 if kind=='salary-cap' else 2,'maximumPerTeam':4,'entryLimit':1}
    elif kind=='season-long':
        if len(members)<2 or len(set(members))!=len(members): raise ValueError('explicit distinct league members required')
        parameters={'rosterSize':12,'activeSlots':[['C'],['LW'],['RW'],['D'],['D'],['G'],skaters],
                    'draftOrder':list(members),'waiverPriority':list(members),'draftStart':1,'draftPickSeconds':60,
                    'tradeDeadline':1,'mode':mode,'categories':[]}
        # Placeholder times MUST be replaced before constructing a real schedule.
        if mode in ('h2h-categories','roto'):
            parameters['categories']=[{'id':'goals','numerator':'goals','denominator':None,'direction':'higher','minimumDenominator':0},
                                      {'id':'savePercentage','numerator':'saves','denominator':'shotsAgainst','direction':'higher','minimumDenominator':30}]
    elif kind=='pickem':
        scoring='PICKEM_RAW_METRICS_DRAFT_V1'
        parameters={'minimumLegs':2,'maximumLegs':3,'push':'void','dnp':'void','allowCorrelated':False,
                    'payoutTable':[{'active':a,'wins':w,'multiplier':([1,1] if a==1 else [3,1] if a==2 else [5,1]) if w==a else 0}
                                   for a in range(1,4) for w in range(a+1)]}
    else: raise ValueError('unknown draft format')
    return Rules.freeze({'id':'DISCUSSION-NHL-'+kind+'-'+mode,'version':1,'sport':'NHL','format':kind,'scoring':scoring,'status':'draft','parameters':parameters})

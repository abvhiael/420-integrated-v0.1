"""Independently replay executed, verified cards, pots and final tournament ranks.

Input is a passing single-test Foundry -vvvv trace, never a caller payout vector.
This reference deliberately imports no Solidity evaluator or standings implementation.
"""
import argparse,itertools,json,re
from collections import Counter,defaultdict
from pathlib import Path
from Crypto.Hash import keccak

def digest(data):
    h=keccak.new(digest_bits=256);h.update(data);return int.from_bytes(h.digest(),'big')
def encoded(values):return b''.join(int(v).to_bytes(32,'big') for v in values)
def five(cards):
    ranks=sorted((c%13+2 for c in cards),reverse=True);counts=Counter(ranks)
    groups=sorted(((n,r) for r,n in counts.items()),reverse=True)
    unique=sorted(counts,reverse=True);straight=0
    if len(unique)==5:
        if unique[0]-unique[-1]==4:straight=unique[0]
        elif unique==[14,5,4,3,2]:straight=5
    flush=len({c//13 for c in cards})==1
    if straight and flush:return (8,straight)
    if groups[0][0]==4:return (7,groups[0][1],groups[1][1])
    if [g[0] for g in groups]==[3,2]:return (6,groups[0][1],groups[1][1])
    if flush:return (5,*ranks)
    if straight:return (4,straight)
    if groups[0][0]==3:return (3,groups[0][1],*sorted((r for r in ranks if r!=groups[0][1]),reverse=True))
    pairs=sorted((r for r,n in counts.items() if n==2),reverse=True)
    if len(pairs)==2:return (2,*pairs,next(r for r in ranks if r not in pairs))
    if pairs:return (1,pairs[0],*(r for r in ranks if r!=pairs[0]))
    return (0,*ranks)
def seven(cards):return max(five(c) for c in itertools.combinations(cards,5))
def packets(trace,name,size):
    raw=re.findall(r'emit '+name+r'\(encoded: (0x[0-9a-fA-F]+)\)',trace)
    result=[]
    for value in raw:
        b=bytes.fromhex(value[2:]);assert len(b)==size*32,(name,len(b),size)
        result.append([int.from_bytes(b[i:i+32],'big') for i in range(0,len(b),32)])
    return result
def replay(trace,require_certificate=True):
    assert re.search(r'\[PASS\].*test',trace) and '0 failed' in trace and '[FAIL' not in trace,'not a passing execution'
    hands=packets(trace,'C5ExecutedHandData',74);certs=packets(trace,'C5CertifiedStandingsData',31)
    assert hands and (not require_certificate or len(certs)==1),'missing execution evidence'
    observed={};eliminations=defaultdict(list);seen=set()
    for w in hands:
        hand,table,wave,button,mask=w[:5];assert hand not in seen;seen.add(hand)
        people=w[5:14];a=w[14:23];b=w[23:32];board=w[32:37]
        initial=w[37:46];contrib=w[46:55];remaining=w[55:64];final=w[64:73];folded=w[73]
        seats=[i for i in range(9) if mask>>i&1];assert len(seats)>=2
        cards=board+[c for i in seats for c in (a[i],b[i])]
        assert len(set(cards))==len(cards) and all(0<=c<52 for c in cards),'invalid verified deck'
        assert sum(initial)==sum(final) and all(initial[i]==contrib[i]+remaining[i] for i in seats),'chip conservation'
        expected=remaining[:];ranks={i:seven([a[i],b[i],*board]) for i in seats if not folded>>i&1}
        previous=0
        for level in sorted(set(contrib)-{0}):
            participants=[i for i in seats if contrib[i]>=level];pot=(level-previous)*len(participants);previous=level
            eligible=[i for i in participants if i in ranks]
            assert eligible,'unallocated pot'
            best=max(ranks[i] for i in eligible);winners=[i for i in eligible if ranks[i]==best]
            each,odd=divmod(pot,len(winners))
            for i in winners:expected[i]+=each
            order=sorted(winners,key=lambda i:(i-button-1)%9)
            for i in order[:odd]:expected[i]+=1
        assert expected==final,('independent pot calculation',hand,expected,final)
        busts=[i for i in seats if final[i]==0]
        values=sorted({initial[i] for i in busts},reverse=True)
        for i in seats:
            observed[people[i]]=final[i]
            if i in busts:eliminations[people[i]].append((wave,values.index(initial[i])))
    result={'verifiedHands':len(hands),'independentCardAndPotReplay':True,'certificateVerified':False}
    if certs:
        w=certs[0];context,wave,champion,root,unique=w[:5];assert unique==4
        people=w[5:9];generations=w[9:13];receipts=w[13:17];first=w[17:21];last=w[21:25];chips=w[25:29]
        assert len(set(people))==unique and set(people)==set(observed)
        assert [observed[p] for p in people]==chips and sum(v>0 for v in chips)==1 and observed[champion]>0
        scores={p:(wave+1,0) if p==champion else (eliminations[p][-1][0],-eliminations[p][-1][1]) for p in people}
        calculated=digest(encoded([context,wave,champion,unique]))
        for i,p in enumerate(people):
            better=sum(scores[q]>scores[p] for q in people);tied=sum(scores[q]==scores[p] for q in people)
            assert (first[i],last[i])==(better+1,better+tied),'independent elimination ranking'
            calculated=digest(encoded([calculated,p,generations[i],receipts[i],first[i],last[i]]))
        assert calculated==root and w[29:]==[400,12],'standings commitment or escrow mismatch'
        result.update(certificateVerified=True,uniquePlayers=unique,rounds=wave,standingsRoot=f'{root:064x}',heldPrize=w[29],heldFees=w[30])
    return result
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('trace');p.add_argument('--output',required=True);p.add_argument('--hand-only',action='store_true');a=p.parse_args()
    result=replay(Path(a.trace).read_text(encoding='utf-8-sig'),not a.hand_only)
    Path(a.output).write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps(result))

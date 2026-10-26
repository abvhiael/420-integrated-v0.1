"""Extract actual executed tournament statements; exporting context is not proof acceptance."""
import argparse,json,re
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('trace');p.add_argument('--root',required=True);a=p.parse_args()
text=Path(a.trace).read_text(encoding='utf-8-sig');root=Path(a.root)
owners={'TournamentPrizeReentryFunded420Test':'reentry','TournamentPrizeRebuyFunded420Test':'rebuy','TournamentPrizeFreeFunded420Test':'free','TournamentPrizeHeadsUpFunded420Test':'heads'}
sections=re.split(r'Ran \d+ tests? for [^\n]*:(Tournament\w+Test)\r?\n',text);count=0
for i in range(1,len(sections),2):
    owner,body=sections[i:i+2]
    if owner not in owners:continue
    if not any('[PASS] '+v+'()' in body for v in ['testExportInitialC7Contexts','testExportPostPurchaseC7Contexts','testExportFinalC7Context']):continue
    for label,encoded in re.findall(r'emit C7StatementContext\(label: (0x[0-9a-fA-F]+), encoded: (0x[0-9a-fA-F]+)\)',body):
        name=bytes.fromhex(label[2:]).rstrip(b'\0').decode('ascii');raw=bytes.fromhex(encoded[2:])
        if name not in ['tableA','tableB','nextA','nextB','final'] or len(raw)!=85*32:raise RuntimeError('Invalid actual context')
        words=[str(int.from_bytes(raw[j:j+32],'big')) for j in range(0,len(raw),32)]
        if words[9]!='31337':raise RuntimeError('Wrong chain')
        out=root/owners[owner]/name;out.mkdir(parents=True,exist_ok=True)
        n=int(words[75]);assert 2<=n<=9
        chips=list(map(int,words[76:85])); winner=max(range(9),key=lambda s:chips[s]); winnerPosition=list(map(int,words[57:57+n])).index(winner)
        (out/'context.bin').write_bytes(raw);(out/'context.json').write_text(json.dumps({'winnerPosition':winnerPosition,'words':words[:34+max(0,n-2)*2],'seats':list(map(int,words[48:48+n])),'owners':list(map(int,words[57:57+2*n]))},indent=2)+'\n',encoding='utf-8');count+=1
if not count:raise RuntimeError('No passing actual context execution')
print('Exported',count,'actual tournament contexts; no proof acceptance claimed')

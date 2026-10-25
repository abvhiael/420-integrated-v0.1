"""Fail on new severe findings or source drift; preserve raw analyzer severity."""
import hashlib,json,re,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def fingerprint(f):
    d=re.sub(r'#\d+(?:-\d+)?','',f['description'].replace('\\','/'));d=re.sub(r'_scope_\d+','_scope',d)
    return hashlib.sha256((f['check']+'\n'+' '.join(d.split())).encode()).hexdigest()
def main():
    rawpath,out=map(Path,sys.argv[1:]);raw=json.loads(rawpath.read_text(encoding='utf-8'));expected=json.loads((ROOT/'scripts/fantasy/static-approved-review-v1.json').read_text(encoding='utf-8'))
    if not raw.get('success'):raise RuntimeError('actual analyzer failed')
    for p,h in expected['normalizedSourceSHA256'].items():
        if hashlib.sha256((ROOT/p).read_bytes().replace(b'\r\n',b'\n')).hexdigest()!=h:raise RuntimeError('source drift since local review '+p)
    severe=[f for f in raw['results']['detectors'] if f['impact'] in ['High','Medium']];actual={expected.get('reviewedSignatureVariants',{}).get(fingerprint(f),fingerprint(f)):f for f in severe}
    if len(actual)!=len(severe) or set(actual)!=set(expected['dispositions']):raise RuntimeError('new/missing severe findings require review '+json.dumps({'new':sorted(set(actual)-set(expected['dispositions'])),'missing':sorted(set(expected['dispositions'])-set(actual))}))
    for h,f in actual.items():
        if expected['dispositions'][h]['severity']!=f['impact'] or expected['dispositions'][h]['check']!=f['check']:raise RuntimeError('severity drift')
    report={'analyzerSucceeded':True,'reviewType':expected['reviewType'],'rawHigh':sum(f['impact']=='High' for f in severe),'rawMedium':sum(f['impact']=='Medium' for f in severe),'unreviewedHighMedium':0,'rawSHA256':hashlib.sha256(rawpath.read_bytes()).hexdigest(),'dispositions':expected['dispositions']}
    out.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:report[k] for k in ['analyzerSucceeded','rawHigh','rawMedium','unreviewedHighMedium']}))
if __name__=='__main__':main()

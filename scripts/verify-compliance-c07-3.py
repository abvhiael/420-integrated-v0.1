#!/usr/bin/env python3
"""App-scoped immutable build-input and secret-boundary qualification."""
import json,re,sys,tempfile
from pathlib import Path

CHECKOUT='3d3c42e5aac5ba805825da76410c181273ba90b1'
UPLOAD='cf430e030ddbb5b0abf93d22962f4752f3646cd9'
POSTGRES='ca0bd484cb98bf4b24eb1010e73fb3fcbd6714d240fbc1a10eea5b7dbecb641d'
GO_SHA='ecbadb99091a3f46e31f5f934b068b1864eafa7995211b39eaddf76996045fe5'
APPROVED_SUMS={
 'github.com/lib/pq v1.12.0 h1:mC1zeiNamwKBecjHarAr26c/+d8V5w/u4J0I/yASbJo=',
 'github.com/lib/pq v1.12.0/go.mod h1:/p+8NSbOcwzAEI7wiMXFlgydTwcgTr3OSKMsD2BitpA=',
}

def objects(raw):
 decoder=json.JSONDecoder();offset=0;values=[]
 while offset<len(raw):
  if raw[offset].isspace():offset+=1;continue
  value,end=decoder.raw_decode(raw,offset);values.append(value);offset=end
 return values

def verify(root):
 root=Path(root);workflow=(root/'.github/workflows/420compliance-c01-level1.yml').read_text()
 uses=re.findall(r'uses:\s*([^\s#]+)',workflow)
 assert set(uses)=={'actions/checkout@'+CHECKOUT,'actions/upload-artifact@'+UPLOAD},'unreviewed action input'
 assert 'postgres:16@sha256:'+POSTGRES in workflow,'mutable fixture container'
 assert 'https://go.dev/dl/go1.27.2.linux-amd64.tar.gz' in workflow and GO_SHA in workflow and 'sha256sum -c -' in workflow,'unverified toolchain'
 assert 'golang.org/x/vuln/cmd/govulncheck@v1.9.0' in workflow,'mutable vulnerability tool'
 permissions=re.search(r'(?m)^permissions:\n((?:  [^\n]*\n)*)',workflow)
 assert permissions and permissions.group(1)=='  contents: read\n' and not re.search(r'(?m)^ +permissions:',workflow),'expanded workflow permissions'
 assert 'persist-credentials: false' in workflow and 'secrets.' not in workflow,'credential retention or secret access'
 assert 'ref: $' in workflow and 'github.sha' in workflow and 'EXPECTED_SHA' in workflow,'unbound checkout'
 assert 'pull_request_target:' not in workflow and 'workflow_run:' not in workflow,'privileged trigger'
 assert 'GOTOOLCHAIN: local' in workflow and 'GOSUMDB: sum.golang.org' in workflow,'unreviewed toolchain/module fallback'
 mod=(root/'go.mod').read_text();assert re.findall(r'require\s+(\S+)\s+(\S+)',mod)==[('github.com/lib/pq','v1.12.0')],'dependency changed without review'
 assert not re.search(r'(?m)^\s*(replace|exclude)\b',mod),'dependency source override'
 assert set((root/'go.sum').read_text().splitlines())==APPROVED_SUMS,'unreviewed checksum inventory'
 for source in (root/'services/complianceauth').glob('*.go'):
  if source.name.endswith('_test.go'):continue
  assert not re.search(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[A-Z0-9]{16}|Bearer [A-Za-z0-9_-]{20,}',source.read_text()),'literal secret boundary failure: '+source.name
 return {'step':'C07.3','immutable_actions':uses,'postgres_fixture_digest':POSTGRES,'go_version':'go1.27.2','go_archive_sha256':GO_SHA,'govulncheck_version':'v1.9.0','reviewed_runtime_dependency':'github.com/lib/pq v1.12.0','reviewed_checksums':sorted(APPROVED_SUMS),'permissions':'contents:read','source_secret_boundary':'PASS'}

def self_test():
 with tempfile.TemporaryDirectory(prefix='c073-policy-') as temp:
  root=Path(temp);(root/'.github/workflows').mkdir(parents=True);(root/'services/complianceauth').mkdir(parents=True)
  (root/'services/complianceauth/fixture.go').write_text('package complianceauth\n')
  paths=['.github/workflows/420compliance-c01-level1.yml','go.mod','go.sum'];original={p:Path(p).read_text() for p in paths}
  for p,text in original.items():(root/p).write_text(text)
  verify(root);denied=0
  mutations=[('.github/workflows/420compliance-c01-level1.yml',original[paths[0]].replace(CHECKOUT,'v7')),('.github/workflows/420compliance-c01-level1.yml',original[paths[0]].replace('contents: read','contents: write')),('.github/workflows/420compliance-c01-level1.yml',original[paths[0]].replace('contents: read','contents: read\n  id-token: write')),('.github/workflows/420compliance-c01-level1.yml',original[paths[0]].replace('persist-credentials: false','persist-credentials: true')),('go.mod',original['go.mod']+'\nreplace github.com/lib/pq => ../unreviewed\n'),('go.sum',original['go.sum']+'\nunreviewed v1 h1:changed\n'),('services/complianceauth/fixture.go','package complianceauth\n// -----BEGIN PRIVATE KEY-----\n')]
  for path,text in mutations:
   (root/path).write_text(text)
   try:verify(root)
   except AssertionError:denied+=1
   else:raise AssertionError('supply-chain mutation accepted: '+path)
   (root/path).write_text(original.get(path,'package complianceauth\n'))
  assert denied==7;print('C07.3 supply-chain adversarial cases PASS: '+str(denied))

if __name__=='__main__':
 result=verify(Path('.'))
 if len(sys.argv)>1 and sys.argv[1]=='--self-test':self_test()
 elif len(sys.argv)>1:
  report=objects(Path(sys.argv[1]).read_text());config=[o['config'] for o in report if 'config' in o];findings=[o['finding'] for o in report if 'finding' in o]
  assert config and all(c.get('scanner_name')=='govulncheck' for c in config),'scanner did not execute'
  assert not findings,'known dependency/standard-library vulnerabilities require remediation: '+str(findings)
  result['vulnerability_scan']={'status':'PASS','findings':0,'configuration':config}
 Path('/tmp/compliance-c073-supply-chain.json').write_text(json.dumps(result,indent=2)+'\n')
 print('C07.3 immutable inputs, dependency review and secret boundary PASS')

#!/usr/bin/env python3
"""Execute safe operator examples and check mutating examples against real CLIs.

No network endpoint, production key, signing duty, Wallet send or restore is
executed. Existing signing/recovery/financial suites retain their original proof.
"""
import argparse, hashlib, json, os, pathlib, re, shlex, subprocess, tempfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
DOC=ROOT/'docs/STAKE-AUDIT-9.7-VALIDATOR-OPERATOR-RUNBOOK.md'
TARGETS={
 'fourtwentyd':('./consensus/cmd/fourtwentyd','blst'),
 'stake-signer':('./consensus/cmd/stake-signer','blst'),
 'stake-operator-init':('./consensus/cmd/stake-operator-init','blst'),
 'stake-monitor':('./consensus/cmd/stake-monitor','blst'),
 'stake-reconcile':('./consensus/cmd/stake-reconcile','blst'),
 'indexer420':('./indexer/cmd/indexer420','blst'),
 'node420':('./execution/cmd/node420',''),
}
REQUIRED={'build','key-generation','validator-history','signer-provision','jwt','execution-init','execution','engine-probe','spki','signer','signing','settlement','indexer','backup','restore','signer-recovery','monitor-init','monitor','publish','accounting'}
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=pathlib.Path,required=True);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
 result={'schema':'420-stake-operator-runbook-qualification-v1','candidate_sha':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'pass':False,'commands':[],'binaries':{}}
 def run(args,**kw):return subprocess.run(args,cwd=ROOT,text=True,capture_output=True,timeout=180,**kw)
 try:
  doc=DOC.read_text();result['runbook_sha256']=hashlib.sha256(DOC.read_bytes()).hexdigest()
  policy=json.loads((ROOT/'docs/ci/frontmatter-policy.json').read_text())
  assert doc.startswith('---\n')
  header=doc.split('---',2)[1]
  for field in policy['required_fields']:assert re.search(r'^'+re.escape(field)+r':',header,re.M),field
  for field,allowed in [('category',policy['allowed_category']),('status',policy['allowed_status'])]:
   value=re.search(r'^'+field+r': (.+)$',header,re.M).group(1);assert value in allowed,field
  for target in re.findall(r'\]\(([^)#]+)(?:#[^)]*)?\)',doc):
   if '://' not in target:assert (DOC.parent/target).is_file(),'missing runbook link '+target
  blocks={}
  for block in re.findall(r'```sh\n(.*?)```',doc,re.S):
   m=re.match(r'# operator-command: ([\w-]+)\n',block);assert m,'unlabelled shell command'
   assert m[1] not in blocks;blocks[m[1]]=block
   checked=run(['bash','-n'],input=block);assert checked.returncode==0,checked.stderr
  assert set(blocks)==REQUIRED,'runbook command coverage changed'
  with tempfile.TemporaryDirectory(prefix='stake-operator-qualification-') as tmp:
   tmp=pathlib.Path(tmp);binary={};help_text={}
   declared={}
   for line in blocks['build'].splitlines():
    if line.startswith('go build '):
     tokens=shlex.split(line);name=tokens[tokens.index('-o')+1].removeprefix('bin/');assert name not in declared;declared[name]=tokens
   assert set(declared)==set(TARGETS)
   for name,(target,tags) in TARGETS.items():
    path=tmp/name;args=['go','build'];args+=['-tags',tags] if tags else [];args+=['-o',str(path),target]
    expected=['go','build']+(['-tags',tags] if tags else [])+['-o','bin/'+name,target]
    assert declared[name]==expected,'documented build differs '+name
    built=run(args);assert built.returncode==0,built.stderr
    binary[name]=path;result['binaries'][name]={'target':target,'tags':tags,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    if name!='indexer420':
     h=run([str(path),'--help']);assert h.returncode==0,h.stderr;help_text[name]=h.stdout+h.stderr
   for ident,block in blocks.items():
    joined=block.replace('\\\n',' ')
    for name in re.findall(r'\bbin/([\w./-]+)',joined):
     if name.startswith('upstream/'):
      assert name=='upstream/geth-v1.17.5-420';continue
     assert name in TARGETS,name
     if name=='indexer420':
      source=''.join(p.read_text() for p in (ROOT/'indexer/cmd/indexer420').glob('*.go'))
      for env in re.findall(r'\b(INDEXER_[A-Z_]+)=',joined):assert '"'+env+'"' in source,env
     elif ident!='build':
      for flag in re.findall(r'(?<!\w)--([\w.-]+)',joined):
       assert re.search(r'^\s+-'+re.escape(flag)+r'(?:\s|$)',help_text[name],re.M),'unknown documented flag '+name+'/'+flag
    result['commands'].append({'id':ident,'shell_syntax':'PASS','interface':'PASS','execution':'interface-only'})
   # Actual key generation: output contains public material only; re-execution
   # must refuse to replace the private identity. Generated keys are never kept.
   private=tmp/'private';private.mkdir(mode=0o700);keydir=private/'identity'
   cmd=[str(binary['stake-operator-init']),'--generate-key-dir',str(keydir)]
   generated=run(cmd);assert generated.returncode==0,generated.stderr
   pub=json.loads(generated.stdout);assert re.fullmatch('0x[0-9a-f]{96}',pub['publicKey']);assert re.fullmatch('0x[0-9a-f]{192}',pub['proofOfPossession'])
   secret=(keydir/'bls.hex').read_bytes();assert len(secret)==64 and secret.decode() not in generated.stdout+generated.stderr
   assert (keydir/'bls.hex').stat().st_mode&0o777==0o600
   assert run(cmd).returncode!=0 and (keydir/'bls.hex').read_bytes()==secret
   # Normal build refuses real key generation; no signature/key fallback.
   default=tmp/'operator-default';built=run(['go','build','-o',str(default),'./consensus/cmd/stake-operator-init']);assert built.returncode==0,built.stderr
   assert run([str(default),'--generate-key-dir',str(private/'unsupported')]).returncode!=0
   assert not (private/'unsupported').exists()
   protocol=run([str(binary['fourtwentyd']),'--protocol']);assert protocol.returncode==0 and 'chain_id=420 slot_seconds=12' in protocol.stdout
   for name in ['fourtwentyd','node420']:assert run([str(binary[name]),'--version']).returncode==0
   # JWT command is run in an isolated private directory and refuses overwrite.
   jwt=private/'engine-jwt.hex';shell='(umask 077; set -C; openssl rand -hex 32 > '+shlex.quote(str(jwt))+')'
   assert run(['bash','-c',shell]).returncode==0;before=jwt.read_bytes();assert re.fullmatch(b'[0-9a-f]{64}\n',before)
   assert run(['bash','-c',shell]).returncode!=0 and jwt.read_bytes()==before
   assert jwt.stat().st_mode&0o777==0o600
   tar=run(['tar','--help']);assert tar.returncode==0
   for option in ['--create','--extract','--acls','--xattrs','--numeric-owner','--same-owner','--file','--directory']:assert option in tar.stdout,option
   checksum=run(['sha256sum','--help']);assert checksum.returncode==0 and '--check' in checksum.stdout
   # Wallet API names and contract amounts/exit ownership checked without sends.
   wallet=(ROOT/'wallet/web/core/stake-management.js').read_text()
   for name in ['createStake420ManagementClient','registrationQuote','sendRegistration','sendTopUp','sendReplaceCredit','sendWithdraw','confirm']:assert re.search(r'(?:function |\b)'+name+r'\b',wallet),name
   # Import the actual browser module and inspect the real factory's returned
   # methods without invoking any RPC or transaction.
   script="""import {createStake420ManagementClient,FROZEN_STAKE_ADDRESSES as a} from './wallet/web/core/stake-management.js';
   const c=createStake420ManagementClient({provider:{request(){throw Error('unexpected RPC')}},chainId:'0x1a4',account:'0x'+'12'.repeat(20),stakeAddress:a.stake420,validatorRegistryAddress:a.validatorRegistry,rewardControllerAddress:a.rewardController});
   for(const n of ['registrationQuote','sendRegistration','sendTopUp','sendReplaceCredit','sendWithdraw','summary','confirm'])if(typeof c[n]!=='function')throw Error(n);"""
   checked=run(['node','--input-type=module','-e',script]);assert checked.returncode==0,checked.stderr
   registry=(ROOT/'contracts/src/system/ValidatorRegistry.sol').read_text()
   for token in ['EFFECTIVE_BOND = 42_000 ether','MAX_PROTOCOL_CREDIT = 21_000 ether','MIN_OWNED_BOND = 21_000 ether','WITHDRAWAL_DELAY_BLOCKS = ROTATION_BLOCKS * 6','function applyExitNotice(bytes32 validatorId, uint64 noticeRotation) external onlyConsensusSystem','if (msg.sender != v.withdrawal) revert NotWithdrawalAddress()']:assert token in registry,token
   for item in result['commands']:
    if item['id'] in ['build','key-generation','jwt']:item['execution']='PASS: isolated local execution'
   result['safe_executions']={'key_and_pop_generation':True,'secret_output_absent':True,'exclusive_key_creation':True,'private_permissions':True,'default_build_no_key_fallback':True,'jwt_generation_no_overwrite':True,'protocol_and_versions':True,'wallet_factory_interfaces':True,'archive_tool_interfaces':True}
  result['pass']=True
 finally:
  (a.output/'evidence.json').write_text(json.dumps(result,indent=2)+'\n')
 assert result['pass'];print(json.dumps(result,indent=2))
if __name__=='__main__':main()

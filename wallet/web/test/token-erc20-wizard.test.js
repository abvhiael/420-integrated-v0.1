import test from 'node:test';
import assert from 'node:assert/strict';
import {TOKEN_TEMPLATES_420,encodeTokenCreation420,createTokenDiscoverySession420,createTokenCatalogue420,
  parseERC20Units420,formatERC20Units420,generateERC20Salt420,validateERC20WizardFields420,createERC20Wizard420} from '../core/token-app.js';
import {TOKEN_CREATION_FEE_WEI_420} from '../core/token-runtime.js';
import {connected} from './token-connected-fixture.js';
import {controller,addr,digest,abi,serviceHash} from './token-test-fixture.js';
const erc20=TOKEN_TEMPLATES_420.filter(p=>p.standard==='ERC20');
const fixed=erc20[0].key,capped=erc20[2].key,votes=erc20[5].key;
const inputs=(key=fixed)=>({name:'Example 🌿',symbol:'EX',supply:'100.000000000000000001',
  cap:key===capped?'200.01':'',userSalt:digest(9)});
async function ready(key=fixed,mutate=()=>{}){
  const f=connected(),session=createTokenDiscoverySession420(),catalogue=createTokenCatalogue420(session);
  const wizard=createERC20Wizard420(catalogue,session,{salt:()=>digest(9)});
  mutate(f);
  assert.equal((await session.refresh({provider:f.provider,config:f.config,controller,smartAccount:f.selected})).status,'verified');
  assert.equal(await catalogue.select(key),true);
  return {f,session,catalogue,wizard};
}
function fill(wizard,key=fixed){
  for(const [field,value] of Object.entries(inputs(key)))if(field!=='cap'||key===capped)assert.equal(wizard.setField(field,value),true);
}
test('ERC20 amount conversion preserves every base unit and uint256 boundary without floating point',()=>{
  assert.equal(parseERC20Units420('0.000000000000000001'),'1');
  assert.equal(parseERC20Units420('9007199254740993.123456789012345678'),'9007199254740993123456789012345678');
  assert.equal(parseERC20Units420('0001.230000'),'1230000000000000000');
  const max=(1n<<256n)-1n;
  assert.equal(parseERC20Units420(formatERC20Units420(max)),max.toString());
  assert.throws(()=>parseERC20Units420(formatERC20Units420(max).replace(/\d$/,'9')),/range/);
  assert.equal(formatERC20Units420('0'),'0');
  for(const invalid of ['', ' ', '-1','+1','.1','1.','1e18','1,000','1.0000000000000000001','0x1','Infinity',1,NaN,'9'.repeat(81)])assert.throws(()=>parseERC20Units420(invalid));
});
test('all six ERC20 wizard profiles encode exactly the canonical SDK draft, fixed 18 decimals and correct cap',()=>{
  for(const p of erc20){
    const v=validateERC20WizardFields420(p.key,inputs(p.key));
    assert.equal(v.template.id,p.id);
    assert.equal(v.draft.name,'Example 🌿');
    assert.equal(v.draft.initialSupply,'100000000000000000001');
    assert.equal(v.draft.cap,p.capped?'200010000000000000000':'0');
    assert.equal(v.displaySupply,'100.000000000000000001');
    assert.equal(v.displayCap,p.capped?'200.01':null);
    assert.equal(v.data,encodeTokenCreation420(v.draft).data);
    assert.equal(v.configHash,encodeTokenCreation420(v.draft).configHash);
    assert.ok(Object.isFrozen(v)&&Object.isFrozen(v.draft));
  }
});
test('wizard rejects malformed metadata, arbitrary fields and non-ERC20 profiles',()=>{
  for(const patch of [{name:''},{symbol:' '},{name:'x\u0000y'},{symbol:'x\u202ey'},{name:'\ud800'},
    {name:'x'.repeat(4096)},{userSalt:'0x12'},{owner:addr(9)},{decimals:6},{value:'1'},{bytecode:'0x60'}]){
    assert.throws(()=>validateERC20WizardFields420(fixed,{...inputs(),...patch}));
  }
  for(const key of ['ERC721_COLLECTION','ERC1155_MULTI','CUSTOM'])assert.throws(()=>validateERC20WizardFields420(key,inputs()),/frozen ERC20/);
  const exact=validateERC20WizardFields420(fixed,{...inputs(),name:' Example '});
  assert.equal(exact.draft.name,' Example ');
});
test('cap must be positive, at least the supply, and only belongs to capped profile; votes bound matches contract',()=>{
  for(const cap of ['','0','99.999999999999999999'])assert.throws(()=>validateERC20WizardFields420(capped,{...inputs(capped),cap}));
  assert.equal(validateERC20WizardFields420(capped,{...inputs(capped),cap:inputs().supply}).draft.cap,'100000000000000000001');
  assert.throws(()=>validateERC20WizardFields420(fixed,{...inputs(),cap:'100'}),/Only the capped/);
  const max=(1n<<208n)-1n;
  assert.equal(validateERC20WizardFields420(votes,{...inputs(),supply:formatERC20Units420(max)}).draft.initialSupply,max.toString());
  assert.throws(()=>validateERC20WizardFields420(votes,{...inputs(),supply:formatERC20Units420(max+1n)}),/uint208/);
  assert.throws(()=>encodeTokenCreation420({template:votes,name:'N',symbol:'S',initialSupply:(max+1n).toString(),cap:'0',userSalt:digest(9)}),/uint208/);
});
test('zero supply is valid but non-mintable templates warn permanently; salt is secure bytes32',()=>{
  for(const p of erc20){
    const v=validateERC20WizardFields420(p.key,{...inputs(p.key),supply:'0'});
    assert.equal(v.draft.initialSupply,'0');
    assert.match(v.warnings[0],p.mintable?/can mint later/:/cannot mint later/);
  }
  assert.match(generateERC20Salt420(),/^0x[0-9a-f]{64}$/);
  assert.notEqual(generateERC20Salt420(),generateERC20Salt420());
});
test('all six actual wizard selections produce exact fee, immutable owner-bound canonical draft after fresh read',async()=>{
  for(const p of erc20){
    const {f,session,catalogue,wizard}=await ready(p.key);
    fill(wizard,p.key);const count=f.calls.length;
    const draft=await wizard.review();
    assert.ok(draft);
    assert.equal(draft.authority,'DRAFT_ONLY');assert.equal(draft.confirmationRequired,true);
    assert.equal(draft.owner,f.selected.smartAccount);assert.equal(draft.controller,controller);
    assert.equal(draft.request.target,f.binding.factory.address);
    assert.equal(draft.request.value,TOKEN_CREATION_FEE_WEI_420);
    assert.equal(draft.request.data,encodeTokenCreation420(draft.request.draft).data);
    assert.equal(draft.request.configHash,encodeTokenCreation420(draft.request.draft).configHash);
    assert.deepEqual(draft.verificationBlock,session.getSnapshot().verificationBlock);
    assert.ok(f.calls.length>count&&f.calls.every(([m])=>['eth_accounts','eth_chainId','eth_getBlockByNumber','eth_getCode','eth_call'].includes(m)));
    assert.ok(Object.isFrozen(draft)&&Object.isFrozen(draft.request));
    wizard.dispose();catalogue.dispose();
  }
});
test('editing, salt regeneration, reset, NFT selection and refresh clear any prepared draft',async()=>{
  const {session,catalogue,wizard}=await ready();
  fill(wizard);assert.ok(await wizard.review());
  wizard.setField('symbol','EDIT');assert.equal(wizard.getSnapshot().draft,null);
  assert.ok(await wizard.review());assert.equal(wizard.renewSalt(),true);assert.equal(wizard.getSnapshot().draft,null);
  assert.ok(await wizard.review());wizard.reset();assert.equal(wizard.getSnapshot().draft,null);assert.equal(wizard.getSnapshot().fields.name,'');
  fill(wizard);assert.ok(await wizard.review());
  assert.equal(await catalogue.select('ERC721_COLLECTION'),true);
  assert.equal(wizard.getSnapshot().ready,false);assert.equal(wizard.getSnapshot().draft,null);
  assert.equal(await catalogue.select(fixed),true);fill(wizard);assert.ok(await wizard.review());
  await catalogue.refresh();assert.equal(wizard.getSnapshot().draft,null);assert.equal(wizard.getSnapshot().ready,false);
  session.invalidate();wizard.dispose();catalogue.dispose();
});
test('unconfigured, counterfactual and non-owner contexts never enter ERC20 creation wizard',async()=>{
  const session=createTokenDiscoverySession420(),catalogue=createTokenCatalogue420(session),wizard=createERC20Wizard420(catalogue,session);
  assert.equal(wizard.getSnapshot().ready,false);assert.equal(await wizard.review(),null);assert.equal(wizard.setField('name','X'),false);
  wizard.dispose();catalogue.dispose();
  for(const mutate of [f=>{f.control.accountDeployed=false;f.selected.deployed=false;},f=>{f.control.owner=addr(333);}]){
    const {wizard,catalogue}=await ready(fixed,mutate);
    assert.equal(wizard.getSnapshot().ready,false);assert.equal(await wizard.review(),null);wizard.dispose();catalogue.dispose();
  }
});
test('fresh draft preparation rejects disabled template, revoked service, ownership change, chain and reorg',async()=>{
  for(const mutate of [
    f=>f.enable(erc20[0],false),
    f=>f.set(f.binding.registry.address,'getService(bytes32)',abi(f.binding.factory.address,f.binding.factory.codeHash,f.binding.release.metadataHash,1,1000,0),['bytes32'],[serviceHash]),
    f=>{f.control.owner=addr(333)},f=>{f.tokenControl.chain='0x1'},f=>{f.tokenControl.canonicalHash=digest(99)},
    f=>{f.provider.request=async()=>{throw Error('offline')}},
  ]){
    const {f,wizard,catalogue}=await ready();
    fill(wizard);mutate(f);assert.equal(await wizard.review(),null);
    assert.equal(wizard.getSnapshot().draft,null);assert.equal(wizard.getSnapshot().busy,false);
    assert.match(wizard.getSnapshot().error,/changed/);
    wizard.dispose();catalogue.dispose();
  }
});
test('disconnect, fresh host context and reset cannot resurrect a pending draft',async()=>{
  for(const action of ['disconnect','refresh','reset','dispose']){
    const {f,session,catalogue,wizard}=await ready();
    fill(wizard);let release;
    const wait=new Promise(resolve=>{release=resolve}),original=f.provider.request;
    f.provider.request=async(...args)=>{await wait;return original(...args)};
    const pending=wizard.review();assert.equal(wizard.getSnapshot().busy,true);
    if(action==='disconnect')session.invalidate();
    if(action==='refresh'){const newer=connected();await session.refresh({provider:newer.provider,config:newer.config,controller,smartAccount:newer.selected});}
    if(action==='reset')wizard.reset();
    if(action==='dispose')wizard.dispose();
    release();assert.equal(await pending,null);assert.equal(wizard.getSnapshot().draft,null);
    wizard.dispose();catalogue.dispose();
  }
});
test('invalid form does not start re-verification, arbitrary form fields cannot be injected',async()=>{
  const {f,wizard,catalogue}=await ready();
  assert.equal(wizard.setField('owner',addr(9)),false);assert.equal(wizard.setField('cap','100'),false);
  const count=f.calls.length;assert.equal(await wizard.review(),null);assert.equal(f.calls.length,count);
  assert.ok(wizard.getSnapshot().error);wizard.dispose();catalogue.dispose();
});

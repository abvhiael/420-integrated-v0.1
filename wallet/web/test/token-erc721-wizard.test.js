import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TOKEN_TEMPLATES_420,encodeTokenCreation420,createTokenDiscoverySession420,createTokenCatalogue420,
  createERC20Wizard420,createERC721Wizard420,validateERC721WizardFields420} from '../core/token-app.js';
import {TOKEN_CREATION_FEE_WEI_420} from '../core/token-runtime.js';
import {connected} from './token-connected-fixture.js';
import {controller,addr,digest,abi,serviceHash} from './token-test-fixture.js';
const profile=TOKEN_TEMPLATES_420.find(p=>p.key==='ERC721_COLLECTION'),key=profile.key;
const input={name:'Collection 🌿',symbol:'NFT',baseURI:'ipfs://bafyexample/metadata.json',userSalt:digest(9)};
async function ready(mutate=()=>{},selection=key){
  const f=connected(),session=createTokenDiscoverySession420(),catalogue=createTokenCatalogue420(session);
  const wizard=createERC721Wizard420(catalogue,session,{salt:()=>digest(9)});
  mutate(f);
  assert.equal((await session.refresh({provider:f.provider,config:f.config,controller,smartAccount:f.selected})).status,'verified');
  assert.equal(await catalogue.select(selection),true);
  return {f,session,catalogue,wizard};
}
function fill(wizard,patch={}){for(const [field,value] of Object.entries({...input,...patch}))assert.equal(wizard.setField(field,value),true);}
test('ERC721 collection codec matches exact frozen ABI/config commitments and template semantics',async()=>{
  const result=validateERC721WizardFields420(key,input),expected=encodeTokenCreation420({template:key,...input});
  assert.equal(result.template.id,profile.id);assert.deepEqual(result.draft,expected.draft);
  assert.equal(result.data,expected.data);assert.equal(result.configHash,expected.configHash);assert.equal(result.calldataHash,expected.calldataHash);
  assert.deepEqual(result.collection,{initialSupply:'0',ownerMintable:true,holderOrApprovedOperatorBurn:true,ownershipTransferable:true,uriMutable:false,uriMode:'EXACT_SHARED_URI'});
  const solidity=await readFile(new URL('../../../contracts/src/token/ERC721Template420.sol',import.meta.url),'utf8');
  assert.match(solidity,/function tokenURI\([\s\S]*?ownerOf\(id\);\s*return baseURI;/);
  assert.doesNotMatch(solidity,/function\s+setBaseURI/);
  assert.match(result.warnings.join(' '),/does not append the ID/);
  assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.collection)&&Object.isFrozen(result.warnings));
});
test('empty URI and absolute URI bytes are preserved, no substitution or metadata fetch',()=>{
  for(const baseURI of ['', 'https://example.org/metadata%20file.json','ipfs://bafyexample/{id}.json','ar://example','data:application/json,%7B%7D']){
    const result=validateERC721WizardFields420(key,{...input,baseURI});
    assert.equal(result.draft.baseURI,baseURI);assert.equal(result.collection.uriMode,'EXACT_SHARED_URI');
    assert.match(result.warnings.join(' '),baseURI===''?/Empty base URI/:/Metadata is not fetched/);
  }
  assert.equal(validateERC721WizardFields420(key,{...input,name:' Exact '}).draft.name,' Exact ');
});
test('reject malformed metadata, URI, salt, oversize calldata and unapproved configuration fields',()=>{
  for(const patch of [{name:''},{symbol:' '},{name:'x\u0000y'},{symbol:'x\u202ey'},{name:'\ud800'},{baseURI:'\ud800'},
    {baseURI:'relative/path'},{baseURI:' https://example.org'},{baseURI:'ipfs://a b'},{baseURI:'ipfs://a%Q0'},
    {baseURI:'javascript:alert(1)'},{baseURI:'vbscript:foo'},{baseURI:'https://user:pass@example.org'},{baseURI:'https://'},
    {baseURI:'ipfs://'+ 'a'.repeat(4096)},{name:'x'.repeat(4000)},{userSalt:'0x12'},
    {owner:addr(9)},{initialSupply:'1'},{tokenId:'1'},{cap:'1'},{decimals:18},{bytecode:'0x60'},{value:'1'}]){
    assert.throws(()=>validateERC721WizardFields420(key,{...input,...patch}),undefined,JSON.stringify(patch).slice(0,100));
  }
  for(const other of ['ERC20_FIXED','ERC1155_MULTI','CUSTOM'])assert.throws(()=>validateERC721WizardFields420(other,input),/frozen ERC721/);
});
test('verified ERC721 wizard prepares immutable canonical collection draft, exact fee and owner after fresh read',async()=>{
  const {f,session,catalogue,wizard}=await ready();fill(wizard);
  const count=f.calls.length,d=await wizard.review();
  assert.ok(d);assert.equal(d.authority,'DRAFT_ONLY');assert.equal(d.confirmationRequired,true);
  assert.equal(d.owner,f.selected.smartAccount);assert.equal(d.controller,controller);assert.equal(d.request.target,f.binding.factory.address);
  assert.equal(d.request.value,TOKEN_CREATION_FEE_WEI_420);assert.equal(d.request.data,encodeTokenCreation420(d.request.draft).data);
  assert.equal(d.request.configHash,encodeTokenCreation420(d.request.draft).configHash);assert.equal(d.collection.initialSupply,'0');
  assert.deepEqual(d.verificationBlock,session.getSnapshot().verificationBlock);
  assert.ok(f.calls.length>count&&f.calls.every(([m])=>['eth_accounts','eth_chainId','eth_getBlockByNumber','eth_getCode','eth_call'].includes(m)));
  assert.ok(Object.isFrozen(d)&&Object.isFrozen(d.request)&&Object.isFrozen(d.collection));
  wizard.dispose();catalogue.dispose();
});
test('empty URI draft, edits, salt regeneration and reset clear prepared collection',async()=>{
  const {wizard,catalogue}=await ready();fill(wizard,{baseURI:''});
  assert.equal((await wizard.review()).request.draft.baseURI,'');
  wizard.setField('baseURI',input.baseURI);assert.equal(wizard.getSnapshot().draft,null);
  assert.ok(await wizard.review());assert.equal(wizard.renewSalt(),true);assert.equal(wizard.getSnapshot().draft,null);
  assert.ok(await wizard.review());wizard.reset();assert.equal(wizard.getSnapshot().draft,null);assert.equal(wizard.getSnapshot().fields.name,'');
  wizard.dispose();catalogue.dispose();
});
test('ERC20 and ERC721 wizard state is isolated across profile selection and refresh',async()=>{
  const {session,catalogue,wizard}=await ready();
  const erc20=createERC20Wizard420(catalogue,session,{salt:()=>digest(10)});
  fill(wizard);assert.ok(await wizard.review());assert.equal(erc20.getSnapshot().ready,false);
  await catalogue.select('ERC20_FIXED');assert.equal(wizard.getSnapshot().draft,null);assert.equal(wizard.getSnapshot().ready,false);
  assert.equal(erc20.getSnapshot().ready,true);erc20.setField('name','Fungible');erc20.setField('symbol','FT');erc20.setField('supply','10');
  assert.ok(await erc20.review());await catalogue.select(key);assert.equal(erc20.getSnapshot().draft,null);
  assert.equal(wizard.getSnapshot().fields.name,'');fill(wizard);assert.ok(await wizard.review());
  await catalogue.select('ERC1155_MULTI');assert.equal(wizard.getSnapshot().draft,null);assert.equal(wizard.getSnapshot().ready,false);
  await catalogue.select(key);fill(wizard);assert.ok(await wizard.review());await catalogue.refresh();
  assert.equal(wizard.getSnapshot().draft,null);assert.equal(wizard.getSnapshot().ready,false);
  wizard.dispose();erc20.dispose();catalogue.dispose();
});
test('unconfigured, nonowner, counterfactual and wrong profile cannot enter collection wizard',async()=>{
  const s=createTokenDiscoverySession420(),c=createTokenCatalogue420(s),w=createERC721Wizard420(c,s);
  assert.equal(w.getSnapshot().ready,false);assert.equal(await w.review(),null);assert.equal(w.setField('name','X'),false);w.dispose();c.dispose();
  for(const mutate of [f=>{f.control.accountDeployed=false;f.selected.deployed=false;},f=>{f.control.owner=addr(333);}]){
    const {wizard,catalogue}=await ready(mutate);
    assert.equal(wizard.getSnapshot().ready,false);assert.equal(await wizard.review(),null);wizard.dispose();catalogue.dispose();
  }
  const {wizard,catalogue}=await ready(()=>{},'ERC20_FIXED');assert.equal(wizard.getSnapshot().ready,false);wizard.dispose();catalogue.dispose();
});
test('fresh collection review rejects disabled template, revoked Registry, wrong owner/chain, reorg and RPC failure',async()=>{
  for(const mutate of [f=>f.enable(profile,false),
    f=>f.set(f.binding.registry.address,'getService(bytes32)',abi(f.binding.factory.address,f.binding.factory.codeHash,f.binding.release.metadataHash,1,1000,0),['bytes32'],[serviceHash]),
    f=>{f.control.owner=addr(333)},f=>{f.tokenControl.chain='0x1'},f=>{f.tokenControl.canonicalHash=digest(99)},f=>{f.provider.request=async()=>{throw Error('offline')}}]){
    const {f,wizard,catalogue}=await ready();fill(wizard);mutate(f);
    assert.equal(await wizard.review(),null);assert.equal(wizard.getSnapshot().draft,null);assert.equal(wizard.getSnapshot().busy,false);
    assert.match(wizard.getSnapshot().error,/changed/);wizard.dispose();catalogue.dispose();
  }
});
test('pending collection review cannot resurrect after disconnect, newer context, reset or disposal',async()=>{
  for(const action of ['disconnect','refresh','reset','dispose']){
    const {f,session,catalogue,wizard}=await ready();fill(wizard);let release;
    const wait=new Promise(resolve=>{release=resolve}),original=f.provider.request;
    f.provider.request=async(...args)=>{await wait;return original(...args)};
    const pending=wizard.review();assert.equal(wizard.getSnapshot().busy,true);assert.equal(await wizard.review(),null);
    if(action==='disconnect')session.invalidate();
    if(action==='refresh'){const newer=connected();await session.refresh({provider:newer.provider,config:newer.config,controller,smartAccount:newer.selected});}
    if(action==='reset')wizard.reset();if(action==='dispose')wizard.dispose();
    release();assert.equal(await pending,null);assert.equal(wizard.getSnapshot().draft,null);wizard.dispose();catalogue.dispose();
  }
});
test('invalid form does not call RPC and cannot inject owner, mint or transaction parameters',async()=>{
  const {f,wizard,catalogue}=await ready();
  for(const field of ['owner','tokenId','initialSupply','decimals','calldata','value','cap'])assert.equal(wizard.setField(field,'1'),false);
  const count=f.calls.length;assert.equal(await wizard.review(),null);assert.equal(f.calls.length,count);assert.ok(wizard.getSnapshot().error);
  wizard.dispose();catalogue.dispose();
});

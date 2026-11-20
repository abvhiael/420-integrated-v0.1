import test from 'node:test';
import assert from 'node:assert/strict';
import {createTokenDiscoverySession420,createTokenCatalogue420,createERC20Wizard420,createERC721Wizard420,createERC1155Wizard420,validateERC20WizardFields420,validateERC721WizardFields420,validateERC1155WizardFields420} from '../core/token-app.js';
import {tokenStatus420,setTokenStatus420,tokenFieldError420,runTokenAction420,focusToken420} from '../token-ui-accessibility.js';
import {connected} from './token-connected-fixture.js';
import {controller,digest} from './token-test-fixture.js';
const salt=digest(9),er20={name:'Example',symbol:'EX',supply:'1',cap:'',userSalt:salt},er721={name:'Collection',symbol:'NFT',baseURI:'ipfs://example',userSalt:salt},er1155={uri:'ipfs://example/{id}',userSalt:salt};
test('field-specific errors derive from canonical validation across all three standards',()=>{
 for(const [validate,profile,fields,invalid] of [
  [validateERC20WizardFields420,'ERC20_FIXED',er20,{name:'',symbol:'\u202e',supply:'1.0000000000000000001',userSalt:'0x1'}],
  [validateERC20WizardFields420,'ERC20_CAPPED',{...er20,cap:'2'},{cap:'0'}],
  [validateERC721WizardFields420,'ERC721_COLLECTION',er721,{name:'',symbol:' ',baseURI:'javascript:alert(1)',userSalt:'0x1'}],
  [validateERC1155WizardFields420,'ERC1155_MULTI',er1155,{uri:'https://user:pass@example.org',userSalt:'0x1'}]
 ])for(const [field,value] of Object.entries(invalid))assert.throws(()=>validate(profile,{...fields,[field]:value}),e=>e.field===field&&!!e.message);
 assert.throws(()=>validateERC20WizardFields420('ERC20_VOTES',{...er20,supply:(2n**208n).toString()}),e=>e.field==='supply');
});
test('field errors retain exact input, clear on correction, and do not confer transaction authority',async()=>{
 for(const [create,profile,fields,key,invalid] of [[createERC20Wizard420,'ERC20_FIXED',er20,'supply','1e3'],[createERC721Wizard420,'ERC721_COLLECTION',er721,'baseURI','javascript:alert(1)'],[createERC1155Wizard420,'ERC1155_MULTI',er1155,'uri','relative/path']]){
  const f=connected(),session=createTokenDiscoverySession420(),catalogue=createTokenCatalogue420(session),wizard=create(catalogue,session,{salt:()=>salt});
  await session.refresh({provider:f.provider,config:f.config,controller,smartAccount:f.selected});assert.equal(await catalogue.select(profile),true);
  for(const [k,v] of Object.entries(fields))if(k!=='cap')wizard.setField(k,v);
  wizard.setField(key,invalid);assert.equal(await wizard.review(),null);let state=wizard.getSnapshot();assert.equal(state.errorField,key);assert.equal(state.fields[key],invalid);assert.equal(state.draft,null);
  wizard.setField(key,fields[key]);assert.equal(wizard.getSnapshot().errorField,null);assert.ok(await wizard.review());assert.equal(wizard.getSnapshot().errorField,null);
  session.invalidate();assert.equal(wizard.getSnapshot().draft,null);assert.equal(wizard.getSnapshot().ready,false);assert.equal(wizard.getSnapshot().errorField,null);
  assert.ok(f.calls.every(([method])=>! /send|sign|requestAccounts/i.test(method)));wizard.dispose();catalogue.dispose();
 }
});
test('discovery or runtime error is not incorrectly assigned to a field',async()=>{
 const f=connected(),session=createTokenDiscoverySession420(),catalogue=createTokenCatalogue420(session),wizard=createERC20Wizard420(catalogue,session,{salt:()=>salt});
 await session.refresh({provider:f.provider,config:f.config,controller,smartAccount:f.selected});await catalogue.select('ERC20_FIXED');for(const [k,v] of Object.entries(er20))if(k!=='cap')wizard.setField(k,v);
 f.tokenControl.chain='0x1';assert.equal(await wizard.review(),null);assert.match(wizard.getSnapshot().error,/changed/);assert.equal(wizard.getSnapshot().errorField,null);assert.equal(wizard.getSnapshot().draft,null);
});
function node(){const attrs=new Map();return {attrs,isConnected:true,disabled:false,dataset:{},textContent:'',id:'status',setAttribute(k,v){attrs.set(k,v)},removeAttribute(k){attrs.delete(k)},closest(){return null},focus(){globalThis.document.activeElement=this;}};}
test('status output strips injected formatting, error association clears and focus respects user navigation',async()=>{
 const status=tokenStatus420(node()),input=node(),trigger=node(),elsewhere=node(),destination=node();
 setTokenStatus420(status,'RPC\u202e\u0000 message','error');assert.equal(status.textContent,'RPC   message');assert.equal(status.attrs.get('aria-atomic'),'true');assert.equal(status.attrs.get('role'),'status');
 tokenFieldError420(input,status,true);assert.equal(input.attrs.get('aria-invalid'),'true');assert.equal(input.attrs.get('aria-errormessage'),'status');tokenFieldError420(input,status,false);assert.equal(input.attrs.has('aria-invalid'),false);
 globalThis.document={activeElement:trigger};try{
  await runTokenAction420(trigger,status,async()=>{assert.equal(document.activeElement,status);return true;},()=>destination);assert.equal(document.activeElement,destination);
  document.activeElement=trigger;await runTokenAction420(trigger,status,async()=>{elsewhere.focus();},()=>destination);assert.equal(document.activeElement,elsewhere);
  destination.disabled=true;assert.equal(focusToken420(destination),false);
 }finally{delete globalThis.document;}
});

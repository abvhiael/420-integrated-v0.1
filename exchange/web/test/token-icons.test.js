import test from 'node:test';
import assert from 'node:assert/strict';
import {TOKEN_ICON_FILES,tokenIconPath,createTokenIcon,createTokenPairIcons} from '../core/token-icons.js';
import fs from 'node:fs';

test('all catalogue symbols map to unique local artwork',()=>{
  const catalogue=JSON.parse(fs.readFileSync(new URL('../fixtures/markets.json',import.meta.url),'utf8'));
  const symbols=new Set(catalogue.flatMap(m=>[m.baseSymbol,m.quoteSymbol]));
  assert.equal(symbols.size,13);
  assert.equal(TOKEN_ICON_FILES.length,13);
  assert.deepEqual(new Set([...symbols].map(s=>tokenIconPath(s).slice(2))),new Set(TOKEN_ICON_FILES));
  assert.equal(tokenIconPath('eBTC'),'./assets/tokens/ebtc.png');
  assert.equal(tokenIconPath(' ETH '),'./assets/tokens/eth.png');
});
test('unknown assets and hostile metadata never become URLs or bridged asset aliases',()=>{
  for(const value of ['BTC','XRP','USDC','https://example.com/a.png','../ebtc','__proto__','constructor','toString','',null,42])assert.equal(tokenIconPath(value),null);
});
function element(tag){
  return {tag,children:[],attrs:{},hidden:false,append(...nodes){this.children.push(...nodes);},setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,fn){this[k]=fn;}};
}
const doc={createElement:element};
test('paired art is decorative and falls back safely if the local image fails',()=>{
  const pair=createTokenPairIcons(doc,'420','eBTC');
  assert.equal(pair.attrs['aria-hidden'],'true');
  assert.equal(pair.children.length,2);
  const icon=pair.children[1], [fallback,img]=icon.children;
  assert.equal(img.src,'./assets/tokens/ebtc.png');
  assert.equal(img.alt,'');
  assert.equal(fallback.hidden,true);
  img.error();
  assert.equal(img.hidden,true);
  assert.equal(fallback.hidden,false);
  const unknown=createTokenIcon(doc,'OTHER');
  assert.equal(unknown.children.length,1);
  assert.equal(unknown.children[0].textContent,'OTHER');
});

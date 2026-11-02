import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {TABLES_DESKS_DESIGNS,TABLES_DESKS_ROOT,tablesDesksDesign,tablesDesksPlacement,tablesDesksPlacementStyle} from '../src/tables-desks-catalog.js';
import {mountMarketplace} from '../src/marketplace.js';
const expected=['rustic-coffee-table','round-coffee-table','compact-end-table','narrow-console-table','storage-sideboard','writing-desk','corner-workstation','growers-planning-desk','communal-project-table','personal-secretary-desk'];
test('all ten records bind actual uploaded RGBA PNGs to exact filenames, sizes and checksums',async()=>{
 assert.deepEqual(TABLES_DESKS_DESIGNS.map(x=>x.id),expected.map(x=>'hc-prop-furniture-'+x));
 for(const item of TABLES_DESKS_DESIGNS){
  assert.equal(item.sprite.src,TABLES_DESKS_ROOT+item.id+'.png');
  const bytes=await readFile(new URL('../public'+item.sprite.src,import.meta.url));
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16),1024);assert.equal(bytes.readUInt32BE(20),1024);
  assert.equal(bytes[25],6); // PNG truecolour with alpha
  assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);
  assert.equal(item.marketStatus,'not-registered');assert.equal(item.assetStatus,'uploaded-main');
  assert.deepEqual(item.regions,['emerald-coast','golden-prairie','red-mesa']);
  assert.deepEqual(item.environments,['indoor','greenhouse']);
  assert.ok(Object.isFrozen(item)&&Object.isFrozen(item.placement)&&Object.isFrozen(item.contentBounds));
 }
});
test('placement aligns alpha ground contact rather than transparent canvas bottom',()=>{
 for(const item of TABLES_DESKS_DESIGNS){
  const p=tablesDesksPlacement(item.id),style=tablesDesksPlacementStyle(item.id,{x:960,y:800});
  assert.equal(p.tilePx,64);assert.equal(p.authority,'visual-only');
  assert.equal(p.anchorX,.5);assert.equal(p.anchorY,item.contentBounds[3]/1024);
  assert.equal(style.left,'50%');assert.equal(style.transform,'translate(-50%, -93.75%)');
  assert.equal(parseFloat(style.width)*1920/100,384);
  assert.equal(parseFloat(style.height)*1080/100,384);
  assert.equal(style.zIndex,'20800');
  assert.ok(p.footprintTiles.columns>=1&&p.footprintTiles.rows>=1);
 }
 assert.equal(tablesDesksDesign('hc-prop-furniture-storage-sideboard').tags.includes('table'),false);
 assert.equal(tablesDesksDesign('hc-prop-furniture-writing-desk').tags.includes('workspace'),true);
 for(const id of ['../escape','__proto__',null])assert.throws(()=>tablesDesksPlacement(id),/unknown-tables-desks/);
 const id=TABLES_DESKS_DESIGNS[0].id;
 for(const x of [NaN,Infinity,-1,1921,'4'])assert.throws(()=>tablesDesksPlacementStyle(id,{x,y:1}),/invalid-furniture-coordinate/);
 for(const y of [NaN,Infinity,-1,1081,'4'])assert.throws(()=>tablesDesksPlacementStyle(id,{x:1,y}),/invalid-furniture-coordinate/);
 for(const scale of [0,2,NaN,'1'])assert.throws(()=>tablesDesksPlacementStyle(id,{x:1,y:1,scale}),/invalid-furniture-scale/);
});
class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.events={};}
 append(...children){this.children.push(...children);}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(k,fn){this.events[k]=fn;}
}
test('offline marketplace includes all ten art cards without auth, settlement, prices or purchase controls',()=>{
 const main=new Element('main');let calls=0;
 mountMarketplace({document:{createElement:tag=>new Element(tag)},main,runtime:{mode:'offline'},authenticate:()=>{calls++;throw Error('unexpected auth');},fetchImpl:()=>{calls++;throw Error('unexpected fetch');}});
 const section=main.children.find(x=>x.attributes['aria-label']==='Tables, desks and personal workspaces catalog');
 assert.ok(section);assert.match(section.children[1].textContent,/Browsing grants no items or bonuses/);
 const cards=section.children[2].children;assert.equal(cards.length,10);
 for(const [i,card] of cards.entries()){
  assert.equal(card.attributes['data-asset-id'],TABLES_DESKS_DESIGNS[i].id);
  assert.equal(card.children[1].src,TABLES_DESKS_DESIGNS[i].sprite.src);
  assert.equal(card.children.some(x=>x.tagName==='button'),false);
  assert.match(card.children[2].textContent,/pending registration/);
 }
 assert.equal(calls,0);
});

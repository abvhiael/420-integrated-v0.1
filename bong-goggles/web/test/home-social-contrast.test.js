import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../dashboard.css',import.meta.url),'utf8');
const original=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

function luminance(hex){
 const rgb=hex.slice(1).match(/../g).map(part=>parseInt(part,16)/255);
 const [r,g,b]=rgb.map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
 return .2126*r+.7152*g+.0722*b;
}
function contrast(a,b){
 const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);
 return (values[0]+.05)/(values[1]+.05);
}
test('off-chain Home feed overrides light-dashboard ink only inside its dark panel',()=>{
 assert.ok(html.indexOf('href="/styles.css"')<html.indexOf('href="/dashboard.css"'));
 assert.match(original,/\.home-social\.ui-card\{[^}]*background:#153b2a/);
 assert.match(original,/\.home-social__composer,\.home-social__posts \.social-post\{background:#0d291d/);
 const override=css.slice(css.indexOf('The dashboard uses dark ink on ivory'));
 assert.ok(override.length>400,'dedicated dashboard-specific contrast override exists');
 assert.match(override,/\.home-social\.ui-card\{color:#f1faef\}/);
 for(const selector of [
  '.home-social.ui-card h2',
  '.home-social.ui-card .eyebrow',
  '.home-social.ui-card .home-social__intro',
  '.home-social.ui-card .home-social__member',
  '.home-social.ui-card label',
  '.home-social.ui-card .social-post__body',
  '.home-social.ui-card .social-comments li',
  '.home-social.ui-card .social-post header small',
  '.home-social.ui-card a',
  '.home-social.ui-card textarea::placeholder'
 ]) assert.ok(override.includes(selector),selector+' must receive an accessible foreground');
 assert.match(override,/\.home-social\.ui-card a:focus-visible,/);
 assert.match(override,/@media\(forced-colors:active\)/);
});
test('home feed foreground palette has at least enhanced 7:1 text contrast',()=>{
 for(const [fg,bg,purpose] of [
  ['#f1faef','#153b2a','home feed title and intro'],
  ['#f1faef','#0d291d','post text and comments'],
  ['#c5e2ce','#0d291d','author and date metadata'],
  ['#c5e2ce','#153b2a','composer helper text'],
  ['#b9fac8','#153b2a','visited and unvisited profile links'],
  ['#172d23','#fffef9','composer text area'],
  ['#52665a','#fffef9','composer placeholder']
 ]){
  assert.ok(contrast(fg,bg)>=7,purpose+' contrast '+contrast(fg,bg).toFixed(2)+' < 7');
 }
});

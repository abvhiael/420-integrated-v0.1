import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const files=[
  'hero-launch.webp','wallpaper-moonlit-hills.webp',
  'border-botanical-left.png','border-botanical-right.png','rocket-420integrated.png',
  'campaign-greenroots.webp','campaign-aeroleaf.webp','campaign-justice-fund.webp',
  'campaign-innovation-hub.webp','campaign-sunridge.webp'
];

test('the ten original artwork files are actual images and all have a visible CSS owner',()=>{
  const css=fs.readFileSync(path.join(root,'artwork.css'),'utf8');
  for(const name of files){
    const file=path.join(root,'assets',name);
    const bytes=fs.readFileSync(file);
    assert.ok(bytes.length>1000, name+' should be a real nonempty image');
    assert.ok(bytes.length<16_000_000, name+' should fit the approved deployment size limit');
    if(name.endsWith('.webp')){
      assert.equal(bytes.toString('ascii',0,4),'RIFF');
      assert.equal(bytes.toString('ascii',8,12),'WEBP');
    }else{
      assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
    }
    assert.ok(css.includes('assets/'+name), name+' has a stylesheet reference');
  }
});
test('all fictional campaign artwork names match a CSS mapping with non-transactional presentation',()=>{
  const css=fs.readFileSync(path.join(root,'artwork.css'),'utf8');
  for(const token of ['greenroots','aeroleaf','justice','hub','sunridge','coop']){
    assert.ok(css.includes('.artwork-'+token), 'missing artwork class '+token);
  }
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const showcase=fs.readFileSync(path.join(root,'showcase.js'),'utf8');
  assert.match(html,/href="\.\/artwork\.css"/);
  assert.match(html,/role="img" aria-label="Fictional/);
  assert.match(html,/data-blocked="true" aria-disabled="true"/);
  assert.doesNotMatch(html,/HERO ARTWORK SLOT|CAMPAIGN ARTWORK SLOT|CAMPAIGN IMAGE PLACEHOLDER/);
  assert.doesNotMatch(showcase,/CAMPAIGN ARTWORK SLOT/);
  assert.match(showcase,/Fictional .* campaign illustration/);
});
test('static asset source directory is copied to production dist',()=>{
  const script=fs.readFileSync(path.join(root,'scripts','build.mjs'),'utf8');
  assert.match(script,/fs\.cpSync\(path\.join\(root,'assets'\),path\.join\(dist,'assets'\)/);
  assert.match(script,/'artwork\.css'/);
});

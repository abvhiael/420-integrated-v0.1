import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const asset=name=>readFileSync(new URL('../assets/'+name,import.meta.url));
const pngDimensions=data=>{
  assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a','valid PNG signature required');
  assert.equal(data.toString('ascii',12,16),'IHDR','PNG IHDR required');
  return [data.readUInt32BE(16),data.readUInt32BE(20)];
};

test('owner-approved LIFTd arrive higher master remains byte-identical to retained source',()=>{
  // SHA-256 computed from the exact original 1536x1024 Library artwork and
  // independently matched to main's Git object 45df9ff77f5efc592ce0eedd18ddc9db4e989943.
  const data=asset('liftd-official-logo.png');
  assert.deepEqual(pngDimensions(data),[1536,1024]);
  assert.equal(data.length,1277314);
  assert.equal(createHash('sha256').update(data).digest('hex'),'0eae68ec0b22e227df57eb8aa44a58dd995515e2dff41089e2c553c98c356766');
});

test('official favicon and approved public driver photographs are retained',()=>{
  const ico=asset('favicon.ico');
  assert.ok(ico.length>0,'approved favicon must not be missing');
  assert.equal(ico.subarray(0,4).toString('hex'),'00000100','valid ICO header required');
  for(const file of ['liftd-driver-hero.png','liftd-driver-earn-more.png','liftd-driver-drive-your-way.png','liftd-driver-community.png']){
    const data=asset(file);
    assert.ok(data.length>10000, file+' cannot be an empty placeholder');
    const [width,height]=pngDimensions(data);
    assert.ok(width>=320&&height>=320,file+' dimensions must be usable');
  }
});

test('LIFTd header/footer/favicon and public driver route reference their actual branded assets',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const landing=readFileSync(new URL('../driver-landing.mjs',import.meta.url),'utf8');
  assert.match(html,/assets\/liftd-official-logo\.png/);
  assert.match(html,/assets\/favicon\.ico/);
  assert.match(html,/href="\/drive" data-route/);
  for(const name of ['liftd-driver-hero.png','liftd-driver-earn-more.png','liftd-driver-drive-your-way.png','liftd-driver-community.png'])
    assert.ok(landing.includes(name),name+' must be wired into the public driver landing');
});

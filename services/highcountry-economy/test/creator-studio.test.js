import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {STUDIO_VERSION,creatorTemplates,validateStudioAsset,CreatorStudio,ImmutableArtBlobs} from '../src/creator-studio.js';
import {CONTRACT_VERSION} from '../src/placement-contract.js';
const crc=b=>{let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return(c^0xffffffff)>>>0;};
const chunk=(type,data)=>{const l=Buffer.alloc(4),c=Buffer.alloc(4),t=Buffer.from(type);l.writeUInt32BE(data.length);c.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([l,t,data,c]);};
const png=(w=16,h=16,solid=false)=>{const header=Buffer.alloc(13);header.writeUInt32BE(w,0);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;const scan=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=y*(w*4+1)+1+x*4;scan[k]=125;scan[k+1]=56;scan[k+2]=93;scan[k+3]=solid||x>1&&y>1?255:0;}return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);};
const geom=(id='asset_1')=>({schemaVersion:CONTRACT_VERSION,assetId:id,geometryId:'geometry_1',geometryVersion:1,surface:'floor',layer:'furniture',visualPx:{width:16,height:16},renderAnchorPx:{x:8,y:8},occupancy:{kind:'rectangle',width:1,height:1},allowedOrientations:[0],qualified:true,qualificationRef:'reviewed_geo'});
const meta=()=>({schemaVersion:STUDIO_VERSION,assetId:'asset_1',revision:1,templateId:'floor-object',geometry:geom(),style:{isometricAttestation:true,reviewRequired:true},creatorId:'creator_1',rightsDeclaration:'rights_1'});
const denied=fn=>assert.throws(fn,/hc-econ-04:|hc-place-02:/);
test('reproducible PNG and geometry provenance with explicit nonapproval',()=>{
 const a=validateStudioAsset(png(),meta()),b=validateStudioAsset(png(),meta());
 assert.deepEqual(a,b);assert.equal(a.publicationStatus,'unpublished');assert.equal(a.styleStatus,'human-review-required');
 assert.equal(a.pixels.nontransparentPixels,13*13);assert.equal(creatorTemplates().length,5);
 assert.equal(a.sha256.length,64);
});
test('reject malformed PNG including CRC, truncation, no alpha, excessive size',()=>{
 denied(()=>validateStudioAsset(Buffer.from('not png'),meta()));
 denied(()=>validateStudioAsset(png(16,16,true),meta()));
 const wrong=png();wrong[44]^=1;denied(()=>validateStudioAsset(wrong,meta()));
 denied(()=>validateStudioAsset(png().subarray(0,30),meta()));
 denied(()=>validateStudioAsset(Buffer.concat([png(),Buffer.from('garbage')]),meta()));
 denied(()=>validateStudioAsset(png(4097,1),meta()));
});
test('reject invalid anchor, geometry, template and unsigned style assertion',()=>{
 denied(()=>validateStudioAsset(png(),{...meta(),templateId:'unlisted'}));
 denied(()=>validateStudioAsset(png(),{...meta(),geometry:{...geom(),renderAnchorPx:{x:999,y:8}}}));
 denied(()=>validateStudioAsset(png(),{...meta(),geometry:{...geom(),visualPx:{width:18,height:16}}}));
 denied(()=>validateStudioAsset(png(),{...meta(),geometry:{...geom(),surface:'wall_slot'}}));
 denied(()=>validateStudioAsset(png(),{...meta(),style:{isometricAttestation:false,reviewRequired:true}}));
 denied(()=>validateStudioAsset(png(),{...meta(),creatorId:'bad creator'}));
});
function fixture(){
 let current={econCreatorAssets:new Map()},revoked=false;
 const store={async transact(cb){const s=structuredClone(current),r=cb(s);current=s;return r;}};
 const map=new Map(),blobs={async putIfAbsent(k,v){if(!map.has(k))map.set(k,v);},async get(k){return map.get(k);}};
 const authority={async principal(session){return session==='valid'?'creator_1':'other';},guardState(){return !revoked;}};
 return {studio:new CreatorStudio({store,blobs,authority}),state:()=>current,revoke(){revoked=true;},map};
}
test('content-addressed durable revisions, idempotence, conflict, ownership and revocation',async()=>{
 const f=fixture(),file=png(),m=meta();const first=await f.studio.submit('valid',file,m);
 assert.deepEqual(first,await f.studio.submit('valid',file,m));
 assert.equal((await f.studio.read('valid','asset_1',1)).sha256,first.sha256);
 await assert.rejects(f.studio.submit('other',file,m),/creator-mismatch/);
 await assert.rejects(f.studio.submit('valid',png(16,16,true),m),/png-transparency-required/);
 await assert.rejects(f.studio.submit('valid',file,{...m,rightsDeclaration:'rights_2'}),/immutable-revision-conflict/);
 await assert.rejects(f.studio.submit('valid',file,{...m,revision:3}),/revision-owner-or-sequence/);
 const second=await f.studio.submit('valid',file,{...m,revision:2});assert.equal(second.revision,2);
 assert.equal(f.state().econCreatorAssets.size,2);
 f.revoke();await assert.rejects(f.studio.submit('valid',file,{...m,revision:3}),/creator-revoked/);
 await assert.rejects(f.studio.read('valid','asset_1',1),/reader-revoked/);
});
test('blob store corruption blocks admission and does not persist metadata',async()=>{
 const f=fixture();f.map.set('sha256:'+validateStudioAsset(png(),meta()).sha256,Buffer.from('corrupt'));
 await assert.rejects(f.studio.submit('valid',png(),meta()),/blob-integrity/);
 assert.equal(f.state().econCreatorAssets.size,0);
});

test('disk-backed blobs are immutable, content-addressed and verified on read',async()=>{
 const root=await mkdtemp(join(tmpdir(),'hc-creator-'));
 try{
  const blobs=new ImmutableArtBlobs(root),data=png(),hash=validateStudioAsset(data,meta()).sha256,key='sha256:'+hash;
  await blobs.putIfAbsent(key,data);await blobs.putIfAbsent(key,data);
  assert.deepEqual(await blobs.get(key),data);
  await assert.rejects(blobs.putIfAbsent(key,Buffer.from('unauthorized')),/blob-digest/);
  assert.throws(()=>blobs.path('../untrusted'),/blob-key/);
 }finally{await rm(root,{recursive:true,force:true});}
});

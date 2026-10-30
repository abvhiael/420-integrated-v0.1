// HC-ECON-04 Creator Studio. Pure intake and immutable content-addressed storage.
// Technical validation never confers certification, ownership, or publication.
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {defineGeometry,CONTRACT_VERSION,TILE_SIZE_PX} from './placement-contract.js';
export const STUDIO_VERSION='HC.ECON.CREATOR.STUDIO.V1';
const err=m=>{throw new TypeError('hc-econ-04:'+m);};
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const safeInt=x=>Number.isSafeInteger(x);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(o,keys)=>object(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const hex=x=>createHash('sha256').update(x).digest('hex');
const deep=x=>structuredClone(x);
const freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const checksum=buf=>{let c=0xffffffff;for(const byte of buf){c^=byte;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return(c^0xffffffff)>>>0;};
function decodePNG(input,{maxBytes=8*1024*1024,maxPixels=4096*4096}={}){
 if(!Buffer.isBuffer(input)||input.length<69||input.length>maxBytes||!input.subarray(0,8).equals(signature))err('png-signature-or-size');
 let offset=8,ihdr=null,ids=[],idatEnded=false,ended=false,ancillary=0;
 while(offset<input.length){
  if(offset+12>input.length)err('png-truncated');
  const size=input.readUInt32BE(offset),type=input.toString('ascii',offset+4,offset+8),start=offset+8,end=start+size;
  if(end+4>input.length||!/^[A-Za-z]{4}$/.test(type))err('png-chunk');
  const chunk=input.subarray(start,end),crc=input.readUInt32BE(end);
  if(checksum(input.subarray(offset+4,end))!==crc)err('png-crc');
  offset=end+4;
  if(!ihdr&&type!=='IHDR')err('png-ihdr-order');
  if(type==='IHDR'){
   if(ihdr||size!==13)err('png-ihdr');
   const width=chunk.readUInt32BE(0),height=chunk.readUInt32BE(4),depth=chunk[8],color=chunk[9];
   if(!width||!height||width*height>maxPixels||depth!==8||color!==6||chunk[10]!==0||chunk[11]!==0||chunk[12]!==0)err('png-rgba8-required');
   ihdr={width,height};
  }else if(type==='IDAT'){
   if(idatEnded)err('png-idat-order');
   ids.push(chunk);
  }else if(type==='IEND'){
   if(size!==0||!ids.length||offset!==input.length)err('png-end');
   ended=true;break;
  }else{
   if(ids.length)idatEnded=true;
   if(type[0]===type[0].toUpperCase())err('png-unknown-critical');
   ancillary+=size;if(ancillary>65536)err('png-metadata-limit');
   // Reject animation, embedded ICC/style ambiguity and palette overlays.
   if(['acTL','fcTL','fdAT','iCCP','sRGB','tRNS'].includes(type))err('png-unapproved-metadata');
  }
 }
 if(!ended||!ihdr)err('png-incomplete');
 const {width,height}=ihdr,stride=width*4,expected=(stride+1)*height;
 let raw;try{raw=inflateSync(Buffer.concat(ids),{maxOutputLength:expected+1});}catch{err('png-deflate');}
 if(raw.length!==expected)err('png-pixel-length');
 const scan=new Uint8Array(stride*height);let solid=0,minX=width,minY=height,maxX=-1,maxY=-1;
 for(let y=0;y<height;y++){
  const filter=raw[y*(stride+1)];if(filter>4)err('png-filter');
  for(let i=0;i<stride;i++){
   const left=i>=4?scan[y*stride+i-4]:0,above=y?scan[(y-1)*stride+i]:0,corner=y&&i>=4?scan[(y-1)*stride+i-4]:0;
   const p=left+above-corner,pa=Math.abs(p-left),pb=Math.abs(p-above),pc=Math.abs(p-corner);
   const predictor=pa<=pb&&pa<=pc?left:pb<=pc?above:corner;
   const value=raw[y*(stride+1)+1+i],prev=filter===1?left:filter===2?above:filter===3?Math.floor((left+above)/2):filter===4?predictor:0;
   scan[y*stride+i]=(value+prev)&255;
  }
  for(let x=0;x<width;x++){const alpha=scan[y*stride+x*4+3];if(alpha){solid++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}
 }
 if(!solid||solid===width*height)err('png-transparency-required');
 return freeze({width,height,nontransparentPixels:solid,alphaBounds:{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1},hasTransparency:true});
}
export function creatorTemplates(){
 return freeze([
  {templateId:'floor-object',surface:'floor',layer:'furniture',tileSizePx:TILE_SIZE_PX,requiresAlpha:true},
  {templateId:'ground-object',surface:'outdoor_ground',layer:'outdoor_decor',tileSizePx:TILE_SIZE_PX,requiresAlpha:true},
  {templateId:'wall-object',surface:'wall_slot',layer:'wall_decor',tileSizePx:TILE_SIZE_PX,requiresAlpha:true},
  {templateId:'tabletop-object',surface:'tabletop_slot',layer:'tabletop_decor',tileSizePx:TILE_SIZE_PX,requiresAlpha:true},
  {templateId:'shelf-object',surface:'shelf_slot',layer:'shelf_decor',tileSizePx:TILE_SIZE_PX,requiresAlpha:true}
 ]);
}
export function validateStudioAsset(bytes,metadata){
 if(!exact(metadata,['schemaVersion','assetId','revision','templateId','geometry','style','creatorId','rightsDeclaration']))err('metadata-shape');
 if(metadata.schemaVersion!==STUDIO_VERSION||!validId(metadata.assetId)||!safeInt(metadata.revision)||metadata.revision<1||
 !validId(metadata.creatorId)||!validId(metadata.rightsDeclaration))err('metadata-identity');
 const template=creatorTemplates().find(t=>t.templateId===metadata.templateId);if(!template)err('unknown-template');
 if(!exact(metadata.style,['isometricAttestation','reviewRequired'])||metadata.style.isometricAttestation!==true||metadata.style.reviewRequired!==true)err('style-attestation');
 const pixels=decodePNG(bytes),geometry=defineGeometry(metadata.geometry);
 if(!geometry.qualified||geometry.assetId!==metadata.assetId||geometry.surface!==template.surface||geometry.layer!==template.layer||geometry.schemaVersion!==CONTRACT_VERSION)err('geometry-template');
 if(geometry.visualPx.width!==pixels.width||geometry.visualPx.height!==pixels.height)err('geometry-image-dimensions');
 if(geometry.renderAnchorPx.x<0||geometry.renderAnchorPx.x>=pixels.width||geometry.renderAnchorPx.y<0||geometry.renderAnchorPx.y>=pixels.height)err('anchor-outside-canvas');
 // Qualified geometry occupancy is versioned separately from sprite pixel dimensions.
 // Style is a review requirement; a creator's attestation alone never authorizes publish.
 const sha256=hex(bytes),metadataHash=hex(JSON.stringify(metadata));
 return freeze({schemaVersion:STUDIO_VERSION,assetId:metadata.assetId,revision:metadata.revision,creatorId:metadata.creatorId,sha256,metadataHash,byteLength:bytes.length,mimeType:'image/png',pixels,geometryId:geometry.geometryId,geometryVersion:geometry.geometryVersion,templateId:template.templateId,styleStatus:'human-review-required',publicationStatus:'unpublished'});
}
export class CreatorStudio {
 constructor({store,blobs,authority}={}){
  if(typeof store?.transact!=='function'||typeof blobs?.putIfAbsent!=='function'||typeof blobs?.get!=='function'||
  typeof authority?.principal!=='function'||typeof authority?.guardState!=='function')err('authoritative-dependencies');
  Object.assign(this,{store,blobs,authority});
 }
 async submit(session,bytes,metadata){
  const creator=await this.authority.principal(session);
  if(creator!==metadata?.creatorId)err('creator-mismatch');
  const result=validateStudioAsset(bytes,metadata);
  const key='sha256:'+result.sha256;
  // Immutable blob put is idempotent and must verify written bytes on readback.
  await this.blobs.putIfAbsent(key,Buffer.from(bytes));
  const stored=await this.blobs.get(key);
  if(!Buffer.isBuffer(stored)||hex(stored)!==result.sha256)err('blob-integrity');
  return this.store.transact(state=>{
   if(this.authority.guardState(state,session,'creator-submit',creator)!==true)err('creator-revoked');
   state.econCreatorAssets??=new Map();
   const id=JSON.stringify([result.assetId,result.revision]);
   const prev=state.econCreatorAssets.get(id);
   if(prev){
    if(prev.sha256!==result.sha256||prev.metadataHash!==result.metadataHash||prev.creatorId!==creator)err('immutable-revision-conflict');
    return deep(prev);
   }
   const prior=[...state.econCreatorAssets.values()].filter(a=>a.assetId===result.assetId);
   if(prior.length&& (prior.some(a=>a.creatorId!==creator)||Math.max(...prior.map(a=>a.revision))+1!==result.revision))err('revision-owner-or-sequence');
   if(!prior.length&&result.revision!==1)err('first-revision-required');
   state.econCreatorAssets.set(id,result);
   return deep(result);
  });
 }
 async read(session,assetId,revision){
  const principal=await this.authority.principal(session);
  return this.store.transact(s=>{
   if(this.authority.guardState(s,session,'creator-read',principal)!==true)err('reader-revoked');
   const row=s.econCreatorAssets?.get(JSON.stringify([assetId,revision]));
   if(!row||row.creatorId!==principal)err('not-owned');
   return deep(row);
  });
 }
}

/** Operator-provisioned immutable blob directory; never supplied by browser. */
export class ImmutableArtBlobs {
 constructor(directory){
  if(typeof directory!=='string'||!directory.startsWith('/')||directory==='/' )err('blob-root');
  this.directory=resolve(directory);
 }
 path(key){
  if(typeof key!=='string'||!/^sha256:[0-9a-f]{64}$/.test(key))err('blob-key');
  return join(this.directory,key.slice(7,9),key.slice(7)+'.png');
 }
 async putIfAbsent(key,bytes){
  if(!Buffer.isBuffer(bytes)||hex(bytes)!==key.slice(7))err('blob-digest');
  const file=this.path(key);
  await mkdir(join(this.directory,key.slice(7,9)),{recursive:true});
  try{await writeFile(file,bytes,{flag:'wx',mode:0o600});}
  catch(e){if(e?.code!=='EEXIST')throw e;}
  const actual=await this.get(key);
  if(!actual.equals(bytes))err('blob-conflict');
 }
 async get(key){
  const data=await readFile(this.path(key));
  if(hex(data)!==key.slice(7))err('blob-corrupt');
  return data;
 }
}

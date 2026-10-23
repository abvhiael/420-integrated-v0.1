import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveGalleryArtwork} from '../src/archive-gallery.js';
const path='assets/highcountry/original-sixteen/hc-f01-archive-key-art.png';
test('gallery only resolves checksum-verified canonical immediately scoped assets',()=>{
 const m={schema:'HC.ORIGINAL_SIXTEEN.A06.SCOPED.V1',immediate:[{path,status:'available',sha256:'a'.repeat(64)}]};
 assert.equal(resolveGalleryArtwork(m,'hc-f01'),'/'+path);
 assert.equal(resolveGalleryArtwork(m,'hc-f02'),null);
 assert.equal(resolveGalleryArtwork(m,'../../hc-f01'),null);
 assert.equal(resolveGalleryArtwork({...m,immediate:[{path,status:'missing'}]},'hc-f01'),null);
});

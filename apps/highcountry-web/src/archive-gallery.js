// A06 public collection preview. Not an entitlement, acquisition or reward authority.
const validId=id=>typeof id==='string'&&/^hc-f(0[1-9]|1[0-6])$/.test(id);
export function resolveGalleryArtwork(manifest,id){
 if(!validId(id)||manifest?.schema!=='HC.ORIGINAL_SIXTEEN.A06.SCOPED.V1')return null;
 const path='assets/highcountry/original-sixteen/'+id+'-archive-key-art.png';
 const entry=manifest.immediate?.find(x=>x.path===path);
 return entry?.status==='available'&&/^[a-f0-9]{64}$/.test(entry.sha256)?'/'+path:null;
}
export async function mountOriginalSixteenGallery({document,main,fetchImpl=fetch}){
 const introduction=document.createElement('p');introduction.textContent='Original Sixteen heritage gallery — public preview. Discoveries, Archive Edition entitlements, Founder Seals and museum rewards require authenticated server-issued events; this gallery grants nothing.';main.append(introduction);
 let manifest;
 try{const response=await fetchImpl('/assets/highcountry/original-sixteen/a06-scoped-manifest.json',{credentials:'same-origin'});if(!response.ok)throw Error('manifest-unavailable');manifest=await response.json();}
 catch{const msg=document.createElement('p');msg.textContent='Artwork catalogue currently unavailable. No unlocks are affected.';main.append(msg);return;}
 const names=['Emerald Ghost','Blackwater Haze','Cedar Widow','Harbour Lights','Bracken Gold','Rainmaker','Prairie Thunder','Dust Devil','Harvest Moon','Midnight Elevator','Golden Hour','Redline','Copperhead','Desert Saint','Solstice Fire','Crimson Ghost'];
 const collection=document.createElement('div');collection.className='founder-gallery';main.append(collection);
 for(let i=0;i<16;i++){
  const card=document.createElement('section'),id='hc-f'+String(i+1).padStart(2,'0');card.className='game-panel';
  const heading=document.createElement('h3');heading.textContent=id.toUpperCase()+' — '+names[i];card.append(heading);
  const art=resolveGalleryArtwork(manifest,id);
  if(art){const img=document.createElement('img');img.src=art;img.alt='Illustrated heritage key art for '+names[i];img.width=240;img.loading='lazy';img.addEventListener('error',()=>{img.replaceWith(document.createTextNode('Illustration unavailable'));});card.append(img);}
  else{const missing=document.createElement('p');missing.textContent='Illustration pending; heritage collection remains accessible without this image.';card.append(missing);}
  collection.append(card);
 }
}

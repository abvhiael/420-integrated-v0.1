import {keccak256,toUtf8Bytes} from 'ethers';
export function productChange(product,{listingId,revision,publishState='draft'}={}) {
  return {id:product.product_id,version:product.version,sku:product.sku,description:product.description,media:JSON.parse(product.media_manifest),...(product.category_id?{category:product.category_id}:{}),...(listingId?{listingId,revision}:{}),publishState};
}
export function listingChange(values,product) {
  const change={...values,version:product.version,revision:values.revision?Number(values.revision):undefined,expiresAt:Number(values.expiresAt)};
  delete change.productId;
  if(change.method==='createListing')change.itemClass=keccak256(toUtf8Bytes('420/MARKET/ITEM/'+change.itemClass+'/V1'));
  else {delete change.sellerProfileId;delete change.itemClass;delete change.assetRef;}
  return change;
}
export function appendText(parent,tag,text,className) {const node=parent.ownerDocument.createElement(tag);node.textContent=String(text??'');if(className)node.className=className;parent.append(node);return node;}
export function renderPreview(root,{slug,branding,categories,products,mediaURLs}) {
  root.replaceChildren();root.dataset.theme=['default','light','dark'].includes(branding.theme_id)?branding.theme_id:'default';
  for(const [id,alt,css] of [[branding.banner_object_id,'Store banner','banner'],[branding.avatar_object_id,'Store avatar','avatar']])if(mediaURLs.has(id)){const image=root.ownerDocument.createElement('img');image.src=mediaURLs.get(id);image.alt=alt;image.className=css;root.append(image);}
  appendText(root,'h3',slug||'Your storefront');appendText(root,'p',branding.public_description);const menu=appendText(root,'ul','');for(const c of categories.filter(c=>c.visibility==='public').sort((a,b)=>a.sort_order-b.sort_order))appendText(menu,'li',c.slug);
  for(const p of products){const card=appendText(root,'section','');appendText(card,'h4',p.sku);appendText(card,'p',p.description);appendText(card,'p',p.publish_state==='published'?'Published metadata · stock requires fresh Market read':'Private draft · unavailable to shoppers');for(const id of JSON.parse(p.media_manifest))if(mediaURLs.has(id)){const image=root.ownerDocument.createElement('img');image.src=mediaURLs.get(id);image.alt=p.sku+' product photo';card.append(image);}}
}
export function transactionTerms(plan){
  const i=plan.intent,names=i.method==='register'?['merchantId','profileId','metadataHash','payout']:i.method==='createListing'?['listingId','sellerProfileId','itemClass','assetRef','metadataHash','policyId','saleMechanism','settlementAdapterId','quoteAsset','unitPriceBaseUnits','immutableQuantity','expiresAtSeconds']:['listingId','metadataHash','policyId','saleMechanism','settlementAdapterId','quoteAsset','unitPriceBaseUnits','immutableQuantity','expiresAtSeconds'];
  return {chain:i.chainId,controller:plan.controller,contract:i.contract,target:i.target,method:i.method,terms:Object.fromEntries(names.map((name,index)=>[name,i.args[index]])),expectedFinalizedRevision:plan.revision??null,expiresAt:plan.expiresAt,finalizedSource:plan.provenance};
}

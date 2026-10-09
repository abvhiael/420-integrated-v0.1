import { keccak256, toUtf8Bytes } from 'ethers';
import { requireThat, text, wallet, bytes32, integer, quantity, keys, id, hash, safeMedia, encryptDelivery, decryptDelivery } from './security.mjs';
import { fixedPrice, orderStates } from './authority.mjs';
import { canonicalRefundProposal } from './refund.mjs';
import {MARKET_ARBITRATION_DOMAIN,MARKET_ORIGIN_COMPONENT,CASE_STATES} from './arbitration.mjs';

const editableScopes = ['branding','catalogue','categories','media'];
const objectID = value => { requireThat(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value), 'invalid_id'); return value; };
const word=value=>{requireThat(typeof value==='string'&&/^0x[0-9a-f]{64}$/.test(value),'invalid_bytes32');return value;};
const version = value => integer(value,1,Number.MAX_SAFE_INTEGER);
const slug = value => { requireThat(typeof value === 'string' && /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(value), 'invalid_slug'); return value; };
export class CommerceService {
  constructor(db, authority, projection, { chainId, deliveryKey, now = Date.now }) {
    this.db=db; this.authority=authority; this.projection=projection; this.chainId=chainId; this.deliveryKey=deliveryKey; this.now=now; this.activeUploads=0;
  }
  async source() {
    requireThat(this.projection.health().state !== 'halted','projection_halted',503);
    const source = await this.authority.snapshot();
    requireThat(source.finalized === true && source.chainId === this.chainId,'authority_mismatch',503);
    return source;
  }
  store(storeId) { const store=this.db.get('SELECT * FROM stores WHERE store_id=?',objectID(storeId)); requireThat(store,'not_found',404); return store; }
  async access(actor, storeId, scope) {
    actor=wallet(actor); const store=this.store(storeId), source=await this.source(), merchant=await source.merchant(store.merchant_id);
    requireThat(merchant.active && wallet(merchant.controller)!=='0x0000000000000000000000000000000000000000','inactive_merchant',403);
    if (actor !== wallet(merchant.controller)) {
      const delegate=this.db.get('SELECT * FROM delegates WHERE store_id=? AND wallet=?',storeId,actor);
      requireThat(editableScopes.includes(scope) && delegate && delegate.expires_at>this.now() && delegate.controller_reference===wallet(merchant.controller) && JSON.parse(delegate.scopes).includes(scope),'forbidden',403);
    }
    return {store,source,merchant,actor};
  }
  mutate(actor, store, operation, object, fn) { return this.db.transaction(() => { const result=fn(); this.db.audit(actor,store,operation,object,this.now()); return result; }); }
  async builder(actor,storeId) {
    actor=wallet(actor);const store=this.store(storeId),source=await this.source(),merchant=await source.merchant(store.merchant_id);
    requireThat(merchant.active,'inactive_merchant',403);
    let permissions;
    if(wallet(merchant.controller)===actor)permissions=[...editableScopes,'publish','delegate'];
    else {const d=this.db.get('SELECT * FROM delegates WHERE store_id=? AND wallet=?',storeId,actor);requireThat(d&&d.expires_at>this.now()&&d.controller_reference===wallet(merchant.controller),'forbidden',403);permissions=JSON.parse(d.scopes);requireThat(permissions.length,'forbidden',403);}
    const has=s=>permissions.includes(s);
    return {store,permissions,branding:has('branding')?this.db.get('SELECT * FROM store_branding WHERE store_id=?',storeId):null,categories:has('categories')?this.db.all('SELECT * FROM store_categories WHERE store_id=?',storeId):[],products:has('catalogue')?this.db.all('SELECT * FROM products WHERE store_id=?',storeId):[],variants:has('catalogue')?this.db.all('SELECT v.* FROM product_variants v JOIN products p ON p.product_id=v.product_id WHERE p.store_id=?',storeId):[],media:has('media')?this.db.all('SELECT object_id,content_hash,content_type FROM media WHERE store_id=?',storeId):[],releases:has('branding')?this.db.all('SELECT version,branding,published_at FROM store_releases WHERE store_id=? ORDER BY version DESC LIMIT 50',storeId):[]};
  }
  async identity(actor,merchantId) {
    bytes32(merchantId); actor=wallet(actor); const source=await this.source(),merchant=await source.merchant(merchantId);
    const registered=wallet(merchant.controller)!=='0x0000000000000000000000000000000000000000';
    requireThat(!registered || wallet(merchant.controller)===actor,'forbidden',403);
    return {registered,merchant,store:registered?this.db.get('SELECT * FROM stores WHERE merchant_id=?',merchantId)??null:null,provenance:this.provenance(source)};
  }
  provenance(source) {return {chainId:this.chainId,blockHash:source.blockHash,blockNumber:source.blockNumber,finalized:true};}
  plan(source,contract,method,args,details) {
    const expiresAt=Math.min(this.now()+60000,source.expiresAt??this.now()+60000);
    return {...details,expiresAt,provenance:this.provenance(source),intent:source.transaction(contract,method,args)};
  }
  async registration(actor,input) {
    keys(input,['merchantId','profileId','metadataHash','payout']); actor=wallet(actor);
    const args=[bytes32(input.merchantId),word(input.profileId),word(input.metadataHash),wallet(input.payout)],source=await this.source(),merchant=await source.merchant(input.merchantId);
    requireThat(wallet(merchant.controller)==='0x0000000000000000000000000000000000000000','merchant_exists',409);
    return this.plan(source,'MerchantRegistry420','register',args,{merchantId:input.merchantId,controller:actor,payout:args[3]});
  }
  async merchantListing(actor,storeId,listingId) {
    const {source,merchant}=await this.access(actor,storeId,'catalogue'),listing=await source.listing(bytes32(listingId));
    requireThat(listing && wallet(listing.seller)===wallet(merchant.controller),'listing_tenant',403);
    return {listingId,listing,provenance:this.provenance(source),reservationRequired:true};
  }
  async listingPlan(actor,storeId,productId,input) {
    keys(input,['version','method','listingId','revision','sellerProfileId','itemClass','assetRef','policyId','adapterId','quoteAsset','unitPrice','quantity','expiresAt']);
    const {source,merchant}=await this.access(actor,storeId,'publish'),p=this.db.get('SELECT * FROM products WHERE store_id=? AND product_id=?',storeId,objectID(productId));
    requireThat(p && p.version===version(input.version),'version_conflict',409);
    requireThat(['createListing','reviseListing'].includes(input.method),'invalid_listing_method');
    const listingId=bytes32(input.listingId),policyId=bytes32(input.policyId),adapterId=bytes32(input.adapterId),asset=wallet(input.quoteAsset);
    // Zero address is the canonical native $420 settlement-asset representation.
    // The owning Market and Pay contracts still validate their own policy/adapter.
    quantity(input.unitPrice);quantity(input.quantity);integer(input.expiresAt,0,Number.MAX_SAFE_INTEGER);
    requireThat(input.expiresAt===0 || input.expiresAt>Math.floor(this.now()/1000),'invalid_expiry');
    const policy=await source.policy(policyId,adapterId);requireThat(policy.policyActive&&policy.adapterActive,'inactive_policy',409);
    const listing=await source.listing(listingId);let args,revision;
    if(input.method==='createListing') {
      requireThat(!listing || wallet(listing.seller)==='0x0000000000000000000000000000000000000000','listing_exists',409);
      requireThat(['PHYSICAL_GOOD','SERVICE','DIGITAL_GOOD','LICENSE','GAME_ASSET','CREATIVE_PRODUCT','MERCHANT_INVENTORY'].map(x=>keccak256(toUtf8Bytes('420/MARKET/ITEM/'+x+'/V1'))).includes(input.itemClass),'invalid_item_class');
      args=[listingId,word(input.sellerProfileId),bytes32(input.itemClass),bytes32(input.assetRef),p.metadata_hash,policyId,fixedPrice,adapterId,asset,input.unitPrice,input.quantity,input.expiresAt];revision=1;
    } else {
      requireThat(listing && wallet(listing.seller)===wallet(merchant.controller) && Number(listing.revision)===integer(input.revision,1,2**32-2),'listing_binding',409);
      requireThat(input.quantity===listing.quantity,'quantity_immutable',409);
      args=[listingId,p.metadata_hash,policyId,fixedPrice,adapterId,asset,input.unitPrice,input.quantity,input.expiresAt];revision=input.revision+1;
    }
    return this.plan(source,'ListingRegistry420',input.method,args,{productId,productVersion:p.version,metadataHash:p.metadata_hash,listingId,revision,controller:wallet(merchant.controller)});
  }
  async createStore(actor,input) {
    keys(input,['merchantId','slug']); bytes32(input.merchantId); slug(input.slug);
    const source=await this.source(), merchant=await source.merchant(input.merchantId); actor=wallet(actor);
    requireThat(merchant.active && wallet(merchant.controller)===actor,'forbidden',403);
    const storeId=id();
    return this.mutate(actor,storeId,'create_store',storeId,() => {
      this.db.run('INSERT INTO stores VALUES(?,?,?,?,\'draft\',?,?,1)',storeId,input.merchantId,actor,input.slug,this.now(),this.now());
      this.db.run('INSERT INTO store_branding VALUES(?,NULL,NULL,\'default\',\'\',1)',storeId);
      return this.store(storeId);
    });
  }
  async updateStore(actor,storeId,input) {
    keys(input,['version','status','slug','designVersion','categoryVersions']); version(input.version); slug(input.slug); requireThat(['draft','published'].includes(input.status),'invalid_status');
    await this.access(actor,storeId,'publish');
    return this.mutate(actor,storeId,'update_store',storeId,() => {
      if(input.designVersion!==undefined)requireThat(this.db.get('SELECT version FROM store_branding WHERE store_id=?',storeId).version===version(input.designVersion),'design_conflict',409);
      if(input.categoryVersions!==undefined){requireThat(Array.isArray(input.categoryVersions),'invalid_categories');const expected=this.db.all('SELECT category_id,version FROM store_categories WHERE store_id=? ORDER BY category_id',storeId);requireThat(JSON.stringify(expected)===JSON.stringify(input.categoryVersions),'design_conflict',409);}
      requireThat(this.db.run('UPDATE stores SET slug=?,status=?,updated_at=?,version=version+1 WHERE store_id=? AND version=?',input.slug,input.status,this.now(),storeId,input.version).changes===1,'version_conflict',409); if(input.status==='published') this.db.run('INSERT INTO store_releases VALUES(?,?,?,?,?)',storeId,input.version+1,JSON.stringify(this.db.get('SELECT * FROM store_branding WHERE store_id=?',storeId)),JSON.stringify(this.db.all("SELECT category_id,parent_id,global_taxonomy_id,slug,sort_order FROM store_categories WHERE store_id=? AND visibility='public' ORDER BY sort_order,category_id",storeId)),this.now()); return this.store(storeId);
    });
  }
  async delegate(actor,storeId,input) {
    keys(input,['wallet','scopes','expiresAt']); await this.access(actor,storeId,'delegate');
    const target=wallet(input.wallet); requireThat(Array.isArray(input.scopes) && input.scopes.every(s => editableScopes.includes(s)) && new Set(input.scopes).size===input.scopes.length,'invalid_scope'); integer(input.expiresAt,this.now(),this.now()+86400000);
    return this.mutate(actor,storeId,'delegate',target,() => this.db.run('INSERT INTO delegates VALUES(?,?,?,?,?) ON CONFLICT(store_id,wallet) DO UPDATE SET controller_reference=excluded.controller_reference,scopes=excluded.scopes,expires_at=excluded.expires_at',storeId,target,wallet(actor),JSON.stringify(input.scopes),input.expiresAt));
  }
  mediaReferences(storeId, ids) {
    requireThat(Array.isArray(ids) && ids.length<=12 && new Set(ids).size===ids.length,'invalid_media_manifest');
    return ids.map(mediaId => { const media=this.db.get('SELECT object_id,content_hash FROM media WHERE object_id=? AND store_id=?',objectID(mediaId),storeId); requireThat(media,'media_tenant',403); return media; });
  }
  async branding(actor,storeId,input) {
    keys(input,['version','avatar','banner','theme','description']); version(input.version); text(input.description); requireThat(['default','light','dark'].includes(input.theme),'invalid_theme');
    await this.access(actor,storeId,'branding'); this.mediaReferences(storeId,[...new Set([input.avatar,input.banner].filter(Boolean))]);
    return this.mutate(actor,storeId,'branding',storeId,() => {
      requireThat(this.db.run('UPDATE store_branding SET avatar_object_id=?,banner_object_id=?,theme_id=?,public_description=?,version=version+1 WHERE store_id=? AND version=?',input.avatar??null,input.banner??null,input.theme,input.description,storeId,input.version).changes===1,'version_conflict',409);
      return this.db.get('SELECT * FROM store_branding WHERE store_id=?',storeId);
    });
  }
  async upload(actor,storeId,data,mime) {
    await this.access(actor,storeId,'media');requireThat(this.activeUploads<2,'media_capacity',429);
    this.activeUploads++;let sanitized;try{sanitized=await safeMedia(data,mime);}finally{this.activeUploads--;}
    // Revalidate after potentially expensive decoding, before committing.
    await this.access(actor,storeId,'media'); const objectId=id();
    return this.mutate(actor,storeId,'media_upload',objectId,() => {
      const usage=this.db.get('SELECT COUNT(*) AS n,COALESCE(SUM(length(content)),0) AS bytes FROM media WHERE store_id=?',storeId);
      requireThat(usage.n<200 && usage.bytes+sanitized.length<=100*1024*1024,'media_quota',429);
      this.db.run('INSERT INTO media VALUES(?,?,?,?,\'image/png\',?)',objectId,storeId,hash(sanitized),sanitized,this.now());
      return {objectId,contentHash:hash(sanitized),contentType:'image/png'};
    });
  }
  publicMedia(mediaId) {
    const row=this.db.get("SELECT m.content,m.content_type FROM media m JOIN stores s ON s.store_id=m.store_id WHERE m.object_id=? AND s.status='published' AND (EXISTS(SELECT 1 FROM store_releases r WHERE r.store_id=s.store_id AND r.version=(SELECT MAX(version) FROM store_releases WHERE store_id=s.store_id) AND (json_extract(r.branding,'$.avatar_object_id')=m.object_id OR json_extract(r.branding,'$.banner_object_id')=m.object_id)) OR EXISTS(SELECT 1 FROM products p,json_each(p.media_manifest) j WHERE p.store_id=s.store_id AND p.publish_state='published' AND j.value=m.object_id))",objectID(mediaId));
    requireThat(row,'not_found',404); return row;
  }
  async category(actor,storeId,input) {
    keys(input,['id','version','slug','parent','globalTaxonomy','order','visibility']); await this.access(actor,storeId,'categories'); slug(input.slug); integer(input.order,0,1000); requireThat(['public','hidden'].includes(input.visibility),'invalid_visibility');
    if(input.parent) requireThat(this.db.get('SELECT 1 FROM store_categories WHERE category_id=? AND store_id=? AND parent_id IS NULL',objectID(input.parent),storeId),'category_parent');
    if(input.globalTaxonomy) requireThat(this.db.get('SELECT 1 FROM store_categories WHERE category_id=? AND store_id IS NULL',objectID(input.globalTaxonomy)),'global_taxonomy');
    const categoryId=input.id ? objectID(input.id) : id(); requireThat(categoryId!==input.parent,'category_cycle');
    return this.mutate(actor,storeId,'category',categoryId,() => {
      requireThat(this.db.get('SELECT COUNT(*) AS n FROM store_categories WHERE store_id=?',storeId).n<100 || input.id,'category_quota',429);
      if(input.id) { version(input.version); requireThat(this.db.run('UPDATE store_categories SET parent_id=?,global_taxonomy_id=?,slug=?,sort_order=?,visibility=?,version=version+1 WHERE category_id=? AND store_id=? AND version=?',input.parent??null,input.globalTaxonomy??null,input.slug,input.order,input.visibility,categoryId,storeId,input.version).changes===1,'version_conflict',409); }
      else this.db.run('INSERT INTO store_categories VALUES(?,?,?,?,?,?,?,1)',categoryId,storeId,input.parent??null,input.globalTaxonomy??null,input.slug,input.order,input.visibility);
      return this.db.get('SELECT * FROM store_categories WHERE category_id=?',categoryId);
    });
  }
  metadata(storeId,input) {
    const media=this.mediaReferences(storeId,input.media);
    const manifest={schema:'420-commerce-product-v1',sku:input.sku,description:input.description,media:media.map(m => m.content_hash)};
    return { manifest, metadataHash:keccak256(toUtf8Bytes(JSON.stringify(manifest))) };
  }
  async product(actor,storeId,input) {
    keys(input,['id','version','sku','description','media','category','listingId','revision','publishState']); text(input.sku,80); requireThat(input.sku.length>0,'empty_sku'); text(input.description,8000); requireThat(['draft','published'].includes(input.publishState),'invalid_publish_state');
    const {source,merchant}=await this.access(actor,storeId,input.publishState==='published' ? 'publish':'catalogue');
    if(input.category) requireThat(this.db.get('SELECT 1 FROM store_categories WHERE category_id=? AND store_id=?',objectID(input.category),storeId),'category_tenant',403);
    const {metadataHash,manifest}=this.metadata(storeId,input);
    if(input.listingId) bytes32(input.listingId); if(input.revision) integer(input.revision,1,2**32-1);
    if(input.publishState==='published') {
      const listing=await source.listing(bytes32(input.listingId));
      requireThat(listing && listing.active && wallet(listing.seller)===wallet(merchant.controller) && Number(listing.revision)===input.revision && listing.metadataHash===metadataHash && listing.policyActive && listing.adapterActive && (listing.expiresAt==='0' || BigInt(listing.expiresAt)>BigInt(Math.floor(this.now()/1000))),'listing_binding',409);
    }
    const productId=input.id?objectID(input.id):id();
    return this.mutate(actor,storeId,'product',productId,() => {
      requireThat(!input.listingId || !this.db.get('SELECT 1 FROM product_variants WHERE canonical_listing_id=?',input.listingId),'variant_stock_alias',409);
      requireThat(this.db.get('SELECT COUNT(*) AS n FROM products WHERE store_id=?',storeId).n<1000 || input.id,'product_quota',429);
      if(input.id) { version(input.version); requireThat(this.db.run('UPDATE products SET canonical_listing_id=?,listing_revision=?,metadata_hash=?,sku=?,description=?,media_manifest=?,category_id=?,publish_state=?,version=version+1 WHERE product_id=? AND store_id=? AND version=?',input.listingId??null,input.revision??null,metadataHash,input.sku,input.description,JSON.stringify(input.media),input.category??null,input.publishState,productId,storeId,input.version).changes===1,'version_conflict',409); }
      else this.db.run('INSERT INTO products VALUES(?,?,?,?,?,?,?,?,?,?,1)',productId,storeId,input.listingId??null,input.revision??null,metadataHash,input.sku,input.description,JSON.stringify(input.media),input.category??null,input.publishState);
      return {...this.db.get('SELECT * FROM products WHERE product_id=?',productId),metadataManifest:manifest};
    });
  }
  async variant(actor,storeId,productId,input) {
    keys(input,['id','version','options','sku','listingId']); await this.access(actor,storeId,'catalogue'); objectID(productId); text(input.sku,80); requireThat(input.sku.length>0,'empty_sku'); keys(input.options,Object.keys(input.options??{})); requireThat(Object.keys(input.options).length>0 && Object.keys(input.options).length<=8,'variant_options');
    for(const [key,value] of Object.entries(input.options)) { text(key,40); text(value,80); }
    requireThat(this.db.get('SELECT 1 FROM products WHERE product_id=? AND store_id=?',productId,storeId),'product_tenant',403);
    if(input.listingId) { bytes32(input.listingId); const {source,merchant}=await this.access(actor,storeId,'publish'),listing=await source.listing(input.listingId); requireThat(wallet(listing.seller)===wallet(merchant.controller)&&listing.active,'variant_listing'); }
    const variantId=input.id?objectID(input.id):id();
    return this.mutate(actor,storeId,'variant',variantId,() => {
      requireThat(!input.listingId || !this.db.get('SELECT 1 FROM products WHERE canonical_listing_id=?',input.listingId),'variant_stock_alias',409);
      requireThat(this.db.get('SELECT COUNT(*) AS n FROM product_variants WHERE product_id=?',productId).n<100 || input.id,'variant_quota',429);
      if(input.id) { version(input.version); requireThat(this.db.run('UPDATE product_variants SET option_json=?,canonical_listing_id=?,variant_sku=?,version=version+1 WHERE variant_id=? AND product_id=? AND version=?',JSON.stringify(input.options),input.listingId??null,input.sku,variantId,productId,input.version).changes===1,'version_conflict',409); }
      else this.db.run('INSERT INTO product_variants VALUES(?,?,?,?,?,1)',variantId,productId,JSON.stringify(input.options),input.listingId??null,input.sku);
      return this.db.get('SELECT * FROM product_variants WHERE variant_id=?',variantId);
    });
  }
  publicStores({query='',offset=0,limit=20}={}) {
    text(query,120); integer(offset,0,100000); integer(limit,1,100);
    const items=this.db.all("SELECT s.store_id,s.slug,b.theme_id,b.public_description,b.avatar_object_id,b.banner_object_id FROM stores s JOIN store_releases r ON r.store_id=s.store_id AND r.version=(SELECT MAX(version) FROM store_releases WHERE store_id=s.store_id) JOIN store_branding b ON b.store_id=s.store_id WHERE s.status='published' AND instr(lower(s.slug||' '||json_extract(r.branding,'$.public_description')),lower(?))>0 ORDER BY s.slug LIMIT ? OFFSET ?",query,limit+1,offset);
    for(const item of items){const release=this.db.get('SELECT branding FROM store_releases WHERE store_id=? ORDER BY version DESC LIMIT 1',item.store_id);requireThat(release,'release_unavailable',503);const b=JSON.parse(release.branding);Object.assign(item,{theme_id:b.theme_id,public_description:b.public_description,avatar_object_id:b.avatar_object_id,banner_object_id:b.banner_object_id});}
    return this.page(items,offset,limit);
  }
  page(items,offset,limit) { return {schema:'420-commerce-api-v1',authoritative:false,state:items.length?'ready':'empty',provenance:this.projection.health(),items:items.slice(0,limit),nextOffset:items.length>limit?offset+limit:null}; }
  publicStore(slugValue) { slug(slugValue); const row=this.db.get("SELECT store_id FROM stores WHERE slug=? AND status='published'",slugValue); requireThat(row,'not_found',404); return { ...this.publicStores({query:slugValue}).items.find(s => s.store_id===row.store_id),categories:JSON.parse(this.db.get('SELECT categories FROM store_releases WHERE store_id=? ORDER BY version DESC LIMIT 1',row.store_id).categories),authoritative:false,provenance:this.projection.health() }; }
  globalCategories() { return {items:this.db.all("SELECT category_id,parent_id,slug,sort_order FROM store_categories WHERE store_id IS NULL AND visibility='public' ORDER BY sort_order,category_id"),authoritative:false}; }
  // Operator-approved taxonomy is presentation data; merchant routes cannot
  // modify it. Snapshot replacement is transactionally validated as a full set.
  reconcileTaxonomy(items) {
    requireThat(Array.isArray(items)&&items.length<=100,'taxonomy_size');
    const seen=new Set();for(const item of items){keys(item,['id','slug','parent','order']);objectID(item.id);slug(item.slug);integer(item.order,0,1000);requireThat(!seen.has(item.id),'taxonomy_duplicate');seen.add(item.id);}
    for(const item of items)if(item.parent)requireThat(items.some(p=>p.id===item.parent&&!p.parent)&&item.parent!==item.id,'taxonomy_parent');
    this.db.transaction(()=>{
      const old=this.db.all('SELECT category_id FROM store_categories WHERE store_id IS NULL ORDER BY parent_id IS NULL ASC');
      requireThat(old.every(row=>seen.has(row.category_id)||!this.db.get('SELECT 1 FROM store_categories WHERE global_taxonomy_id=?',row.category_id)),'taxonomy_in_use');
      for(const item of [...items.filter(x=>!x.parent),...items.filter(x=>x.parent)])this.db.run("INSERT INTO store_categories VALUES(?,NULL,?,NULL,?,?,'public',1) ON CONFLICT(category_id) DO UPDATE SET parent_id=excluded.parent_id,slug=excluded.slug,sort_order=excluded.sort_order,version=version+1 WHERE store_categories.store_id IS NULL",item.id,item.parent??null,item.slug,item.order);
      requireThat(items.every(item=>this.db.get('SELECT 1 FROM store_categories WHERE category_id=? AND store_id IS NULL',item.id)),'taxonomy_tenant');
      for(const row of old.filter(row=>!seen.has(row.category_id)))this.db.run('DELETE FROM store_categories WHERE category_id=?',row.category_id);
      this.db.audit('approved-configuration',null,'taxonomy_reconcile',hash(JSON.stringify(items)),this.now());
    });
  }
  async availability(productId) {
    const row=this.db.get("SELECT p.* FROM products p JOIN stores s ON s.store_id=p.store_id WHERE p.product_id=? AND p.publish_state='published' AND s.status='published'",objectID(productId));requireThat(row,'not_found',404);
    const source=await this.source(),merchant=await source.merchant(this.store(row.store_id).merchant_id),listing=await source.listing(row.canonical_listing_id);
    requireThat(merchant.active&&listing.active&&wallet(listing.seller)===wallet(merchant.controller)&&Number(listing.revision)===row.listing_revision&&listing.metadataHash===row.metadata_hash&&listing.policyActive&&listing.adapterActive&&(listing.expiresAt==='0'||BigInt(listing.expiresAt)>BigInt(Math.floor(this.now()/1000))),'listing_unavailable',409);
    return {listingId:row.canonical_listing_id,revision:row.listing_revision,available:listing.available,inventory:listing.inventory??null,reservationRequired:true,authority:'Market.InventoryReservation420',provenance:{chainId:this.chainId,blockHash:source.blockHash,blockNumber:source.blockNumber,finalized:true}};
  }
  search({query='',storeId=null,category=null,offset=0,limit=20,productId=null}={}) {
    text(query,120); integer(offset,0,100000); integer(limit,1,100); if(storeId)objectID(storeId); if(category)objectID(category); if(productId)objectID(productId);
    const rows=this.db.all("SELECT p.product_id,p.store_id,p.sku,p.description,p.media_manifest,p.canonical_listing_id,p.listing_revision,p.metadata_hash,c.payload,c.block_number,c.block_hash,c.finalized FROM products p JOIN stores s ON s.store_id=p.store_id LEFT JOIN catalogue_projection c ON c.listing_id=p.canonical_listing_id WHERE p.publish_state='published' AND s.status='published' AND (? IS NULL OR p.store_id=?) AND (? IS NULL OR p.category_id=?) AND (? IS NULL OR p.product_id=?) AND instr(lower(p.sku||' '||p.description),lower(?))>0 ORDER BY p.product_id LIMIT ? OFFSET ?",storeId,storeId,category,category,productId,productId,query,limit+1,offset);
    const items=rows.map(row => { const {payload,...publicData}=row,listing=payload?JSON.parse(payload):null; return {...publicData,media:JSON.parse(row.media_manifest),listing:listing&&listing.metadataHash===row.metadata_hash&&Number(listing.revision)===row.listing_revision?listing:null,availability:'canonical_reservation_required',authoritative:false}; });
    return this.page(items,offset,limit);
  }
  async draft(actor,storeId) { await this.access(actor,storeId,'catalogue'); return {releases:this.db.all('SELECT version,branding,categories,published_at FROM store_releases WHERE store_id=? ORDER BY version DESC LIMIT 50',storeId),store:this.store(storeId),branding:this.db.get('SELECT * FROM store_branding WHERE store_id=?',storeId),categories:this.db.all('SELECT * FROM store_categories WHERE store_id=?',storeId),products:this.db.all('SELECT * FROM products WHERE store_id=?',storeId),variants:this.db.all('SELECT v.* FROM product_variants v JOIN products p ON p.product_id=v.product_id WHERE p.store_id=?',storeId)}; }
  async section(actor,storeId,section) {
    const scopes={branding:'branding',categories:'categories',products:'catalogue',media:'media'};requireThat(Object.hasOwn(scopes,section),'not_found',404);await this.access(actor,storeId,scopes[section]);
    if(section==='branding')return this.db.get('SELECT * FROM store_branding WHERE store_id=?',storeId);
    if(section==='media')return {items:this.db.all('SELECT object_id,content_hash,content_type FROM media WHERE store_id=? ORDER BY object_id',storeId)};
    const table=section==='categories'?'store_categories':'products';return {items:this.db.all(`SELECT * FROM ${table} WHERE store_id=?`,storeId)};
  }
  async privateMedia(actor,storeId,mediaId) {
    await this.access(actor,storeId,'media');const row=this.db.get('SELECT content,content_type FROM media WHERE store_id=? AND object_id=?',storeId,objectID(mediaId));requireThat(row,'not_found',404);
    return {objectId:mediaId,contentType:row.content_type,dataBase64:Buffer.from(row.content).toString('base64')};
  }
  cart(actor,input) {
    keys(input,['id','version','storeId','lines']); actor=wallet(actor); const store=this.store(input.storeId); requireThat(store.status==='published','store_unpublished');
    requireThat(Array.isArray(input.lines)&&input.lines.length>0&&input.lines.length<=20,'cart_lines');
    const seen=new Set(); for(const line of input.lines) {keys(line,['listingId','revision','quantity']); bytes32(line.listingId); integer(line.revision,1,2**32-1); quantity(line.quantity); requireThat(!seen.has(line.listingId),'duplicate_cart_line'); seen.add(line.listingId); requireThat(this.db.get("SELECT 1 FROM products WHERE store_id=? AND canonical_listing_id=? AND listing_revision=? AND publish_state='published' UNION SELECT 1 FROM product_variants v JOIN products p ON p.product_id=v.product_id WHERE p.store_id=? AND v.canonical_listing_id=? AND p.publish_state='published'",input.storeId,line.listingId,line.revision,input.storeId,line.listingId),'cart_tenant'); }
    const cartId=input.id?objectID(input.id):id();
    return this.mutate(actor,input.storeId,'cart',cartId,() => {
      if(input.id) { version(input.version); requireThat(this.db.run('UPDATE cart_sessions SET expires_at=?,version=version+1 WHERE cart_id=? AND customer_scope=? AND store_id=? AND version=? AND expires_at>?',this.now()+1800000,cartId,actor,input.storeId,input.version,this.now()).changes===1,'cart_conflict',409); this.db.run('DELETE FROM cart_lines WHERE cart_id=?',cartId); }
      else { requireThat(this.db.get('SELECT COUNT(*) AS n FROM cart_sessions WHERE customer_scope=? AND expires_at>?',actor,this.now()).n<20,'cart_quota',429); this.db.run('INSERT INTO cart_sessions VALUES(?,?,?,?,1)',cartId,actor,input.storeId,this.now()+1800000); }
      for(const line of input.lines)this.db.run('INSERT INTO cart_lines VALUES(?,?,?,?)',cartId,line.listingId,line.revision,line.quantity);
      return {...this.db.get('SELECT * FROM cart_sessions WHERE cart_id=?',cartId),lines:input.lines,reserved:false};
    });
  }
  ownCart(actor,cartId) { const cart=this.db.get('SELECT * FROM cart_sessions WHERE cart_id=? AND customer_scope=? AND expires_at>?',objectID(cartId),wallet(actor),this.now()); requireThat(cart,'cart_unavailable',404); return cart; }
  async prepare(actor,input) {
    keys(input,['cartId','cartVersion','idempotencyKey']); actor=wallet(actor); version(input.cartVersion); requireThat(typeof input.idempotencyKey==='string'&&/^[a-zA-Z0-9_-]{16,100}$/.test(input.idempotencyKey),'idempotency_key');
    const cart=this.ownCart(actor,input.cartId),store=this.store(cart.store_id); requireThat(cart.version===input.cartVersion&&store.status==='published','cart_conflict',409);
    const source=await this.source(),merchant=await source.merchant(store.merchant_id); requireThat(merchant.active,'inactive_merchant',403);
    const lines=this.db.all('SELECT * FROM cart_lines WHERE cart_id=?',cart.cart_id);
    // Each Market order binds one listing. Multi-line cart orchestration is an
    // explicit list of separately authorized orders, never a synthetic order.
    const requestHash=hash(JSON.stringify({cartVersion:cart.version,lines}));
    const previous=()=>this.db.all('SELECT * FROM checkout_attempts WHERE customer_scope=? AND merchant_id=? AND network_id=? AND substr(idempotency_key,1,?)=?',actor,store.merchant_id,this.chainId,input.idempotencyKey.length+1,input.idempotencyKey+':');
    const old=previous();
    if(old.length) requireThat(old.length===lines.length&&old.every(a=>a.request_hash===requestHash&&a.expires_at>this.now()),'idempotency_conflict',409);
    const attempts=[];
    for(const line of lines) {
      const listing=await source.listing(line.listing_id);
      requireThat(listing.active&&Number(listing.revision)===line.requested_revision&&wallet(listing.seller)===wallet(merchant.controller)&&listing.saleMechanism===fixedPrice&&listing.policyActive&&listing.adapterActive&&listing.reporterActive&&(listing.expiresAt==='0'||BigInt(listing.expiresAt)>BigInt(Math.floor(this.now()/1000)))&&BigInt(listing.available)>=BigInt(line.quantity)&&BigInt(listing.unitPrice)>0n,'listing_unavailable',409);
      const total=BigInt(listing.unitPrice)*BigInt(line.quantity); requireThat(total<2n**256n,'amount_overflow');
      attempts.push({attempt_id:id(),cart_id:cart.cart_id,customer_scope:actor,merchant_id:store.merchant_id,network_id:this.chainId,order_id:'0x'+id(),listing_id:line.listing_id,listing_revision:line.requested_revision,quantity:line.quantity,seller:wallet(listing.seller),asset:wallet(listing.quoteAsset),total:total.toString(),payment_id:null,quote_id:null,idempotency_key:input.idempotencyKey+':'+line.listing_id,request_hash:requestHash,state:'ORDER_SIGNATURE_REQUIRED',expires_at:this.now()+120000});
    }
    const reused=old.length?old:previous();
    if(reused.length) { requireThat(reused.length===lines.length&&reused.every(a=>a.request_hash===requestHash&&a.expires_at>this.now()),'idempotency_conflict',409);return {attempts:reused.map(a=>this.orderPlan(source,a)),paid:false}; }
    this.mutate(actor,store.store_id,'checkout_prepare',cart.cart_id,()=>{
      requireThat(this.db.get('SELECT version FROM cart_sessions WHERE cart_id=?',cart.cart_id).version===cart.version,'cart_conflict',409);
      for(const a of attempts) this.db.run('INSERT INTO checkout_attempts VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',...Object.values(a));
    });
    return {attempts:attempts.map(a=>this.orderPlan(source,a)),paid:false};
  }
  orderPlan(source,a) { return {attemptId:a.attempt_id,orderId:a.order_id,state:a.state,expiresAt:a.expires_at,paymentAllowed:false,reserved:false,intent:source.intent('createOrder',[a.order_id,a.listing_id,a.listing_revision,a.quantity,a.asset,a.total])}; }
  async status(actor,attemptId) {
    actor=wallet(actor); const a=this.db.get('SELECT * FROM checkout_attempts WHERE attempt_id=?',objectID(attemptId)); requireThat(a,'not_found',404);
    const source=await this.source(),merchant=await source.merchant(a.merchant_id); requireThat(actor===a.customer_scope||actor===wallet(merchant.controller)&&merchant.active,'forbidden',403);
    const order=await source.order(a.order_id);
    if(Number(order.status)===0) return {attemptId,state:'ORDER_SIGNATURE_REQUIRED',paid:false,reserved:false};
    requireThat(order.listingId===a.listing_id&&Number(order.listingRevision)===a.listing_revision&&wallet(order.buyer)===a.customer_scope&&wallet(order.seller)===a.seller&&order.quantity===a.quantity&&wallet(order.paymentAsset)===a.asset&&order.totalAmount===a.total,'order_correlation',503);
    let paid=false,invoiceId=null,receiptHash=null,paymentId=null,refundedBaseUnits='0',state=orderStates[Number(order.status)]; requireThat(state,'unknown_order_state',503);
    if(state==='CREATED') {
      invoiceId=await source.invoiceId(a.order_id); const invoice=await source.invoice(invoiceId);
      const valid=invoice.active&&invoice.merchantId===a.merchant_id&&wallet(invoice.merchant)===a.seller&&invoice.amount===a.total&&invoice.currency==='0x343230'&&Number(invoice.mode)===0&&Number(invoice.acceptance)>=1&&!invoice.partialPayments&&(invoice.expiresAt==='0'||BigInt(invoice.expiresAt)>BigInt(Math.floor(this.now()/1000)));
      state=valid?'PAYMENT_SIGNATURE_REQUIRED':'MERCHANT_INVOICE_PENDING';
    } else if(['PAID','FULFILLED','COMPLETED','DISPUTED','REFUNDED'].includes(state)) {
      const payment=await source.payment(bytes32(order.paymentRef)); paymentId=order.paymentRef; receiptHash=payment.receiptHash; invoiceId=await source.invoiceId(a.order_id);
      const invoice=await source.invoice(invoiceId),paidInvoice=await source.invoicePaid(invoiceId),bound=await source.boundPayment(a.order_id);
      requireThat(bound===order.paymentRef&&payment.invoiceId===invoiceId&&wallet(payment.payer)===a.customer_scope&&wallet(payment.merchant)===a.seller&&wallet(payment.settlementAsset)===a.asset&&payment.settlementAmount===a.total&&payment.receiptHash!== '0x'+'0'.repeat(64)&&invoice.active&&invoice.merchantId===a.merchant_id&&wallet(invoice.merchant)===a.seller&&invoice.amount===a.total&&invoice.currency==='0x343230'&&Number(invoice.mode)===0&&Number(invoice.acceptance)>=1&&!invoice.partialPayments&&paidInvoice.amount===a.total&&paidInvoice.closed,'payment_correlation',503);
      const status=Number(payment.status);
      requireThat(state==='REFUNDED'?status===6&&BigInt(payment.refundedAmount)===BigInt(payment.settlementAmount)+BigInt(payment.tipAmount):[5,7].includes(status),'payment_finality',503);
      requireThat(/^[0-9]+$/.test(String(payment.refundedAmount))&&BigInt(payment.refundedAmount)<=BigInt(a.total),'refund_accounting_mismatch',503);
      refundedBaseUnits=String(payment.refundedAmount);
      // Partial Pay refund keeps canonical Market status; never release SQL stock.
      paid=state!=='REFUNDED';
    }
    this.db.run('UPDATE checkout_attempts SET state=?,payment_id=?,quote_id=? WHERE attempt_id=?',state,order.paymentRef==='0x'+'0'.repeat(64)?null:order.paymentRef,null,attemptId);
    return {attemptId,orderId:a.order_id,merchantId:a.merchant_id,seller:a.seller,buyer:a.customer_scope,asset:a.asset,total:a.total,state,paid,reserved:['CREATED','PAYMENT_SIGNATURE_REQUIRED','MERCHANT_INVOICE_PENDING','PAID','FULFILLED','DISPUTED'].includes(state),invoiceId,paymentId,receiptHash,refundedBaseUnits,paymentAllowed:state==='PAYMENT_SIGNATURE_REQUIRED',provenance:{chainId:this.chainId,blockHash:source.blockHash,blockNumber:source.blockNumber,finalized:true}};
  }
  // COM-6: projections only. Canonical Pay/Market remain financial authorities.
  async merchantOperations(actor,storeId,{offset=0,limit=25}={}) {
    integer(offset,0,Number.MAX_SAFE_INTEGER);integer(limit,1,100);
    const {store,source,merchant}=await this.access(actor,storeId,'publish');
    requireThat(wallet(merchant.controller)===wallet(actor),'forbidden',403);
    const where='FROM checkout_attempts a JOIN cart_sessions c ON c.cart_id=a.cart_id WHERE c.store_id=?';
    const count=this.db.get('SELECT COUNT(*) AS count '+where,storeId).count;
    const rows=this.db.all('SELECT a.attempt_id,a.order_id,a.listing_id,a.listing_revision,a.quantity,a.asset,a.total,a.expires_at '+where+' ORDER BY a.attempt_id LIMIT ? OFFSET ?',storeId,limit,offset);
    const items=[];
    for(const row of rows){
      const status=await this.status(actor,row.attempt_id);
      items.push({...row,...status,canonical:true,merchantId:store.merchant_id});
    }
    return {items,totalCount:count,nextOffset:offset+rows.length<count?offset+rows.length:null,source:'finalized_market_pay',provenance:{chainId:this.chainId,blockHash:source.blockHash,blockNumber:source.blockNumber,finalized:true}};
  }
  async merchantAnalytics(actor,storeId,{offset=0,limit=100}={}) {
    // Page-local ledger reconciled against finalized Market/Pay, with explicit
    // partial coverage. Never publish a paginated result as all-time revenue.
    integer(offset,0,Number.MAX_SAFE_INTEGER);integer(limit,1,100);
    const page=await this.merchantOperations(actor,storeId,{offset,limit});
    const totals={orders:0,paid:0,refunded:0,awaitingPayment:0};
    const byAsset={};
    for(const order of page.items) {
      requireThat(order.provenance.blockHash===page.provenance.blockHash&&order.provenance.blockNumber===page.provenance.blockNumber&&order.provenance.finalized,'analytics_snapshot_changed',503);
      totals.orders++;
      if(!byAsset[order.asset])byAsset[order.asset]={paidBaseUnits:'0',refundedBaseUnits:'0',netBaseUnits:'0'};
      const amounts=byAsset[order.asset];
      const refunded=BigInt(order.refundedBaseUnits??'0');
      requireThat(refunded>=0n&&refunded<=BigInt(order.total),'refund_accounting_mismatch',503);
      if(order.paid===true||order.state==='REFUNDED'){
        if(order.paid===true)totals.paid++;
        if(refunded>0n)totals.refunded++;
        amounts.paidBaseUnits=(BigInt(amounts.paidBaseUnits)+BigInt(order.total)).toString();
        amounts.refundedBaseUnits=(BigInt(amounts.refundedBaseUnits)+refunded).toString();
        amounts.netBaseUnits=(BigInt(amounts.netBaseUnits)+BigInt(order.total)-refunded).toString();
      }
      if(['CREATED','PAYMENT_SIGNATURE_REQUIRED','MERCHANT_INVOICE_PENDING'].includes(order.state))totals.awaitingPayment++;
    }
    // Count can change between pages; callers must not combine pages without
    // independently pinning/reconciling finality and local dataset generation.
    return {totals,byAsset,partial:offset>0||page.nextOffset!==null,totalCount:page.totalCount,nextOffset:page.nextOffset,offset,limit,scope:'finalized_checkout_page_only',assetBreakdownRequired:true,financialAuthority:'Pay/Market',provenance:page.provenance};
  }
  async merchantRemedy(actor,storeId,attemptId,kind,request={}) {
    requireThat(['refund','dispute'].includes(kind),'invalid_remedy');
    const {store,merchant,source}=await this.access(actor,storeId,'publish');
    requireThat(wallet(merchant.controller)===wallet(actor),'forbidden',403);
    const row=this.db.get('SELECT a.* FROM checkout_attempts a JOIN cart_sessions c ON c.cart_id=a.cart_id WHERE c.store_id=? AND a.attempt_id=?',storeId,objectID(attemptId));
    requireThat(row,'not_found',404);
    // Dispute initiation is governed by Market order identity/state, not by Pay's finalized invoice reader.
    // Avoid requiring unrelated Pay settlement proof before a Market-only eligibility decision.
    const status=kind==='refund'?await this.status(actor,attemptId):{paymentId:null};
    let proposal=null;
    if(kind==='refund') {
      requireThat(status.paid&&status.paymentId&&status.receiptHash,'refund_not_authorized',409);
      keys(request,['amount','reasonHash']);
      const payment=await source.payment(bytes32(status.paymentId));
      requireThat(payment.receiptHash===status.receiptHash&&payment.invoiceId===status.invoiceId,'refund_payment_correlation',503);
      proposal=canonicalRefundProposal({paymentId:status.paymentId,orderId:row.order_id,payer:row.customer_scope,asset:row.asset,payment,requestedAmount:request.amount,reasonHash:request.reasonHash});
      // Immutable, idempotent request. Pending requests consume the locally
      // proposed budget without claiming that Pay governance approved them.
      const requestId=this.mutate(actor,storeId,'refund_request',row.order_id,()=>{
        const existing=this.db.get('SELECT * FROM refund_requests WHERE payment_id=? AND reason_hash=? AND amount=?',status.paymentId,request.reasonHash,request.amount);
        if(existing)return existing.request_id;
        const pending=this.db.all('SELECT amount FROM refund_requests WHERE payment_id=? AND request_state=?',status.paymentId,'PENDING_GOVERNANCE').reduce((sum,item)=>sum+BigInt(item.amount),0n);
        requireThat(BigInt(proposal.amount)+pending<=BigInt(proposal.refundableMaximum)-BigInt(proposal.previousRefunded),'refund_pending_exceeds_available',409);
        const requestId=id();
        this.db.run('INSERT INTO refund_requests VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',requestId,storeId,attemptId,status.paymentId,row.order_id,proposal.amount,proposal.settlementAsset,proposal.recipient,request.reasonHash,proposal.previousRefunded,'PENDING_GOVERNANCE',this.now());
        return requestId;
      });
      proposal={...proposal,requestId,refundId:'0x'+requestId,requestState:'PENDING_GOVERNANCE',recorded:true};
    }
    else {
      keys(request,['disputeHash']);
      bytes32(request.disputeHash);
      // Only the Market V1 original buyer or seller may call disputeOrder.
      // The merchant dashboard acts for the canonical seller, never Arbitration.
      const canonical=await source.order(bytes32(row.order_id));
      requireThat(wallet(canonical.seller)===wallet(actor),'dispute_party_mismatch',403);
      requireThat(['2','3'].includes(String(canonical.status)),'dispute_not_eligible',409);
      requireThat(canonical.disputeHash===undefined||!canonical.disputeHash||canonical.disputeHash==='0x'+'0'.repeat(64),'dispute_already_committed',409);
      const requestId=this.mutate(actor,storeId,'dispute_request',row.order_id,()=>{
        const existing=this.db.get('SELECT * FROM dispute_requests WHERE order_id=?',row.order_id);
        if(existing) {
          requireThat(existing.dispute_hash===request.disputeHash&&existing.requester===wallet(actor),'dispute_conflict',409);
          return existing.request_id;
        }
        const requestId=id();
        this.db.run('INSERT INTO dispute_requests(request_id,store_id,attempt_id,order_id,dispute_hash,requester,state,created_at) VALUES(?,?,?,?,?,?,?,?)',requestId,storeId,attemptId,row.order_id,request.disputeHash,wallet(actor),'AWAITING_MARKET_WALLET_SUBMISSION',this.now());
        return requestId;
      });
      proposal={requestId,orderId:row.order_id,disputeHash:request.disputeHash,requester:wallet(actor),intent:source.intent('disputeOrder',[bytes32(row.order_id),request.disputeHash]),state:'AWAITING_MARKET_WALLET_SUBMISSION',executed:false,arbitrationCaseOpened:false};
    }
    // Governance / Arbitration alone authorizes effects. No fabricated signed transaction.
    return {kind,orderId:row.order_id,merchantId:store.merchant_id,amount:proposal?.amount??row.total,asset:row.asset,paymentId:status.paymentId??null,proposal,status:'CANONICAL_AUTHORITY_ACTION_REQUIRED',executed:false,refunded:false,disputed:false,authority:kind==='refund'?'Pay.RefundManager420':'Market.OrderRegistry420 / 420Arbitration',provenance:{chainId:this.chainId,blockHash:source.blockHash,blockNumber:source.blockNumber,finalized:true}};
  }
  async merchantArbitrationPrepare(actor,storeId,attemptId,request={}) {
    keys(request,['remedyHash']);bytes32(request.remedyHash);
    const {source,merchant}=await this.access(actor,storeId,'publish');
    requireThat(wallet(merchant.controller)===wallet(actor),'forbidden',403);
    requireThat(source.arbitration,'arbitration_unavailable',503);
    const attempt=this.db.get('SELECT a.* FROM checkout_attempts a JOIN cart_sessions c ON c.cart_id=a.cart_id WHERE c.store_id=? AND a.attempt_id=?',storeId,objectID(attemptId));
    requireThat(attempt,'not_found',404);
    const dispute=this.db.get('SELECT * FROM dispute_requests WHERE store_id=? AND order_id=?',storeId,attempt.order_id);
    requireThat(dispute&&dispute.requester===wallet(actor),'dispute_request_required',409);
    const order=await source.order(bytes32(attempt.order_id));
    requireThat(String(order.status)==='6'&&order.disputeHash===dispute.dispute_hash&&wallet(order.seller)===wallet(actor),'market_dispute_not_finalized',409);
    requireThat(wallet(order.buyer)!==wallet(actor),'arbitration_same_party',409);
    const policy=await source.arbitration.policy();
    requireThat(policy.exists===true&&policy.active===true&&wallet(policy.resolver)!=='0x'+'0'.repeat(40),'arbitration_policy_inactive',503);
    requireThat(source.arbitration.domainId===MARKET_ARBITRATION_DOMAIN&&source.arbitration.componentId===MARKET_ORIGIN_COMPONENT,'arbitration_domain_mismatch',503);
    this.mutate(actor,storeId,'arbitration_plan',attempt.order_id,()=>{
      const found=this.db.get('SELECT arbitration_remedy_hash,arbitration_case_id FROM dispute_requests WHERE request_id=?',dispute.request_id);
      requireThat(!found.arbitration_case_id,'arbitration_case_already_bound',409);
      requireThat(!found.arbitration_remedy_hash||found.arbitration_remedy_hash===request.remedyHash,'arbitration_remedy_conflict',409);
      this.db.run('UPDATE dispute_requests SET arbitration_remedy_hash=? WHERE request_id=?',request.remedyHash,dispute.request_id);
    });
    const args=[MARKET_ARBITRATION_DOMAIN,wallet(order.buyer),MARKET_ORIGIN_COMPONENT,bytes32(attempt.order_id),dispute.dispute_hash,request.remedyHash];
    return {requestId:dispute.request_id,orderId:attempt.order_id,claimant:wallet(actor),respondent:wallet(order.buyer),claimHash:dispute.dispute_hash,requestedRemedyHash:request.remedyHash,policy:{resolver:wallet(policy.resolver),appealResolver:policy.appealResolver,evidenceWindow:policy.evidenceWindow,appealWindow:policy.appealWindow,maxAppeals:policy.maxAppeals},intent:source.arbitration.intent('openCase',args),state:'ARBITRATION_WALLET_SUBMISSION_REQUIRED',caseOpened:false,remedyExecuted:false,provenance:{chainId:source.chainId,blockHash:source.blockHash,finalized:true}};
  }
  async merchantArbitrationBind(actor,storeId,attemptId,request={}) {
    keys(request,['caseId']);bytes32(request.caseId);
    const {source,merchant}=await this.access(actor,storeId,'publish');
    requireThat(wallet(merchant.controller)===wallet(actor),'forbidden',403);
    requireThat(source.arbitration,'arbitration_unavailable',503);
    const attempt=this.db.get('SELECT a.* FROM checkout_attempts a JOIN cart_sessions c ON c.cart_id=a.cart_id WHERE c.store_id=? AND a.attempt_id=?',storeId,objectID(attemptId));
    requireThat(attempt,'not_found',404);
    const dispute=this.db.get('SELECT * FROM dispute_requests WHERE store_id=? AND order_id=?',storeId,attempt.order_id);
    requireThat(dispute?.arbitration_remedy_hash&&dispute.requester===wallet(actor),'arbitration_plan_required',409);
    const order=await source.order(bytes32(attempt.order_id));
    requireThat(String(order.status)==='6'&&order.disputeHash===dispute.dispute_hash,'market_dispute_not_finalized',409);
    const caseRecord=await source.arbitration.getCase(request.caseId);
    requireThat(caseRecord.exists===true&&wallet(caseRecord.claimant)===wallet(actor)&&wallet(caseRecord.respondent)===wallet(order.buyer)&&caseRecord.domainId===MARKET_ARBITRATION_DOMAIN&&caseRecord.originComponentId===MARKET_ORIGIN_COMPONENT&&caseRecord.originObjectId===attempt.order_id&&caseRecord.claimHash===dispute.dispute_hash&&caseRecord.requestedRemedyHash===dispute.arbitration_remedy_hash,'arbitration_case_mismatch',503);
    this.mutate(actor,storeId,'arbitration_bind',attempt.order_id,()=>{
      const existing=this.db.get('SELECT arbitration_case_id FROM dispute_requests WHERE request_id=?',dispute.request_id);
      requireThat(!existing.arbitration_case_id||existing.arbitration_case_id===request.caseId,'arbitration_case_conflict',409);
      this.db.run('UPDATE dispute_requests SET arbitration_case_id=? WHERE request_id=?',request.caseId,dispute.request_id);
    });
    return {orderId:attempt.order_id,caseId:request.caseId,state:CASE_STATES[Number(caseRecord.state)]??'UNKNOWN',finalized:source.finalized,arbitrationCaseOpened:true,remedyExecuted:false};
  }
  async merchantArbitrationAction(actor,storeId,attemptId,action,request={}) {
    requireThat(['submitEvidence','appeal'].includes(action),'arbitration_action_invalid');
    const {source,merchant}=await this.access(actor,storeId,'publish');
    requireThat(wallet(merchant.controller)===wallet(actor),'forbidden',403);
    requireThat(source.arbitration,'arbitration_unavailable',503);
    const attempt=this.db.get('SELECT a.* FROM checkout_attempts a JOIN cart_sessions c ON c.cart_id=a.cart_id WHERE c.store_id=? AND a.attempt_id=?',storeId,objectID(attemptId));
    requireThat(attempt,'not_found',404);
    const dispute=this.db.get('SELECT * FROM dispute_requests WHERE store_id=? AND order_id=?',storeId,attempt.order_id);
    requireThat(dispute?.arbitration_case_id&&dispute.requester===wallet(actor),'arbitration_case_unbound',409);
    const caseRecord=await source.arbitration.getCase(dispute.arbitration_case_id);
    requireThat(caseRecord.exists===true&&wallet(caseRecord.claimant)===wallet(actor)&&caseRecord.domainId===MARKET_ARBITRATION_DOMAIN&&caseRecord.originComponentId===MARKET_ORIGIN_COMPONENT&&caseRecord.originObjectId===attempt.order_id&&caseRecord.claimHash===dispute.dispute_hash&&caseRecord.requestedRemedyHash===dispute.arbitration_remedy_hash,'arbitration_case_mismatch',503);
    let args;
    if(action==='submitEvidence'){
      keys(request,['evidenceHash']);bytes32(request.evidenceHash);
      requireThat(Number(caseRecord.state)===1&&BigInt(caseRecord.evidenceDeadline)>=BigInt(source.blockTimestamp),'arbitration_evidence_closed',409);
      args=[dispute.arbitration_case_id,request.evidenceHash];
    }else{
      keys(request,[]);
      requireThat(Number(caseRecord.state)===2&&BigInt(caseRecord.appealDeadline)>=BigInt(source.blockTimestamp)&&Number(caseRecord.round)<Number(caseRecord.maxAppeals),'arbitration_appeal_closed',409);
      args=[dispute.arbitration_case_id];
    }
    return {caseId:dispute.arbitration_case_id,action,requester:wallet(actor),intent:source.arbitration.intent(action,args),executed:false,remedyExecuted:false,provenance:{chainId:source.chainId,blockHash:source.blockHash,finalized:true}};
  }
  async merchantDisputes(actor,storeId) {
    const {source,merchant}=await this.access(actor,storeId,'publish');
    requireThat(wallet(merchant.controller)===wallet(actor),'forbidden',403);
    const rows=this.db.all('SELECT * FROM dispute_requests WHERE store_id=? ORDER BY created_at,request_id LIMIT 50',storeId);
    const items=[];
    for(const row of rows){
      const order=await source.order(bytes32(row.order_id));
      const marketStatus=String(order.status);
      const onChain=marketStatus==='6'||marketStatus==='7';
      const matched=onChain&&order.disputeHash===row.dispute_hash;
      requireThat(!onChain||matched,'dispute_commitment_mismatch',503);
      let caseSummary=null,arbitrationRulingFinalized=false;
      if(row.arbitration_case_id){
        requireThat(matched&&source.arbitration,'arbitration_binding_unavailable',503);
        const record=await source.arbitration.getCase(row.arbitration_case_id);
        requireThat(record.exists===true&&wallet(record.claimant)===wallet(row.requester)&&wallet(record.respondent)===wallet(order.buyer)&&record.domainId===MARKET_ARBITRATION_DOMAIN&&record.originComponentId===MARKET_ORIGIN_COMPONENT&&record.originObjectId===row.order_id&&record.claimHash===row.dispute_hash&&record.requestedRemedyHash===row.arbitration_remedy_hash,'arbitration_case_mismatch',503);
        const state=CASE_STATES[Number(record.state)];
        requireThat(state&&state!=='NONE','arbitration_state_invalid',503);
        let ruling=null;
        if(['RULED','FINALIZED'].includes(state)){
          ruling=await source.arbitration.getRuling(row.arbitration_case_id,Number(record.round));
          const selected=Number(record.round)===0?record.resolver:record.appealResolver;
          requireThat(ruling.exists===true&&wallet(ruling.resolver)===wallet(selected)&&ruling.rulingHash!=='0x'+'0'.repeat(64)&&ruling.remedyCommitment!=='0x'+'0'.repeat(64),'arbitration_ruling_invalid',503);
          arbitrationRulingFinalized=state==='FINALIZED';
        }
        caseSummary={caseId:row.arbitration_case_id,caseState:state,round:Number(record.round),evidenceDeadline:record.evidenceDeadline,appealDeadline:record.appealDeadline,claimant:record.claimant,respondent:record.respondent,ruling:ruling?{outcomeCode:Number(ruling.outcomeCode),rulingHash:ruling.rulingHash,remedyCommitment:ruling.remedyCommitment,finalized:arbitrationRulingFinalized}:null};
      }
      const state=caseSummary?(arbitrationRulingFinalized?'ARBITRATION_FINALIZED_REMEDY_NOT_EXECUTED':'ARBITRATION_'+caseSummary.caseState):matched?(marketStatus==='7'?'MARKET_REFUNDED_NO_ARBITRATION_CASE':'MARKET_DISPUTE_FINALIZED'):'AWAITING_MARKET_WALLET_SUBMISSION';
      items.push({requestId:row.request_id,attemptId:row.attempt_id,orderId:row.order_id,disputeHash:row.dispute_hash,requester:row.requester,state,marketDisputed:matched,marketStatus,arbitrationCaseOpened:!!caseSummary,arbitrationRulingFinalized,arbitrationCase:caseSummary,remedyExecuted:false});
    }
    return {items,partial:rows.length===50,authority:source.arbitration?'420Market V1 + ProtocolRegistry-approved independent 420Arbitration':'420Market V1; 420Arbitration unverified/unavailable',provenance:{chainId:this.chainId,blockHash:source.blockHash,blockNumber:source.blockNumber,finalized:true}};
  }
  async merchantRefunds(actor,storeId) {
    const {source,merchant}=await this.access(actor,storeId,'publish');
    requireThat(wallet(merchant.controller)===wallet(actor),'forbidden',403);
    const rows=this.db.all('SELECT * FROM refund_requests WHERE store_id=? ORDER BY created_at,request_id LIMIT 50',storeId);
    const items=[];
    for(const request of rows) {
      const refundId='0x'+request.request_id;
      let executed=false,marketReported=false,state='PENDING_GOVERNANCE_OR_UNVERIFIED';
      if(source.fundedRefund) {
        const proof=await source.fundedRefund(refundId);
        if(proof.executed) {
          const evidence=proof.record;
          requireThat(evidence.paymentId===request.payment_id&&wallet(evidence.settlementAsset)===wallet(request.asset)&&wallet(evidence.recipient)===wallet(request.recipient)&&BigInt(evidence.amount)===BigInt(request.amount)&&evidence.reasonHash===request.reason_hash,'refund_proof_mismatch',503);
          const payment=await source.payment(bytes32(request.payment_id));
          requireThat(BigInt(payment.refundedAmount)>=BigInt(request.payment_refunded_at_request)+BigInt(request.amount),'refund_pay_correlation',503);
          executed=true;
          const fullyRefunded=BigInt(payment.refundedAmount)===BigInt(payment.settlementAmount)+BigInt(payment.tipAmount);
          if(fullyRefunded) {
            const market=await source.order(bytes32(request.order_id));
            marketReported=Number(market.status)===7&&source.marketRefundReported?await source.marketRefundReported(request.order_id):false;
            state=marketReported?'FUNDED_REFUND_MARKET_RECONCILED':'FUNDS_RETURNED_MARKET_REPORT_PENDING';
          } else state='PARTIAL_FUNDED_REFUND_FINALIZED';
        }
      }
      items.push({requestId:request.request_id,refundId,paymentId:request.payment_id,orderId:request.order_id,amount:request.amount,asset:request.asset,recipient:request.recipient,reasonHash:request.reason_hash,state,fundsReturned:executed,marketReported,canonicalPayoutProof:executed,requestRecorded:true});
    }
    return {items,partial:rows.length===50,refundAuthority:source.fundedRefund?'FINALIZED_REFUND_MANAGER':'UNBOUND_REFUND_MANAGER',provenance:{chainId:this.chainId,blockHash:source.blockHash,blockNumber:source.blockNumber,finalized:true}};
  }
  async merchantNotificationPreferences(actor,storeId,request=null) {
    const {merchant}=await this.access(actor,storeId,'publish');
    requireThat(wallet(merchant.controller)===wallet(actor),'forbidden',403);
    if(request!==null){
      keys(request,['enabled']);
      requireThat(typeof request.enabled==='boolean','invalid_notification_consent');
      this.mutate(actor,storeId,'notification_preferences',storeId,()=>{
        const prior=this.db.get('SELECT controller FROM commerce_notification_preferences WHERE store_id=?',storeId);
        // A change of canonical merchant controller invalidates the old subscription.
        if(prior&&prior.controller!==wallet(actor))this.db.run('DELETE FROM commerce_notification_feed WHERE store_id=?',storeId);
        this.db.run('INSERT INTO commerce_notification_preferences(store_id,controller,enabled,updated_at) VALUES(?,?,?,?) ON CONFLICT(store_id) DO UPDATE SET controller=excluded.controller,enabled=excluded.enabled,updated_at=excluded.updated_at',storeId,wallet(actor),request.enabled?1:0,this.now());
        if(!request.enabled)this.db.run('DELETE FROM commerce_notification_feed WHERE store_id=?',storeId);
      });
    }
    const row=this.db.get('SELECT * FROM commerce_notification_preferences WHERE store_id=?',storeId);
    return {enabled:!!(row&&row.controller===wallet(actor)&&row.enabled===1),channels:['in_app'],externalDelivery:'NOT_CONFIGURED',promotionalConsent:false,source:'420Market finalized shared Indexer events',authority:'NONCANONICAL_LOCAL_FEED'};
  }
  async merchantNotifications(actor,storeId,{limit=25,cursor=null}={}) {
    const {merchant,source}=await this.access(actor,storeId,'publish');
    requireThat(wallet(merchant.controller)===wallet(actor),'forbidden',403);
    integer(limit,1,100);
    if(cursor!==null)objectID(cursor);
    const setting=this.db.get('SELECT * FROM commerce_notification_preferences WHERE store_id=?',storeId);
    if(!setting||setting.controller!==wallet(actor)||setting.enabled!==1){
      return {enabled:false,items:[],nextCursor:null,delivery:'NOT_CONFIGURED',authoritative:false,provenance:{chainId:this.chainId,blockHash:source.blockHash,finalized:true}};
    }
    // Only finalized canonical events bound to this merchant's actual checkout orders.
    // Rebuildable feed; a chain reorg or controller change cannot confer authority.
    const events=this.db.all("SELECT DISTINCT e.event_id,e.payload,e.block_hash,e.block_number,e.finality FROM event_inbox e JOIN checkout_attempts a ON json_extract(e.payload,'$.fields.orderId')=a.order_id JOIN cart_sessions c ON c.cart_id=a.cart_id WHERE c.store_id=? AND e.canonical=1 AND e.finality='finalized' AND e.topic LIKE '420Market.%' ORDER BY e.block_number,e.event_id",storeId);
    const kinds=new Set(['OrderCreated','PaymentRecorded','FulfillmentRecorded','OrderCompleted','OrderCancelled','OrderDisputed','RefundRecorded']);
    this.db.transaction(()=>{
      // Previously visible evidence may be retracted or superseded; remove invalid rows.
      this.db.run("DELETE FROM commerce_notification_feed WHERE store_id=? AND event_id NOT IN (SELECT event_id FROM event_inbox WHERE canonical=1 AND finality='finalized')",storeId);
      for(const event of events){
        const row=JSON.parse(event.payload);
        if(!kinds.has(row.eventName))continue;
        this.db.run('INSERT OR IGNORE INTO commerce_notification_feed(store_id,event_id,notification_id,operation,created_at) VALUES(?,?,?,?,?)',storeId,event.event_id,hash(event.event_id),row.eventName,this.now());
      }
    });
    const cursorRow=cursor?this.db.get("SELECT e.block_number,f.event_id FROM commerce_notification_feed f JOIN event_inbox e ON e.event_id=f.event_id WHERE f.store_id=? AND f.notification_id=? AND e.canonical=1 AND e.finality='finalized'",storeId,cursor):null;
    requireThat(cursor===null||cursorRow,'invalid_notification_cursor');
    const pageRows=this.db.all("SELECT f.*,e.payload,e.block_hash,e.block_number FROM commerce_notification_feed f JOIN event_inbox e ON e.event_id=f.event_id WHERE f.store_id=? AND e.canonical=1 AND e.finality='finalized' AND (? IS NULL OR e.block_number<? OR (e.block_number=? AND f.event_id<?)) ORDER BY e.block_number DESC,f.event_id DESC LIMIT ?",storeId,cursorRow?.block_number??null,cursorRow?.block_number??null,cursorRow?.block_number??null,cursorRow?.event_id??null,limit+1);
    const more=pageRows.length>limit,page=pageRows.slice(0,limit);
    const items=page.map(row=>{
      const event=JSON.parse(row.payload);
      return {id:row.notification_id,orderId:event.fields.orderId,eventName:row.operation,read:row.read_at!==null,finality:'finalized',chainId:this.chainId,blockHash:row.block_hash,blockNumber:row.block_number,transactionHash:event.provenance.transactionHash,logIndex:event.provenance.logIndex,authoritative:false};
    });
    return {enabled:true,items,nextCursor:more?page.at(-1).notification_id:null,delivery:'IN_APP_PRESENTATION_ONLY',authoritative:false,provenance:{chainId:this.chainId,blockHash:source.blockHash,finalized:true}};
  }
  async merchantNotificationRead(actor,storeId,eventId,request) {
    keys(request,['read']);requireThat(typeof request.read==='boolean','invalid_read_state');
    const {merchant}=await this.access(actor,storeId,'publish');
    requireThat(wallet(merchant.controller)===wallet(actor),'forbidden',403);
    objectID(eventId);
    const row=this.db.get("SELECT f.event_id FROM commerce_notification_feed f JOIN commerce_notification_preferences p ON p.store_id=f.store_id JOIN event_inbox e ON e.event_id=f.event_id WHERE f.store_id=? AND f.notification_id=? AND p.enabled=1 AND p.controller=? AND e.canonical=1 AND e.finality='finalized'",storeId,eventId,wallet(actor));
    requireThat(row,'notification_not_found',404);
    this.mutate(actor,storeId,'notification_read',eventId,()=>this.db.run('UPDATE commerce_notification_feed SET read_at=? WHERE store_id=? AND event_id=?',request.read?this.now():null,storeId,row.event_id));
    return {id:eventId,read:request.read,authoritative:false};
  }
  async merchantIntegrations(actor,storeId) {
    const {store,merchant,source}=await this.access(actor,storeId,'publish');
    requireThat(wallet(merchant.controller)===wallet(actor),'forbidden',403);
    const display=source.merchantDisplay?await source.merchantDisplay(merchant):{identity:{status:'NOT_VERIFIED',authority:'420Identity/420Verify'},names:{status:'NOT_VERIFIED',authority:'420Names'}};
    return {merchantId:store.merchant_id,chainId:this.chainId,identity:display.identity,names:display.names,notifications:{status:'LOCAL_OPT_IN_FEED_ONLY',externalDelivery:'NOT_CONFIGURED',authority:'420Notifications',sideEffects:false},search:{status:'LOCAL_PUBLIC_CATALOGUE',authority:'420Commerce projection; 420Search external integration unverified'},analytics:{status:'LOCAL_FINALIZED_PROJECTION',authority:'420Analytics external integration unverified'},provenance:{chainId:this.chainId,blockHash:source.blockHash,blockNumber:source.blockNumber,finalized:true}};
  }
  async putDelivery(actor,attemptId,input) {
    keys(input,['address','contact']); text(input.address,2000); text(input.contact,200); actor=wallet(actor);
    const a=this.db.get('SELECT a.*,c.store_id FROM checkout_attempts a JOIN cart_sessions c ON c.cart_id=a.cart_id WHERE attempt_id=? AND a.customer_scope=?',objectID(attemptId),actor); requireThat(a,'not_found',404);
    const status=await this.status(actor,attemptId); requireThat(status.reserved,'unreserved_delivery',409);
    const encrypted=encryptDelivery(this.deliveryKey,a.order_id,a.store_id,JSON.stringify(input));
    return this.mutate(actor,a.store_id,'delivery_write',a.order_id,() => this.db.run('INSERT INTO customer_delivery VALUES(?,?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET encrypted_payload=excluded.encrypted_payload,purge_after=excluded.purge_after',a.order_id,a.store_id,encrypted,'buyer-and-canonical-controller',this.now()+30*86400000));
  }
  async readDelivery(actor,attemptId) {
    actor=wallet(actor); const a=this.db.get('SELECT a.*,c.store_id FROM checkout_attempts a JOIN cart_sessions c ON c.cart_id=a.cart_id WHERE attempt_id=?',objectID(attemptId)); requireThat(a,'not_found',404);
    if(actor!==a.customer_scope) await this.access(actor,a.store_id,'delivery');
    else await this.source();
    const row=this.db.get('SELECT * FROM customer_delivery WHERE order_id=? AND purge_after>?',a.order_id,this.now()); requireThat(row,'not_found',404);
    const result=JSON.parse(decryptDelivery(this.deliveryKey,a.order_id,a.store_id,Buffer.from(row.encrypted_payload)));
    this.db.audit(actor,a.store_id,'delivery_read',a.order_id,this.now()); return result;
  }
  purge() { return this.db.transaction(()=>{const n=this.db.run('DELETE FROM customer_delivery WHERE purge_after<=?',this.now()).changes; this.db.run('DELETE FROM auth_nonces WHERE expires_at<=?',this.now()); this.db.audit('retention',null,'delivery_purge',String(n),this.now());return n;}); }
}

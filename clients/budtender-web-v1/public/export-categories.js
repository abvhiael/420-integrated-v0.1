export const EXPORT_PREFIXES=Object.freeze({"env":"env_","fixture":"fixture_","prop":"prop_","plant":"plant_","sign":"sign_","light":"light_","decal":"decal_"});
export function validateExportCatalog(catalog,sourceInventory){
 if(catalog?.schema_version!==1||catalog.phase!=="3.19"||JSON.stringify(catalog.prefixes)!==JSON.stringify(EXPORT_PREFIXES))throw Error("bad contract");
 if(!Array.isArray(sourceInventory)||!Array.isArray(catalog.assets)||catalog.asset_count!==catalog.assets.length||catalog.assets.length!==sourceInventory.length)throw Error("coverage mismatch");
 const seenSource=new Set(),seenOutput=new Set();
 for(const a of catalog.assets){
  if(!Object.hasOwn(EXPORT_PREFIXES,a.category)||typeof a.source!=="string"||!/^assets\/budtender\/phase-3\.(?:[1-9]|1[0-7])\/[a-z0-9_]+\.png$/.test(a.source))throw Error("unsafe source");
  if(typeof a.export_name!=="string"||!a.export_name.startsWith(EXPORT_PREFIXES[a.category])||!/^[a-z0-9_]+\.png$/.test(a.export_name))throw Error("unsafe export name");
  if(seenSource.has(a.source)||seenOutput.has(a.export_name))throw Error("duplicate export");
  if(!Number.isSafeInteger(a.bytes)||a.bytes<=0)throw Error("invalid byte size");
  if((a.source_sha256? !/^[a-f0-9]{64}$/.test(a.source_sha256):!/^[a-f0-9]{40}$/.test(a.git_blob_sha??"")))throw Error("invalid source digest");
  seenSource.add(a.source);seenOutput.add(a.export_name);
 }
 for(const source of sourceInventory)if(!seenSource.has(source))throw Error("missing source "+source);
 return true;
}

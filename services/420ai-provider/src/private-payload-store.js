import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson420 } from "./canonical-json.js";

function idFile(id) {
  return createHash("sha256").update(String(id)).digest("hex") + ".json";
}
function aadBytes(aad) { return Buffer.from(canonicalJson420(aad ?? {})); }
function aadHash(aad) { return createHash("sha256").update(aadBytes(aad)).digest("hex"); }

export class MemoryBlobStore420 {
  constructor() { this.values = new Map(); }
  async put(id, value) { this.values.set(id, structuredClone(value)); }
  async get(id) { return this.values.has(id) ? structuredClone(this.values.get(id)) : null; }
  async delete(id) { return this.values.delete(id); }
  async entries() { return [...this.values.entries()].map(([id,value])=>[id,structuredClone(value)]); }
}

export class FileBlobStore420 {
  constructor(directory) { if (!directory) throw new TypeError("directory required"); this.directory=directory; }
  async put(id,value) {
    await mkdir(this.directory,{recursive:true});
    const path=join(this.directory,idFile(id)), tmp=path+".tmp";
    await writeFile(tmp,JSON.stringify(value),{mode:0o600});
    await rename(tmp,path);
  }
  async get(id) {
    try { return JSON.parse(await readFile(join(this.directory,idFile(id)),"utf8")); }
    catch (e) { if (e?.code==="ENOENT") return null; throw e; }
  }
  async delete(id) {
    try { await unlink(join(this.directory,idFile(id))); return true; }
    catch (e) { if (e?.code==="ENOENT") return false; throw e; }
  }
  async entries() { throw new Error("FileBlobStore420 entries require an external inventory; enumerate payload IDs from runtime state"); }
}

export class EncryptedPayloadStore420 {
  constructor({ key, blobStore, now=()=>Date.now(), maxRetentionMs=24*60*60*1000 }={}) {
    if (!Buffer.isBuffer(key) || key.length!==32) throw new TypeError("32-byte encryption key required");
    if (!blobStore?.put || !blobStore?.get || !blobStore?.delete) throw new TypeError("blobStore required");
    if (!Number.isSafeInteger(maxRetentionMs) || maxRetentionMs<=0) throw new TypeError("maxRetentionMs invalid");
    this.key=Buffer.from(key); this.blobStore=blobStore; this.now=now; this.maxRetentionMs=maxRetentionMs;
  }
  async put(id, plaintext, { aad={}, expiresAt }={}) {
    if (!id) throw new TypeError("payload id required");
    const bytes=Buffer.isBuffer(plaintext)?Buffer.from(plaintext):Buffer.from(plaintext ?? "");
    const now=this.now();
    if (!Number.isSafeInteger(expiresAt) || expiresAt<=now || expiresAt-now>this.maxRetentionMs) throw new Error("invalid retention window");
    const nonce=randomBytes(12), cipher=createCipheriv("aes-256-gcm",this.key,nonce);
    cipher.setAAD(aadBytes(aad));
    const ciphertext=Buffer.concat([cipher.update(bytes),cipher.final()]);
    const record={version:1,algorithm:"AES-256-GCM",nonce:nonce.toString("base64"),tag:cipher.getAuthTag().toString("base64"),ciphertext:ciphertext.toString("base64"),aadHash:aadHash(aad),createdAt:now,expiresAt};
    await this.blobStore.put(id,record);
    bytes.fill(0);
    return {id,expiresAt,aadHash:record.aadHash};
  }
  async get(id,{aad={}}={}) {
    const record=await this.blobStore.get(id);
    if (!record) throw new Error("private payload unavailable");
    if (record.expiresAt<=this.now()) { await this.blobStore.delete(id); throw new Error("private payload expired"); }
    if (record.aadHash!==aadHash(aad)) throw new Error("private payload scope mismatch");
    const decipher=createDecipheriv("aes-256-gcm",this.key,Buffer.from(record.nonce,"base64"));
    decipher.setAAD(aadBytes(aad)); decipher.setAuthTag(Buffer.from(record.tag,"base64"));
    return Buffer.concat([decipher.update(Buffer.from(record.ciphertext,"base64")),decipher.final()]);
  }
  async delete(id){ return this.blobStore.delete(id); }
  async purgeExpired(ids=[]) {
    let purged=0;
    for (const id of ids) {
      const r=await this.blobStore.get(id);
      if (r && r.expiresAt<=this.now()) { await this.blobStore.delete(id); purged+=1; }
    }
    return purged;
  }
}

import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";

export class MemoryRuntimeStateStore420 {
  constructor(seed=[]) { this.jobs=new Map(seed.map((x)=>[x.jobId,structuredClone(x)])); }
  async get(jobId){return this.jobs.has(jobId)?structuredClone(this.jobs.get(jobId)):null;}
  async put(state){this.jobs.set(state.jobId,structuredClone(state));return structuredClone(state);}
  async list(){return [...this.jobs.values()].map((value)=>structuredClone(value));}
}

export class FileRuntimeStateStore420 {
  constructor(path){if(!path)throw new TypeError("state path required");this.path=path;}
  async _read(){try{return JSON.parse(await readFile(this.path,"utf8"));}catch(e){if(e?.code==="ENOENT")return {version:1,jobs:{}};throw e;}}
  async _write(doc){await mkdir(dirname(this.path),{recursive:true});const tmp=this.path+".tmp";await writeFile(tmp,JSON.stringify(doc),{mode:0o600});await rename(tmp,this.path);}
  async get(jobId){const d=await this._read();return d.jobs[jobId]?structuredClone(d.jobs[jobId]):null;}
  async put(state){const d=await this._read();d.jobs[state.jobId]=structuredClone(state);await this._write(d);return structuredClone(state);}
  async list(){const d=await this._read();return Object.values(d.jobs).map(structuredClone);}
}

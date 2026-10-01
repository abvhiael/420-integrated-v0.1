import fs from 'node:fs';
import path from 'node:path';
export class FileProjectionStore{
  constructor(file){
    if(typeof file!=='string'||!file)throw new Error('projection store file required');
    this.file=file;this.data={schema:'420-exchange-read-store-v1',records:{},observations:{}};
  }
  open(){
    fs.mkdirSync(path.dirname(this.file),{recursive:true});
    if(fs.existsSync(this.file)){const parsed=JSON.parse(fs.readFileSync(this.file,'utf8'));if(parsed?.schema!=='420-exchange-read-store-v1')throw new Error('projection store schema mismatch');this.data=parsed;}
    else this.flush();
    return this;
  }
  flush(){const tmp=this.file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(this.data,null,2)+'\n',{mode:0o600});fs.renameSync(tmp,this.file);}
  health(){fs.accessSync(path.dirname(this.file),fs.constants.R_OK|fs.constants.W_OK);return {ok:true};}
  values(){return Object.values(this.data.records);}
  reconcile(records,{observationKey='exchange'}={}){
    const current=new Set(records.map(r=>r.recordId));
    const previous=new Set(this.data.observations[observationKey]??[]);
    for(const id of previous)if(!current.has(id)&&this.data.records[id])this.data.records[id]={...this.data.records[id],active:false,canonicality:'orphaned'};
    for(const record of records){
      const old=this.data.records[record.recordId];
      this.data.records[record.recordId]=old?{...old,...record}:{...record};
      if(record.semanticKey){
        for(const candidate of Object.values(this.data.records)){
          if(candidate.recordId!==record.recordId&&candidate.semanticKey===record.semanticKey&&candidate.active!==false){
            candidate.active=false;candidate.canonicality='orphaned';candidate.replacedBy=record.recordId;
          }
        }
      }
    }
    this.data.observations[observationKey]=[...current];this.flush();return this.values();
  }
  close(){this.flush();}
}
export class MemoryProjectionStore extends FileProjectionStore{
  constructor(){super('/memory');this.data={schema:'420-exchange-read-store-v1',records:{},observations:{}};}
  open(){return this;}flush(){}health(){return {ok:true};}close(){}
}

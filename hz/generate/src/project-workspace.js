import { createHash } from "node:crypto";
import { digest420 } from "./schema.js";
import { GenerationError420 } from "./errors.js";

const DAY=24*60*60*1000;
export const PROJECT_VISIBILITY_420="PRIVATE";
export const PROJECT_STATUS_420=Object.freeze(["ACTIVE","ARCHIVED","DELETED"]);
export const TAKE_STATUS_420=Object.freeze(["COMPLETE","INCOMPLETE","FAILED","CANCELLED"]);
const clone=(v)=>structuredClone(v);
const req=(v,n)=>{if(v===undefined||v===null||v==="")throw new GenerationError420("INVALID_REQUEST",n+" is required");return v;};
const clean=(v,n,max=4096)=>{if(v===null||v===undefined)return null;if(typeof v!=="string")throw new GenerationError420("INVALID_REQUEST",n+" must be a string");const x=v.trim();if(x.length>max)throw new GenerationError420("INVALID_REQUEST",n+" is too long");return x||null;};
const bytesOf=(v)=>Buffer.byteLength(typeof v==="string"?v:JSON.stringify(v));
const sha256=(v)=>createHash("sha256").update(v).digest("hex");

export class DeterministicPrivateStorage420 {
  constructor(){this.objects=new Map();this.tombstones=new Set();}
  put({accountRef,projectId,kind,label,bytes,content,idempotencyKey}){
    req(accountRef,"accountRef");req(projectId,"projectId");req(kind,"kind");req(idempotencyKey,"idempotencyKey");
    const body=Buffer.isBuffer(content)?content:Buffer.from(typeof content==="string"?content:JSON.stringify(content));
    const size=bytes??body.length;
    if(size!==body.length)throw new GenerationError420("INTEGRITY_MISMATCH","declared storage bytes differ from payload");
    const integrity="sha256:"+sha256(body);
    const storageRef="hzprivate:"+digest420({accountRef,projectId,kind,label:label??null,integrity,idempotencyKey});
    const existing=this.objects.get(storageRef);
    if(existing){
      if(existing.integrity!==integrity||existing.bytes!==size)throw new GenerationError420("REPLAY_CONFLICT","storage idempotency conflict");
      return clone(existing);
    }
    if(this.tombstones.has(storageRef))throw new GenerationError420("REPLAY_CONFLICT","deleted storage identity cannot be resurrected");
    const object=Object.freeze({storageRef,accountRef,projectId,kind,label:label??null,integrity,bytes:size,storageClass:"HZ_PRIVATE_PRIMARY",indexable:false});
    this.objects.set(storageRef,{...object,body});
    return clone(object);
  }
  get(storageRef){
    if(this.tombstones.has(storageRef))throw new GenerationError420("INVALID_REQUEST","storage object deleted");
    const x=this.objects.get(storageRef);if(!x)throw new GenerationError420("INVALID_REQUEST","storage object not found");
    if("sha256:"+sha256(x.body)!==x.integrity)throw new GenerationError420("INTEGRITY_MISMATCH","stored object integrity mismatch");
    return {metadata:clone({...x,body:undefined}),content:Buffer.from(x.body)};
  }
  delete(storageRef){
    this.objects.delete(storageRef);this.tombstones.add(storageRef);return {storageRef,tombstoned:true};
  }
  has(storageRef){return this.objects.has(storageRef)&&!this.tombstones.has(storageRef);}
}

function artifactFromProvider(a){
  if(!a||typeof a!=="object"||!a.kind||!a.storageRef||!a.integrity)return null;
  return Object.freeze({kind:String(a.kind),label:a.label??null,sourceStorageRef:String(a.storageRef),sourceIntegrity:String(a.integrity)});
}
function projectSummary(p){
  return {
    projectId:p.projectId,ownerRef:p.ownerRef,title:p.title,status:p.status,visibility:p.visibility,indexable:false,
    createdAt:p.createdAt,updatedAt:p.updatedAt,lastActivityAt:p.lastActivityAt,selectedTakeId:p.selectedTakeId,
    favoriteTakeIds:[...p.favoriteTakeIds],versionHeadId:p.versionHeadId,bytes:p.usage.privatePrimaryBytes
  };
}

export class ProjectWorkspace420 {
  constructor({
    storage=new DeterministicPrivateStorage420(),
    now=()=>Date.now(),
    accountQuotaBytes=1024*1024*1024,
    projectQuotaBytes=512*1024*1024
  }={}){
    this.storage=storage;this.now=now;
    this.accountQuotaBytes=Number(accountQuotaBytes);this.projectQuotaBytes=Number(projectQuotaBytes);
    if(!Number.isSafeInteger(this.accountQuotaBytes)||this.accountQuotaBytes<=0)throw new GenerationError420("INVALID_REQUEST","accountQuotaBytes invalid");
    if(!Number.isSafeInteger(this.projectQuotaBytes)||this.projectQuotaBytes<=0)throw new GenerationError420("INVALID_REQUEST","projectQuotaBytes invalid");
    this.projects=new Map();this.deletedProjectIds=new Set();this.exports=new Map();
  }

  createProject({ownerRef,title="Untitled project",lyricsDraft="",metadataDraft={}}){
    const now=this.now(),owner=String(req(ownerRef,"ownerRef"));
    const seed={ownerRef:owner,title:clean(title,"title",256)??"Untitled project",createdAt:now,nonce:this.projects.size};
    const projectId="hzproject:"+digest420(seed);
    if(this.deletedProjectIds.has(projectId))throw new GenerationError420("REPLAY_CONFLICT","deleted project identity cannot be reused");
    const p={
      schemaVersion:1,projectId,ownerRef:owner,title:seed.title,status:"ACTIVE",visibility:"PRIVATE",indexable:false,
      createdAt:now,updatedAt:now,lastActivityAt:now,archivedAt:null,archiveExpiresAt:null,deletedAt:null,
      takes:new Map(),favoriteTakeIds:new Set(),selectedTakeId:null,versions:new Map(),versionHeadId:null,
      usage:{privatePrimaryBytes:0,archivedBytes:0,publishedExternalReferenceBytes:0,objectCount:0},
      storageRefs:new Set(),tombstone:false
    };
    this.projects.set(projectId,p);
    this.#appendVersion(p,"PROJECT_CREATED",{title:p.title,lyricsDraft:String(lyricsDraft??""),metadataDraft:clone(metadataDraft??{})});
    return this.getProject(projectId,owner);
  }

  getProject(projectId,actorRef){
    const p=this.#project(projectId,actorRef);
    return Object.freeze({
      ...projectSummary(p),
      lyricsDraft:this.#headPayload(p).lyricsDraft??"",
      metadataDraft:clone(this.#headPayload(p).metadataDraft??{}),
      takes:[...p.takes.values()].map(clone),
      versions:[...p.versions.values()].map(clone),
      storageRefs:[...p.storageRefs]
    });
  }

  listProjects(actorRef){
    return [...this.projects.values()].filter(p=>p.ownerRef===actorRef&&p.status!=="DELETED").map(projectSummary);
  }

  publicIndexRecords(){return [];}

  updateDraft(projectId,actorRef,{lyricsDraft,metadataDraft,title}={}){
    const p=this.#active(projectId,actorRef);
    const prev=this.#headPayload(p);
    if(title!==undefined)p.title=clean(title,"title",256)??p.title;
    const payload={
      title:p.title,
      lyricsDraft:lyricsDraft===undefined?(prev.lyricsDraft??""):String(lyricsDraft),
      metadataDraft:metadataDraft===undefined?clone(prev.metadataDraft??{}):clone(metadataDraft??{})
    };
    this.#appendVersion(p,"DRAFT_UPDATED",payload);
    this.#touch(p);return this.getProject(projectId,actorRef);
  }

  recordGeneration(projectId,actorRef,job,{saveArtifacts=true}={}){
    const p=this.#active(projectId,actorRef);req(job?.jobId,"job.jobId");
    const status=job.state==="SUCCEEDED"?"COMPLETE":job.state==="FAILED"?"FAILED":job.state==="CANCELLED"?"CANCELLED":"INCOMPLETE";
    const takeId="hztake:"+digest420({projectId,jobId:job.jobId,requestDigest:job.requestDigest,status});
    if(p.takes.has(takeId))return clone(p.takes.get(takeId));
    const artifacts=[];
    if(status==="COMPLETE"&&Array.isArray(job.outputManifest?.artifacts)){
      const sources=job.outputManifest.artifacts.map(artifactFromProvider).filter(Boolean);
      if(saveArtifacts){
        const pending=sources.map(source=>({source,payload:JSON.stringify({sourceStorageRef:source.sourceStorageRef,sourceIntegrity:source.sourceIntegrity,kind:source.kind,label:source.label})}));
        this.#assertQuota(p,pending.reduce((n,x)=>n+bytesOf(x.payload),0));
        for(const {source,payload} of pending){
          const stored=this.storage.put({accountRef:p.ownerRef,projectId,kind:source.kind,label:source.label,content:payload,idempotencyKey:takeId+":"+source.kind+":"+(source.label??"")});
          p.storageRefs.add(stored.storageRef);p.usage.privatePrimaryBytes+=stored.bytes;p.usage.objectCount+=1;
          artifacts.push(Object.freeze({...source,storageRef:stored.storageRef,integrity:stored.integrity,bytes:stored.bytes,storageClass:"HZ_PRIVATE_PRIMARY"}));
        }
      } else {
        for(const source of sources)artifacts.push(Object.freeze({...source,storageRef:null,integrity:source.sourceIntegrity,bytes:0,storageClass:"EXTERNAL_REFERENCE"}));
      }
    }
    const now=this.now();
    const take=Object.freeze({
      takeId,jobId:job.jobId,requestDigest:job.requestDigest??null,status,createdAt:now,
      saved:Boolean(saveArtifacts&&status==="COMPLETE"),selected:false,favorite:false,
      artifacts:Object.freeze(artifacts),failureCode:job.lastError?.code??null,
      retentionExpiresAt:status==="FAILED"||status==="CANCELLED"?now+7*DAY:status==="COMPLETE"&&!saveArtifacts?now+30*DAY:null
    });
    p.takes.set(takeId,take);this.#appendVersion(p,"GENERATION_RECORDED",{takeId,status,artifactCount:artifacts.length});
    this.#touch(p);return clone(take);
  }

  favoriteTake(projectId,actorRef,takeId,value=true){
    const p=this.#active(projectId,actorRef),t=this.#take(p,takeId);
    if(t.status!=="COMPLETE")throw new GenerationError420("INVALID_REQUEST","only complete takes may be favorited");
    if(value)p.favoriteTakeIds.add(takeId);else p.favoriteTakeIds.delete(takeId);
    p.takes.set(takeId,Object.freeze({...t,favorite:Boolean(value)}));
    this.#appendVersion(p,value?"TAKE_FAVORITED":"TAKE_UNFAVORITED",{takeId});this.#touch(p);
    return clone(p.takes.get(takeId));
  }

  selectTake(projectId,actorRef,takeId){
    const p=this.#active(projectId,actorRef),t=this.#take(p,takeId);
    if(t.status!=="COMPLETE"||!t.artifacts.some(a=>a.kind==="MIX"))throw new GenerationError420("INVALID_REQUEST","selected take must be complete and contain MIX");
    if(p.selectedTakeId&&p.takes.has(p.selectedTakeId)){const old=p.takes.get(p.selectedTakeId);p.takes.set(old.takeId,Object.freeze({...old,selected:false}));}
    p.selectedTakeId=takeId;p.takes.set(takeId,Object.freeze({...t,selected:true}));
    this.#appendVersion(p,"TAKE_SELECTED",{takeId});this.#touch(p);return clone(p.takes.get(takeId));
  }

  verifyArtifacts(projectId,actorRef,takeId){
    const p=this.#project(projectId,actorRef),t=this.#take(p,takeId);
    return t.artifacts.map(a=>{
      if(!a.storageRef)return {kind:a.kind,storageRef:null,verified:true,externalReference:true};
      const stored=this.storage.get(a.storageRef);
      const verified=stored.metadata.integrity===a.integrity&&stored.metadata.bytes===a.bytes;
      if(!verified)throw new GenerationError420("INTEGRITY_MISMATCH","project artifact integrity mismatch");
      return {kind:a.kind,storageRef:a.storageRef,verified:true,externalReference:false};
    });
  }

  archive(projectId,actorRef){
    const p=this.#active(projectId,actorRef),now=this.now();
    p.status="ARCHIVED";p.archivedAt=now;p.archiveExpiresAt=now+30*DAY;
    p.usage.archivedBytes=p.usage.privatePrimaryBytes;p.usage.privatePrimaryBytes=0;
    this.#appendVersion(p,"PROJECT_ARCHIVED",{archiveExpiresAt:p.archiveExpiresAt});this.#touch(p);
    return this.getProject(projectId,actorRef);
  }

  restore(projectId,actorRef){
    const p=this.#project(projectId,actorRef);
    if(p.status!=="ARCHIVED")throw new GenerationError420("INVALID_REQUEST","project is not archived");
    if(p.archiveExpiresAt<=this.now())throw new GenerationError420("INVALID_REQUEST","archive grace expired");
    p.status="ACTIVE";p.archivedAt=null;p.archiveExpiresAt=null;
    p.usage.privatePrimaryBytes=p.usage.archivedBytes;p.usage.archivedBytes=0;
    this.#appendVersion(p,"PROJECT_RESTORED",{});this.#touch(p);return this.getProject(projectId,actorRef);
  }

  exportProject(projectId,actorRef){
    const p=this.#project(projectId,actorRef),now=this.now();
    const payload={
      schemaVersion:1,project:projectSummary(p),versions:[...p.versions.values()].map(clone),
      takes:[...p.takes.values()].map(clone),storageIntegrity:[...p.storageRefs].map(ref=>{
        const x=this.storage.get(ref).metadata;return {storageRef:ref,integrity:x.integrity,bytes:x.bytes};
      }),
      canonicalRefsOnly:true,secretsIncluded:false,createdAt:now,expiresAt:now+DAY
    };
    const exportId="hzexport:"+digest420({projectId,ownerRef:p.ownerRef,createdAt:now,head:p.versionHeadId});
    const body=JSON.stringify(payload),stored=this.storage.put({accountRef:p.ownerRef,projectId,kind:"EXPORT",label:"project-export",content:body,idempotencyKey:exportId});
    this.exports.set(exportId,{exportId,projectId,ownerRef:p.ownerRef,storageRef:stored.storageRef,integrity:stored.integrity,createdAt:now,expiresAt:now+DAY});
    return clone(this.exports.get(exportId));
  }

  readExport(exportId,actorRef){
    const e=this.exports.get(exportId);if(!e||e.ownerRef!==actorRef)throw new GenerationError420("INVALID_REQUEST","export unavailable");
    if(e.expiresAt<=this.now()){this.storage.delete(e.storageRef);this.exports.delete(exportId);throw new GenerationError420("INVALID_REQUEST","export expired");}
    const x=this.storage.get(e.storageRef);if(x.metadata.integrity!==e.integrity)throw new GenerationError420("INTEGRITY_MISMATCH","export integrity mismatch");
    return JSON.parse(x.content.toString());
  }

  deleteProject(projectId,actorRef){
    const p=this.#project(projectId,actorRef),now=this.now();
    for(const ref of p.storageRefs)this.storage.delete(ref);
    for(const [id,e] of this.exports.entries())if(e.projectId===projectId){this.storage.delete(e.storageRef);this.exports.delete(id);}
    p.status="DELETED";p.deletedAt=now;p.tombstone=true;p.indexable=false;p.visibility="PRIVATE";
    p.takes.clear();p.favoriteTakeIds.clear();p.selectedTakeId=null;p.storageRefs.clear();
    p.usage={privatePrimaryBytes:0,archivedBytes:0,publishedExternalReferenceBytes:0,objectCount:0};
    this.deletedProjectIds.add(projectId);this.projects.delete(projectId);
    return {projectId,deletedAt:now,tombstoned:true,servingRevoked:true,indexingRevoked:true};
  }

  sweepRetention(){
    const now=this.now(),actions=[];
    for(const p of [...this.projects.values()]){
      if(p.status==="ARCHIVED"&&p.archiveExpiresAt!==null&&p.archiveExpiresAt<=now){
        actions.push({projectId:p.projectId,action:"ARCHIVE_EXPIRED_DELETE"});
        this.deleteProject(p.projectId,p.ownerRef);continue;
      }
      if(p.status==="ACTIVE"&&p.lastActivityAt+365*DAY<=now){
        p.status="ARCHIVED";p.archivedAt=now;p.archiveExpiresAt=now+30*DAY;p.usage.archivedBytes=p.usage.privatePrimaryBytes;p.usage.privatePrimaryBytes=0;
        actions.push({projectId:p.projectId,action:"INACTIVITY_ARCHIVE"});continue;
      }
      for(const [takeId,t] of [...p.takes.entries()]){
        if(t.retentionExpiresAt!==null&&t.retentionExpiresAt<=now&&!t.favorite&&!t.selected){
          for(const a of t.artifacts)if(a.storageRef){this.storage.delete(a.storageRef);p.storageRefs.delete(a.storageRef);p.usage.privatePrimaryBytes=Math.max(0,p.usage.privatePrimaryBytes-a.bytes);p.usage.objectCount=Math.max(0,p.usage.objectCount-1);}
          p.takes.delete(takeId);actions.push({projectId:p.projectId,takeId,action:"TAKE_RETENTION_DELETE"});
        }
      }
    }
    for(const [id,e] of [...this.exports.entries()])if(e.expiresAt<=now){this.storage.delete(e.storageRef);this.exports.delete(id);actions.push({exportId:id,action:"EXPORT_EXPIRED_DELETE"});}
    return actions;
  }

  usage(actorRef){
    const projects=[...this.projects.values()].filter(p=>p.ownerRef===actorRef);
    return {
      accountRef:actorRef,
      privatePrimaryBytes:projects.reduce((n,p)=>n+p.usage.privatePrimaryBytes,0),
      archivedBytes:projects.reduce((n,p)=>n+p.usage.archivedBytes,0),
      publishedExternalReferenceBytes:projects.reduce((n,p)=>n+p.usage.publishedExternalReferenceBytes,0),
      objectCount:projects.reduce((n,p)=>n+p.usage.objectCount,0),
      accountQuotaBytes:this.accountQuotaBytes,
      projectQuotaBytes:this.projectQuotaBytes
    };
  }

  #project(id,actorRef){const p=this.projects.get(id);if(!p||p.ownerRef!==actorRef||p.status==="DELETED")throw new GenerationError420("INVALID_REQUEST","project unavailable");return p;}
  #active(id,actorRef){const p=this.#project(id,actorRef);if(p.status!=="ACTIVE")throw new GenerationError420("INVALID_REQUEST","project is not active");return p;}
  #take(p,id){const t=p.takes.get(id);if(!t)throw new GenerationError420("INVALID_REQUEST","take unavailable");return t;}
  #touch(p){p.updatedAt=this.now();p.lastActivityAt=p.updatedAt;}
  #headPayload(p){return p.versionHeadId?p.versions.get(p.versionHeadId).payload:{};}
  #appendVersion(p,kind,payload){
    const versionNo=p.versions.size+1,createdAt=this.now(),parentVersionId=p.versionHeadId;
    const versionId="hzversion:"+digest420({projectId:p.projectId,versionNo,parentVersionId,kind,payload,createdAt});
    const v=Object.freeze({versionId,versionNo,parentVersionId,kind,createdAt,payload:clone(payload)});
    p.versions.set(versionId,v);p.versionHeadId=versionId;return v;
  }
  #assertQuota(p,additionalBytes){
    const projectBytes=p.usage.privatePrimaryBytes+p.usage.archivedBytes;
    const account=this.usage(p.ownerRef).privatePrimaryBytes+this.usage(p.ownerRef).archivedBytes;
    if(projectBytes+additionalBytes>this.projectQuotaBytes||account+additionalBytes>this.accountQuotaBytes)
      throw new GenerationError420("NO_CAPACITY","private project storage quota exceeded");
  }
}

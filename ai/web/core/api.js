const join=(base,path)=>new URL(path.replace(/^\//,''),base.endsWith('/')?base:base+'/').toString();
async function json(url){const r=await fetch(url,{cache:'no-store',headers:{accept:'application/json'}});if(!r.ok)throw new Error(`AI API ${r.status}`);const body=await r.json();if(body?.meta?.authoritative!==undefined&&body.meta.authoritative!==false)throw new Error('AI API authority violation');return body;}
export class AIClient420{
 constructor(base){if(!base)throw new Error('AI API unavailable');this.base=base;}
 readiness(){return json(join(this.base,'v1/readiness'));}
 providers(q=''){return json(join(this.base,`v1/providers${q}`));}
 models(q=''){return json(join(this.base,`v1/models${q}`));}
 jobs(q=''){return json(join(this.base,`v1/jobs${q}`));}
 job(id){return json(join(this.base,`v1/jobs/${encodeURIComponent(id)}`));}
 events(id){return json(join(this.base,`v1/jobs/${encodeURIComponent(id)}/events`));}
}

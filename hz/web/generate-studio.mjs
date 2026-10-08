const DEFAULT_CAPACITY = Object.freeze({
  providerId: "mock:420hz",
  modelId: "mock:music",
  modelVersion: "1.0.0",
  availableSlots: 4,
  queueDepth: 0,
  estimatedStartMs: 0,
  asset: "$420",
  price: "0.42"
});

export const STUDIO_STATES_420 = Object.freeze([
  "LANDING","COMPOSING","READY","GENERATING","COMPARE","SAVED","FAILED","CANCELLED"
]);

const clone=(v)=>structuredClone(v);
const clean=(v,max=4000)=>String(v??"").trim().slice(0,max);

export class GenerateStudioModel420 {
  constructor({now=()=>Date.now(),capacity=DEFAULT_CAPACITY}={}){
    this.now=now;
    this.capacity=clone(capacity);
    this.state="LANDING";
    this.request={prompt:"",lyrics:"",mode:"VOCAL",durationSec:180,genres:[],styles:[],moods:[],instrumentation:[]};
    this.progress=0;
    this.takes=[];
    this.selectedTakeId=null;
    this.savedTakeIds=new Set();
    this.lastError=null;
    this.refundState="NOT_APPLICABLE";
    this.disclosure="AI_GENERATED";
    this.registerPublishReady=false;
  }

  start(){this.state="COMPOSING";return this.snapshot();}
  updateRequest(patch={}){
    if(!["COMPOSING","READY","FAILED","COMPARE","SAVED"].includes(this.state)) throw new Error("request cannot be edited in current state");
    const next={...this.request,...patch};
    next.prompt=clean(next.prompt,2000);next.lyrics=clean(next.lyrics,12000);
    next.mode=next.mode==="INSTRUMENTAL"?"INSTRUMENTAL":"VOCAL";
    next.durationSec=Math.max(15,Math.min(600,Number(next.durationSec)||180));
    for(const key of ["genres","styles","moods","instrumentation"]) next[key]=[...new Set((next[key]??[]).map(x=>clean(x,80)).filter(Boolean))].slice(0,12);
    if(next.mode==="INSTRUMENTAL") next.lyrics="";
    this.request=next;
    this.state=this.canGenerate()?"READY":"COMPOSING";
    this.lastError=null;
    return this.snapshot();
  }

  canGenerate(){return this.request.prompt.length>=3 && this.capacity.availableSlots>0;}
  quote(){
    return Object.freeze({
      providerId:this.capacity.providerId,
      modelId:this.capacity.modelId,
      modelVersion:this.capacity.modelVersion,
      availableSlots:this.capacity.availableSlots,
      queueDepth:this.capacity.queueDepth,
      estimatedStartMs:this.capacity.estimatedStartMs,
      asset:this.capacity.asset,
      price:this.capacity.price,
      authoritative:false
    });
  }

  begin({forceFailure=false}={}){
    if(!this.canGenerate()) throw new Error("generation request is not ready");
    this.state="GENERATING";this.progress=12;this.lastError=null;this.refundState="NOT_APPLICABLE";this._forceFailure=forceFailure;
    return this.snapshot();
  }

  advance(){
    if(this.state!=="GENERATING") return this.snapshot();
    this.progress=Math.min(100,this.progress+29);
    if(this.progress<100) return this.snapshot();
    if(this._forceFailure){
      this.state="FAILED";
      this.lastError={code:"PROVIDER_UNAVAILABLE",retryable:true,message:"Development provider unavailable."};
      this.refundState="NO_SETTLEMENT_OBSERVED";
      return this.snapshot();
    }
    const stamp=this.now();
    const make=(variant,index)=>Object.freeze({
      takeId:`dev-take-${stamp}-${index}`,
      variant,
      status:"COMPLETE",
      durationSec:this.request.durationSec,
      artifacts:Object.freeze([
        {kind:"MIX",label:`${variant} mix`,available:true},
        {kind:"STEM",label:"vocals",available:this.request.mode==="VOCAL"},
        {kind:"STEM",label:"instrumental",available:true},
        {kind:"LYRICS_TIMING",label:"lyrics timing",available:this.request.mode==="VOCAL" && Boolean(this.request.lyrics)},
        {kind:"ARTWORK",label:"draft artwork",available:true}
      ]),
      provenance:Object.freeze({
        providerId:this.capacity.providerId,
        modelId:this.capacity.modelId,
        modelVersion:this.capacity.modelVersion,
        aiDisclosureClass:this.disclosure,
        requestCommitment:`dev-request-${stamp}`,
        resultCommitment:`dev-result-${stamp}-${index}`,
        public:false
      })
    });
    this.takes=[make("A",1),make("B",2)];
    this.selectedTakeId=this.takes[0].takeId;
    this.state="COMPARE";
    this.registerPublishReady=false;
    return this.snapshot();
  }

  selectTake(id){
    if(!this.takes.some(t=>t.takeId===id)) throw new Error("take not found");
    this.selectedTakeId=id;return this.snapshot();
  }
  saveSelected(){
    if(!this.selectedTakeId) throw new Error("no selected take");
    this.savedTakeIds.add(this.selectedTakeId);this.state="SAVED";this.registerPublishReady=true;return this.snapshot();
  }
  regenerate(){
    if(!["COMPARE","SAVED","FAILED"].includes(this.state)) throw new Error("regenerate unavailable");
    return this.begin();
  }
  remix(){
    if(!this.selectedTakeId) throw new Error("select a take before remix");
    const selected=this.takes.find(t=>t.takeId===this.selectedTakeId);
    this.request={...this.request,prompt:`Remix ${selected.variant}: ${this.request.prompt}`.slice(0,2000)};
    this.state="READY";this.registerPublishReady=false;return this.snapshot();
  }
  retry(){
    if(this.state!=="FAILED"||!this.lastError?.retryable) throw new Error("retry unavailable");
    return this.begin();
  }
  cancel(){
    if(this.state!=="GENERATING") throw new Error("cancel unavailable");
    this.state="CANCELLED";this.progress=0;this.lastError={code:"CANCELLED",retryable:false,message:"Generation cancelled."};this.refundState="NO_SETTLEMENT_OBSERVED";
    return this.snapshot();
  }
  registerPublishHandoff(){
    if(!this.registerPublishReady||!this.savedTakeIds.has(this.selectedTakeId)) throw new Error("save a complete take before Register & Publish");
    return Object.freeze({
      action:"REGISTER_AND_PUBLISH_HANDOFF",
      enabled:false,
      reason:"HZ-GCA-7 owns registration/publication; no transaction is submitted by HZ-GCA-6.",
      selectedTakeId:this.selectedTakeId
    });
  }
  snapshot(){
    return Object.freeze({
      state:this.state,request:clone(this.request),quote:this.quote(),progress:this.progress,takes:clone(this.takes),
      selectedTakeId:this.selectedTakeId,savedTakeIds:[...this.savedTakeIds],lastError:clone(this.lastError),
      refundState:this.refundState,registerPublishReady:this.registerPublishReady,disclosure:this.disclosure
    });
  }
}

function text(el,value){if(el)el.textContent=value;}
function hidden(el,value){if(el)el.hidden=value;}
function setPressed(button,on){if(button)button.setAttribute("aria-pressed",on?"true":"false");}

export function mountGenerateStudio420(doc=document){
  const root=doc.querySelector("#generateStudio");
  if(!root) return null;
  const model=new GenerateStudioModel420();
  const q=s=>root.querySelector(s);
  const qa=s=>[...root.querySelectorAll(s)];
  const status=q("#studioStatus"), progress=q("#generationProgress"), progressText=q("#generationProgressText");

  function formPatch(){
    return {
      prompt:q("#songPrompt")?.value,
      lyrics:q("#songLyrics")?.value,
      mode:q("#songMode")?.value,
      durationSec:Number(q("#songDuration")?.value),
      genres:(q("#songGenres")?.value??"").split(","),
      styles:(q("#songStyles")?.value??"").split(","),
      moods:(q("#songMoods")?.value??"").split(","),
      instrumentation:(q("#songInstrumentation")?.value??"").split(",")
    };
  }
  function syncRequest(){try{model.updateRequest(formPatch());render();}catch{}}

  function render(){
    const s=model.snapshot();
    text(status,
      s.state==="LANDING"?"ready to start":
      s.state==="COMPOSING"?"add a prompt to continue":
      s.state==="READY"?"request ready":
      s.state==="GENERATING"?"development generation running":
      s.state==="COMPARE"?"two development takes ready to compare":
      s.state==="SAVED"?"selected take saved privately":
      s.state==="FAILED"?"generation failed":
      s.state==="CANCELLED"?"generation cancelled":s.state.toLowerCase()
    );
    hidden(q("#studioLanding"),s.state!=="LANDING");
    hidden(q("#studioComposer"),s.state==="LANDING");
    hidden(q("#studioProgress"),s.state!=="GENERATING");
    hidden(q("#studioComparison"),!["COMPARE","SAVED"].includes(s.state));
    hidden(q("#studioFailure"),!["FAILED","CANCELLED"].includes(s.state));
    hidden(q("#studioProvenance"),!["COMPARE","SAVED"].includes(s.state));
    hidden(q("#registerPublishPanel"),!["COMPARE","SAVED"].includes(s.state));
    const generate=q("#generateSongButton");if(generate)generate.disabled=!model.canGenerate()||s.state==="GENERATING";
    if(progress){progress.value=s.progress;progress.setAttribute("aria-valuenow",String(s.progress));}
    text(progressText,`${s.progress}%`);
    const quote=s.quote;
    text(q("#quotePrice"),`${quote.price} ${quote.asset}`);
    text(q("#quoteCapacity"),`${quote.availableSlots} slot${quote.availableSlots===1?"":"s"} • queue ${quote.queueDepth}`);
    text(q("#quoteModel"),`${quote.modelId} @ ${quote.modelVersion} • development projection`);
    text(q("#refundState"),s.refundState.replaceAll("_"," ").toLowerCase());

    const cards=q("#takeCards");
    if(cards){
      cards.replaceChildren(...s.takes.map(t=>{
        const article=doc.createElement("article");article.className="take-card";article.dataset.takeId=t.takeId;
        article.innerHTML=`<div class="take-topline"><strong>take ${t.variant}</strong><span>${t.durationSec}s</span></div>
          <div class="mock-wave" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
          <audio controls preload="none" aria-label="Take ${t.variant} audio preview"><p>Audio preview unavailable until a development media URL is resolved.</p></audio>
          <p class="take-note">development preview • no public media URL claimed</p>
          <ul class="artifact-list">${t.artifacts.filter(a=>a.available).map(a=>`<li>${a.kind.toLowerCase()} • ${a.label}</li>`).join("")}</ul>
          <button class="button secondary select-take" type="button" aria-pressed="${s.selectedTakeId===t.takeId}">${s.selectedTakeId===t.takeId?"selected":"select take "+t.variant}</button>`;
        article.querySelector(".select-take")?.addEventListener("click",()=>{model.selectTake(t.takeId);render();});
        return article;
      }));
    }
    const selected=s.takes.find(t=>t.takeId===s.selectedTakeId);
    text(q("#provProvider"),selected?`${selected.provenance.providerId} • ${selected.provenance.modelId} @ ${selected.provenance.modelVersion}`:"—");
    text(q("#provDisclosure"),selected?.provenance.aiDisclosureClass??"—");
    text(q("#provCommitment"),selected?.provenance.resultCommitment??"—");
    const save=q("#saveTakeButton");if(save)save.disabled=!s.selectedTakeId;
    const remix=q("#remixTakeButton");if(remix)remix.disabled=!s.selectedTakeId;
    const handoff=q("#registerPublishButton");if(handoff){handoff.disabled=!s.registerPublishReady;handoff.title=s.registerPublishReady?"Prepared handoff only — HZ-GCA-7 performs registration/publication.":"Save a complete take first.";}
    const err=s.lastError;text(q("#failureCode"),err?.code??"—");text(q("#failureMessage"),err?.message??"");
    const retry=q("#retryGenerationButton");if(retry)retry.disabled=!(s.state==="FAILED"&&err?.retryable);
  }

  q("#startGenerateButton")?.addEventListener("click",()=>{model.start();render();q("#songPrompt")?.focus();});
  for(const el of qa(".studio-input"))el.addEventListener("input",syncRequest);
  q("#generateSongButton")?.addEventListener("click",()=>{
    syncRequest();try{model.begin({forceFailure:q("#simulateFailure")?.checked===true});render();
      const timer=setInterval(()=>{const s=model.advance();render();if(s.state!=="GENERATING")clearInterval(timer);},180);
    }catch(e){text(status,e.message);}
  });
  q("#cancelGenerationButton")?.addEventListener("click",()=>{try{model.cancel();render();}catch{}});
  q("#retryGenerationButton")?.addEventListener("click",()=>{try{model.retry();render();const timer=setInterval(()=>{const s=model.advance();render();if(s.state!=="GENERATING")clearInterval(timer);},180);}catch{}});
  q("#saveTakeButton")?.addEventListener("click",()=>{try{model.saveSelected();render();}catch{}});
  q("#regenerateButton")?.addEventListener("click",()=>{try{model.regenerate();render();const timer=setInterval(()=>{const s=model.advance();render();if(s.state!=="GENERATING")clearInterval(timer);},180);}catch{}});
  q("#remixTakeButton")?.addEventListener("click",()=>{try{model.remix();q("#songPrompt").value=model.snapshot().request.prompt;render();q("#songPrompt")?.focus();}catch{}});
  q("#registerPublishButton")?.addEventListener("click",()=>{try{const h=model.registerPublishHandoff();text(q("#publishHandoffStatus"),h.reason);}catch(e){text(q("#publishHandoffStatus"),e.message);}});
  render();
  return model;
}

if(typeof document!=="undefined") {
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",()=>mountGenerateStudio420(document),{once:true});
  else mountGenerateStudio420(document);
}

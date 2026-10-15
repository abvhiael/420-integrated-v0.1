import { checkRiderPreferences } from "./preference-policy.mjs";

// Browser UI only; L01 authenticated service must enforce scoped authorization server-side.
export function mountRiderAccount(container, adapter, session) {
  let active = true;
  const root = document.createElement("section");
  root.className = "panel";
  root.setAttribute("aria-label", "Rider account preferences");
  const title = document.createElement("h2"); title.textContent = "Accessibility, communications & privacy";
  const notice = document.createElement("p"); notice.setAttribute("role","status"); notice.setAttribute("aria-live","polite");
  root.append(title, notice);
  container.append(root);
  if (!session || session.status!=="authenticated" || !session.roles?.includes("rider") || !session.accountId || !adapter ||
      typeof adapter.getPreferences!=="function" || typeof adapter.savePreferences!=="function" || typeof adapter.erasePreferences!=="function") {
    notice.textContent = "Account preference services are not connected. Nothing can be saved from this preview.";
    return () => { active=false; root.remove(); };
  }
  const form=document.createElement("form");
  const defs=[
    ["largeText","Larger text","checkbox"],
    ["reducedMotion","Reduce movement","checkbox"],
    ["screenReaderHints","Extra screen-reader guidance","checkbox"],
    ["tripNotifications","Trip notifications (opt-in)","checkbox"],
    ["marketingConsent","Marketing messages (opt-in)","checkbox"],
    ["locationHistoryConsent","Retain location history (opt-in)","checkbox"]
  ];
  const fields={};
  for(const [key,label] of defs){
    const line=document.createElement("label");line.className="preference-row";
    const input=document.createElement("input");input.type="checkbox";input.name=key;
    line.append(input,document.createTextNode(" "+label));form.append(line);fields[key]=input;
  }
  const label=document.createElement("label");label.textContent="Preferred contact method ";
  const contact=document.createElement("select");contact.name="contactMethod";
  for(const [value,text] of [["none","None"],["email","Email"],["sms","Text message"]]){
    const opt=document.createElement("option");opt.value=value;opt.textContent=text;contact.append(opt);
  }
  label.append(contact);form.append(label);
  const save=document.createElement("button");save.type="submit";save.textContent="Save preferences";save.disabled=true;
  const erase=document.createElement("button");erase.type="button";erase.textContent="Clear preferences";erase.disabled=true;
  form.append(save,erase);root.append(form);
  let revision=null;
  const apply=(result)=>{
    if(!result||!Number.isSafeInteger(result.revision)||result.revision<0)throw Error("Invalid preference response");
    const values=checkRiderPreferences(result.preferences);
    for(const [key] of defs)fields[key].checked=values[key];
    contact.value=values.contactMethod;
    revision=result.revision;save.disabled=false;erase.disabled=false;
  };
  async function reload(){
    save.disabled=true;erase.disabled=true;revision=null;notice.textContent="Loading current preferences…";
    try{
      const result=await adapter.getPreferences({accountId:session.accountId});
      if(!active)return;
      apply(result);notice.textContent="Current settings loaded. All optional communication and location sharing is opt-in.";
    }catch{if(active)notice.textContent="Unable to verify account preferences; changes are unavailable.";}
  }
  form.addEventListener("submit",async e=>{
    e.preventDefault();if(revision===null)return;
    save.disabled=true;erase.disabled=true;notice.textContent="Saving…";
    try{
      const values=Object.fromEntries(defs.map(([key])=>[key,fields[key].checked]));
      values.contactMethod=contact.value;
      const prefs=checkRiderPreferences(values);
      const result=await adapter.savePreferences({accountId:session.accountId,expectedRevision:revision,preferences:prefs});
      if(!active)return;
      apply(result);notice.textContent="Preferences saved.";
    }catch{if(active){notice.textContent="Save was not accepted. Reload current settings before retrying.";revision=null;}}
  });
  erase.addEventListener("click",async()=>{
    if(revision===null)return;
    save.disabled=true;erase.disabled=true;notice.textContent="Clearing…";
    try{
      await adapter.erasePreferences({accountId:session.accountId});
      if(!active)return;
      await reload();if(active)notice.textContent="Preferences cleared.";
    }catch{if(active)notice.textContent="Clear request failed. Reload account settings before retrying.";}
  });
  void reload();
  return ()=>{active=false;root.remove();};
}

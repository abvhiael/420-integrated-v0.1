import {examples,bySlug,percentage,sampleAmount,filterExamples,parseRoute} from './sample-catalog.js';

// All content rendered here is explicitly illustrative. The canonical app.js owns
// live data, Wallet, 420Pay, governance and transaction authorization independently.
const $=selector=>document.querySelector(selector);
let category='All';
const artLabels={greenroots:'COMMUNITY',aeroleaf:'PRODUCT',justice:'DONATION',hub:'COMMUNITY',sunridge:'PREORDER',coop:'CO-OP'};
const text=(node,value)=>{node.textContent=String(value);return node;};
function element(tag,className='',value){
  const node=document.createElement(tag);if(className)node.className=className;
  if(value!==undefined)text(node,value);return node;
}
function sampleCard(item){
  const a=element('a','showcase-card');
  a.href='#/campaign/'+item.slug;
  a.setAttribute('aria-label','View example campaign '+item.title);
  const media=element('div','card-media artwork artwork-'+item.art);
  media.setAttribute('role','img');
  media.setAttribute('aria-label','Fictional '+item.title+' campaign illustration');
  media.append(element('span','media-tag','EXAMPLE · '+artLabels[item.art]));
  const content=element('div','card-content'),category=element('div','card-top');
  category.append(element('span','kicker',item.category.toUpperCase()+' · SAMPLE'));
  category.append(element('span','sample-indicator','FICTIONAL'));
  content.append(category,element('h3','',item.title),element('p','',item.description));
  const progressRow=element('div','card-progress-label');
  progressRow.append(element('span','',sampleAmount(item.raised)+' / '+sampleAmount(item.goal)+' 420I'));
  progressRow.append(element('strong','',percentage(item)+'%'));
  const meter=element('div','meter');const fill=element('span');fill.style.width=percentage(item)+'%';meter.append(fill);
  const foot=element('div','card-footer');
  foot.append(element('span','',item.days+' example days left'),element('strong','',''));
  foot.lastElementChild.textContent='Explore ↗';
  content.append(progressRow,meter,foot);
  a.append(media,content);return a;
}
function renderCards(){
  const featured=examples.slice(0,4);
  $('#home-samples')?.replaceChildren(...featured.map(sampleCard));
  $('#dashboard-examples')?.replaceChildren(...examples.slice(0,3).map(sampleCard));
  $('#overview-examples')?.replaceChildren(...examples.slice(0,3).map(c=>{
    const a=element('a','overview-entry');
    a.href='#/campaign/'+c.slug;
    const icon=element('span','entry-icon','✳'),inner=element('span');
    inner.append(element('strong','',c.title),element('small','',c.category+' · EXAMPLE'));
    a.append(icon,inner,element('span','entry-arrow','↗'));return a;
  }));
  updateFilters();
}
function updateFilters(){
  const query=$('#sample-search')?.value||'';
  const matches=filterExamples(examples,{query,category});
  $('#discover-samples')?.replaceChildren(...matches.map(sampleCard));
  text($('#sample-count'),matches.length+' fictional example'+(matches.length===1?'':'s'));
  $('#sample-empty').hidden=!!matches.length;
  document.querySelectorAll('[data-sample-category]').forEach(button=>{
    const active=button.dataset.sampleCategory===category;
    button.classList.toggle('selected',active);
    button.setAttribute('aria-pressed',String(active));
  });
}
function renderCampaign(slug){
  const c=bySlug(slug);if(!c)return;
  const textMap={'#sample-detail-title':c.title,'#sample-detail-category':c.category.toUpperCase()+' · FICTIONAL EXAMPLE',
    '#sample-detail-summary':c.description,'#sample-detail-story':c.story,
    '#sample-detail-percent':percentage(c)+'%','#sample-detail-raised':sampleAmount(c.raised)+' 420I',
    '#sample-detail-goal':sampleAmount(c.goal)+' 420I','#sample-detail-backers':sampleAmount(c.backers),
    '#sample-detail-days':String(c.days)};
  for(const [selector,value] of Object.entries(textMap))text($(selector),value);
  $('#sample-detail-meter').style.width=percentage(c)+'%';
  $('#sample-detail-art').className='campaign-hero-art artwork artwork-'+c.art;
  $('#sample-detail-art').setAttribute('aria-label','Fictional '+c.title+' campaign illustration');
  $('#sample-tier-grid').replaceChildren(...(c.tiers.length?c.tiers.map(([name,amount,description])=>{
    const card=element('article','tier-card');
    card.append(element('span','tier-icon','✳'),element('h3','',name),element('strong','tier-price',sampleAmount(amount)+' 420I'),
      element('p','',description),element('small','tier-notice','EXAMPLE · NOT REDEEMABLE'));
    return card;
  }):[element('p','empty-examples','This fictional campaign has no reward tiers.')]));
}
function navigate(){
  let route;
  try{route=parseRoute(location.hash);}catch{route={page:'not-found'};}
  for(const panel of document.querySelectorAll('main > .view')){
    panel.hidden=panel.id!=='view-'+route.page;
  }
  if(route.page==='campaign')renderCampaign(route.slug);
  document.querySelectorAll('[data-nav]').forEach(node=>{
    const active=node.dataset.nav===(route.page==='campaign'?'discover':route.page);
    node.classList.toggle('active',active);
    if(active)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');
  });
  const titles={home:'420 Launchpad',discover:'Discover Examples',campaign:bySlug(route.slug)?.title||'Campaign',
    creator:'Creator Studio',dashboard:'Creator Dashboard',overview:'My Overview',live:'Verified Workspace','not-found':'Not Found'};
  document.title=(titles[route.page]||'420 Launchpad')+' | 420 Integrated';
  window.scrollTo?.({top:0,behavior:'instant'});
}
function init(){
  renderCards();
  $('#sample-search')?.addEventListener('input',updateFilters);
  $('#sample-filters')?.addEventListener('click',event=>{
    const button=event.target.closest('button[data-sample-category]');
    if(!button)return;
    category=button.dataset.sampleCategory;updateFilters();
  });
  window.addEventListener('hashchange',navigate);
  navigate();
}
init();

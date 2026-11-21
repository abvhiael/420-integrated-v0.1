// Presentation-only fixtures. NEVER mix these with canonical Launchpad service data.
export const examples=Object.freeze([
  {slug:'greenroots',title:'GreenRoots Community Grow',mode:'COMMUNITY_PROJECT',category:'Community',region:'British Columbia, Canada',description:'A community-owned, organic cultivation and education space to grow, learn, and collaborate.',story:'GreenRoots is an illustrative community-grow proposal centered on regenerative cultivation, hands-on education, and shared local access. This page demonstrates how a real creator story and governance commitments would appear.',raised:180000,goal:250000,days:12,backers:1248,art:'greenroots',tiers:[['Supporter Seed',100,'A project supporter badge and updates'],['GreenRoots Pack',500,'Supporter updates and a sample welcome pack'],['Community Grower',1000,'A sample branded supporter package'],['Founding Member',5000,'A sample founding-member acknowledgment']]},
  {slug:'aeroleaf',title:'AeroLeaf Vaporizer',mode:'REWARD',category:'Rewards',region:'Canada',description:'A concept for a thoughtfully engineered portable vaporizer with customizable temperature controls.',story:'An illustrative hardware campaign demonstrating a reward-based crowdfunding model.',raised:136000,goal:200000,days:9,backers:819,art:'aeroleaf',tiers:[['Early Supporter',100,'Example supporter reward'],['Founder Edition',1000,'Example founder reward']]},
  {slug:'justice-fund',title:'Cannabis Justice Fund',mode:'DONATION',category:'Donations',region:'Canada',description:'An example donation project supporting legal education and community advocacy.',story:'A fictional advocacy funding example. No organization or fundraising campaign is represented as real.',raised:54000,goal:100000,days:18,backers:452,art:'justice',tiers:[]},
  {slug:'innovation-hub',title:'420 Innovation Hub',mode:'COMMUNITY_PROJECT',category:'Community',region:'Canada',description:'A collaborative community space for cannabis research, education, and local creative projects.',story:'An example community project illustrating milestone-based campaign storytelling.',raised:405000,goal:500000,days:20,backers:2134,art:'hub',tiers:[['Community Member',200,'Example project updates']]},
  {slug:'sunridge',title:'Sunridge Reserve — Preorder',mode:'PRODUCT_PREORDER',category:'Preorders',region:'Canada',description:'A hypothetical small-batch product preorder with transparent delivery commitments.',story:'An illustrative preorder. No regulated product is available to buy through this demonstration.',raised:92000,goal:200000,days:14,backers:394,art:'sunridge',tiers:[['Launch Interest',100,'Example preorder interest tier']]},
  {slug:'community-coop',title:'Community Grow Co-op',mode:'COMMUNITY_PROJECT',category:'Community',region:'Canada',description:'A member-led education and sustainability project for local growers.',story:'A fictional collaborative community proposal.',raised:231000,goal:300000,days:11,backers:1541,art:'coop',tiers:[]}
]);
export const bySlug=slug=>examples.find(x=>x.slug===slug)||null;
export const percentage=c=>Math.min(100,Math.round(c.raised/c.goal*100));
export const sampleAmount=n=>new Intl.NumberFormat('en-CA').format(n);
export function filterExamples(list,{query='',category='All'}={}){
  const q=query.trim().toLowerCase();
  return list.filter(c=>(category==='All'||c.category===category)&&
    (!q||[c.title,c.description,c.region,c.category].some(v=>v.toLowerCase().includes(q))));
}
export function parseRoute(hash=''){
  const normalized=decodeURIComponent(hash.replace(/^#\/?/,'')).replace(/^\//,'');
  if(['','home'].includes(normalized))return {page:'home'};
  if(['discover','creator','overview','live'].includes(normalized))return {page:normalized};
  if(normalized.startsWith('campaign/')){
    const slug=normalized.slice('campaign/'.length);
    if(/^[a-z0-9-]{1,60}$/.test(slug)&&bySlug(slug))return {page:'campaign',slug};
  }
  return {page:'not-found'};
}

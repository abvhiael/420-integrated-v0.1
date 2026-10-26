import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const text=value=>typeof value==='string'&&value.trim().length>0;
export function validateResearch(research,catalog){
 const require=(ok,message)=>{if(!ok)throw new Error(message);};
 require(research.schema==='HC.SEED.COMMON_RESEARCH.V1','research schema');
 require(research.editorialPublisher==='Leafly','editorial publisher');
 require(research.scope==='attributed research; no encoded loci or authorized genome registration','research boundary');
 const expected=new Map(catalog.cultivars.filter(e=>e.tier==='common').map(e=>[e.id,e]));
 require(expected.size===23&&research.cultivars.length===23,'common coverage count');
 const seen=new Set(),sourceIds=new Set(),urls=new Set();let sources=0,gaps=0;
 const statuses=new Set(['reported-cross','unknown','partial','uncertain','legend','conflicting-reports','regional-population']);
 for(const e of research.cultivars){
  const identity=expected.get(e.cultivarId);
  require(identity&&!seen.has(e.cultivarId)&&e.canonicalName===identity.name&&e.canonicalRegion===identity.region,'catalog identity mismatch');seen.add(e.cultivarId);
  require(e.coverage==='profile-reviewed'&&e.reviewStatus==='reviewed-with-explicit-limitations'&&e.genomeAdmission==='not-authorized-by-research','review boundary');
  require(Array.isArray(e.sources)&&e.sources.length>0,'missing sources');
  const localSources=new Set();
  for(const s of e.sources){
   const url=new URL(s.url);
   require(url.origin==='https://www.leafly.com'&&!url.search&&!url.hash&&(/^\/strains\/[a-z0-9-]+$/.test(url.pathname)||/^\/news\/strains-products\/[a-z0-9-]+$/.test(url.pathname)),'non-Leafly source');
   require(s.publisher==='Leafly'&&text(s.id)&&!sourceIds.has(s.id)&&!urls.has(s.url),'duplicate or invalid source');
   require(s.reviewedOn===research.reviewedOn&&s.reviewTimezone==='America/Regina'&&/^\d{4}-\d{2}-\d{2}$/.test(s.reviewedOn)&&text(s.sourceTitle)&&text(s.retrieval)&&text(s.claimBasis)&&Array.isArray(s.sections)&&s.sections.length>0&&s.sections.every(text),'source review fields');
   sourceIds.add(s.id);localSources.add(s.id);urls.add(s.url);sources++;
  }
  const cited=list=>Array.isArray(list)&&list.length>0&&list.every(id=>localSources.has(id));
  const a=e.ancestry;
  require(statuses.has(a.status)&&a.biologicallyVerified===false&&a.crossOrder==='not-established'&&text(a.attribution)&&cited(a.sourceIds),'ancestry attribution');
  require(Array.isArray(a.candidateParentSets)&&a.candidateParentSets.every(set=>Array.isArray(set)&&set.length>0&&set.every(text)),'candidate parents');
  if(['unknown','regional-population'].includes(a.status))require(a.candidateParentSets.length===0,'invented unknown parents');
  else require(a.candidateParentSets.length>0,'missing attributed parents');
  if(a.status==='conflicting-reports')require(a.candidateParentSets.length>=2,'lost conflicting pedigree');
  if(a.candidateSourceIds)require(a.candidateSourceIds.length===a.candidateParentSets.length&&a.candidateSourceIds.every(cited),'candidate attribution');
  const ch=e.characteristics;
  require(['Indica','Sativa','Hybrid'].includes(ch.publisherClassification)&&localSources.has(ch.sourceId),'characteristic attribution');
  for(const field of ['reportedFlavors','profileTerpenes','readerReportedEffects'])require(Array.isArray(ch[field])&&ch[field].length===3&&ch[field].every(text),'characteristic coverage');
  require((ch.morphologySummary===null&&ch.morphologyCoverage==='not-described-in-reviewed-profile')||(text(ch.morphologySummary)&&ch.morphologyCoverage==='described'),'morphology coverage');
  require(text(e.history.summary)&&cited(e.history.sourceIds)&&((e.history.originAsAttributed===null&&e.history.originCoverage==='not-established-in-reviewed-profile')||(text(e.history.originAsAttributed)&&e.history.originCoverage==='attributed')),'history attribution');
  require(text(e.uncertainty.notes)&&text(e.uncertainty.resolution)&&cited(e.uncertainty.sourceIds),'uncertainty coverage');
  require(Array.isArray(e.coverageGaps)&&e.coverageGaps.every(g=>text(g.field)&&text(g.reason)&&['unknown-retained','qualified-account-retained'].includes(g.resolution)),'gap resolution');gaps+=e.coverageGaps.length;
  const hasGap=field=>e.coverageGaps.some(g=>g.field===field);
  if(!a.candidateParentSets.length)require(hasGap('ancestry.candidateParentSets'),'missing ancestry gap');
  if(e.history.originAsAttributed===null)require(hasGap('history.originAsAttributed'),'missing origin gap');
  if(ch.morphologySummary===null)require(hasGap('characteristics.morphologySummary'),'missing morphology gap');
  if(['partial','uncertain','legend','conflicting-reports'].includes(a.status))require(hasGap('ancestry'),'missing qualified ancestry gap');
  require(Array.isArray(e.sourceNameMappings)&&e.sourceNameMappings.every(m=>text(m.sourceName)&&text(m.resolution)&&m.changesCanonicalIdentity===false),'source label boundary');
  require(!Object.hasOwn(e,'loci')&&!Object.hasOwn(e,'genomeId')&&!Object.hasOwn(ch,'thc')&&!Object.hasOwn(ch,'medicalBenefits'),'unreviewed genome or clinical encoding');
 }
 require(research.coverage.expectedCommonCultivars===23&&research.coverage.reviewedProfiles===23&&research.coverage.supplementalLeaflyArticles===sources-23&&research.coverage.missingProfiles===0&&research.coverage.unresolvedRetrievalFailures===0,'coverage summary');
 return {reviewedCultivars:seen.size,reviewedSources:sources,explicitGapResolutions:gaps,researchSha256:createHash('sha256').update(JSON.stringify(research)).digest('hex')};
}
export function loadResearch(){const root=new URL('../../',import.meta.url);return ['common-cultivar-research.v1.json','seed-catalog.v1.json'].map(name=>JSON.parse(readFileSync(new URL('deployments/highcountry/'+name,root))));}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(validateResearch(...loadResearch())));

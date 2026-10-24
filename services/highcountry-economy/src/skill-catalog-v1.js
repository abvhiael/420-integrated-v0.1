// HC-NEXT-5.1 approved baseline: noncompetitive convenience only.
// Catalog activation still requires a genuine independently configured evidence issuer and player level authority.
import {validateProgressionCatalog} from './skill-research.js';
export const HIGHCOUNTRY_SKILL_RESEARCH_V1=validateProgressionCatalog({
 version:'HC-SKILL-RESEARCH-V1',
 tracks:[
  {id:'archive-index-I',kind:'skill',eligibility:'verified-gameplay',prerequisites:[],
   requiredPoints:2,maxPointsPerProof:1,cost:10,minLevel:1,
   effect:'archive-filters',effectValue:1,cap:1},
  {id:'field-journal-II',kind:'skill',eligibility:'verified-gameplay',prerequisites:['archive-index-I'],
   requiredPoints:4,maxPointsPerProof:1,cost:25,minLevel:2,
   effect:'journal-slots',effectValue:2,cap:2},
  {id:'workbench-notes-I',kind:'research',eligibility:'verified-gameplay',prerequisites:[],
   requiredPoints:3,maxPointsPerProof:1,cost:15,minLevel:1,
   effect:'recipe-notes',effectValue:1,cap:1},
  {id:'workshop-layout-II',kind:'research',eligibility:'verified-gameplay',prerequisites:['workbench-notes-I'],
   requiredPoints:5,maxPointsPerProof:1,cost:30,minLevel:3,
   effect:'workshop-layout',effectValue:1,cap:1}
 ]});

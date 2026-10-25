import {validateMissionCatalog} from './missions.js';
export const HIGHCOUNTRY_MISSIONS_V1=validateMissionCatalog({
 version:'HC-MISSIONS-V1',
 missions:[
  {id:'first-field-notes',objective:'record-verified-field-observations',target:3,maxPerEvidence:1,durationMs:604800000,prerequisites:[],reward:{type:'journal-badge',amount:1}},
  {id:'growers-journal',objective:'complete-verified-cultivation-log',target:5,maxPerEvidence:1,durationMs:604800000,prerequisites:['first-field-notes'],reward:{type:'archive-note',amount:1}},
  {id:'workshop-chronicle',objective:'complete-verified-workshop-log',target:4,maxPerEvidence:1,durationMs:604800000,prerequisites:['growers-journal'],reward:{type:'cosmetic-token',amount:1}}
 ]});

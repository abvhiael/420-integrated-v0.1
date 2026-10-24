import {validateMissionCatalog} from './missions.js';
// Gameplay-neutral, approved V1 sample mission objectives. Reward units are metadata only.
export const HIGHCOUNTRY_MISSIONS_V1=validateMissionCatalog({version:'HC-MISSIONS-V1',templates:[
 {id:'journal-first-steps',objective:'verified-journal-entry',prerequisite:null,target:2,maxPerProof:1,durationMs:86400000,rewardUnits:0,badgeId:'first-journal-badge'},
 {id:'field-notes',objective:'verified-field-observation',prerequisite:'journal-first-steps',target:3,maxPerProof:1,durationMs:172800000,rewardUnits:0,badgeId:'field-observer-badge'},
 {id:'workshop-checklist',objective:'verified-workshop-check',prerequisite:'field-notes',target:3,maxPerProof:1,durationMs:259200000,rewardUnits:0,badgeId:'workshop-keeper-badge'}
]});

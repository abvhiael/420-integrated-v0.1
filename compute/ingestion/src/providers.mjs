import {parseBoincStatsXml,parseFoldingDonorCsv} from './parsers.mjs';
export const disabledProfiles=Object.freeze({
 folding:{id:'foldingathome-official-bulk',system:'FOLDING_AT_HOME',enabled:false,permissionApproved:false,sourceApproval:false,origin:'https://foldingathome.org',path:'/stats/donor-flatfile',schemaVersion:'not-verified',contentType:'text/plain',minPollMs:3600000,parse:parseFoldingDonorCsv},
 boinc:{id:'boinc-project-not-selected',system:'BOINC',enabled:false,permissionApproved:false,sourceApproval:false,origin:'https://example.invalid',path:'/stats/user.gz',schemaVersion:'not-verified',contentType:'application/xml',minPollMs:86400000,parse:parseBoincStatsXml}
});

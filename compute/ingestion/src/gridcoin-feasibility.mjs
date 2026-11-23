export const REQUIRED_G01=Object.freeze(['genesisAndNetworkId','addressEncoding','transactionModel','consensusFinalityAndReorg','rpcAndIndependentNodes','signingAndCustody','confirmations','maintenanceAndVersion','denominationAndPrecision','licensesAndPermissions','gatewayTrustModel','onChainVerifierFeasibility','twoWayRedeemability','reservesAndInsolvency','liquidityAndRiskApproval']);
export function evaluateG01(d){
 if(!d||d.schemaVersion!=='420-gridcoin-g01-v1'||!Array.isArray(d.checks)||d.checks.length!==REQUIRED_G01.length||new Set(d.checks.map(c=>c.name)).size!==REQUIRED_G01.length)throw Error('incomplete G-01 inventory');
 const missing=[];
 for(const name of REQUIRED_G01){const c=d.checks.find(x=>x.name===name);if(!c||!['VERIFIED','UNVERIFIED','REJECTED'].includes(c.status))throw Error('invalid G-01 evidence status');if(c.status!=='VERIFIED'||!Array.isArray(c.primaryReferences)||c.primaryReferences.length===0||c.liveNodeVerified!==true)missing.push(name);}
 const approved=d.governanceApproved===true&&d.independentReviewApproved===true&&d.verifiedTwoWaySettlement===true&&missing.length===0;
 return Object.freeze({decision:approved?'GO':'NO_GO',approved,unresolved:missing,bridgeEnabled:false,exchangeEnabled:false});
}

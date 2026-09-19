export const CLOSEOUT_GATES=Object.freeze([
  'resolvedDeployment','verifiedContracts','swapLiveEvidence','limitOrderLiveEvidence',
  'bridgeLiveEvidence','bridgeBeneficiarySettlement','browserUiIntegration',
  'realBrowserWalletMatrix','liveReadApiAndIndexer','securityReview','operatorSignoff',
]);

export function assessGenesisCloseout({manifest,qualifications={},evidence={},review={}}={}){
  const results=[];
  function gate(id,pass,detail){results.push(Object.freeze({id,status:pass?'PASS':'BLOCKED',detail}));}
  const resolved=manifest?.schema==='420-exchange-testnet-runtime-v15.1'&&manifest?.environment==='testnet'&&manifest?.status==='RESOLVED'&&/^0x[0-9a-f]+$/i.test(manifest?.network?.chainId??'')&&/^https:\/\//.test(manifest?.network?.rpcUrl??'');
  gate('resolvedDeployment',resolved,'Real testnet chain ID, RPC and deployed-contract manifest required');
  const addresses=manifest?.contracts??{};
  const required=['ExchangeAtomicRouter420','ExchangeLimitOrderSettlement420','ExchangeBridgeQualification420','GatewayRouter420'];
  gate('verifiedContracts',resolved&&required.every(k=>/^0x[0-9a-f]{40}$/i.test(addresses[k]??'')&&!/^0x0{40}$/i.test(addresses[k]))&&required.every(k=>/^0x[0-9a-f]{64}$/i.test(manifest?.evidence?.verifiedCodeHashes?.[k]??'')), 'Require nonzero deployed addresses and independently verified code hashes for critical contracts');
  const expected=['swapLiveEvidence','limitOrderLiveEvidence','bridgeLiveEvidence'];
  const schemas=['420-exchange-live-swap-evidence-v15.6','420-exchange-live-limit-order-evidence-v15.7','420-exchange-live-bridge-evidence-v15.8'];
  expected.forEach((id,i)=>{
    const item=evidence[id];
    const configuredChain=i===2?item?.sourceChainId??item?.chainId:item?.chainId;
    const aligned=resolved&&String(configuredChain??'').toLowerCase()===manifest.network.chainId.toLowerCase();
    const qualified=item?.status==='QUALIFIED'&&item?.schema===schemas[i]&&/^0x[0-9a-f]{64}$/i.test(item?.txHash??item?.sourceTxHash??'')&&typeof item?.sourceSha==='string'&&/^[0-9a-f]{40}$/i.test(item.sourceSha);
    gate(id,aligned&&qualified&&review?.approvedEvidenceShas?.[id]===item.sourceSha,'Require reviewed protected-workflow artifact, matching source chain, transaction and exact code revision');
  });
  gate('bridgeBeneficiarySettlement',evidence.bridgeBeneficiarySettlement?.status==='VERIFIED'&&review?.bridgePayoutApproved===true,'InboundAccepted does not prove beneficiary payout; require final transfer registry and beneficiary settlement evidence');
  gate('browserUiIntegration',qualifications.v159?.browserIntegrationStatus==='COMPLETE'&&review?.browserUiIntegrationApproved===true,'Provider selector, event disposal and real user-initiated execution UI must be deployed and tested');
  gate('realBrowserWalletMatrix',Array.isArray(qualifications.v159?.browserMatrix)&&qualifications.v159.browserMatrix.length>=6&&qualifications.v159.browserMatrix.every(x=>x.status==='PASS'&&x.evidenceId),'Require six evidenced real-browser and wallet sessions, not mocked provider tests');
  gate('liveReadApiAndIndexer',evidence.liveReadApiAndIndexer?.status==='VERIFIED'&&review?.indexerApproved===true,'Require live V13 API/stream and RPC reconciliation, including reorg/replacement and stale-data drills');
  gate('securityReview',review?.securityReview?.status==='APPROVED'&&review.securityReview.evidenceId,'Require independent deployment/security review and a traceable approval');
  gate('operatorSignoff',review?.operatorSignoff?.status==='APPROVED'&&review.operatorSignoff.evidenceId,'Require operator acceptance of testnet incident, rollback and release procedures');
  const blocked=results.filter(x=>x.status==='BLOCKED').map(x=>x.id);
  return Object.freeze({schema:'420-exchange-genesis-closeout-v15.10',status:blocked.length?'BLOCKED':'QUALIFIED',gates:Object.freeze(results),blocked:Object.freeze(blocked)});
}

export const BOOTSTRAP_STATES=Object.freeze({
  LOADING:'loading',
  READY:'ready',
  DEGRADED:'degraded',
  UNSUPPORTED_NETWORK:'unsupported-network',
  MAINTENANCE:'maintenance',
});

export function deriveBootstrapState({config,dependencyHealth={},connectedChainId=null}={}){
  if(!config) return Object.freeze({state:BOOTSTRAP_STATES.LOADING,reasons:['CONFIG_LOADING']});
  if(config.maintenance===true) return Object.freeze({state:BOOTSTRAP_STATES.MAINTENANCE,reasons:['MAINTENANCE']});
  if(connectedChainId!==null && Number(connectedChainId)!==Number(config.chainId)){
    return Object.freeze({state:BOOTSTRAP_STATES.UNSUPPORTED_NETWORK,reasons:['CHAIN_ID_MISMATCH']});
  }

  const degraded=Object.entries(dependencyHealth)
    .filter(([,value])=>value===false)
    .map(([name])=>`${name.toUpperCase()}_UNAVAILABLE`)
    .sort();

  if(degraded.length) return Object.freeze({state:BOOTSTRAP_STATES.DEGRADED,reasons:degraded});
  return Object.freeze({state:BOOTSTRAP_STATES.READY,reasons:[]});
}

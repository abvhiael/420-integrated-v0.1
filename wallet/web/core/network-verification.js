/** W15.5 display classifications; never infer verified deployment from configured addresses. */
function addressConfigured(address) {
  return typeof address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(address) && !/^0x0{40}$/i.test(address);
}
export function buildWalletVerificationModel420({config=null,network=null,controller=null,smartAccount=null,phase='idle',error=null}={}) {
  const checking = phase==='loading' || phase==='connecting';
  const disconnected = !controller;
  const chainConfigured = typeof config?.network?.chainId==='string' && /^0x[0-9a-fA-F]+$/.test(config.network.chainId);
  const chainMismatch = Boolean(network?.chainMismatch);
  const healthyOnExpected = Boolean(chainConfigured && network?.healthy && !chainMismatch
    && typeof network.chainId==='string' && /^0x[0-9a-fA-F]+$/.test(network.chainId)
    && BigInt(network.chainId)===BigInt(config.network.chainId));
  const component = (address) => addressConfigured(address)
    ? {label:'Address configured',detail:'Deployment and source verification not established by this view'}
    : {label:'Not configured',detail:'Approved contract address is not available'};
  const networkModel = !chainConfigured ? {label:'Not configured',detail:'Approved chain ID is missing'}
    : chainMismatch ? {label:'Wrong network',detail:'Connected chain does not match approved chain ID'}
    : healthyOnExpected ? {label:'RPC reachable · chain matched',detail:'Chain ID matches configuration; this does not verify contracts'}
    : {label:'Not checked',detail:'Connect an authorized controller to check the configured chain'};
  const accountModel = smartAccount?.deployed===true && healthyOnExpected
    ? {label:'Deployed account discovered',detail:'Account discovery completed through Wallet Core'}
    : smartAccount && healthyOnExpected
      ? {label:'Counterfactual account',detail:'Not deployed; no active account contract is proven'}
      : {label:'Not discovered',detail:'No canonical account evidence available'};
  const phaseLabel = checking ? {label:'Checking wallet state',detail:'Waiting for Wallet Core checks',state:'loading'}
    : error ? {label:'Wallet check failed',detail:String(error),state:'failure'}
    : chainMismatch ? {label:'Wrong network',detail:'Wallet Core execution must remain blocked until the approved chain is selected',state:'warning'}
    : !chainConfigured ? {label:'Deployment unconfigured',detail:'Approved chain and contract configuration is incomplete. Wallet functions remain gated.',state:'warning'}
    : disconnected ? {label:'Wallet disconnected',detail:'Connect an authorized wallet to check the configured chain and discover an account.',state:'disconnected'}
    : healthyOnExpected ? {label:'Network matched; verify contracts separately',detail:'RPC reachability is not proof of deployment or service identity.',state:'ready'}
    : {label:'Network not verified',detail:'The connected network has not been checked successfully.',state:'warning'};
  return {
    banner:phaseLabel,
    wallet:checking ? {label:'Connecting',detail:'Waiting for wallet authorization'}
      : disconnected ? {label:'Disconnected',detail:'No authorized controller'} : {label:'Controller connected',detail:'Wallet Core has an authorized controller'},
    network:checking ? {label:'Checking',detail:'Waiting for chain identity'} : networkModel,
    factory:component(config?.smartAccount?.factoryAddress),
    entrypoint:component(config?.deployment?.entryPointAddress),
    registry:component(config?.deployment?.capabilityRegistryAddress),
    account:checking ? {label:'Checking',detail:'Waiting for account discovery'} : accountModel,
    services:config?.manifest?.url ? {label:'Manifest configured',detail:'Acceptance and service links require independent manifest resolution'}
      : {label:'Manifest unavailable',detail:'No approved ecosystem manifest URL configured'}
  };
}

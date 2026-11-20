import {createTokenFeeReview420} from './core/token-fee-review.js';
import {formatERC20Units420} from './core/token-erc20-wizard.js';
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;}
const amount=wei=>formatERC20Units420(wei)+' native $420';
export function mountTokenFeeReview420(section,wizard,session){
  const model=createTokenFeeReview420(wizard,session);
  const panel=el('section','token-fee-review');panel.hidden=true;panel.setAttribute('aria-label','Token fee review and authorization');
  const heading=el('h5',null,'Fee review and simulation');
  const help=el('p',null,'Simulation does not sign or send a transaction. The SmartAccount pays the creation fee to the community Treasury Vault. The connected controller pays network gas.');
  const actions=el('div','token-catalogue-controls');
  const simulate=el('button','ghost-button','Simulate and review fees');simulate.type='button';
  const authorize=el('button','ghost-button','Authorize reviewed creation');authorize.type='button';
  const submit=el('button','ghost-button','Submit authorized creation');submit.type='button';
  const cancel=el('button','ghost-button','Cancel authorization');cancel.type='button';
  const details=el('dl','token-fee-review-details');
  const status=el('p','token-fee-review-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  actions.append(simulate,authorize,submit,cancel);panel.append(heading,help,details,actions,status);section.append(panel);
  let shown=null,approved=null;
  function render(v){
    panel.hidden=!v.draft;shown=v.quote;approved=v.authorization;submit.disabled=!approved||v.busy;simulate.disabled=!v.draft||v.busy;
    authorize.disabled=!v.quote||v.busy||!!v.authorization;cancel.disabled=!v.quote&&!v.busy&&!v.authorization;
    details.replaceChildren();details.hidden=!v.quote;
    if(v.quote){
      const q=v.quote;
      const entries=[['Simulation','Passed — not submitted'],['Creation fee (SmartAccount)',amount(q.creationFeeWei)],
        ['Community Treasury Vault',q.communityTreasuryVault],['Gas units (estimate)',q.gasUnits],['Gas price (estimate, wei)',q.gasPriceWei],
        ['Network gas (controller estimate)',amount(q.estimatedGasWei)],['Combined estimated cost',amount(q.estimatedTotalWei)],
        ['SmartAccount balance',amount(q.smartAccountBalanceWei)],['Controller balance',amount(q.controllerBalanceWei)],
        ['SmartAccount',q.smartAccount],['Gas-paying controller',q.controller],['Network chain ID',String(q.chainId)],
        ['Factory',q.request.target],['Template ID',q.templateId],['Configuration hash',q.configHash],['Calldata hash',q.calldataHash],
        ['SmartAccount execution hash',q.executionHash],['Authorization epoch',q.authorizationEpoch],['Creator nonce',q.creatorNonce],
        ['Simulation block',BigInt(q.simulationBlock.number).toString()+' · '+q.simulationBlock.hash],
        ['Simulated token address (not guaranteed)',q.predictedAddress],['Verified block',BigInt(q.verificationBlock.number).toString()+' · '+q.verificationBlock.hash]];
      for(const [label,value] of entries)details.append(el('dt',null,label),el('dd',null,value));
    }
    status.textContent=v.error||(v.busy?'Rechecking Wallet, Registry and simulation…':v.authorization?
      'Explicit authorization recorded. No transaction signed or submitted.':v.quote?
      'Review both costs and the exact configuration above. Gas is an estimate; this authorization covers at most the displayed estimated gas and total. Higher costs require a new review. Authorizing re-simulates and rejects changed costs or authority.':'Prepare a draft, then simulate to review costs.');
  }
  const unsubscribe=model.subscribe(render);
  simulate.addEventListener('click',()=>{void model.simulate();});
  authorize.addEventListener('click',()=>{void model.authorize(shown);});
  submit.addEventListener('click',()=>{void model.submit(approved).then(hash=>{if(hash)void session.checkTransaction(hash);});});
  cancel.addEventListener('click',()=>model.cancel());
  return ()=>{unsubscribe();model.dispose();};
}

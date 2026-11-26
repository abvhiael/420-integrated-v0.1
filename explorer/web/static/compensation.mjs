import { escapeHtml420 as esc } from './presentation.mjs';

const native = '0x' + '0'.repeat(40);
const labels = {
  DevelopmentCompensationForwarded: 'Development compensation contribution',
  FounderCompensationDeposited: 'Native splitter credit',
  FounderTokenCompensationCredited: 'Token splitter credit',
  FounderCompensationClaimed: 'Founder claim'
};

export function renderCompensation420(view) {
  const header = '<section class="panel"><h3>Development compensation</h3>';
  if (!Array.isArray(view?.events)) {
    return header + '<p>Compensation records are unavailable.</p></section>';
  }
  if (!view.events.length) {
    return header + '<p>No compensation activity is indexed for this transaction.</p></section>';
  }
  return header + view.events.map(event => {
    const f = event.fields;
    const asset = f.asset || f.token || native;
    const details = [
      ['Amount (base units)', f.compensationAmount || f.amount],
      ['Asset', asset === native ? 'Native $420' : asset],
      ['Application', f.sourceApplicationId],
      ['Revenue basis (base units)', f.grossProtocolRevenue],
      ['Revenue reference', f.revenueRef],
      ['Policy', f.policyRef],
      ['Contribution', f.contributionId],
      ['Source', f.source || f.sourceVault],
      ['Beneficiary', f.beneficiary],
      ['Event contract', event.contractAddress],
      ['Transaction', event.transactionHash],
      ['Block', event.blockNumber],
      ['Block hash', event.blockHash],
      ['Log index', event.logIndex],
      ['Indexed confirmations', view.confirmations],
      ['Finality', view.finality]
    ];
    return `<article><h4>${esc(labels[event.eventName] || event.eventName)}</h4><dl>${
      details.filter(([, value]) => value !== undefined).map(([label, value]) =>
        `<dt>${label}</dt><dd class="mono">${esc(value)}</dd>`).join('')
    }</dl></article>`;
  }).join('') + '</section>';
}

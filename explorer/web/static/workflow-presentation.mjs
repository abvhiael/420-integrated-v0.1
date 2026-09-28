import { PresentationError420, address420, decimalString420, escapeHtml420, hash420 } from './presentation.mjs';

const same = (a,b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();

export function routeLink420(parts, label) {
  if (!Array.isArray(parts) || !parts.length) throw new PresentationError420('internal route is missing');
  const encoded = parts.map((part) => encodeURIComponent(String(part ?? '')));
  if (encoded.some((part) => part === '')) throw new PresentationError420('internal route contains empty segment');
  return `<a class="link mono" href="#/${encoded.join('/')}">${escapeHtml420(label)}</a>`;
}

export function producerPresentation420(view) {
  const block = view?.block ?? view ?? {};
  const trace = view?.trace ?? {};
  const producer = block?.producer ?? {};
  const number = decimalString420(block.number, 'block number');
  if (number === '0') return {genesis:true, number};
  const required = ['consensusSlot','producerSeat','proposerRank','consensusBlockRoot','certified'];
  for (const key of required) {
    if (trace[key] === undefined || trace[key] === null || trace[key] === '') {
      throw new PresentationError420('historical producer trace is incomplete');
    }
    if (producer[key] !== undefined && producer[key] !== null && producer[key] !== '' && String(producer[key]) !== String(trace[key])) {
      throw new PresentationError420('consensus/execution producer provenance mismatch');
    }
  }
  if (trace.canonicalAuthority === true) throw new PresentationError420('Explorer projection cannot claim canonical authority');
  if (!trace.executionAuthority || !trace.consensusAuthority || !trace.projectionAuthority) {
    throw new PresentationError420('historical producer authority provenance is incomplete');
  }
  if (trace.executionBlockHash && block.hash && !same(trace.executionBlockHash, block.hash)) {
    throw new PresentationError420('consensus/execution block provenance mismatch');
  }
  const slot = decimalString420(trace.consensusSlot, 'consensus slot');
  const seat = decimalString420(trace.producerSeat, 'producer seat');
  const rank = decimalString420(trace.proposerRank, 'proposer rank');
  const root = String(trace.consensusBlockRoot);
  if (!root.startsWith('0x')) throw new PresentationError420('consensus block root is malformed');
  return {
    genesis:false, number, slot, seat, rank, root, certified:Boolean(trace.certified),
    consensusLink:routeLink420(['consensus',slot], `consensus slot ${slot}`),
    blockLink:routeLink420(['blocks',number], `block ${number}`)
  };
}

export function registryServicePresentation420(view) {
  const serviceId = String(view?.serviceId ?? '');
  if (!serviceId) throw new PresentationError420('Registry service id is missing');
  const versions = Array.isArray(view?.versions) ? view.versions : [];
  const activeVersion = Number(view?.activeVersion ?? 0);
  const implementation = String(view?.implementation ?? '');
  if (activeVersion > 0) {
    const active = versions.find(v => Number(v.version) === activeVersion && v.active === true);
    if (!active) throw new PresentationError420('Registry active version is not active in history');
    if (!implementation || !active.implementation || !same(implementation, active.implementation)) {
      throw new PresentationError420('Registry implementation mismatch');
    }
    address420(implementation,'Registry implementation');
  } else if (implementation) {
    throw new PresentationError420('Registry implementation exists without active version');
  }
  return {
    serviceId,
    activeVersion,
    implementation,
    implementationLink:implementation ? routeLink420(['contracts',implementation],implementation) : '—'
  };
}

export function contractPresentation420(view, requestedAddress) {
  const c=view?.contract ?? {};
  const address=address420(c.address || requestedAddress,'contract address');
  const deploymentTxHash=c.deploymentTxHash ? hash420(c.deploymentTxHash,'deployment transaction hash') : '';
  const deploymentBlock=decimalString420(c.deploymentBlockNumber ?? 0,'deployment block number');
  return {
    address,
    deploymentBlock,
    deploymentTxLink:deploymentTxHash ? routeLink420(['transactions',deploymentTxHash],deploymentTxHash) : '—',
    deploymentBlockLink:routeLink420(['blocks',deploymentBlock],deploymentBlock)
  };
}

export function addressHistoryPresentation420(txs, address) {
  const normalized=address420(address,'address').toLowerCase();
  if (!Array.isArray(txs)) throw new PresentationError420('address history is malformed');
  return txs.map(tx => {
    const hash=hash420(tx.hash,'transaction hash');
    const block=decimalString420(tx.blockNumber,'transaction block number');
    const from=address420(tx.from,'transaction from').toLowerCase();
    const outgoing=from===normalized;
    const counterparty=outgoing ? tx.to : tx.from;
    if (counterparty) address420(counterparty,'transaction counterparty');
    decimalString420(tx.valueWei ?? '0','transaction value');
    return {tx,outgoing,counterparty,txLink:routeLink420(['transactions',hash],hash),blockLink:routeLink420(['blocks',block],block)};
  });
}

export function assetTransfersPresentation420(transfers) {
  if (!Array.isArray(transfers)) throw new PresentationError420('asset transfers payload is malformed');
  return transfers.map(t => {
    const block=decimalString420(t.blockNumber,'asset transfer block number');
    const txHash=hash420(t.transactionHash,'asset transfer transaction hash');
    if (t.from) address420(t.from,'asset transfer from');
    if (t.to) address420(t.to,'asset transfer to');
    decimalString420(t.amount,'asset transfer amount');
    const label=escapeHtml420(String(t.assetKey ?? ''));
    return {
      t,label,
      blockLink:routeLink420(['blocks',block],block),
      txLink:routeLink420(['transactions',txHash],txHash),
      fromLink:t.from ? routeLink420(['addresses',t.from],t.from) : '—',
      toLink:t.to ? routeLink420(['addresses',t.to],t.to) : '—'
    };
  });
}

export function diagnosticPresentation420(status) {
  const wrong=Boolean(status?.wrongChain);
  const stale=Boolean(status?.stale);
  const degraded=Boolean(status?.degraded);
  const consistent=status?.consistent !== false;
  const ready=Boolean(status?.ready);
  if (ready && (wrong || stale || degraded || !consistent)) {
    throw new PresentationError420('ready status contradicts degraded diagnostics');
  }
  const state = wrong ? 'WRONG CHAIN' : stale ? 'STALE' : degraded ? 'DEGRADED' : !consistent ? 'INCONSISTENT' : ready ? 'READY' : 'NOT READY';
  return {
    state,
    banner:`<div class="diagnostic-state" data-diagnostic-state="${escapeHtml420(state)}"><strong>${escapeHtml420(state)}</strong><span>420Explorer is a non-canonical projection; verify canonical sources before acting.</span></div>`
  };
}

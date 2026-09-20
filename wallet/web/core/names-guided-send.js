import { normalizeAddress } from './abi.js';
import { createNames420Client } from './names-client.js';
import { confirm420NameRecipient, normalize420Name } from './names-send.js';
import { buildSendExecution } from './send.js';

// Deployment data must come from the qualified chain-specific runtime generator.
// The checked-in placeholder runtime has no Names deployment and fails closed.
export function createQualifiedNamesSend420({ provider, config, confirm }) {
  if (typeof confirm !== 'function') throw new Error('explicit recipient confirmation required');
  if (!config || config.schema !== '420-wallet-runtime-config-v1' ||
      !config.network?.chainId || !config.network?.rpcUrl ||
      !config.deployment?.namesAddress || !config.deployment?.environment ||
      !config.deployment?.sourceInventoryPhase || !config.manifest?.url) {
    throw new Error('420 Names requires a qualified chain-specific deployment manifest');
  }
  const namesAddress = normalizeAddress(config.deployment.namesAddress);
  const client = createNames420Client({ provider, namesAddress, chainId: config.network.chainId });
  return Object.freeze({
    async prepare({ recipient, amount, asset }) {
      const name = normalize420Name(recipient);
      const verified = await confirm420NameRecipient({
        name, lookup: client.lookup, chainTime: client.chainTime, confirm,
      });
      await client.verifyChain();
      const built = buildSendExecution({ recipient: verified.recipient, amount, asset });
      return Object.freeze({ name, verified, request: built.request, summary: built.summary });
    },
    async revalidate(prepared) {
      if (!prepared?.name || !prepared?.verified?.recipient || !prepared?.request) throw new Error('420 Names send must be prepared again');
      const current = await confirm420NameRecipient({
        name: prepared.name, lookup: client.lookup, chainTime: client.chainTime,
        confirm: ({ name, recipient }) => confirm({ name, recipient, recheck: true }),
      });
      await client.verifyChain();
      if (current.labelHash !== prepared.verified.labelHash || current.recipient !== prepared.verified.recipient) {
        throw new Error('420 Name changed; prepare the send again');
      }
      return current;
    },
  });
}

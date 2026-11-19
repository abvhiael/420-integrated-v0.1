/** Forward only Pay event provenance from the Indexer replay stream. */
export async function forwardPayIndexerEvent(envelope, origin, credential, request = fetch) {
  if (envelope?.streamVersion !== 'v1' || envelope.protocol !== '420Pay' || envelope.eventName !== 'PaymentSet') return false;
  const url = new URL(origin);
  if (url.origin !== origin || url.protocol !== 'https:' || !/^pay_[0-9a-f]{64}$/.test(credential))
    throw new Error('Invalid Pay Indexer ingress configuration');
  const record = envelope.provenance;
  const response = await request(new URL('/internal/v1/events', url), {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { authorization: 'Bearer ' + credential, 'content-type': 'application/json' },
    body: JSON.stringify({ blockHash: record.blockHash, blockNumber: record.blockNumber,
      txHash: record.transactionHash, logIndex: String(record.logIndex) })
  });
  if (response.status !== 202) throw new Error('Pay event ingress unavailable (' + response.status + ')');
  return true;
}

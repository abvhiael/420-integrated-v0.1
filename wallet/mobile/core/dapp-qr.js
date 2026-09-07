import { parseMobileDappHandoff420 } from './dapp-handoff.js';

function rpcError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/**
 * QR is a transport for the same handoff URI used by App/Universal Links.
 * It never carries private keys, signatures, approvals, or executable authority.
 */
export function parseMobileDappQr420(payload, options = {}) {
  if (typeof payload !== 'string') throw rpcError(-32600, 'QR payload must be text');
  const value = payload.trim();
  if (!value || value.length > 4096) throw rpcError(-32600, 'invalid QR payload length');
  if (/\u0000/.test(value)) throw rpcError(-32600, 'QR payload contains forbidden data');
  return parseMobileDappHandoff420(value, options);
}

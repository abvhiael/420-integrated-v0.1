export interface AIServiceDescriptor420 {
  schema: '420-ai-service-v1';
  apiVersion: 'v1';
  baseUrl: string;
  chainId: string;
  protocolRegistry: string;
  capabilities: readonly ('providers' | 'models' | 'jobs' | 'job-events')[];
  authoritative: false;
}

export function validateAIServiceDescriptor420(input: AIServiceDescriptor420): AIServiceDescriptor420 {
  if (input.schema !== '420-ai-service-v1' || input.apiVersion !== 'v1') throw new Error('unsupported AI service descriptor');
  let url: URL;
  try { url = new URL(input.baseUrl); } catch { throw new Error('baseUrl must be a URL'); }
  const local = ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('AI API baseUrl must use HTTPS outside localhost');
  if (!/^[1-9][0-9]*$/.test(input.chainId)) throw new Error('chainId must be a positive decimal string');
  if (!/^0x[0-9a-fA-F]{40}$/.test(input.protocolRegistry)) throw new Error('protocolRegistry must be an address');
  if (input.authoritative !== false) throw new Error('AI API must declare authoritative=false');
  const allowed = new Set(['providers','models','jobs','job-events']);
  if (!Array.isArray(input.capabilities) || input.capabilities.length === 0) throw new Error('AI API capabilities required');
  for (const capability of input.capabilities) if (!allowed.has(capability)) throw new Error('unsupported AI API capability');
  return structuredClone(input);
}

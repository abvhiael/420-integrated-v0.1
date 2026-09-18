import { validateStreamEvent } from './exchange-client.js';

export function encodeResumeCursor(sequence) {
  if (!Number.isInteger(sequence) || sequence < 0) throw new Error('invalid resume sequence');
  return sequence === 0 ? '' : String(sequence);
}

export function decodeStreamPayload(payload) {
  const value = typeof payload === 'string' ? JSON.parse(payload) : payload;
  return validateStreamEvent(value);
}

export function createStreamAdapter({ transport, onEvent, onError = () => {}, eventSourceFactory, webSocketFactory }) {
  if (typeof onEvent !== 'function') throw new Error('onEvent required');

  if (transport === 'sse') {
    if (typeof eventSourceFactory !== 'function') throw new Error('eventSourceFactory required');
    return {
      connect(url, resumeCursor = '') {
        const target = new URL(url);
        if (resumeCursor) target.searchParams.set('cursor', resumeCursor);
        const source = eventSourceFactory(target.toString());
        source.onmessage = (message) => onEvent(decodeStreamPayload(message.data));
        source.onerror = onError;
        return () => source.close();
      },
    };
  }

  if (transport === 'websocket') {
    if (typeof webSocketFactory !== 'function') throw new Error('webSocketFactory required');
    return {
      connect(url, resumeCursor = '') {
        const target = new URL(url);
        if (resumeCursor) target.searchParams.set('cursor', resumeCursor);
        const socket = webSocketFactory(target.toString());
        socket.onmessage = (message) => onEvent(decodeStreamPayload(message.data));
        socket.onerror = onError;
        return () => socket.close();
      },
    };
  }

  throw new Error('unsupported stream transport');
}

import { ExchangeClient } from './exchange-client.js';
import { QueryCache, queryCacheKey } from './exchange-cache.js';
import { applyHistoryPage, applySnapshot, applyStreamEvent, createExchangeStore, updateFreshness } from './exchange-store.js';
import { createStreamAdapter, encodeResumeCursor } from './exchange-stream.js';

export class ExchangeDataLayer {
  constructor({ baseUrl, streamUrl = null, transport = 'websocket-or-sse', fetchImpl, eventSourceFactory, webSocketFactory } = {}) {
    this.client = new ExchangeClient({ baseUrl, fetchImpl });
    this.streamUrl = streamUrl;
    this.transport = transport;
    this.eventSourceFactory = eventSourceFactory;
    this.webSocketFactory = webSocketFactory;
    this.cache = new QueryCache();
    this.store = createExchangeStore();
    this.disconnect = null;
  }

  async loadSnapshot(subjectId) {
    const key = queryCacheKey({ surface: 'snapshot', subjectId });
    const cached = this.cache.get(key);
    if (cached) return cached;
    const snapshot = await this.client.snapshot(subjectId);
    applySnapshot(this.store, snapshot);
    this.cache.set(key, snapshot);
    return snapshot;
  }

  async loadHistory(query) {
    const key = queryCacheKey({
      surface: 'history',
      subjectId: query.subjectId ?? '',
      cursor: query.cursor ?? '',
      filters: {
        kind: query.kind,
        activeOnly: query.activeOnly ?? true,
        limit: query.limit ?? 50,
      },
    });
    const cached = this.cache.get(key);
    if (cached) return cached;
    const page = await this.client.history(query);
    applyHistoryPage(this.store, page);
    this.cache.set(key, page);
    return page;
  }

  connectStream() {
    if (!this.streamUrl) throw new Error('Exchange streamUrl required');
    if (this.disconnect) return this.disconnect;

    const resolvedTransport = this.transport === 'websocket-or-sse'
      ? (this.webSocketFactory ? 'websocket' : 'sse')
      : this.transport;

    const adapter = createStreamAdapter({
      transport: resolvedTransport,
      eventSourceFactory: this.eventSourceFactory,
      webSocketFactory: this.webSocketFactory,
      onEvent: (event) => applyStreamEvent(this.store, event),
      onError: () => { this.store.freshness = 'degraded'; },
    });

    this.disconnect = adapter.connect(this.streamUrl, encodeResumeCursor(this.store.lastSequence));
    return () => {
      const close = this.disconnect;
      this.disconnect = null;
      close?.();
    };
  }

  freshness(nowSeconds) {
    return updateFreshness(this.store, nowSeconds);
  }
}

# RR-1 — Persistent Cannabis Newsfeed

## Purpose and authority boundary

RR-1 adds a separate external-news lane. Third-party reporting is not converted into a ReeferReview-authored `Publication`, and ReeferReview does not ingest full publisher article bodies.

```
Reviewed HTTPS RSS/Atom sources
          |
          v
FeedFetcher -> ParseNewsFeed
          |
          v
normalization -> canonical URL -> relevance/topic classification
          |
          v
FileNewsStore (persistent, atomic file replacement)
          |
          +--> GET /v1/news
          +--> GET /v1/news/{id}
          +--> GET /v1/news/sources
          +--> GET /v1/news/topics
```

The canonical publisher URL remains the reader handoff.

## Persistence

Development default: `.reefer-review/news.json`.

The store schema is `420-reefer-review-news-store-v1`. Writes use a temporary file plus atomic rename. File/directory creation is owner-only where creation occurs. Reopening the store reconstructs persisted items and deduplication evidence.

## Source registry

`config/reefer-review-news-sources.json` is the reviewed source registry.

Requirements:
- unique source IDs and feed URLs;
- HTTPS feed and homepage URLs;
- explicit attribution;
- explicit excerpt/image policy;
- polling interval of at least five minutes.

The initial registry enables official RSS feeds for Marijuana Moment and High Times. ReeferReview consumes publisher-supplied headline/link/metadata and, where allowed by source policy, the source-provided excerpt. Initial image ingestion is disabled. Full article bodies stay at the publisher.

## Ingestion

`go run ./cmd/reefer-news-sync` performs one explicit operator-triggered synchronization of all enabled sources.

This is intentionally a one-shot importer. Background polling, conditional GET, retry/backoff and circuit breaking belong to RR-8.

Feed fetches are bounded to 2 MiB by default. RSS 2.0 and Atom are supported. XML containing document type or entity declarations is rejected.

## Relevance and topics

A deterministic cannabis vocabulary is applied across title, source excerpt and categories. Unrelated entries are persisted as `REJECTED` but are never returned by the public news API.

Visible items receive deterministic topic labels such as policy, medical, science, industry, cultivation, hemp and culture.

## Deduplication and replay boundaries

- fragments and common tracking query parameters are removed from canonical URLs;
- stable public IDs derive from SHA-256 of the canonical URL;
- full canonical URL hash is retained;
- same-source feed GUID continuity preserves the original item ID if the publisher changes the linked URL;
- content fingerprints detect metadata revisions;
- keyset pagination cursors bind the last timestamp, item ID and current source/topic/query filter hash.

## API

- `GET /v1/news?limit=&cursor=&source=&topic=&q=`
- `GET /v1/news/{id}`
- `GET /v1/news/sources`
- `GET /v1/news/topics`

Only `VISIBLE` items are returned.

## Environment

- `REEFER_REVIEW_NEWS_DB` — persistent news-store path; default `.reefer-review/news.json`.
- `REEFER_REVIEW_NEWS_SOURCES` — source-registry path; default `config/reefer-review-news-sources.json`.

## Explicit deferrals

RR-1 does not claim:
- full persistent homepage/news navigation (RR-2);
- live Search projection of external news (RR-6);
- comprehensive production network-fetch hardening such as SSRF/DNS-rebinding policy (RR-7);
- scheduled polling and source-health operations (RR-8);
- public-testnet or production deployment (REEFER-AUDIT-7+).

# Bong Goggles BG-16.6 — preference + delivery integration

BG-16.6 connects Bong Goggles notification vocabulary to the existing 420Notifications subscription and provider model without moving subscription, provider, retry, rate-limit or consent authority into Bong Goggles.

## Subscription handoff

`services/bong-goggles-indexer-v1/src/notificationDeliveryPreferences.js` builds an explicit non-authoritative subscription preference compatible with the qualified 420Notifications model:

- source filter is fixed to `bong-goggles`;
- topic filters use the frozen Bong Goggles topic catalog;
- event filters use the frozen Bong Goggles notification-kind catalog;
- minimum severity maps to the 420Notifications `info` / `warning` / `critical` ordering;
- supported channels are only the Genesis notification provider kinds `in_app`, `web` and `push`;
- activation and operational consent must both be explicit;
- promotional consent is independent and defaults off;
- no subscription preference is protocol or chain state.

Unknown topics, kinds or channels fail closed.

## Delivery handoff

A validated Bong Goggles notification candidate may be handed to the existing Genesis providers only when the current subscription preference matches its source/topic/kind/severity and the subscription remains active, unmuted and operationally consented.

Channel handoff targets the already-qualified provider IDs:

- `in_app` -> `genesis-in-app`
- `web` -> `genesis-web`
- `push` -> `genesis-push`

The handoff carries the notification/event ID, destination, severity and non-authoritative presentation payload. It deliberately does not carry retry counters, backoff timing, queue state, rate-limit state or provider-health state. Those remain owned by 420Notifications.

## Consent and unsubscribe boundary

Bong Goggles does not silently subscribe a user. `active: true` and `operationalConsent: true` are required inputs. Muting, removing operational consent or unsubscribing suppresses future delivery presentation only and does not change the canonical source event.

Promotional consent is separate and opt-in. Bong Goggles operational candidates remain classified as `operational` even when the user has independently enabled promotional consent; promotional consent cannot upgrade or reclassify an operational event.

## Privacy boundary

Every delivery handoff first passes the BG-16 notification-candidate validator. Messenger candidates therefore retain the BG-16.4 metadata-only rule and fail closed if plaintext, ciphertext, message payload/body/content, envelope/storage commitments, device-key commitments or epoch commitments are present.

## Qualification coverage

`notificationDeliveryPreferences.test.js` covers:

- explicit activation and operational-consent requirements;
- topic/kind/channel normalization and validation;
- granular topic and kind matching;
- mute and operational-consent suppression;
- in-app/web/push provider mapping;
- exclusion of retry/rate-limit ownership from the Bong Goggles handoff;
- separate promotional consent with default-off behavior;
- Messenger private-payload rejection before delivery.

BG-16.6 remains presentation-only and does not grant Bong Goggles or 420Notifications signing, spending, capability, protocol-state or canonical-event authority.

# Bong Goggles BG-16.3 — Groups + Events Notification Emitters

BG-16.3 connects the canonical Bong Goggles community/event registry to the BG-16 notification pipeline without creating parallel application events or notification authority.

## Canonical source events

The implementation consumes only events already emitted by `BongGogglesCommunityRegistry420`:

- `GroupJoinRequested`
- `GroupMemberActivated`
- `GroupMemberRemoved`
- `GroupUpdated`
- `EventRSVP`
- `EventUpdated`

No synthetic event-invitation primitive is introduced because the current canonical community registry does not emit one.

## Group behavior

- join requests notify the hydrated current group owner only while the group remains active;
- member activation requires hydrated current membership in `ACTIVE` state before emission;
- member removal requires hydrated current membership in `REMOVED` state;
- removal notifications do not invent an actor because the canonical event exposes the transaction operator, not the logical removal actor;
- material `GroupUpdated` activity fans out only to hydrated eligible recipients;
- muted, inactive or currently blocked recipients are suppressed;
- owner self-notifications are suppressed by the common notification candidate layer.

## Event behavior

- RSVP activity targets the hydrated current event owner and requires a current active event;
- material `EventUpdated` activity fans out to hydrated current event participants/watchers;
- event cancellation/deactivation remains deliverable because the update itself is material presentation information;
- muted, inactive or blocked recipients are suppressed;
- event-owner self-notifications are suppressed.

## Authority + privacy boundary

Recipient lists are application/indexer projection state used only for delivery fan-out. They are not protocol authority and cannot redefine group membership, RSVP state, event visibility or canonical event status. Notification replay remains deterministic and deduplicated by the existing BG-12.6/BG-16 pipeline.

## Exit criteria

BG-16.3 is complete when group/event emitters, hydration guards and replay/fan-out tests are committed on the BG-16 phase branch and the exact PR head passes required Bong Goggles and Integrated qualification workflows.

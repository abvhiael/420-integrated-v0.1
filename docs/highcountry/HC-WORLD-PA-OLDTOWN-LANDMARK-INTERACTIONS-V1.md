# Old Town landmark interaction integration

This PR adds five **read-only** public screens linked by immutable LM-01..LM-05 identities and provisional 1536x1024-image entrance polygons. The five exterior PNGs already exist at `apps/highcountry-web/public/assets/highcountry/old-town/permanent-landmarks/`. No private title purchase or quest reward action is exposed.

**Image dependency:** The Old Town overview artwork supplied in conversation is NOT presently at `apps/highcountry-web/public/assets/highcountry/maps/emerald-coast/port-alder/old-town-genesis-master-v1.png`. Until the user uploads the exact source image, the visual overlay is hidden and accessible landmark text links remain usable. Pixel coordinates are **candidates** requiring inspection against the approved, checksum-frozen image; neither entrances nor cadastral geometry are certified. Public map never discloses any hidden Original Sixteen heritage locations.

Routes:
- `/port-alder/district/HC-EC-S01-D07` → Old Town public landmark directory
- `/port-alder/district/HC-EC-S01-D07/landmark/LM-01` ... `LM-05` → public information screen with existing landmark artwork, descriptive services, return link.

Screens contain informational services only, not fake booking, inventory, action rewards or unimplemented quest completion. The production story/inventory capabilities remain future work. Validation is bounded Level 1.

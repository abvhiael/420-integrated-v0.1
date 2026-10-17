# Budtender 3.20 — Production priority tiers

The original three-tier production sequence is locked in `assets/budtender/phase-3.20/priority_tiers.json`, preserving all 11 Tier 1, 7 Tier 2, and 6 Tier 3 named work groups verbatim. Every reference resolves to an existing approved Budtender asset and is mapped without modifying any PNG or its source identity.

**Tier 1 — playable visual upgrade:** starter-shop background shell; primary counter; rear shelving; product jars/packages; POS register; queue posts; waiting nook; core plants; primary menu board; logo/signage; canonical lighting overlay. All are introduced in the existing web storefront scene with presentation-only geometry and the frozen 15-layer rendering order. The logo/signage slot currently uses approved `sign_store_welcome` art; it is not a claim of a dedicated logo lockup. The starter shell and counter were already implemented and remain intact.

**Tier 2 — progression support (integrated as conditional artwork):** shelf stocking variants; side-display modules; upgrade visual states; alternate décor; more plants; premium fixtures; expansion seam states. Artwork switches are projected read-only from current inventory stock, upgrade and expansion information; no server state is modified.

**Tier 3 — polish (integrated as optional visual overlay):** secondary props; alternate signs; time-of-day variants; minor clutter; decorative posters; more product variations. Artwork is included behind an accessible decorative-polish toggle.

**Boundary:** Phase 3.20 establishes production order and the first playable visual composition. It does not claim spatial art direction approvals, pixel-perfect alignment, full economic progression coverage, or animation; those require their own acceptance. Renderer remains non-authoritative for simulation, economy, inventory, and progression. Tests ensure the first-tier requirements render from allowlisted assets and do not change game state. No global qualification or testnet is required for this scoped rendering step.

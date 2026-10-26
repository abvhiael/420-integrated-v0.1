# HC-ART-02-B — Greenhouse Lounge Assets

Status: art paths verified in repository main; catalog and browse display committed on PR #839. No server SKU, live BUDS price, entitlement, resale, placement or collision right created.

All 10 universal images live at `apps/highcountry-web/public/assets/cultivation/props/comfort-furniture/greenhouse-lounge/universal/`, using the exact prefix `hc-prop-furniture-`. The browser uses `/assets/cultivation/props/comfort-furniture/greenhouse-lounge/universal/`.

The versioned catalog is `apps/highcountry-web/src/greenhouse-lounge-catalog.js`: each record has a canonical id, alt text, environment/region metadata, browse-only market status, and 64px logical ground footprint. `apps/highcountry-web/src/marketplace.js` renders all ten without granting purchasing authority; only the existing authenticated server marketplace can settle BUDS.

## Exact approved footprints

| Asset | Ground tiles |
| --- | --- |
| Papasan chair | 2×2 |
| Freestanding wicker egg chair | 2×2 |
| Double hanging egg chair | 3×2 |
| Wicker loveseat | 2×1 |
| Rattan armchair | 1×1 |
| Folding teak garden chair | 1×1 |
| Cedar garden bench | 2×1 |
| Greenhouse reading chair | 1×1 |
| Hammock chair with stand | 2×2 |
| Small wicker footstool | 1×1 |

Notes: the image dimensions do not determine tile footprint. Anchors are bottom-center. Freestanding suspended chair frames require swing clearance and grounded collision-mask validation. The ivy and accessory details in art remain part of each art image; no additional independent gameplay asset or inventory is minted. Comfort, morale, restoration and secondhand resale require server-verified item instances and the separately defined furniture lifecycle before activation.

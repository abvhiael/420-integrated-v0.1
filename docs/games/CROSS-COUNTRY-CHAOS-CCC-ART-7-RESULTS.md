# CCC-ART-7 — Results screens

Read-only original vintage-road-atlas regional finish and championship presentation for the 2–4 player local Cross-Country Chaos game.

- Each completed regional stage presents its recorded winner(s), original inline SVG checkered flag/trophy art, assigned vehicle-token artwork, and an accessible table with rank, effective km, raw km, banked km and cumulative championship km. Historical mileage records persist. An explicit Continue control advances using the unchanged engine.
- The end of stage three shows a coast-to-coast champion banner, an illustrated 1–3 place podium (including shared places), a final table of all drivers, and accessible scoreboards for all three regional stages. New championship resets local state.
- Engine results and chaosLeaders are authoritative. The result renderer does not change scoring, award points, draw cards, reveal hands, or use network/wallet/reward/wager authority. The unchanged rules award 2,500 stage km to exact winners, use effective then raw mileage for stage ranking, and sum banked kilometres for championship ranking with wins, Western kilometres and then joint champions as official tie-breakers. Stable seat-order affects only placement display.
- User names are escaped; table captions, row/column headings and a focusable horizontal-scroll region make all numbers readable without art. Mobile stacked layout, forced-colours and both reduced-motion modes are supported. The completed public board is available in a disclosure below each results screen.
- No new image assets, fonts, remote dependencies or changes to the six approved atlas layers, six vehicle image assets or 49 card assets. The existing base-only asset budget expands 16 KiB (1077 to 1093 KiB); all other sizes/hashes/allowlists remain enforced.

Files: core/chaos-results.js, core/classics-ui.js, ccc-tabletop.css, test/ccc-art-7-results.test.js, scripts/qualify-web.mjs; prior ART-4/5/6 budget tests updated, not weakened. Required evidence: exact-head Bong Goggles Web Verification including BG-19.13 source, build and accessibility checks, 420Docs Qualification and affected account-social regression. Merge/deploy only on separate authorization.

Next canonical phase, if assigned: CCC-ART-8. No scope is presumed here.

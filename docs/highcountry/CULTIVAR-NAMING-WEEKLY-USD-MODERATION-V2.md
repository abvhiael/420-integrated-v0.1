# High Country — Weekly USD name fee and moderator administration V2

**Approved design:** custom user-created names target **US$4.20**, collected in native **$420** tokens at the **completed trailing seven-calendar-day, UTC time-weighted average USD price** of $420, recomputed **once weekly** from an independently approved price oracle. The 50/50 reviewer and High Country competition-vault split stays unchanged. Free deterministic parent-combined names stay free, including during oracle outages.

## Weekly quote
1. Select a complete UTC 7-day sample window. Do not compute prices from unfinalized data, a single spot tick, unsourced DEX pair, or player-provided values.
2. Accept only authorized feeds meeting freshness, minimum observations, manipulation-resistance, price source independence, liquidity, outlier/reorg and fallback requirements. The user has **not approved a specific oracle**, observation threshold, min/max token fee, or on-chain pricing contract. Until these are completed, V2 fee collection MUST remain disabled.
3. Compute `feeBaseUnits = ceil(USD 4.20 * 10^tokenDecimals / verifiedAverageUsdPer420)`. Use integer/fixed-point audited arithmetic and pin the exact feed, timestamp window, price, version, token address/chain and quote expiry. Reject zero/unavailable prices and precision overflow.
4. The quote is fixed at the accepted proposal; price updates never change existing obligations. New quotes after the next weekly publication use its schedule. Avoid a price update silently increasing past a governance affordability ceiling; stop new custom submissions if configured bounds fail.
5. From escrow `reviewerShare=floor(feeBaseUnits/2)`; `competitionVaultShare=feeBaseUnits-reviewerShare`. Independent review qualification, anti-replay, refund and refund/appeal policies apply. Rewards do not depend on approve/reject outcomes.

## Appointing reviewers
Owner appoints through authenticated High Country `/admin/cultivars/moderation` → Moderators → Invite → select role/scope/expiry → require MFA → issue and verify matching scoped capability. Supervisor can manage ordinary review queues but may not assign developer-owner authority, change compensation or grant own powers. Appeal reviewers are separate from original decision-makers; payment reconciliation is a separate treasury/vault function. Revoke grant and backend access on removal, with full audit trail.

The current repository includes only the `CultivarModerationPanel.jsx` frontend **foundation**; route, identity backend, assignments UI, evidence privacy, MFA, anti-abuse rules, oracle and token settlement are **not yet integrated or deployed**. These are acceptance requirements, not completed capabilities.

## Moderator accountability
Mistakes are reviewed contextually, not punished automatically for every incorrectly approved name. Documented first mistakes → corrective guidance/retraining; repeated negligent approvals → warning, second-review obligation or time-limited suspension; deliberate approval of hateful or targeted harassment names, collusion, fee fraud or repeated reckless conduct → immediate suspension, independent review and revocation/ban where substantiated. Appeal rights, audit evidence, proportionality and source limitations are mandatory. Do not claw back already earned legitimate pay solely because a reasonable review was overturned; fraud remedies need separate approved authority.

## Heritage cultivar-name exceptions
Preserve **exact verified established cultivar names**, including profanity, where documentary evidence and identity matching support them. User-requested candidate list:
- Alaskan Thunder Fuck — documented in Leafly; eligible for curated exact-name exemption
- Fucking Incredible — documented in Leafly; eligible for curated exact-name exemption
- Shit — verification required
- Dirty Old Bastard — verification required
- Bitch Fuel — verification required
- Karma Bitch — verification required

Exception must match a verified pre-existing cultivar identity with cited evidence and normalized, exact registered spelling/alias. It is **not** a blanket permission for newly invented vulgar names, confusing lookalikes, slurs or targeted harassment. Record reviewer, authority, source, content hash, exception scope and expiry/version. Unverified names stay in heritage-review queue rather than being automatically whitelisted. Genuine established `thunderfuck` compound usages are evaluated via the same documented identity rule.

## Product notices
Naming submission must display the standard prohibitions **and** explain that authenticated heritage exceptions exist for specific verified historic strain names; a new cultivar cannot copy an exception merely by containing that vulgar term. Offensive custom submissions may be rejected and cultivars hidden/retired; repeated intentional evasions risk suspension or removal from the game. Fee paid does not guarantee publication, and refund rules must be prominently disclosed before payment.

## No premature deployment claim
`CultivarModerationRegistry` is a name-hash status primitive and does not yet validate human-readable names or heritage citations. All three filtering layers, exception enforcement, moderator backend, independent approval and price/treasury flows still need real service integration, tests and external authorization before paid naming is live.

# High Country — Cultivar Names, Moderation & Reviewer Compensation V1

**Owner-adopted decisions:** 16 founding lines are biologically neutral heritage lines. New cultivar sources: official releases, player crossing, and curated discoveries. Parent-combined names are free; custom names will have an approved nominal fee in native $420 (exact amount TBD). All names undergo normalization/blocklist checks, context-aware screening and review/appeal. A clear player-facing warning is mandatory before submission.

## Player-facing warning (display verbatim)
> Cultivar names cannot contain identity-based slurs, hateful or harassing language, threats, sexually explicit or vulgar words, disguised prohibited terms, impersonation, or attempts to evade moderation. A violating name and its associated cultivar may be banned from use in High Country. Repeated violations may result in account suspension or removal from the game. Genetic ancestry remains recorded even if a cultivar becomes unavailable.

## Separation of authority
- **Genome/provenance:** immutable Genesis or authenticated BreedingEngine record; moderator cannot delete or mutate historical loci or parents.
- **Ownership:** tracked under existing canonical systems; moderator cannot silently confiscate a genome or transfer assets.
- **Naming:** service-verified human-readable name and hash bound to cultivar id/revision; never render blocked old names. Publish a neutral fallback `Cultivar HC-<short id>`.
- **Public use/distribution:** fail closed on moderation registry `usable(id)`. PENDING, HIDDEN, RETIRED must not be presented as usable or tradable in integrated game consumers; immutable on-chain state remains.
- **Cross-account evasion:** index prohibited normalized names and content similarity; record genome descendants and provenance, transfers and report decisions; moderation decisions apply to cultivar ID independently of owner; anti-evasion correlation must be privacy-preserving and appealable.
- **Moderators:** exact scoped capabilities to review and issue reasons, separate audited developer authority, reason hashes reference restricted evidence and do not include plaintext slurs on chain.

## Governance boundaries
The new CultivarModerationRegistry records authorized proposals, status transitions, immutable historical identity pointers, review reasons and rename requests. It does **not** do text screening, verify parent/genome membership, mint transfer fees, ban players, validate arbitrary user accounts, store readable names or auto-apply decisions to pre-existing market and breeding consumers. Those must be integrated at the trusted service/API gateways and tested before launch. Legacy unmoderated records fail closed unless catalogued as grandfathered by an explicit policy.

## $420 moderator compensation — incentive safe
Moderators should receive a fixed approved native $420 payment per completed eligible review, *irrespective of approval or denial*. Funding is escrowed in a scoped developer compensation vault; a distinct claims/settlement component validates final decision ID, reviewer, authorization and amount and prevents duplicate claims. Separate funding and payout roles, caps per period, self-review denial, conflict checks, appeals and clawback/dispute policy required. **No $420 price or payout amount is approved**, and no live payment or token conversion is implemented by this commit. Custom-name fee should be agreed separately; free auto-names never require a wallet and should remain accessible to wallet-free players. If review payments are funded by custom fees, they go to an audited treasury first, not directly to the deciding reviewer.

## Implementation gates
Require a name-screening service with exact Unicode normalization, codepoint constraints, confusable detection, word-context moderation, blocked-term dictionary maintenance and an audited report/appeal queue. Build authenticated admin API/UI using signed moderator roles, CSRF protection, rate limiting, scoped evidence, rollback and logging. Enforce status in search, sale, swap, transfer display, breeding/clone/public distributions, and gameplay entrances. Define how legitimate descendants remain protected without enabling blocked cultivar exploitation. Verify current contract bindings and service authority before exposing moderation actions.

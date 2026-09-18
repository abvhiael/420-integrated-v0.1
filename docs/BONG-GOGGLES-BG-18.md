# Bong Goggles BG-18 — Rewards Production Configuration

BG-18 takes the already-built Bong Goggles reward-verification and shared 420 rewards infrastructure and turns it into a production-configured, auditable, bounded reward program for Bong Goggles.

## Existing authority boundary

Bong Goggles does not mint rewards directly and does not maintain a second reward ledger.

Canonical flow:

`BongGogglesContributionVerifier420`
→ `BongGogglesRewardsAdapter420`
→ `ContributionRegistry420`
→ `RewardCampaignRegistry420`
→ `RewardDistributor420`
→ `RewardPool420`

The Bong Goggles application may display contribution, campaign, accrued-reward and payout state, but the shared rewards contracts remain authoritative.

Existing verified Bong Goggles contribution classes:

- POST
- PHOTO
- STORY
- DISCOVERY
- REVIEW
- CORRECTION
- VERIFICATION

Comments are intentionally not rewardable by default. The Phase 15 games layer exposes a non-authoritative BG-18 rewards hook, but it cannot award or mint anything itself.

## Production principles

- contribution verification and reward valuation remain separate;
- relay identity must never redirect the canonical beneficiary;
- every reward campaign is explicitly scoped by Bong Goggles app ID + contribution type;
- no campaign can accrue beyond per-contribution, per-account or total-budget caps;
- no reward accrues without a funded campaign;
- no client-side score, leaderboard rank, engagement count or local statistic becomes reward authority;
- reward contribution submission is not the same thing as reward earned;
- reward accrued is not the same thing as reward paid;
- earned/payout notifications only activate from canonical shared-reward lifecycle events;
- no reward values are hard-coded into Bong Goggles application code;
- campaign economics must be configurable and replaceable without redeploying Bong Goggles social contracts.

## Roadmap

### BG-18.1 — production reward inventory + configuration schema — COMPLETE AND QUALIFIED

- freeze the canonical Bong Goggles app ID and all supported contribution-type IDs;
- inventory verifier, adapter, Contribution Registry, Campaign Registry, Distributor and Pool dependencies;
- create a versioned Bong Goggles reward configuration schema;
- configuration records campaign intent, scorer, optional policy, caps, budget, start/end window and enablement;
- distinguish testnet, staging and production configurations;
- fail closed on unknown contribution types, missing contracts, zero addresses, invalid windows or unsafe caps;
- no campaign creation or funding is performed from config parsing alone.

Implemented in:
- `services/bong-goggles-indexer-v1/src/rewardProductionConfig.js`
- `services/bong-goggles-indexer-v1/test/rewardProductionConfig.test.js`

The configuration surface freezes the canonical app/contribution ID preimages, inventories the verifier/adapter/shared rewards dependencies, validates `testnet`/`staging`/`production` profiles, fails closed on missing/zero contracts, unknown/duplicate contribution types and unsafe enabled campaign caps/windows, and explicitly performs no campaign creation, funding or activation.

**Exit:** one deterministic configuration surface describes every permitted Bong Goggles reward campaign without creating reward authority in the app layer.

### BG-18.2 — contribution catalog + enablement policy — COMPLETE AND QUALIFIED

- production catalog for POST, PHOTO, STORY, DISCOVERY, REVIEW, CORRECTION and VERIFICATION;
- comments remain explicitly disabled;
- hidden/inactive social objects remain ineligible;
- invalid/closed/merged discovery subjects remain ineligible;
- inactive reviews remain ineligible;
- correction and verification contributions retain canonical author/verifier beneficiary binding;
- source-key/nullifier/replay invariants documented and regression-tested;
- allow contribution classes to be disabled independently without changing verifier identities.

Implemented in:
- `services/bong-goggles-indexer-v1/src/rewardContributionPolicy.js`
- `services/bong-goggles-indexer-v1/test/rewardContributionPolicy.test.js`

The policy catalog covers exactly the seven canonical verifier classes, keeps COMMENT explicitly unsupported, derives independent enablement from validated campaign config without changing verifier methods, mirrors the Solidity source-active rules, preserves canonical beneficiary binding, and documents adapter source replay plus shared-registry nullifier semantics.

**Exit:** each existing contribution class has an explicit production enable/disable policy and verified canonical beneficiary/source semantics.

### BG-18.3 — scorer + eligibility policy profiles — COMPLETE AND QUALIFIED

- define replaceable scorer contracts/profiles per contribution class;
- define optional eligibility-policy contracts for anti-abuse and campaign-specific rules;
- scorer output is always bounded by `maxRewardPerContribution`;
- policy evaluation cannot redirect beneficiary or rewrite contribution evidence;
- production policy can impose account-age, verified-profile, uniqueness, cooldown or other objective eligibility gates where supported by canonical state;
- no popularity score, recommendation rank or off-chain engagement estimate is authoritative unless explicitly committed through an approved reward policy boundary;
- zero score means no accrual.

Implemented in:
- `services/bong-goggles-indexer-v1/src/rewardScorerPolicyProfiles.js`
- `services/bong-goggles-indexer-v1/test/rewardScorerPolicyProfiles.test.js`

Enabled campaign types now require declared replaceable `IRewardScorer420` profiles and optional `IRewardPolicy420` profiles. Objective policy gates are constrained to canonical-state-compatible classes, popularity/recommendation/local-engagement signals are explicitly non-authoritative, zero scorer output requests no accrual, scorer amounts above the campaign cap fail closed, and policy profiles cannot redirect beneficiaries or rewrite canonical contribution evidence.

**Exit:** every enabled contribution type is mapped to a production scorer and, where needed, a production eligibility policy with deterministic tests.

### BG-18.4 — campaign construction + economic caps — IMPLEMENTED, QUALIFICATION PENDING

- build deterministic campaign-plan generation from the BG-18 configuration;
- bind every campaign to `APP_ID_BONG_GOGGLES` and exactly one contribution type;
- configure:
  - max reward per contribution;
  - max reward per account;
  - total campaign budget;
  - start timestamp;
  - end timestamp;
  - scorer;
  - optional eligibility policy;
- reject unsafe relationships such as account cap below contribution cap;
- campaign activation remains sponsor-controlled through `RewardCampaignRegistry420`;
- production numeric values live in environment/deployment configuration rather than source-code constants.

Implemented in:
- `services/bong-goggles-indexer-v1/src/rewardCampaignPlans.js`
- `services/bong-goggles-indexer-v1/test/rewardCampaignPlans.test.js`

Enabled campaigns now produce deterministic inspection-only `RewardCampaignRegistry420.createCampaign` plans bound to the Bong Goggles app ID plus exactly one canonical contribution type. Plans carry scorer, optional policy, per-contribution cap, per-account cap, total budget and campaign window; preflight rejects app/type tampering, unsafe caps/budget and invalid windows. Campaign creation, funding and activation remain false until canonical sponsor actions occur.

**Exit:** campaign plans can be generated, inspected and validated before any on-chain creation or funding occurs.

### BG-18.5 — pool funding + activation workflow

- define the production sequence:
  1. create campaign;
  2. validate canonical campaign record;
  3. fund RewardPool;
  4. verify funded/available balance;
  5. activate campaign;
- prevent activation readiness if configured budget and pool funding disagree;
- expose funded, reserved and available balances;
- define pause/deactivation workflow without destroying prior earned rewards;
- no application service may custody campaign funds;
- Wallet confirmation required for sponsor-side canonical writes.

**Exit:** operators have a deterministic, reversible campaign activation procedure with explicit funding readiness checks.

### BG-18.6 — accrual + claim application integration

- project canonical `ContributionPublished`, `RewardAccrued`, `RewardReserved`, `RewardClaimed` and `RewardReleased` lifecycle state;
- Bong Goggles contribution submission remains distinct from accrual;
- display pending contribution, eligible/processed contribution, accrued reward and paid reward as separate states;
- claim intents target the shared `RewardDistributor420.claim` path;
- beneficiary remains canonical from the contribution/reward record;
- Wallet confirmation required for user-side claims where applicable;
- local UI state cannot mark a reward paid before canonical confirmation.

**Exit:** application surfaces can accurately show reward lifecycle and prepare claims without inventing reward state.

### BG-18.7 — notifications + user-facing reward semantics

- activate `REWARD_EARNED` only from canonical `RewardAccrued` lifecycle events;
- activate `REWARD_PAYOUT_UPDATED` only from canonical claim/release lifecycle events;
- retain existing `REWARD_CONTRIBUTION_SUBMITTED` event semantics;
- explicitly distinguish:
  - contribution submitted;
  - reward accrued/earned;
  - reward claim initiated;
  - reward paid;
- deep links resolve to Bong Goggles reward detail, Wallet and Explorer;
- notification replay/deduplication remains deterministic;
- notification layer cannot trigger claims or mutate reward state.

**Exit:** users no longer see reserved earned/payout notification kinds as synthetic placeholders; they are driven only by real shared-rewards events.

### BG-18.8 — game reward hook decision + safe integration boundary

- review the existing Phase 15 `BG-18_REWARDS_CONFIGURATION` game hook;
- keep game rewards disabled unless a canonical game contribution verifier is introduced against `BongGogglesGameSessionRegistry420`;
- never reward client-calculated leaderboard rows, streaks or local statistics directly;
- if game rewards are enabled in BG-18:
  - define canonical GAME_PARTICIPATION / GAME_RESULT contribution types;
  - require FINISHED zero-wager sessions;
  - bind beneficiary to canonical session participant;
  - use deterministic session-based source keys;
  - prevent self-play/farming and duplicate session reward claims through policy/nullifier rules;
- otherwise formally defer game rewards and preserve `awardRequested:false`, `mintRequested:false`.

**Exit:** game rewards have an explicit production decision and cannot accidentally become active through the existing application hook.

### BG-18.9 — abuse, budget + economic hardening

- duplicate-source and cross-campaign replay testing;
- sybil/farming-oriented eligibility scenarios;
- rapid-post/review/correction spam scenarios;
- account-cap boundary tests;
- contribution-cap boundary tests;
- total-budget exhaustion tests;
- funded-vs-reserved invariant checks;
- campaign expiration and deactivation tests;
- reentrant claim regression remains green;
- scorer/policy failure fails closed;
- malicious relay cannot redirect beneficiary;
- invalid or hidden source transitions cannot generate fresh reward contributions.

**Exit:** reward economics fail closed under replay, abuse, cap exhaustion, funding exhaustion and adversarial claim conditions.

### BG-18.10 — operator/admin reward surfaces

- campaign inventory with app/type/scorer/policy/caps/window/active state;
- pool funded/reserved/available balances;
- accrued-by-campaign and earned-by-account visibility;
- contribution/reward lookup by canonical IDs;
- explicit readiness warnings for underfunded, expired, disabled or misconfigured campaigns;
- Wallet-bound sponsor actions for create/fund/activate/deactivate;
- Explorer links for all canonical campaign/reward transactions;
- no secret keys or private Wallet material stored by Bong Goggles services.

**Exit:** production operators can safely inspect and operate Bong Goggles campaigns without contract-console guesswork.

### BG-18.11 — telemetry, accounting + reconciliation

- deterministic reward-event projector for operational reporting;
- compare local projections to canonical Contribution Registry, Campaign Registry, Distributor and Pool state;
- track submitted contributions, accrued rewards, paid rewards and remaining budget separately;
- no double counting across contribution submission/accrual/payment stages;
- export sanitized campaign/accounting reports without private Wallet data;
- reconciliation fails closed on canonical/local mismatch;
- restart/replay produces identical accounting totals.

**Exit:** reward accounting is reconstructable from canonical events and can be independently reconciled.

### BG-18.12 — production closeout

- end-to-end drills:
  - canonical post → contribution → accrue → reserve → claim → release;
  - review/discovery contribution flows;
  - cap exhaustion;
  - budget exhaustion;
  - campaign pause/deactivation;
  - replay rejection;
  - notification lifecycle;
- load qualification for contribution projection and reward-accounting surfaces;
- operator runbook;
- deployment/config checklist for testnet → staging → production;
- reconcile branch with current `main`;
- exact-head contract, Bong Goggles, Docs and integrated qualification workflows all green;
- merge only after exact-head qualification.

**Exit:** BG-18 is production-configured and merge-ready; proceed to BG-19 full web application/public-facing UI.

## Initial implementation order

The recommended implementation sequence is:

`18.1 config schema → 18.2 contribution policy → 18.3 scorer/policy profiles → 18.4 campaign plans → 18.5 funding/activation → 18.6 lifecycle integration → 18.7 notifications → 18.8 game decision → 18.9 hardening → 18.10 operator surfaces → 18.11 reconciliation/accounting → 18.12 closeout`

## Definition of done

BG-18 is complete only when Bong Goggles can participate in the shared 420 reward economy with configured campaigns, bounded economics, canonical accrual/claim state, accurate notifications, replay/abuse resistance, operational accounting and a production runbook — without Bong Goggles becoming a separate reward ledger, mint, treasury or payout authority.

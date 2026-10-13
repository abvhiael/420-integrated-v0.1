# LIFTd — adopted Vancouver pilot economic policy

Status: adopted by the repository owner on 2026-10-13. This is a product policy decision; pricing, settlement and payroll implementation remain pending under L01.7/L01.8. Operating-cost validation and independent launch acceptance remain required. Policy version: v1.

## Market and fare

First launch: Vancouver, British Columbia, Canada. Initial category: standard vehicle. CAD-denominated upfront quotes.

| Component | Adopted value |
| --- | --- |
| Base transportation fare | CAD 4.00 |
| Passenger-trip distance | CAD 1.80/km |
| Passenger-trip estimated duration | CAD 0.45/minute |
| Minimum transportation fare | CAD 10.00 before taxes and external charges |
| Separate booking fee | None initially |
| Surge | Disabled during initial pilot |
| Tips | Voluntary; 100% to driver |

Transportation fare F = max(CAD 10.00, CAD 4.00 + CAD 1.80 × passenger km + CAD 0.45 × estimated passenger minutes). Quote from route estimates; ordinary traffic delays do not unexpectedly increase an accepted rider price. Destination changes, added stops and chargeable waiting require a disclosed adjustment and the applicable consent. Waiting/cancellation/no-show amounts are not set by this decision.

Long pickups require a viability check before assignment: accepted quote or funded platform subsidy must cover promised driver compensation and applicable obligations. Promotions are funded by LIFTd without reducing promised driver compensation and must respect the current applicable statutory fare floor. Taxes, government trip charges, tolls and airport charges are separately accounted for and excluded from commissionable revenue. External charge amounts and legal applicability must be validated at implementation/launch.

## Driver compensation and platform allocation

Engaged time runs from accepted assignment through completion/cancellation under the applicable rules; account for pickup travel, not just passenger time. Track actual engaged distance/time and online-time earnings separately.

1. Ring-fence distance expense allowance A = CAD 0.45 × engaged motor-vehicle km, including pickup travel. Pay separately from earnings and tips; never commission it.
2. Allocate remaining transportation fare F - A: 80% driver earnings, 20% platform commission. If the allowance exceeds the fare, pay the full allowance and treat the shortage as a platform-funded obligation; never produce negative driver earnings or an allowance shortfall.
3. Guarantee driver earnings of at least CAD 25.00 per engaged hour, excluding allowance and tips. This is an engaged-time guarantee, not an online-time guarantee. Implementation must define pay-period reconciliation consistently with statutory requirements and transparently disclose the guarantee.
4. LIFTd funds all required earnings top-ups; tips/allowance cannot cover them. Statutory requirements override any lower policy amount when rates change.
5. Driver statements separately show earnings, allowance, tips, top-ups and adjustments. Promotions cannot reduce promised driver compensation.

For nonnegative fare remainder, preliminary earnings = 0.80 × (F - A); preliminary platform commission = 0.20 × (F - A). Driver total = earnings plus required top-ups plus allowance plus all tips. Refund/cancellation handling must preserve earned/statutorily owed compensation and avoid double-counting refunds and top-ups.

## Development compensation

Allocate 20% of collected LIFTd platform commission revenue to the canonical Development Compensation Vault, after attributable refunds and mandatory driver top-ups, before discretionary operating expenses. Exclude taxes, tips, driver earnings, allowances and external pass-through charges. The remaining 80% supports insurance, processing, support, infrastructure, compliance and reserves.

Development allocation cannot be negative or funded by withholding driver obligations. When adjusted platform revenue is nonpositive, development distribution is zero and the deficit remains LIFTd's responsibility. Vault recipient/controller addresses are not selected or fabricated by this policy. Settlement implementation must use canonical authority, integer arithmetic, explicit rounding and conservation; rounding residue remains accounted for.

## Reference example

10 passenger km / 20 passenger minutes, plus 2 pickup km / 5 pickup minutes: F = CAD 31.00; A = CAD 5.40; remainder = CAD 25.60; driver earnings = CAD 20.48; driver total before tips = CAD 25.88; preliminary platform revenue = CAD 5.12. The CAD 25/hour guarantee for 25 engaged minutes is approximately CAD 10.42, so no top-up is required. Development allocation rounds to CAD 1.02; platform operating remainder CAD 4.10. Taxes and external charges omitted.

## Implementation and qualification

L01.6 owns pickup viability/admission; L01.7 owns quotes, consent, policy-version binding and regulatory fare floors; L01.8 owns separate earnings/allowance/tip ledgers, top-ups, Pay finality/refunds and conserved Vault allocations. Official-testnet fund movement and independent operational acceptance stay gated. Validate insurance, processing, support and pickup costs before locking a public tariff; change fares through an explicit versioned owner decision rather than silently weakening the driver guarantee.

Regulatory source references used when adopting this policy (reverify effective rules at launch):
- https://www2.gov.bc.ca/gov/content/employment-business/employment-standards-advice/employment-standards/wages/minimum-wage
- https://www2.gov.bc.ca/gov/content/employment-business/employment-standards-advice/employment-standards/forms-resources/igm/esr-part-7-2-section-45-29
- https://www.ptboard.bc.ca/rule-17-tns-minimum-rates
- https://www2.gov.bc.ca/gov/content/transportation/vehicle-safety-enforcement/services/passenger-transportation/guidance-resources/data-requirements

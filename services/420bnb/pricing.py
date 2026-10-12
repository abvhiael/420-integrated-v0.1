"""BNB-2.4 integer-only accommodation pricing. No Pay/payment authority."""
from datetime import date,timedelta
from decimal import Decimal,ROUND_HALF_UP

MAX_MINOR=10**15

def amount(value):
    if type(value) is not int or value<0 or value>MAX_MINOR:
        raise ValueError("INVALID_MONEY")
    return value

def checked_sum(*values):
    result=sum(amount(x) for x in values)
    return amount(result)

def percent_basis_points(value,bps):
    if type(bps) is not int or not 0<=bps<=10000:raise ValueError("INVALID_BPS")
    # Round half up on aggregate amount, not on each nightly rate.
    return amount((amount(value)*bps+5000)//10000)

def quote_breakdown(checkin:date,checkout:date,units:int,base_rate:int,seasonal_rates,
                    cleaning:int,tax_bps:int,discount_bps:int,service:int=0,min_nights:int=1):
    nights=(checkout-checkin).days
    if nights<min_nights or nights<1 or nights>90:raise ValueError("MINIMUM_OR_MAXIMUM_NIGHTS")
    if type(units) is not int or units<1 or units>100:raise ValueError("INVALID_UNITS")
    for v in (base_rate,cleaning,service):amount(v)
    if not 0<=tax_bps<=10000 or not 0<=discount_bps<=10000:
        raise ValueError("INVALID_BPS")
    daily=[]
    for index in range(nights):
        day=checkin+timedelta(days=index)
        candidates=[int(rule["nightly_minor"]) for rule in seasonal_rates
                    if date.fromisoformat(rule["start"])<=day<date.fromisoformat(rule["end"])]
        if len(candidates)>1:raise ValueError("OVERLAPPING_SEASONAL_RATES")
        daily.append(amount(candidates[0] if candidates else base_rate))
    subtotal=amount(sum(daily)*units)
    discount=percent_basis_points(subtotal,discount_bps)
    taxable=checked_sum(subtotal-discount,cleaning,service)
    taxes=percent_basis_points(taxable,tax_bps)
    total=checked_sum(taxable,taxes)
    return {"nights":nights,"units":units,"nightly_rates_minor":daily,
            "subtotal_minor":subtotal,"discount_minor":discount,
            "cleaning_minor":cleaning,"service_minor":service,
            "taxable_minor":taxable,"tax_minor":taxes,"total_minor":total,
            "rounding":"half_up_on_component_aggregate","financial_finality":False}

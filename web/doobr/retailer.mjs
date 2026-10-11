// R03.6 public site must never accept unverified retailer identity or order/dispatch authority.
export function retailerStatus(_input=null){
  return Object.freeze({intake:"CLOSED",orders:"UNAVAILABLE",dispatch:"DISABLED",
    exceptions:"PRIVATE_OPERATOR_REVIEW_REQUIRED",
    reason:"Retailer intake and dispatch require licensed seller-of-record and independent operational approvals."});
}

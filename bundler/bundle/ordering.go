package bundle

import (
 "sort"
 "time"

 "github.com/420integrated/420-integrated/bundler/mempool"
)

// GenesisOrder makes the auditable Genesis candidate policy explicit at the
// execution boundary. Earlier admission wins; the canonical operation hash
// breaks timestamp ties. Fees, operator identity, sender and sponsorship never
// influence priority. Returns a copy; it does not mutate the mempool snapshot.
func GenesisOrder(entries []mempool.Entry, limit int) []mempool.Entry {
 if limit <= 0 { return nil }
 ordered := append([]mempool.Entry(nil), entries...)
 sort.Slice(ordered, func(i,j int) bool {
  a,b := ordered[i],ordered[j]
  if a.AdmittedAt.Equal(b.AdmittedAt) { return a.Hash < b.Hash }
  return a.AdmittedAt.Before(b.AdmittedAt)
 })
 if len(ordered) > limit { ordered = ordered[:limit] }
 return ordered
}

// GenesisOrderingPolicy is an operator-visible descriptor of the active
// deterministic policy, not a claim about chain inclusion or execution order.
type GenesisOrderingPolicy struct {
 Name string `json:"name"`
 Primary string `json:"primary"`
 TieBreak string `json:"tie_break"`
 FeePriority bool `json:"fee_priority"`
 PrivatePriority bool `json:"private_priority"`
 ObservedAt time.Time `json:"observed_at"`
}

func DescribeGenesisOrdering(now time.Time) GenesisOrderingPolicy {
 return GenesisOrderingPolicy{Name:"genesis-fifo-v1",Primary:"admitted_at_ascending",TieBreak:"canonical_user_operation_hash_ascending",FeePriority:false,PrivatePriority:false,ObservedAt:now.UTC()}
}

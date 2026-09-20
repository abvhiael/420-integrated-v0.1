// Package ordering defines the public Genesis candidate-selection policy.
// Selection is operational; it does not grant inclusion or settlement rights.
package ordering

import (
 "errors"
 "sort"
 "strings"

 "github.com/420integrated/420-integrated/bundler/mempool"
)

const GenesisFIFO = "fifo-v1"

// Validate rejects any unqualified policy override. An empty value uses the
// fixed Genesis policy; there is no fee bid, sponsor, sender or operator lane.
func Validate(policy string) error {
 if policy == "" || policy == GenesisFIFO { return nil }
 return errors.New("unsupported bundler ordering policy: genesis requires fifo-v1")
}

// Select copies, sorts and bounds the entire candidate snapshot BEFORE
// truncation. AdmittedAt is retained across qualified fee replacements; hash
// breaks exact-time ties. Fee, paymaster and sender never enter selection.
func Select(entries []mempool.Entry, max int, policy string) ([]mempool.Entry, error) {
 if err := Validate(policy); err != nil { return nil, err }
 if max <= 0 { return nil, errors.New("max selected operations must be positive") }
 selected := append([]mempool.Entry(nil), entries...)
 sort.Slice(selected, func(i,j int) bool {
  a,b := selected[i],selected[j]
  if a.AdmittedAt.Equal(b.AdmittedAt) {
   return strings.ToLower(a.Hash) < strings.ToLower(b.Hash)
  }
  return a.AdmittedAt.Before(b.AdmittedAt)
 })
 if len(selected)>max { selected=selected[:max] }
 return selected,nil
}

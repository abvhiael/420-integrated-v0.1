package ordering

import (
 "testing"
 "time"

 "github.com/420integrated/420-integrated/bundler/mempool"
 "github.com/420integrated/420-integrated/bundler/userop"
)

// This test records the Genesis economic boundary at the selection layer:
// fees only qualify a same-sender/nonce replacement; they do not buy queue
// priority, and sponsor/operator identity never enters ordering.
func TestGenesisFeeAndSponsorNeutralityUnderCapacity(t *testing.T) {
 now := time.Date(2026, 9, 19, 12, 0, 0, 0, time.UTC)
 entries := []mempool.Entry{
  {Hash:"0x03", AdmittedAt:now.Add(-3*time.Second), Operation:userop.PackedUserOperation{GasFees:"0x1"}},
  {Hash:"0x01", AdmittedAt:now.Add(-time.Second), Operation:userop.PackedUserOperation{GasFees:"0xffff", PaymasterAndData:"0x1234"}},
  {Hash:"0x02", AdmittedAt:now.Add(-2*time.Second), Operation:userop.PackedUserOperation{GasFees:"0xffffffffffff"}},
 }
 first,err:=Select(entries,2,GenesisFIFO)
 if err!=nil {t.Fatal(err)}
 if len(first)!=2 || first[0].Hash!="0x03" || first[1].Hash!="0x02" {
  t.Fatalf("fee/sponsorship displaced an earlier admission: %+v",first)
 }
 // Even a subsequent fee increase and sponsor change cannot change
 // admission timestamps or queue position (without a distinct replacement).
 entries[1].Operation.GasFees="0xffffffffffffffffffff"
 entries[1].Operation.PaymasterAndData="0xabcdef"
 next,err:=Select(entries,2,GenesisFIFO)
 if err!=nil {t.Fatal(err)}
 if first[0].Hash!=next[0].Hash || first[1].Hash!=next[1].Hash {
  t.Fatalf("economic metadata changed FIFO selection: %+v",next)
 }
}

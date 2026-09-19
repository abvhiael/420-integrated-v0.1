package observability

import (
 "time"
 "github.com/420integrated/420-integrated/bundler/mempool"
 "github.com/420integrated/420-integrated/bundler/simulation"
 "github.com/420integrated/420-integrated/bundler/userop"
)

type Pool interface {
 Add(userop.PackedUserOperation,simulation.Evidence,time.Time)(mempool.AddResult,error)
 Snapshot(time.Time) []mempool.Entry
 Remove(string) bool
}

type ObservedPool struct {
 Pool Pool
 Metrics *Metrics
}
func (o ObservedPool) Add(op userop.PackedUserOperation,evidence simulation.Evidence,now time.Time)(mempool.AddResult,error){
 result,err:=o.Pool.Add(op,evidence,now)
 o.Metrics.Admission(result.Duplicate,result.Replaced,err)
 return result,err
}
func (o ObservedPool) Snapshot(now time.Time)[]mempool.Entry{return o.Pool.Snapshot(now)}
func (o ObservedPool) Remove(hash string)bool{return o.Pool.Remove(hash)}

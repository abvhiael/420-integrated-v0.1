package observability

import (
 "encoding/json"
 "net/http"
 "sync/atomic"
 "time"

 "github.com/420integrated/420-integrated/status/components"
)

type Counters struct {
 Admitted uint64 `json:"admitted"`
 Duplicates uint64 `json:"duplicates"`
 Replacements uint64 `json:"replacements"`
 AdmissionFailures uint64 `json:"admission_failures"`
 Submitted uint64 `json:"submitted"`
 ValidationRejected uint64 `json:"validation_rejected"`
 SubmissionFailures uint64 `json:"submission_failures"`
}

type Snapshot struct {
 Service string `json:"service"`
 ServiceID string `json:"service_id"`
 Canonical bool `json:"canonical"`
 Authoritative bool `json:"authoritative"`
 ObservedAt string `json:"observed_at"`
 Ready bool `json:"ready"`
 ChainID uint64 `json:"chain_id"`
 EntryPoint string `json:"entry_point"`
 ActiveOperations int `json:"active_operations"`
 Counters Counters `json:"counters"`
}

type Metrics struct {
 admitted atomic.Uint64
 duplicates atomic.Uint64
 replacements atomic.Uint64
 admissionFailures atomic.Uint64
 submitted atomic.Uint64
 rejected atomic.Uint64
 submissionFailures atomic.Uint64
}
func (m *Metrics) Admission(duplicate,replaced bool,err error) {
 if err!=nil {m.admissionFailures.Add(1);return}
 if duplicate {m.duplicates.Add(1);return}
 if replaced {m.replacements.Add(1);return}
 m.admitted.Add(1)
}
func (m *Metrics) Submission(submitted,rejected,failed int) {
 if submitted>0 {m.submitted.Add(uint64(submitted))}
 if rejected>0 {m.rejected.Add(uint64(rejected))}
 if failed>0 {m.submissionFailures.Add(uint64(failed))}
}
func (m *Metrics) Counters() Counters {
 return Counters{Admitted:m.admitted.Load(),Duplicates:m.duplicates.Load(),Replacements:m.replacements.Load(),AdmissionFailures:m.admissionFailures.Load(),Submitted:m.submitted.Load(),ValidationRejected:m.rejected.Load(),SubmissionFailures:m.submissionFailures.Load()}
}
func (m *Metrics) Snapshot(now time.Time,ready bool,chainID uint64,entryPoint string,active int) Snapshot {
 if active<0 {active=0}
 return Snapshot{Service:"420Bundler",ServiceID:"420/service/bundler/v1",Canonical:false,Authoritative:false,ObservedAt:now.UTC().Format(time.RFC3339),Ready:ready,ChainID:chainID,EntryPoint:entryPoint,ActiveOperations:active,Counters:m.Counters()}
}
func (s Snapshot) Component(network,environment string) (components.Snapshot,error) {
 health:=components.HealthDegraded
 if s.Ready {health=components.HealthHealthy}
 out:=components.Snapshot{Component:components.Component{ID:s.ServiceID,Name:s.Service,Class:components.ClassRPC,Network:network,Environment:environment,Public:true},Live:true,Ready:s.Ready,Health:health,Reason:"operator telemetry only; chain evidence is authoritative",Authoritative:false}
 return out,out.Validate()
}
func Handler(snapshot func() Snapshot) http.Handler {
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  if r.Method!=http.MethodGet {w.Header().Set("Allow",http.MethodGet);http.Error(w,"method not allowed",http.StatusMethodNotAllowed);return}
  w.Header().Set("Content-Type","application/json")
  w.Header().Set("Cache-Control","no-store")
  _=json.NewEncoder(w).Encode(snapshot())
 })
}

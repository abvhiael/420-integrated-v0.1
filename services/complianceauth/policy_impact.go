package complianceauth

import (
 "errors"
 "sort"
 "time"
)

var ErrImpactSimulation=errors.New("invalid compliance impact simulation")
const maxImpactFlows=10000
// SimulationFlow carries decisions from independently qualified evaluations;
// this read-only report never creates or grants new policy authority.
type SimulationFlow struct{
 FlowID string
 OperationRef string
 Stage string
 InFlight bool
 Before string
 After string
 BeforePolicyDigest string
 AfterPolicyDigest string
}
type ImpactItem struct{
 FlowID string
 Category string
 RequiresReevaluation bool
}
type ImpactReport struct{
 BeforePolicyDigest string
 AfterPolicyDigest string
 Items []ImpactItem
 Counts map[string]int
 PolicyAuthorized bool
}
func impactOutcome(s string)bool{
 switch s{case "ALLOW","DENY","REVIEW_REQUIRED","UNKNOWN":return true};return false
}
func SimulatePolicyImpact(flows []SimulationFlow)(ImpactReport,error){
 out:=ImpactReport{Counts:map[string]int{}}
 if len(flows)==0||len(flows)>maxImpactFlows{return out,ErrImpactSimulation}
 seen:=map[string]bool{}
 for i,f:=range flows{
  if f.FlowID==""||f.OperationRef==""||f.Stage==""||seen[f.FlowID]||!impactOutcome(f.Before)||!impactOutcome(f.After)||
   !digestValid(f.BeforePolicyDigest)||!digestValid(f.AfterPolicyDigest){return ImpactReport{},ErrImpactSimulation}
  if i==0{out.BeforePolicyDigest=f.BeforePolicyDigest;out.AfterPolicyDigest=f.AfterPolicyDigest}
  if f.BeforePolicyDigest!=out.BeforePolicyDigest||f.AfterPolicyDigest!=out.AfterPolicyDigest{return ImpactReport{},ErrImpactSimulation}
  seen[f.FlowID]=true
  category:="UNCHANGED"
  switch{
  case f.Before=="ALLOW"&&f.After=="DENY":category="NEWLY_BLOCKED"
  case f.Before!="ALLOW"&&f.After=="ALLOW":category="NEWLY_ALLOWED_CANDIDATE"
  case f.Before!=f.After:category="CHANGED_REVIEW_REQUIRED"
  }
  if f.InFlight{
   // In-flight operations always require a fresh stage-specific decision.
   category="IN_FLIGHT_REEVALUATION_REQUIRED"
  }
  out.Items=append(out.Items,ImpactItem{FlowID:f.FlowID,Category:category,RequiresReevaluation:f.InFlight||f.Before!=f.After})
  out.Counts[category]++
 }
 sort.Slice(out.Items,func(i,j int)bool{return out.Items[i].FlowID<out.Items[j].FlowID})
 return out,nil
}

// ImpactEvaluationCase is evaluated against both reviewed policy snapshots
// with identical request facts; no caller-provided ALLOW outcome is trusted.
type ImpactEvaluationCase struct{
 FlowID string
 Request EvaluationRequest
 InFlight bool
}
func SimulateReviewedPolicyImpact(beforeService,afterService EvaluationService,beforePolicy,afterPolicy ReviewedPolicy,cases []ImpactEvaluationCase,at time.Time)(ImpactReport,error){
 if len(cases)==0||len(cases)>maxImpactFlows||at.IsZero(){return ImpactReport{},ErrImpactSimulation}
 beforeDigest:=beforePolicy.Manifest.Manifest.PolicyDigest
 afterDigest:=afterPolicy.Manifest.Manifest.PolicyDigest
 if !digestValid(beforeDigest)||!digestValid(afterDigest){return ImpactReport{},ErrImpactSimulation}
 flows:=make([]SimulationFlow,0,len(cases))
 for _,c:=range cases{
  if c.FlowID==""||c.Request.OperationRef==""||c.Request.Stage==""{return ImpactReport{},ErrImpactSimulation}
  old:=beforeService.Evaluate(beforePolicy,c.Request,at)
  newResult:=afterService.Evaluate(afterPolicy,c.Request,at)
  flows=append(flows,SimulationFlow{
   FlowID:c.FlowID,OperationRef:c.Request.OperationRef,Stage:c.Request.Stage,InFlight:c.InFlight,
   Before:old.Outcome,After:newResult.Outcome,BeforePolicyDigest:beforeDigest,AfterPolicyDigest:afterDigest,
  })
 }
 return SimulatePolicyImpact(flows)
}

package complianceauth

import (
 "errors"
 "sort"
 "strings"
)

var ErrCompositionInvalid=errors.New("invalid compliance policy composition")

// ComposedRequirement binds a legal scope to the independently reviewed rule
// covering it. NONE of these records independently authorize an ALLOW.
type ComposedRequirement struct {
 Scope string
 Jurisdiction string
 RuleID string
 PolicyDigest string
 ReviewDigest string
 ReviewState string
 Outcome string // DENY, REVIEW_REQUIRED, or ALLOW_CANDIDATE
}
type CompositionRequest struct {
 RequiredScopes []string
 ApplicableJurisdictions []string
 Requirements []ComposedRequirement
}
type CompositionDecision struct{
 Outcome string
 Reasons []string
 CoveredScopes []string
 PolicyAuthorized bool
}
// ComposeReviewedPolicy is fail-closed even when every reviewed input is an
// ALLOW_CANDIDATE. The independent authorized publisher/evaluator is separate.
func ComposeReviewedPolicy(req CompositionRequest)(CompositionDecision,error){
 out:=CompositionDecision{Outcome:"REVIEW_REQUIRED",PolicyAuthorized:false}
 if !validNames(req.RequiredScopes)||!validNames(req.ApplicableJurisdictions){return out,ErrCompositionInvalid}
 needs:=map[string]bool{}
 for _,scope:=range req.RequiredScopes{for _,jur:=range req.ApplicableJurisdictions{needs[scope+"\x00"+jur]=true}}
 seen:=map[string]string{}
 denied:=false;review:=false
 for _,item:=range req.Requirements{
  key:=item.Scope+"\x00"+item.Jurisdiction
  if !needs[key]||item.RuleID==""||strings.TrimSpace(item.RuleID)!=item.RuleID||!digestValid(item.PolicyDigest)||!digestValid(item.ReviewDigest){return out,ErrCompositionInvalid}
  switch item.Outcome{case "DENY":denied=true;case "REVIEW_REQUIRED":review=true;case "ALLOW_CANDIDATE":default:return out,ErrCompositionInvalid}
  if item.ReviewState!="INDEPENDENTLY_REVIEWED"{review=true}
  if prior,ok:=seen[key];ok{
   if prior!=item.Outcome{out.Reasons=append(out.Reasons,"AUTHORITY_CONFLICT")}else{out.Reasons=append(out.Reasons,"DUPLICATE_SCOPE")}
   review=true
  }
  seen[key]=item.Outcome
 }
 for key:=range needs{if _,ok:=seen[key];!ok{out.Reasons=append(out.Reasons,"OMITTED_REQUIRED_SCOPE");review=true}else{out.CoveredScopes=append(out.CoveredScopes,key)}}
 sort.Strings(out.Reasons);sort.Strings(out.CoveredScopes)
 if denied {out.Outcome="DENY";return out,nil}
 if review||len(out.Reasons)!=0{out.Outcome="REVIEW_REQUIRED";return out,nil}
 out.Outcome="REVIEWED_CANDIDATE_AUTHORIZATION_REQUIRED"
 return out,nil
}

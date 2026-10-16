package complianceauth

import (
 "errors"
 "math/big"
 "sort"
)

var ErrPolicyCompile=errors.New("invalid deterministic policy program")
const maxPolicyInstructions=128
const maxPolicyFacts=128
const maxDecimalDigits=38

// A policy program is deliberately non-Turing-complete: no jumps, calls, loops,
// external I/O, runtime templates, or dynamically supplied code.
type PolicyLimit struct{
 RuleID string
 Fact string
 Unit string
 MaximumDecimal string // nonnegative integer in the unit's smallest canonical subdivision
 Obligation string
}
type CompiledPolicy struct{
 Version string
 Limits []PolicyLimit
}
type PolicyQuantity struct{
 Unit string
 Decimal string
}
type PolicyEvalInput struct{
 Facts map[string]PolicyQuantity
}
type PolicyEvalResult struct{
 Outcome string
 ReasonCodes []string
 Obligations []string
 Executed int
 PolicyAuthorized bool
}
func exactUnsignedDecimal(value string)(*big.Int,error){
 if len(value)==0||len(value)>maxDecimalDigits{return nil,ErrPolicyCompile}
 for _,digit:=range value{if digit<'0'||digit>'9'{return nil,ErrPolicyCompile}}
 n,ok:=new(big.Int).SetString(value,10);if !ok{return nil,ErrPolicyCompile}
 return n,nil
}
func CompileBoundedPolicy(program CompiledPolicy)(CompiledPolicy,error){
 if program.Version!="420compliance-bounded/v1"||len(program.Limits)==0||len(program.Limits)>maxPolicyInstructions{return CompiledPolicy{},ErrPolicyCompile}
 copyProgram:=CompiledPolicy{Version:program.Version,Limits:append([]PolicyLimit(nil),program.Limits...)}
 seen:=map[string]bool{}
 for _,rule:=range copyProgram.Limits{
  if rule.RuleID==""||rule.Fact==""||rule.Unit==""||rule.Obligation==""||len(rule.RuleID)>128||len(rule.Fact)>128||len(rule.Unit)>32||len(rule.Obligation)>256||seen[rule.RuleID]{
   return CompiledPolicy{},ErrPolicyCompile
  }
  if _,err:=exactUnsignedDecimal(rule.MaximumDecimal);err!=nil{return CompiledPolicy{},err}
  seen[rule.RuleID]=true
 }
 sort.Slice(copyProgram.Limits,func(i,j int)bool{return copyProgram.Limits[i].RuleID<copyProgram.Limits[j].RuleID})
 return copyProgram,nil
}
func EvaluateBoundedPolicy(program CompiledPolicy, input PolicyEvalInput)PolicyEvalResult{
 out:=PolicyEvalResult{Outcome:"REVIEW_REQUIRED"}
 compiled,err:=CompileBoundedPolicy(program)
 if err!=nil {out.ReasonCodes=[]string{"INVALID_POLICY_PROGRAM"};return out}
 if len(input.Facts)>maxPolicyFacts {out.ReasonCodes=[]string{"FACT_BUDGET_EXCEEDED"};return out}
 missing:=false;denied:=false
 for _,rule:=range compiled.Limits{
  out.Executed++
  fact,ok:=input.Facts[rule.Fact]
  if !ok{missing=true;out.ReasonCodes=append(out.ReasonCodes,"MISSING_FACT:"+rule.RuleID);continue}
  if fact.Unit!=rule.Unit {missing=true;out.ReasonCodes=append(out.ReasonCodes,"UNIT_MISMATCH:"+rule.RuleID);continue}
  actual,e:=exactUnsignedDecimal(fact.Decimal);if e!=nil {missing=true;out.ReasonCodes=append(out.ReasonCodes,"INVALID_QUANTITY:"+rule.RuleID);continue}
  max,_:=exactUnsignedDecimal(rule.MaximumDecimal)
  if actual.Cmp(max)>0{denied=true;out.ReasonCodes=append(out.ReasonCodes,"MAX_EXCEEDED:"+rule.RuleID);continue}
  out.Obligations=append(out.Obligations,rule.Obligation)
 }
 sort.Strings(out.ReasonCodes);sort.Strings(out.Obligations)
 if denied{out.Outcome="DENY"}else if missing{out.Outcome="REVIEW_REQUIRED"}else{out.Outcome="CANDIDATE_AUTHORIZATION_REQUIRED"}
 return out
}

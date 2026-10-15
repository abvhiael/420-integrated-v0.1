package complianceauth
import("testing";"strings";"reflect")
func TestC035DeterministicBoundedPolicy(t *testing.T){
 p:=CompiledPolicy{Version:"420compliance-bounded/v1",Limits:[]PolicyLimit{{RuleID:"z",Fact:"quantity",Unit:"mg",MaximumDecimal:"9007199254740993",Obligation:"keep-receipt"},{RuleID:"a",Fact:"weight",Unit:"g",MaximumDecimal:"10",Obligation:"verify-weight"}}}
 valid:=PolicyEvalInput{Facts:map[string]PolicyQuantity{"quantity":{Unit:"mg",Decimal:"9007199254740993"},"weight":{Unit:"g",Decimal:"10"}}}
 result:=EvaluateBoundedPolicy(p,valid)
 if result.Outcome!="CANDIDATE_AUTHORIZATION_REQUIRED"||result.PolicyAuthorized||result.Executed!=2||len(result.Obligations)!=2{t.Fatalf("valid deterministic output %+v",result)}
 reversed:=p;reversed.Limits=[]PolicyLimit{p.Limits[1],p.Limits[0]}
 if got:=EvaluateBoundedPolicy(reversed,valid);!reflect.DeepEqual(result,got){t.Fatalf("unstable program order: %+v %+v",result,got)}
 cases:=[]struct{name string; facts PolicyEvalInput; expected string}{
 {"over max",PolicyEvalInput{Facts:map[string]PolicyQuantity{"quantity":{Unit:"mg",Decimal:"9007199254740994"},"weight":{Unit:"g",Decimal:"10"}}},"DENY"},
 {"missing fact",PolicyEvalInput{Facts:map[string]PolicyQuantity{"quantity":{Unit:"mg",Decimal:"1"}}},"REVIEW_REQUIRED"},
 {"wrong units",PolicyEvalInput{Facts:map[string]PolicyQuantity{"quantity":{Unit:"grams",Decimal:"1"},"weight":{Unit:"g",Decimal:"10"}}},"REVIEW_REQUIRED"},
 {"negative",PolicyEvalInput{Facts:map[string]PolicyQuantity{"quantity":{Unit:"mg",Decimal:"-1"},"weight":{Unit:"g",Decimal:"10"}}},"REVIEW_REQUIRED"},
 {"float",PolicyEvalInput{Facts:map[string]PolicyQuantity{"quantity":{Unit:"mg",Decimal:"1.5"},"weight":{Unit:"g",Decimal:"10"}}},"REVIEW_REQUIRED"},
 }
 for _,tc:=range cases{t.Run(tc.name,func(t *testing.T){d:=EvaluateBoundedPolicy(p,tc.facts);if d.Outcome!=tc.expected||d.PolicyAuthorized||len(d.ReasonCodes)==0{t.Fatalf("%+v",d)}})}
 huge:=CompiledPolicy{Version:p.Version};for i:=0;i<129;i++{huge.Limits=append(huge.Limits,PolicyLimit{RuleID:strings.Repeat("x",i+1),Fact:"a",Unit:"g",MaximumDecimal:"1",Obligation:"log"})}
 if d:=EvaluateBoundedPolicy(huge,valid);d.Outcome!="REVIEW_REQUIRED"||d.Executed!=0{t.Fatal("unbounded program accepted")}
 dup:=p;dup.Limits=[]PolicyLimit{p.Limits[0],p.Limits[0]}
 if _,e:=CompileBoundedPolicy(dup);e==nil{t.Fatal("duplicate rule IDs accepted")}
 for _,quantity:=range []string{"-1","1.0","1e5","",strings.Repeat("9",39)}{
  invalid:=p;invalid.Limits=append([]PolicyLimit(nil),p.Limits...);invalid.Limits[0].MaximumDecimal=quantity
  if _,e:=CompileBoundedPolicy(invalid);e==nil{t.Fatalf("unsafe quantity accepted %q",quantity)}
 }
}

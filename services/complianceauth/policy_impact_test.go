package complianceauth
import("testing";"reflect")
func TestC039PolicyImpactReport(t *testing.T){
 old,new:=Digest([]byte("old")),Digest([]byte("new"))
 makeFlow:=func(id,before,after string,inFlight bool)SimulationFlow{return SimulationFlow{FlowID:id,OperationRef:"order-"+id,Stage:"checkout",InFlight:inFlight,Before:before,After:after,BeforePolicyDigest:old,AfterPolicyDigest:new}}
 flows:=[]SimulationFlow{makeFlow("c","ALLOW","DENY",false),makeFlow("a","DENY","ALLOW",false),makeFlow("d","ALLOW","ALLOW",false),makeFlow("b","ALLOW","REVIEW_REQUIRED",true),makeFlow("e","UNKNOWN","DENY",false)}
 report,err:=SimulatePolicyImpact(flows)
 if err!=nil||report.PolicyAuthorized||report.Counts["NEWLY_BLOCKED"]!=1||report.Counts["NEWLY_ALLOWED_CANDIDATE"]!=1||report.Counts["IN_FLIGHT_REEVALUATION_REQUIRED"]!=1||report.Counts["UNCHANGED"]!=1||report.Counts["CHANGED_REVIEW_REQUIRED"]!=1{t.Fatalf("%+v %v",report,err)}
 if report.Items[0].FlowID!="a"||!report.Items[1].RequiresReevaluation{t.Fatalf("noncanonical result %+v",report.Items)}
 reversed:=append([]SimulationFlow(nil),flows...);for i,j:=0,len(reversed)-1;i<j;i,j=i+1,j-1{reversed[i],reversed[j]=reversed[j],reversed[i]}
 other,err:=SimulatePolicyImpact(reversed);if err!=nil||!reflect.DeepEqual(report,other){t.Fatal("input order changed report")}
 bad:=append([]SimulationFlow(nil),flows...);bad[0].BeforePolicyDigest=Digest([]byte("foreign"))
 if _,err:=SimulatePolicyImpact(bad);err==nil{t.Fatal("mixed policy digests accepted")}
 bad=append([]SimulationFlow(nil),flows...);bad[0].After="INVALID"
 if _,err:=SimulatePolicyImpact(bad);err==nil{t.Fatal("unrecognized outcome accepted")}
 bad=append(append([]SimulationFlow(nil),flows...),flows[0])
 if _,err:=SimulatePolicyImpact(bad);err==nil{t.Fatal("duplicate flow accepted")}
 if _,err:=SimulatePolicyImpact(nil);err==nil{t.Fatal("empty simulation accepted")}
 oversized:=make([]SimulationFlow,maxImpactFlows+1)
 if _,err:=SimulatePolicyImpact(oversized);err==nil{t.Fatal("unbounded simulation accepted")}
}

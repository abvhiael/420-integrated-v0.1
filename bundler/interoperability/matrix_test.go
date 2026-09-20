package interoperability

import (
 "context"
 "net/http/httptest"
 "strings"
 "testing"
)

func TestMultiOperatorMatrixIndependentOutcomes(t *testing.T){
 first:=&scriptedOperator{points:[]string{fixtureEntryPoint},receipt:nil}
 second:=&scriptedOperator{points:[]string{fixtureEntryPoint},receipt:nil}
 a:=httptest.NewServer(first);defer a.Close()
 b:=httptest.NewServer(second);defer b.Close()
 probe:=Probe{EntryPoint:fixtureEntryPoint}
 matrix,err:=probe.CheckOperators(context.Background(),[]string{a.URL,b.URL})
 if err!=nil{t.Fatal(err)}
 if !matrix.AllQualified||!matrix.MultiEndpointQualified||matrix.Qualified!=2||len(matrix.Operators)!=2{t.Fatalf("unexpected qualification: %+v",matrix)}
 if len(first.requests)!=2||len(second.requests)!=2{t.Fatalf("endpoints not probed independently: first=%v second=%v",first.requests,second.requests)}
 for _,requests:=range [][]string{first.requests,second.requests}{for _,method:=range requests{if method=="eth_sendUserOperation"{t.Fatal("qualification submitted an operation")}}}
}

func TestMatrixReportsFailedOperatorWithoutHidingPassingOperator(t *testing.T){
 good:=httptest.NewServer(&scriptedOperator{points:[]string{fixtureEntryPoint},receipt:nil});defer good.Close()
 bad:=httptest.NewServer(&scriptedOperator{points:[]string{"0x2222222222222222222222222222222222222222"}});defer bad.Close()
 matrix,err:=(Probe{EntryPoint:fixtureEntryPoint}).CheckOperators(context.Background(),[]string{good.URL,bad.URL})
 if err!=nil{t.Fatal(err)}
 if matrix.Qualified!=1||matrix.AllQualified||matrix.MultiEndpointQualified||matrix.Operators[0].Error!=""||!matrix.Operators[0].Result.Supported||matrix.Operators[1].Error=="" {t.Fatalf("operator failure was masked: %+v",matrix)}
}

func TestMatrixRejectsDuplicateAndDoesNotCallOperator(t *testing.T){
 operator:=&scriptedOperator{points:[]string{fixtureEntryPoint},receipt:nil}
 server:=httptest.NewServer(operator);defer server.Close()
 _,err:=(Probe{EntryPoint:fixtureEntryPoint}).CheckOperators(context.Background(),[]string{server.URL,strings.Replace(server.URL,"http://","HTTP://",1)})
 if err==nil||!strings.Contains(err.Error(),"duplicate"){t.Fatalf("duplicate not rejected: %v",err)}
}

func TestOneOperatorDoesNotClaimMultiOperatorQualification(t *testing.T){
 operator:=httptest.NewServer(&scriptedOperator{points:[]string{fixtureEntryPoint},receipt:nil});defer operator.Close()
 matrix,err:=(Probe{EntryPoint:fixtureEntryPoint}).CheckOperators(context.Background(),[]string{operator.URL})
 if err!=nil{t.Fatal(err)}
 if !matrix.AllQualified||matrix.MultiEndpointQualified{t.Fatalf("single endpoint claims multi-operator qualification: %+v",matrix)}
}

func TestMatrixRejectsEmptyAndUnboundedInputs(t *testing.T){
 probe:=Probe{EntryPoint:fixtureEntryPoint}
 if _,err:=probe.CheckOperators(context.Background(),nil);err==nil{t.Fatal("empty endpoint list allowed")}
 endpoints:=make([]string,17)
 for i:=range endpoints{endpoints[i]="http://localhost:1"}
 if _,err:=probe.CheckOperators(context.Background(),endpoints);err==nil{t.Fatal("unbounded endpoint list allowed")}
}

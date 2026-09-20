package interoperability

import (
 "context"
 "errors"
 "fmt"
 "net/url"
 "strings"
)

// OperatorResult preserves each operator's independent read-only probe outcome.
// Passing this local matrix is NOT proof of independent ownership or production acceptance.
type OperatorResult struct {
 Endpoint string
 Result Result
 Error string
}

type Matrix struct {
 Operators []OperatorResult
 Qualified int
 AllQualified bool
 MultiEndpointQualified bool
}

// CheckOperators probes every distinct configured endpoint and returns a full
// result matrix. No candidate is submitted, and failure at one endpoint never
// authorizes an automatic send to another endpoint.
func (p Probe) CheckOperators(ctx context.Context, endpoints []string) (Matrix,error) {
 if len(endpoints)==0 {return Matrix{},errors.New("at least one operator endpoint is required")}
 if len(endpoints)>16 {return Matrix{},errors.New("operator matrix exceeds 16 endpoints")}
 seen:=make(map[string]struct{},len(endpoints))
 matrix:=Matrix{Operators:make([]OperatorResult,0,len(endpoints))}
 for _,raw:=range endpoints {
  parsed,err:=url.Parse(raw)
  if err!=nil||parsed.Scheme==""||parsed.Host=="" {return Matrix{},fmt.Errorf("invalid operator endpoint %q",raw)}
  // Normalize only the transport identity, not the path or query, so distinct
  // services on one origin can still be checked separately.
  parsed.Scheme=strings.ToLower(parsed.Scheme)
  parsed.Host=strings.ToLower(parsed.Host)
  key:=parsed.String()
  if _,exists:=seen[key];exists {return Matrix{},fmt.Errorf("duplicate operator endpoint %q",raw)}
  seen[key]=struct{}{}
  record:=OperatorResult{Endpoint:raw}
  result,probeErr:=p.Check(ctx,raw)
  if probeErr!=nil {record.Error=probeErr.Error()} else {record.Result=result;matrix.Qualified++}
  matrix.Operators=append(matrix.Operators,record)
 }
 matrix.AllQualified=matrix.Qualified==len(matrix.Operators)
 matrix.MultiEndpointQualified=matrix.AllQualified&&len(matrix.Operators)>=2
 return matrix,nil
}

package complianceauth

import (
 "context"
 "errors"
 "strings"
 "testing"
)

func TestC065IndependentReviewNegativeBoundary(t *testing.T) {
 s:=C065ReviewService{}
 got,err:=s.Review(context.Background(),C065ReviewInput{})
 if !errors.Is(err,ErrC065Review)||got.State!="" {
  t.Fatalf("unconfigured review must fail closed: %+v %v",got,err)
 }
 if c065FindingsValid(nil,nil,"APPROVED_CANDIDATE")==false {
  t.Fatal("clean review should have valid shape (authority checked separately)")
 }
 if c065FindingsValid(nil,[]string{"conflict-1"},"APPROVED_CANDIDATE") {
  t.Fatal("unresolved conflict cannot approve")
 }
 if c065FindingsValid(nil,nil,"CONFLICT_QUEUE") {
  t.Fatal("empty conflict queue cannot be submitted")
 }
 bad:=C065Finding{Code:"finding-1",Explanation:"Mismatch with cited source",Severity:"BLOCKING",
  Citation:C064CitationRef{SourceID:"source-1",Digest:strings.Repeat("a",64),Locator:"section 1"}}
 if c065FindingsValid([]C065Finding{bad},nil,"APPROVED_CANDIDATE") {
  t.Fatal("blocking finding cannot approve")
 }
 if c065FindingsValid([]C065Finding{bad,bad},nil,"FINDINGS_OPEN") {
  t.Fatal("duplicate finding code accepted")
 }
 if c065FindingsValid(nil,[]string{"duplicate","duplicate"},"CONFLICT_QUEUE") {
  t.Fatal("duplicate conflict ID accepted")
 }
 if c065FindingsValid(nil,nil,"PUBLISHED") {
  t.Fatal("review cannot publish")
 }
 if c065Digest(ImpactReport{})!=c065Digest(ImpactReport{}) {
  t.Fatal("canonical digest nondeterministic")
 }
}
func TestC065PostgreSQLReviewFailsClosedWithoutConnection(t *testing.T){
 s:=C065PostgreSQLReviews{}
 if err:=s.Migrate(context.Background());!errors.Is(err,ErrUnavailable){t.Fatalf("migration: %v",err)}
 _,err:=s.AppendIfCurrent(context.Background(),C065ReviewRecord{},1,0)
 if !errors.Is(err,ErrC065Review){t.Fatalf("invalid review accepted: %v",err)}
}

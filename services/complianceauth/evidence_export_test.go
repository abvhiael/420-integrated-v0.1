package complianceauth
import("crypto/sha256";"encoding/hex";"errors";"testing";"time")
func TestEvidenceExportTermsAndReviewerAccess(t *testing.T){
 now:=time.Date(2026,10,10,20,0,0,0,time.UTC)
 original:=[]byte("Official legal source bytes");h:=sha256.Sum256(original);digest:=hex.EncodeToString(h[:])
 record:=SnapshotRecord{SourceID:"FED-ACT",Digest:digest,Status:"PARSED_PENDING_REVIEW"}
 terms:=RetentionTerms{SourceID:"FED-ACT",PublisherTermsRef:"official-permissions-review-id",ArchivePermitted:true,ExportPermitted:true,ReviewerOnly:true,PermittedUntil:now.Add(time.Hour),MaxExportBytes:1024}
 req:=ExportRequest{ActorID:"reviewer-1",Authenticated:true,ReviewerAuthorized:true,SourceID:"FED-ACT",RequestedAt:now}
 exported,err:=ExportSnapshot(record,original,terms,req)
 if err!=nil||exported.PolicyApproved||exported.OriginalSHA256!=digest{t.Fatalf("valid export %+v %v",exported,err)}
 original[0]='X';if exported.Original[0]=='X'{t.Fatal("export retained mutable input")}
 check:=func(name string,modify func(*SnapshotRecord,*RetentionTerms,*ExportRequest, *[]byte)){t.Run(name,func(t *testing.T){r:=record;p:=terms;a:=req;bytes:=append([]byte(nil),exported.Original...);modify(&r,&p,&a,&bytes);if _,e:=ExportSnapshot(r,bytes,p,a);!errors.Is(e,ErrExportDenied){t.Fatalf("unexpected access %v",e)}})}
 check("unauthenticated",func(_ *SnapshotRecord,_ *RetentionTerms,r *ExportRequest,_ *[]byte){r.Authenticated=false})
 check("nonreviewer",func(_ *SnapshotRecord,_ *RetentionTerms,r *ExportRequest,_ *[]byte){r.ReviewerAuthorized=false})
 check("no archive grant",func(_ *SnapshotRecord,p *RetentionTerms,_ *ExportRequest,_ *[]byte){p.ArchivePermitted=false})
 check("no export grant",func(_ *SnapshotRecord,p *RetentionTerms,_ *ExportRequest,_ *[]byte){p.ExportPermitted=false})
 check("expired licence",func(_ *SnapshotRecord,p *RetentionTerms,_ *ExportRequest,_ *[]byte){p.PermittedUntil=now})
 check("missing publisher terms",func(_ *SnapshotRecord,p *RetentionTerms,_ *ExportRequest,_ *[]byte){p.PublisherTermsRef=""})
 check("oversize",func(_ *SnapshotRecord,p *RetentionTerms,_ *ExportRequest,_ *[]byte){p.MaxExportBytes=1})
 check("tampered digest",func(_ *SnapshotRecord,_ *RetentionTerms,_ *ExportRequest,b *[]byte){(*b)[0]='Z'})
 check("other source",func(_ *SnapshotRecord,_ *RetentionTerms,r *ExportRequest,_ *[]byte){r.SourceID="BC-ACT"})
 check("quarantined",func(r *SnapshotRecord,_ *RetentionTerms,_ *ExportRequest,_ *[]byte){r.Status="QUARANTINED"})
}

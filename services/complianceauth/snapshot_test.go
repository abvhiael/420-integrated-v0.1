package complianceauth
import("errors";"os";"path/filepath";"testing";"time")
type archiveParser struct{failed bool}
func(p archiveParser)Parse(_ string, body []byte)(ParseResult,error){if p.failed{return ParseResult{},errors.New("corrupt document")};return ParseResult{Text:string(body),Version:"fixture-v1",Anchors:[]CitationAnchor{{Locator:"section:1",Excerpt:"official text"}}},nil}
func TestSnapshotArchiveHistoryAndQuarantine(t *testing.T){
 dir:=t.TempDir();archive:=SnapshotArchive{Root:dir,Parser:archiveParser{}}
 tm:=time.Date(2026,10,10,12,0,0,0,time.UTC)
 body:=[]byte("<html>official text</html>")
 makeSnap:=func(at time.Time,b []byte)Snapshot{return Snapshot{SourceID:"FED-ACT",Status:200,ContentType:"text/html",Body:b,Digest:Digest(b),RetrievedAt:at,Archived:true}}
 first,err:=archive.Ingest(makeSnap(tm,body));if err!=nil||first.Status!="PARSED_PENDING_REVIEW"||first.ParserVersion!="fixture-v1"||len(first.Citations)!=1{t.Fatalf("snapshot %+v %v",first,err)}
 second,err:=archive.Ingest(makeSnap(tm.Add(time.Second),[]byte("<html>amended</html>")));if err!=nil||second.PreviousDigest!=first.Digest{t.Fatalf("history chain %+v %v",second,err)}
 history,err:=archive.History("FED-ACT");if err!=nil||len(history)!=2{t.Fatalf("history %v %v",history,err)}
 if _,err:=archive.Ingest(makeSnap(tm,body));err==nil{t.Fatal("duplicate overwrote immutable evidence")}
 q:=SnapshotArchive{Root:dir,Parser:archiveParser{failed:true}}
 record,err:=q.Ingest(makeSnap(tm.Add(2*time.Second),[]byte("invalid")));if !errors.Is(err,ErrQuarantined)||record.Status!="QUARANTINED"{t.Fatalf("corrupt input accepted: %+v %v",record,err)}
 history,err=archive.History("FED-ACT");if err!=nil||len(history)!=3||history[2].Status!="QUARANTINED"{t.Fatal("quarantine record not durable",err)}
 if _,err=archive.History("../escape");!errors.Is(err,ErrUnsafeSource){t.Fatal("path traversal accepted")}
 if _,err=archive.Ingest(Snapshot{SourceID:"../escape",Status:200,ContentType:"text/html",Body:body,Digest:Digest(body),RetrievedAt:tm,Archived:true});!errors.Is(err,ErrUnsafeSource){t.Fatal("unsafe path accepted")}
 if _,err=archive.Ingest(Snapshot{SourceID:"FED-ACT",Status:200,Body:body,Digest:"wrong",RetrievedAt:tm.Add(4*time.Second),Archived:true});err==nil{t.Fatal("digest mismatch accepted")}
 target:=filepath.Join(dir,"FED-ACT")
 entries,err:=os.ReadDir(target);if err!=nil{t.Fatal(err)}
 for _,entry:=range entries{if filepath.Ext(entry.Name())==".raw"{if err:=os.WriteFile(filepath.Join(target,entry.Name()),[]byte("tampered"),0600);err!=nil{t.Fatal(err)};break}}
 if _,err=archive.History("FED-ACT");!errors.Is(err,ErrUnsafeSource){t.Fatal("tampered stored evidence not detected")}
}

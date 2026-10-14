package complianceauth

import (
 "crypto/sha256"
 "encoding/hex"
 "encoding/json"
 "errors"
 "fmt"
 "os"
 "path/filepath"
 "regexp"
 "sort"
 "strings"
 "time"
)
var ErrQuarantined=errors.New("source snapshot quarantined")
var sourceIDPattern=regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$`)
type CitationAnchor struct{Locator string `json:"locator"`; Excerpt string `json:"excerpt"`}
type ParseResult struct{Text string; Anchors []CitationAnchor; Version string}
type DocumentParser interface{Parse(contentType string,body []byte)(ParseResult,error)}
type SnapshotRecord struct {
 SourceID string `json:"source_id"`
 Digest string `json:"digest"`
 ContentType string `json:"content_type"`
 ParserVersion string `json:"parser_version"`
 Citations []CitationAnchor `json:"citations"`
 RetrievedAt time.Time `json:"retrieved_at"`
 PreviousDigest string `json:"previous_digest,omitempty"`
 Status string `json:"status"`
 Reason string `json:"reason,omitempty"`
}
type SnapshotArchive struct{ Root string; Parser DocumentParser }
// This is a local, append-only crash-recoverable prototype. A production multi-instance
// implementation requires database locking, immutable object storage and retention policy.
func(a SnapshotArchive) Ingest(s Snapshot)(SnapshotRecord,error){
 if !sourceIDPattern.MatchString(s.SourceID)||a.Root==""||s.NotModified||s.Status!=200||len(s.Body)==0||!s.Archived{return SnapshotRecord{},ErrUnsafeSource}
 sum:=sha256.Sum256(s.Body);digest:=hex.EncodeToString(sum[:])
 if s.Digest!=digest||s.RetrievedAt.IsZero(){return SnapshotRecord{},ErrUnsafeSource}
 dir:=filepath.Join(a.Root,s.SourceID)
 if err:=os.MkdirAll(dir,0700);err!=nil{return SnapshotRecord{},err}
 history,err:=a.History(s.SourceID);if err!=nil{return SnapshotRecord{},err}
 record:=SnapshotRecord{SourceID:s.SourceID,Digest:digest,ContentType:s.ContentType,RetrievedAt:s.RetrievedAt,Status:"QUARANTINED"}
 if len(history)>0{record.PreviousDigest=history[len(history)-1].Digest}
 if a.Parser==nil{record.Reason="PARSER_UNAVAILABLE"}else{
  result,parseErr:=a.Parser.Parse(s.ContentType,s.Body)
  if parseErr!=nil||strings.TrimSpace(result.Text)==""||result.Version==""||len(result.Anchors)==0{record.Reason="INVALID_OR_UNPARSEABLE"}else{
   valid:=true
   for _,anchor:=range result.Anchors{if strings.TrimSpace(anchor.Locator)==""||strings.TrimSpace(anchor.Excerpt)==""{valid=false;break}}
   if valid{record.Status="PARSED_PENDING_REVIEW";record.ParserVersion=result.Version;record.Citations=result.Anchors}else{record.Reason="INVALID_CITATION_ANCHOR"}
  }
 }
 // Record is unique by instant and digest, preventing overwrite and preserving history.
 name:=fmt.Sprintf("%020d-%s",s.RetrievedAt.UTC().UnixNano(),digest)
 rawPath:=filepath.Join(dir,name+".raw")
 metaPath:=filepath.Join(dir,name+".json")
 // Exclusive writes reject concurrent duplicates; write full body before metadata.
 f,err:=os.OpenFile(rawPath,os.O_WRONLY|os.O_CREATE|os.O_EXCL,0600);if err!=nil{return SnapshotRecord{},err}
 n,writeErr:=f.Write(s.Body);closeErr:=f.Close()
 if writeErr!=nil||closeErr!=nil||n!=len(s.Body){return SnapshotRecord{},ErrUnsafeSource}
 encoded,err:=json.MarshalIndent(record,"","  ");if err!=nil{return SnapshotRecord{},err}
 mf,err:=os.OpenFile(metaPath,os.O_WRONLY|os.O_CREATE|os.O_EXCL,0600);if err!=nil{return SnapshotRecord{},err}
 _,writeErr=mf.Write(encoded);closeErr=mf.Close();if writeErr!=nil{return SnapshotRecord{},writeErr};if closeErr!=nil{return SnapshotRecord{},closeErr}
 if record.Status=="QUARANTINED"{return record,ErrQuarantined}
 return record,nil
}
func(a SnapshotArchive) History(sourceID string)([]SnapshotRecord,error){
 if !sourceIDPattern.MatchString(sourceID)||a.Root==""{return nil,ErrUnsafeSource}
 entries,err:=os.ReadDir(filepath.Join(a.Root,sourceID));if os.IsNotExist(err){return []SnapshotRecord{},nil};if err!=nil{return nil,err}
 sort.Slice(entries,func(i,j int)bool{return entries[i].Name()<entries[j].Name()})
 history:=make([]SnapshotRecord,0)
 for _,entry:=range entries{
  if entry.IsDir()||!strings.HasSuffix(entry.Name(),".json"){continue}
  data,err:=os.ReadFile(filepath.Join(a.Root,sourceID,entry.Name()));if err!=nil{return nil,err}
  var record SnapshotRecord
  if err=json.Unmarshal(data,&record);err!=nil{return nil,err}
  if record.SourceID!=sourceID||!sourceIDPattern.MatchString(record.SourceID){return nil,ErrUnsafeSource}
  rawName:=strings.TrimSuffix(entry.Name(),".json")+".raw"
  body,err:=os.ReadFile(filepath.Join(a.Root,sourceID,rawName));if err!=nil{return nil,err}
  sum:=sha256.Sum256(body)
  if record.Digest!=hex.EncodeToString(sum[:]){return nil,ErrUnsafeSource}
  history=append(history,record)
 }
 return history,nil
}

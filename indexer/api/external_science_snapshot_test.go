package api

import (
 "net/http/httptest"
 "os"
 "path/filepath"
 "strings"
 "testing"
 "time"
 "strconv"
)
func TestSnapshotScienceSourceConnectedAndSanitized(t *testing.T) {
 file:=filepath.Join(t.TempDir(),"science.json")
 data:=`{"schemaVersion":"420-science-read-v1","chainId":"420","authoritative":false,"rewardEligible":false,"total":1,"items":[{"chainId":"420","provider":"BOINC","project":"project","workKey":"`+strings.Repeat("a",64)+`","creditUnit":"BOINC_CREDIT","creditedEvent":"12","observedAt":`
 data+=func() string{return strconv.FormatInt(time.Now().UnixMilli(),10)}()
 data+=`,"eligibility":"VERIFIED","finality":"FINALIZED","authoritative":false,"rewardEligible":false,"amount420":null}]}`
 if err:=os.WriteFile(file,[]byte(data),0600);err!=nil{t.Fatal(err)}
 b:=NewStoreBackend(nil,nil).WithScienceReader(ScienceSnapshotReader{Path:file})
 w:=httptest.NewRecorder();NewServer(b).Handler().ServeHTTP(w,httptest.NewRequest("GET","/v1/compute/external-science?chainId=420",nil))
 if w.Code!=200{t.Fatalf("unexpected %d %s",w.Code,w.Body.String())}
 for _,want:=range []string{`"eligibility":"UNVERIFIED"`,`"finality":"UNFINALIZED"`,`"amount420":null`,`"canonicalAuthority":false`}{if !strings.Contains(w.Body.String(),want){t.Fatalf("missing %s: %s",want,w.Body.String())}}
}
func TestSnapshotScienceMissingAndInvalidInputUnavailable(t *testing.T){
 file:=filepath.Join(t.TempDir(),"science.json")
 b:=NewStoreBackend(nil,nil).WithScienceReader(ScienceSnapshotReader{Path:file})
 for _,data:=range []string{"",`{"schemaVersion":"420-science-read-v1","chainId":"1","items":[],"total":0}`} {
  if data!="" {if err:=os.WriteFile(file,[]byte(data),0600);err!=nil{t.Fatal(err)}}
  w:=httptest.NewRecorder();NewServer(b).Handler().ServeHTTP(w,httptest.NewRequest("GET","/v1/compute/external-science?chainId=420",nil))
  if w.Code!=503{t.Fatalf("expected 503, got %d: %s",w.Code,w.Body.String())}
 }
}

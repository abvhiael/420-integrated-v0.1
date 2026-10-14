package complianceauth

import (
 "crypto/sha256"
 "encoding/hex"
 "errors"
 "regexp"
 "sort"
 "strings"
 "time"
)
var ErrChangeUncertain=errors.New("official source change uncertain")
type SourceSection struct {
 Locator string
 Text string
 EffectiveFrom time.Time
 EffectiveUntil time.Time
 SourceDigest string
}
type SourceDocument struct {
 SourceID string
 URL string
 SnapshotDigest string
 RetrievedAt time.Time
 Available bool
 Sections []SourceSection
 Navigation []string
}
type SourceChange struct {
 Type string
 OldLocator string
 NewLocator string
 OldDigest string
 NewDigest string
 Reason string
}
type ChangeReview struct {
 SourceID string
 State string
 OldSnapshot string
 NewSnapshot string
 Changes []SourceChange
 PolicyActivated bool
}
var whitespace=regexp.MustCompile(`\s+`)
func semanticText(s string)string{return strings.ToLower(strings.TrimSpace(whitespace.ReplaceAllString(s," ")))}
func textDigest(s string)string{h:=sha256.Sum256([]byte(semanticText(s)));return hex.EncodeToString(h[:])}
func compareSections(a,b SourceDocument)(ChangeReview,error){
 result:=ChangeReview{SourceID:a.SourceID,OldSnapshot:a.SnapshotDigest,NewSnapshot:b.SnapshotDigest,State:"REVIEW_REQUIRED",PolicyActivated:false}
 if a.SourceID==""||a.SourceID!=b.SourceID||!digestValid(a.SnapshotDigest)||(!b.Available&&b.SnapshotDigest!=""&&!digestValid(b.SnapshotDigest)){return result,ErrChangeUncertain}
 if !b.Available{result.Changes=[]SourceChange{{Type:"SOURCE_OUTAGE",Reason:"official source unavailable"}};return result,nil}
 if !digestValid(b.SnapshotDigest){return result,ErrChangeUncertain}
 old:=map[string]SourceSection{};newer:=map[string]SourceSection{}
 for _,s:=range a.Sections{if s.Locator==""||s.Text==""||!digestValid(s.SourceDigest)||old[s.Locator].Locator!=""{return result,ErrChangeUncertain};old[s.Locator]=s}
 for _,s:=range b.Sections{if s.Locator==""||s.Text==""||!digestValid(s.SourceDigest)||newer[s.Locator].Locator!=""{return result,ErrChangeUncertain};newer[s.Locator]=s}
 missing:=[]SourceSection{};added:=[]SourceSection{}
 keys:=make([]string,0,len(old));for k:=range old{keys=append(keys,k)};sort.Strings(keys)
 for _,k:=range keys{
  before:=old[k];after,exists:=newer[k]
  if !exists{missing=append(missing,before);continue}
  if textDigest(before.Text)!=textDigest(after.Text){result.Changes=append(result.Changes,SourceChange{Type:"SILENT_AMENDMENT",OldLocator:k,NewLocator:k,OldDigest:textDigest(before.Text),NewDigest:textDigest(after.Text),Reason:"operative source section wording changed"})}
  if !before.EffectiveFrom.Equal(after.EffectiveFrom)||!before.EffectiveUntil.Equal(after.EffectiveUntil){result.Changes=append(result.Changes,SourceChange{Type:"EFFECTIVE_DATE_SHIFT",OldLocator:k,NewLocator:k,Reason:"effective interval changed"})}
 }
 keys=keys[:0];for k:=range newer{keys=append(keys,k)};sort.Strings(keys)
 for _,k:=range keys{if _,ok:=old[k];!ok{added=append(added,newer[k])}}
 used:=map[string]bool{}
 for _,before:=range missing{
  match:=-1
  for i,after:=range added{if !used[after.Locator]&&textDigest(before.Text)==textDigest(after.Text){match=i;break}}
  if match>=0{after:=added[match];used[after.Locator]=true;result.Changes=append(result.Changes,SourceChange{Type:"RELOCATED",OldLocator:before.Locator,NewLocator:after.Locator,OldDigest:textDigest(before.Text),NewDigest:textDigest(after.Text),Reason:"identical section moved to a different locator"})}
  if match<0{result.Changes=append(result.Changes,SourceChange{Type:"REMOVED",OldLocator:before.Locator,OldDigest:textDigest(before.Text),Reason:"section no longer present"})}
 }
 for _,after:=range added{if !used[after.Locator]{result.Changes=append(result.Changes,SourceChange{Type:"ADDED",NewLocator:after.Locator,NewDigest:textDigest(after.Text),Reason:"new source section"})}}
 if len(result.Changes)==0{
  result.State="NO_MEANINGFUL_CHANGE"
  if a.SnapshotDigest!=b.SnapshotDigest{result.State="NAVIGATION_ONLY_CHANGE";result.Changes=[]SourceChange{{Type:"NAVIGATION_ONLY",Reason:"raw snapshot changed but section text and effective intervals did not"}}}
 }
 return result,nil
}
// DetectSourceChanges never publishes policies, even if documents have changed.
func DetectSourceChanges(before,after SourceDocument)(ChangeReview,error){return compareSections(before,after)}

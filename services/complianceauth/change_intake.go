package complianceauth

import (
 "crypto/sha256"
 "encoding/hex"
 "errors"
 "sort"
 "strings"
 "sync"
 "time"
)

var ErrInvalidIntake = errors.New("invalid source change intake")
var ErrIntakeConflict = errors.New("source change intake conflict")
var ErrIntakeForbidden = errors.New("source change intake actor unauthorized")

type ChangeSeverity string
const (
 SeverityCritical ChangeSeverity = "CRITICAL"
 SeverityHigh ChangeSeverity = "HIGH"
 SeverityMedium ChangeSeverity = "MEDIUM"
 SeverityLow ChangeSeverity = "LOW"
)

type ChangeIntake struct {
 ID string
 SourceID string
 SnapshotDigest string
 ChangeType string
 Severity ChangeSeverity
 Apps []string
 Regions []string
 Rules []string
 EffectiveAt time.Time
 DetectedAt time.Time
 OwnerID string
 State string
 AcknowledgedBy string
 AcknowledgedAt time.Time
 // Intake acknowledgment never establishes legal approval.
 PolicyAuthorized bool
}

type ChangeIntakeQueue struct {
 mu sync.Mutex
 items map[string]ChangeIntake
}

func validSeverity(s ChangeSeverity) bool {
 switch s {case SeverityCritical,SeverityHigh,SeverityMedium,SeverityLow:return true}
 return false
}
func validateAffected(xs []string) bool {
 if len(xs)==0 || len(xs)>64{return false}
 seen:=map[string]bool{}
 for _,x:=range xs {if strings.TrimSpace(x)!=x || x=="" || len(x)>128 || seen[x] {return false};seen[x]=true}
 return true
}
func (q *ChangeIntakeQueue) Enqueue(item ChangeIntake) (ChangeIntake,error) {
 if q==nil || item.SourceID=="" || !digestValid(item.SnapshotDigest) || item.ChangeType=="" || !validSeverity(item.Severity) ||
 !validateAffected(item.Apps) || !validateAffected(item.Regions) || !validateAffected(item.Rules) ||
 item.DetectedAt.IsZero() || item.OwnerID=="" || strings.TrimSpace(item.OwnerID)!=item.OwnerID ||
 len(item.OwnerID)>128 || item.State!="" || item.AcknowledgedBy!="" || !item.AcknowledgedAt.IsZero() ||
 item.PolicyAuthorized {return ChangeIntake{},ErrInvalidIntake}
 // The exact normalized key is stable for replay suppression; no arbitrary caller-chosen ID.
 identity:=strings.Join([]string{item.SourceID,item.SnapshotDigest,item.ChangeType,string(item.Severity),strings.Join(item.Apps,","),strings.Join(item.Regions,","),strings.Join(item.Rules,","),item.EffectiveAt.UTC().Format(time.RFC3339Nano)},"\x00")
 sum:=sha256.Sum256([]byte(identity))
 item.ID=hex.EncodeToString(sum[:])
 item.State="PENDING_REVIEW"
 q.mu.Lock();defer q.mu.Unlock()
 if q.items==nil {q.items=map[string]ChangeIntake{}}
 if old,ok:=q.items[item.ID];ok{return old,nil}
 q.items[item.ID]=item
 return item,nil
}
func (q *ChangeIntakeQueue) Acknowledge(id,actor string,at time.Time)(ChangeIntake,error){
 if q==nil || id=="" || actor=="" || at.IsZero(){return ChangeIntake{},ErrInvalidIntake}
 q.mu.Lock();defer q.mu.Unlock()
 item,ok:=q.items[id];if !ok {return ChangeIntake{},ErrInvalidIntake}
 if item.OwnerID!=actor {return ChangeIntake{},ErrIntakeForbidden}
 if item.State!="PENDING_REVIEW" {return ChangeIntake{},ErrIntakeConflict}
 if at.Before(item.DetectedAt) {return ChangeIntake{},ErrInvalidIntake}
 item.State="ACKNOWLEDGED_PENDING_LEGAL_REVIEW"
 item.AcknowledgedBy=actor
 item.AcknowledgedAt=at
 item.PolicyAuthorized=false
 q.items[id]=item
 return item,nil
}
func (q *ChangeIntakeQueue) PendingFor(owner string) []ChangeIntake{
 if q==nil||owner=="" {return nil}
 q.mu.Lock();defer q.mu.Unlock()
 out:=[]ChangeIntake{}
 for _,i:=range q.items {if i.OwnerID==owner && i.State=="PENDING_REVIEW"{out=append(out,i)}}
 sort.Slice(out,func(a,b int)bool{return out[a].ID<out[b].ID})
 return out
}

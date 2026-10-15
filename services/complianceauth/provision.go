package complianceauth

import (
 "errors"
 "fmt"
 "strings"
 "time"
)
// LegalStatus records an externally evidenced legal lifecycle state, not a model inference.
type LegalStatus string
const (
 StatusProposal LegalStatus="PROPOSAL"
 StatusBill LegalStatus="BILL"
 StatusEnactedNotInForce LegalStatus="ENACTED_NOT_IN_FORCE"
 StatusInForce LegalStatus="IN_FORCE"
 StatusRepealed LegalStatus="REPEALED"
 StatusUnknown LegalStatus="UNKNOWN"
)
var ErrUnverifiedLegalStatus=errors.New("unverified legal status")
type ProvisionSource struct {
 SourceID string
 SourceDigest string
 Locator string
 OriginalText string
 InstrumentID string
 Status LegalStatus
 EffectiveFrom time.Time
 EffectiveUntil time.Time
 StatusAuthorityRef string
}
type AmendmentSource struct {
 AmendmentID string
 ReplacesLocator string
 OriginalText string
 SourceDigest string
 Status LegalStatus
 StatusAuthorityRef string
 EffectiveFrom time.Time
 EffectiveUntil time.Time
}
type NormalizedProvision struct {
 SourceID string
 SourceDigest string
 Locator string
 InstrumentID string
 OriginalText string
 NormalizedText string
 Status LegalStatus
 StatusAuthorityRef string
 EffectiveFrom time.Time
 EffectiveUntil time.Time
 Amendments []AmendmentSource
 EligibleForPolicy bool
}
// NormalizeProvisions never derives operative legal status from the text of a bill,
// amendment or source document. Status and effective dates must come from reviewed evidence.
func NormalizeProvisions(src ProvisionSource,amendments []AmendmentSource,at time.Time)(NormalizedProvision,error){
 if src.SourceID==""||src.Locator==""||src.InstrumentID==""||src.StatusAuthorityRef==""||!digestValid(src.SourceDigest)||strings.TrimSpace(src.OriginalText)==""||at.IsZero(){return NormalizedProvision{},ErrUnverifiedLegalStatus}
 if !legalStatusValid(src.Status){return NormalizedProvision{},ErrUnverifiedLegalStatus}
 if src.Status==StatusInForce && (src.EffectiveFrom.IsZero()||at.Before(src.EffectiveFrom)||(!src.EffectiveUntil.IsZero()&&!at.Before(src.EffectiveUntil))){return NormalizedProvision{},ErrUnverifiedLegalStatus}
 out:=NormalizedProvision{SourceID:src.SourceID,SourceDigest:src.SourceDigest,Locator:src.Locator,InstrumentID:src.InstrumentID,OriginalText:src.OriginalText,NormalizedText:strings.Join(strings.Fields(src.OriginalText)," "),Status:src.Status,StatusAuthorityRef:src.StatusAuthorityRef,EffectiveFrom:src.EffectiveFrom,EffectiveUntil:src.EffectiveUntil,EligibleForPolicy:src.Status==StatusInForce}
 seen:=make(map[string]bool)
 for _,a:=range amendments{
  if a.AmendmentID==""||a.ReplacesLocator!=src.Locator||a.StatusAuthorityRef==""||strings.TrimSpace(a.OriginalText)==""||!digestValid(a.SourceDigest)||!legalStatusValid(a.Status)||seen[a.AmendmentID]{return NormalizedProvision{},fmt.Errorf("%w: invalid amendment",ErrUnverifiedLegalStatus)}
  seen[a.AmendmentID]=true
  out.Amendments=append(out.Amendments,a)
  // An amendment can only supersede prior policy after separately evidenced
  // in-force activation; pending amendments cannot modify normalized source text.
  if a.Status==StatusInForce {
   if a.EffectiveFrom.IsZero()||at.Before(a.EffectiveFrom)||(!a.EffectiveUntil.IsZero()&&!at.Before(a.EffectiveUntil)){return NormalizedProvision{},ErrUnverifiedLegalStatus}
   out.NormalizedText=strings.Join(strings.Fields(a.OriginalText)," ")
  } else if a.Status==StatusUnknown {out.EligibleForPolicy=false}
 }
 return out,nil
}
func legalStatusValid(s LegalStatus)bool{
 switch s{case StatusProposal,StatusBill,StatusEnactedNotInForce,StatusInForce,StatusRepealed,StatusUnknown:return true}
 return false
}

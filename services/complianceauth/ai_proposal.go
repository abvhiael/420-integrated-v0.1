package complianceauth

import (
 "context"
 "errors"
 "strings"
)
var ErrAIProposalInvalid=errors.New("invalid untrusted AI extraction proposal")
type CitedSpan struct {
 Locator string `json:"locator"`
 Quote string `json:"quote"`
}
type AIExtractionProposal struct {
 SourceID string `json:"source_id"`
 SnapshotDigest string `json:"snapshot_digest"`
 Label string `json:"label"`
 SuggestedChange string `json:"suggested_change"`
 Spans []CitedSpan `json:"spans"`
}
type ProposalResult struct {
 Proposal AIExtractionProposal
 ReviewRequired bool
 Authorized bool
}
// AITextProposer receives text only. No tool, browser, signing, storage or approval
// capability is exposed to the model. The model output is always untrusted.
type AITextProposer interface {
 ProposeText(context.Context,string)(AIExtractionProposal,error)
}
type AIProposalValidator struct{ Proposer AITextProposer; MaxTextBytes int }
func(v AIProposalValidator) Extract(ctx context.Context,sourceID,snapshotDigest,originalText string)(ProposalResult,error){
 if v.Proposer==nil||sourceID==""||!digestValid(snapshotDigest)||originalText==""||v.MaxTextBytes<=0||len(originalText)>v.MaxTextBytes{return ProposalResult{},ErrAIProposalInvalid}
 p,err:=v.Proposer.ProposeText(ctx,originalText);if err!=nil{return ProposalResult{},err}
 if p.SourceID!=sourceID||p.SnapshotDigest!=snapshotDigest||p.Label!="UNTRUSTED_AI_PROPOSAL"||strings.TrimSpace(p.SuggestedChange)==""||len(p.Spans)==0||len(p.Spans)>32{return ProposalResult{},ErrAIProposalInvalid}
 for _,span:=range p.Spans{
  if strings.TrimSpace(span.Locator)==""||strings.TrimSpace(span.Quote)==""||!strings.Contains(originalText,span.Quote){return ProposalResult{},ErrAIProposalInvalid}
 }
 return ProposalResult{Proposal:p,ReviewRequired:true,Authorized:false},nil
}

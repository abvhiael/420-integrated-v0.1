package complianceauth

import "context"

// C067ArchiveEvidence reads the integrity-checked C02.3 archive. The allowset
// comes from trusted server configuration, not the request. EvidenceID is the
// exact snapshot SHA-256. Raw source content never leaves this adapter.
type C067ArchiveEvidence struct {
 Archive SnapshotArchive
 Allowed map[C064AuthorScope]map[string]bool
}
func(a C067ArchiveEvidence)Inspect(ctx context.Context,scope C064AuthorScope,sourceID,evidenceID string)(C067EvidenceItem,error){
 if ctx==nil||ctx.Err()!=nil||!sourceIDPattern.MatchString(sourceID)||!digestValid(evidenceID)||
 !a.Allowed[scope][sourceID]{return C067EvidenceItem{},ErrC067Denied}
 history,err:=a.Archive.History(sourceID)
 if err!=nil{return C067EvidenceItem{},ErrC067Denied}
 for _,r:=range history{
  if ctx.Err()!=nil{return C067EvidenceItem{},ErrC067Denied}
  if r.Digest==evidenceID{
   if r.Status!="PARSED_PENDING_REVIEW"||r.RetrievedAt.IsZero(){return C067EvidenceItem{},ErrC067Denied}
   return C067EvidenceItem{SourceID:sourceID,EvidenceID:evidenceID,Digest:r.Digest,
    Status:r.Status,ObservedAt:r.RetrievedAt,PublicCitation:""},nil
  }
 }
 return C067EvidenceItem{},ErrC067Denied
}
var _ C067EvidenceRepository = C067ArchiveEvidence{}

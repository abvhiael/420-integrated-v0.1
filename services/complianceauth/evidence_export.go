package complianceauth

import (
 "crypto/sha256"
 "crypto/subtle"
 "encoding/hex"
 "errors"
 "time"
)

var ErrExportDenied=errors.New("compliance evidence export denied")
type RetentionTerms struct {
 SourceID string
 PublisherTermsRef string
 ArchivePermitted bool
 ExportPermitted bool
 ReviewerOnly bool
 PermittedUntil time.Time
 MaxExportBytes int
}
type ExportRequest struct {
 ActorID string
 Authenticated bool
 ReviewerAuthorized bool
 SourceID string
 RequestedAt time.Time
}
type EvidenceExport struct {
 SourceID string
 SnapshotDigest string
 Original []byte
 OriginalSHA256 string
 ReviewerOnly bool
 PublisherTermsRef string
 PolicyApproved bool
}
// ExportSnapshot requires positive permissions and separately authenticated reviewer
// authorization. A C02.7 queue owner string alone cannot authorize access.
func ExportSnapshot(s SnapshotRecord,raw []byte,terms RetentionTerms,req ExportRequest)(EvidenceExport,error){
 deny:=func()(EvidenceExport,error){return EvidenceExport{},ErrExportDenied}
 if s.SourceID==""||s.SourceID!=terms.SourceID||req.SourceID!=s.SourceID||s.Status!="PARSED_PENDING_REVIEW"||
 !digestValid(s.Digest)||len(raw)==0||!terms.ArchivePermitted||!terms.ExportPermitted||
 terms.PublisherTermsRef==""||terms.MaxExportBytes<=0||len(raw)>terms.MaxExportBytes||
 req.ActorID==""||!req.Authenticated||req.RequestedAt.IsZero()||
 terms.PermittedUntil.IsZero()||!req.RequestedAt.Before(terms.PermittedUntil)||
 terms.ReviewerOnly&&!req.ReviewerAuthorized{return deny()}
 h:=sha256.Sum256(raw);actual:=hex.EncodeToString(h[:])
 if subtle.ConstantTimeCompare([]byte(actual),[]byte(s.Digest))!=1{return deny()}
 copied:=append([]byte(nil),raw...)
 return EvidenceExport{SourceID:s.SourceID,SnapshotDigest:s.Digest,Original:copied,OriginalSHA256:actual,ReviewerOnly:terms.ReviewerOnly,PublisherTermsRef:terms.PublisherTermsRef,PolicyApproved:false},nil
}

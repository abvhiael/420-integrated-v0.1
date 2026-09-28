package rpc

import (
	"context"

	"github.com/420integrated/420-integrated/indexer/model"
)

type QualificationSource struct {
	ctx context.Context
	client *Client
	chainID uint64
	schemaVersion string
}

func NewQualificationSource(ctx context.Context, client *Client, chainID uint64, schemaVersion string) *QualificationSource {
	if ctx == nil { ctx = context.Background() }
	return &QualificationSource{ctx:ctx, client:client, chainID:chainID, schemaVersion:schemaVersion}
}

func (s *QualificationSource) ChainID() (uint64,error) { return s.client.ChainID() }
func (s *QualificationSource) BlockByNumber(number uint64) (model.BlockRecord,error) {
	return s.client.BlockByTag(s.ctx,s.chainID,hexQuantity(number),model.FinalityHead,s.schemaVersion)
}
func (s *QualificationSource) Head() (model.BlockRecord,error) {
	return s.client.BlockByTag(s.ctx,s.chainID,"latest",model.FinalityHead,s.schemaVersion)
}
func (s *QualificationSource) Safe() (model.BlockRecord,error) {
	return s.client.SafeBlock(s.ctx,s.chainID,s.schemaVersion)
}
func (s *QualificationSource) Finalized() (model.BlockRecord,error) {
	return s.client.FinalizedBlock(s.ctx,s.chainID,s.schemaVersion)
}

func hexQuantity(n uint64) string {
	if n==0 { return "0x0" }
	const digits="0123456789abcdef"
	buf:=make([]byte,0,18)
	for n>0 { buf=append(buf,digits[n&15]); n>>=4 }
	for i,j:=0,len(buf)-1;i<j;i,j=i+1,j-1 { buf[i],buf[j]=buf[j],buf[i] }
	return "0x"+string(buf)
}

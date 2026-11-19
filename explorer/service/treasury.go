package service

import (
 "context"
 "errors"
 "github.com/420integrated/420-integrated/explorer/indexerclient"
 "github.com/420integrated/420-integrated/indexer/treasuryread"
)

type treasuryIndexerReader interface { TreasuryRead(context.Context,uint64,string,string)(indexerclient.TreasuryProjection,error) }

func (s *Service) Treasury(ctx context.Context,kind,id string)(indexerclient.TreasuryProjection,error){
 reader,ok:=s.indexer.(treasuryIndexerReader)
 if !ok{return indexerclient.TreasuryProjection{},errors.New("Treasury Indexer read boundary unavailable")}
 out,err:=reader.TreasuryRead(ctx,s.requiredChainID,kind,id)
 if err!=nil{return indexerclient.TreasuryProjection{},err}
 if out.Authoritative||out.VaultReleaseVerified{return indexerclient.TreasuryProjection{},treasuryread.ErrAuthority}
 if err=treasuryread.Validate(out.Data,s.requiredChainID,kind,id);err!=nil{return indexerclient.TreasuryProjection{},err}
 if kind=="disbursements"{out.ReleaseEvidence="Treasury commitment only; Vault release not verified"}else{out.ReleaseEvidence=""}
 return out,nil
}

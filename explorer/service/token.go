package service
import(
 "context"
 "strings"
 "strconv"
 "github.com/420integrated/420-integrated/indexer/tokenread"
)
type tokenIndexerReader interface{TokenDeployment(context.Context,uint64,string)(tokenread.Projection,error)}
func(s *Service) TokenDeployment(ctx context.Context,token string)(tokenread.Projection,error){
 token=strings.ToLower(token);if !tokenread.ValidAddress(token){return tokenread.Projection{},tokenread.ErrInvalid}
 reader,ok:=s.indexer.(tokenIndexerReader);if !ok{return tokenread.Projection{},tokenread.ErrUnavailable}
 status,err:=s.NetworkStatus(ctx);if err!=nil{return tokenread.Projection{},err}
 p,err:=reader.TokenDeployment(ctx,s.requiredChainID,token);if err!=nil{return tokenread.Projection{},err}
 if err=p.Validate(s.requiredChainID,token);err!=nil{return tokenread.Projection{},err}
 if p.SnapshotHeight!=strconv.FormatUint(status.IndexedHeight,10){return tokenread.Projection{},tokenread.ErrUnavailable}
 h,_:=strconv.ParseUint(p.SnapshotHeight,10,64);block,err:=s.indexer.Block(ctx,h);if err!=nil||block.ChainID!=s.requiredChainID||block.Number!=h||!strings.EqualFold(p.SnapshotHash,block.Hash){return tokenread.Projection{},tokenread.ErrUnavailable}
 return p,nil
}

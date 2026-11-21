package social

import (
 "context"
 "database/sql"
 "errors"
 "strings"
 "time"
)

// AccountGames provides a strictly separate off-chain, zero-wager ruleset.
// This never submits an on-chain BG-15 game, campaign score or reward claim.
type AccountGames struct{Store *Store}
type Game struct{
 ID string `json:"id"`
 Inviter string `json:"inviter"`
 Invited string `json:"invited"`
 Kind string `json:"kind"`
 Status string `json:"status"`
 Board string `json:"board"`
 NextTurn string `json:"nextTurn,omitempty"`
 Winner string `json:"winner,omitempty"`
 Moves int `json:"moves"`
 UpdatedAt time.Time `json:"updatedAt"`
 InviteExpiresAt time.Time `json:"inviteExpiresAt"`
}
type GameMove struct{
 Number int `json:"number"`
 Actor string `json:"actor"`
 Position int `json:"position"`
 CreatedAt time.Time `json:"createdAt"`
}
func NewAccountGames(store *Store)(*AccountGames,error){if store==nil{return nil,ErrInvalid};return &AccountGames{store},nil}
func gameKind(kind string)(int,int,int,bool){
 switch kind{
 case "tic_tac_toe":return 3,3,3,true
 case "connect_four":return 7,6,4,true
 default:return 0,0,0,false
 }
}
func freshBoard(kind string)string{
 w,h,_,ok:=gameKind(kind);if !ok{return ""}
 return strings.Repeat(".",w*h)
}
func gameLines(board string,width,height,need int,mark byte)bool{
 for y:=0;y<height;y++{for x:=0;x<width;x++{
  if board[y*width+x]!=mark{continue}
  for _,dir:=range [][2]int{{1,0},{0,1},{1,1},{-1,1}}{
   valid:=true
   for n:=1;n<need;n++{
    xx,yy:=x+n*dir[0],y+n*dir[1]
    if xx<0||xx>=width||yy<0||yy>=height||board[yy*width+xx]!=mark{valid=false;break}
   }
   if valid{return true}
  }
 }}
 return false
}
func playBoard(kind,board string,turn,position int)(string,bool,bool,error){
 w,h,need,ok:=gameKind(kind)
 if !ok||len(board)!=w*h||strings.Trim(board,".XO")!=""||turn<0||turn>=w*h{return "",false,false,ErrInvalid}
 // The first player is X. An opponent may never choose the mark.
 mark:=byte('X');if turn%2!=0{mark='O'}
 b:=[]byte(board)
 if kind=="tic_tac_toe"{
  if position<0||position>=len(b)||b[position]!='.'{return "",false,false,ErrConflict}
  b[position]=mark
 }else{
  if position<0||position>=w{return "",false,false,ErrInvalid}
  landing:=-1
  for y:=h-1;y>=0;y--{if b[y*w+position]=='.'{landing=y*w+position;break}}
  if landing<0{return "",false,false,ErrConflict}
  b[landing]=mark
 }
 win:=gameLines(string(b),w,h,need,mark)
 return string(b),win,!strings.Contains(string(b),"."),nil
}
const gameColumns=`id,inviter,invited,kind,
 CASE WHEN status='invited' AND invite_expires_at<=clock_timestamp() THEN 'expired' ELSE status END,
 board,next_turn,winner,moves,updated_at,invite_expires_at`
func scanGame(row interface{Scan(...any)error})(Game,error){
 var g Game;var next,winner sql.NullString
 e:=row.Scan(&g.ID,&g.Inviter,&g.Invited,&g.Kind,&g.Status,&g.Board,&next,&winner,&g.Moves,&g.UpdatedAt,&g.InviteExpiresAt)
 if e==nil{g.NextTurn=next.String;g.Winner=winner.String}
 return g,e
}
func (a *AccountGames) Invite(ctx context.Context,viewer,target,kind string)(Game,error){
 var empty Game
 if !uuid.MatchString(viewer)||!uuid.MatchString(target)||viewer==target{return empty,ErrInvalid}
 if _,_,_,ok:=gameKind(kind);!ok{return empty,ErrInvalid}
 id,e:=newID();if e!=nil{return empty,e}
 tx,e:=a.Store.DB.BeginTx(ctx,nil);if e!=nil{return empty,e};defer tx.Rollback()
 if e=lockPeerPair(ctx,tx,viewer,target);e!=nil{return empty,e}
 blocked,e:=blockedBetween(ctx,tx,viewer,target);if e!=nil{return empty,e}
 if blocked{return empty,ErrForbidden}
 // Untrusted browsers cannot choose a winner, a stake, or a move history.
 game,e:=scanGame(tx.QueryRowContext(ctx,`INSERT INTO bg_account_social.account_games
 (id,inviter,invited,kind,board) VALUES($1,$2,$3,$4,$5)
 RETURNING `+gameColumns,id,viewer,target,kind,freshBoard(kind)))
 if e!=nil{return empty,e}
 if e=tx.Commit();e!=nil{return empty,e}
 return game,nil
}
func (a *AccountGames) List(ctx context.Context,viewer string)([]Game,error){
 if !uuid.MatchString(viewer){return nil,ErrInvalid}
 rows,e:=a.Store.DB.QueryContext(ctx,`SELECT `+gameColumns+`
 FROM bg_account_social.account_games
 WHERE (inviter=$1 OR invited=$1) AND NOT EXISTS(
 SELECT 1 FROM bg_account_social.blocks b WHERE
 (b.blocker=$1 AND b.blocked=CASE WHEN inviter=$1 THEN invited ELSE inviter END)
 OR (b.blocked=$1 AND b.blocker=CASE WHEN inviter=$1 THEN invited ELSE inviter END))
 ORDER BY updated_at DESC,id DESC LIMIT 50`,viewer)
 if e!=nil{return nil,e};defer rows.Close()
 out:=[]Game{}
 for rows.Next(){g,e:=scanGame(rows);if e!=nil{return nil,e};out=append(out,g)}
 return out,rows.Err()
}
func (a *AccountGames) Get(ctx context.Context,viewer,id string)(Game,[]GameMove,error){
 var empty Game
 if !uuid.MatchString(viewer)||!uuid.MatchString(id){return empty,nil,ErrInvalid}
 game,e:=scanGame(a.Store.DB.QueryRowContext(ctx,`SELECT `+gameColumns+`
 FROM bg_account_social.account_games WHERE id=$1 AND (inviter=$2 OR invited=$2)
 AND NOT EXISTS(SELECT 1 FROM bg_account_social.blocks b
 WHERE (b.blocker=$2 AND b.blocked=CASE WHEN inviter=$2 THEN invited ELSE inviter END)
 OR (b.blocked=$2 AND b.blocker=CASE WHEN inviter=$2 THEN invited ELSE inviter END))`,id,viewer))
 if errors.Is(e,sql.ErrNoRows){return empty,nil,ErrNotFound};if e!=nil{return empty,nil,e}
 rows,e:=a.Store.DB.QueryContext(ctx,`SELECT move_number,actor,position,created_at
 FROM bg_account_social.account_game_moves WHERE game_id=$1 ORDER BY move_number ASC`,id)
 if e!=nil{return empty,nil,e};defer rows.Close()
 moves:=[]GameMove{}
 for rows.Next(){var m GameMove
  if e=rows.Scan(&m.Number,&m.Actor,&m.Position,&m.CreatedAt);e!=nil{return empty,nil,e}
  moves=append(moves,m)
 }
 if e=rows.Err();e!=nil{return empty,nil,e}
 return game,moves,nil
}
func (a *AccountGames) Respond(ctx context.Context,viewer,id string,accept bool)(Game,error){
 var empty Game
 if !uuid.MatchString(viewer)||!uuid.MatchString(id){return empty,ErrInvalid}
 tx,e:=a.Store.DB.BeginTx(ctx,nil);if e!=nil{return empty,e};defer tx.Rollback()
 existing,e:=scanGame(tx.QueryRowContext(ctx,`SELECT `+gameColumns+`
 FROM bg_account_social.account_games WHERE id=$1 FOR UPDATE`,id))
 if errors.Is(e,sql.ErrNoRows){return empty,ErrNotFound};if e!=nil{return empty,e}
 if existing.Invited!=viewer{return empty,ErrNotFound}
 if existing.Status!="invited"{return empty,ErrConflict}
 blocked,e:=blockedBetween(ctx,tx,existing.Inviter,viewer);if e!=nil{return empty,e}
 if blocked{return empty,ErrForbidden}
 status,turn:="declined",any(nil)
 if accept{status="active";turn=existing.Inviter}
 game,e:=scanGame(tx.QueryRowContext(ctx,`UPDATE bg_account_social.account_games SET
 status=$2,next_turn=$3,updated_at=clock_timestamp() WHERE id=$1
 RETURNING `+gameColumns,id,status,turn))
 if e!=nil{return empty,e}
 if e=tx.Commit();e!=nil{return empty,e}
 return game,nil
}
func (a *AccountGames) Move(ctx context.Context,viewer,id string,position,expected int)(Game,error){
 var empty Game
 if !uuid.MatchString(viewer)||!uuid.MatchString(id)||position<0||position>=42||expected<1{return empty,ErrInvalid}
 tx,e:=a.Store.DB.BeginTx(ctx,nil);if e!=nil{return empty,e};defer tx.Rollback()
 existing,e:=scanGame(tx.QueryRowContext(ctx,`SELECT `+gameColumns+`
 FROM bg_account_social.account_games WHERE id=$1 FOR UPDATE`,id))
 if errors.Is(e,sql.ErrNoRows){return empty,ErrNotFound};if e!=nil{return empty,e}
 if viewer!=existing.Inviter&&viewer!=existing.Invited{return empty,ErrNotFound}
 blocked,e:=blockedBetween(ctx,tx,existing.Inviter,existing.Invited);if e!=nil{return empty,e}
 if blocked{return empty,ErrForbidden}
 if existing.Status!="active"||existing.NextTurn!=viewer||expected!=existing.Moves+1{return empty,ErrConflict}
 board,win,draw,e:=playBoard(existing.Kind,existing.Board,existing.Moves,position)
 if e!=nil{return empty,e}
 status:="active";next:=any(existing.Inviter);winner:=any(nil)
 if viewer==existing.Inviter{next=existing.Invited}
 if win{status="won";next=nil;winner=viewer}else if draw{status="draw";next=nil}
 game,e:=scanGame(tx.QueryRowContext(ctx,`UPDATE bg_account_social.account_games SET
 board=$2,moves=moves+1,next_turn=$3,status=$4,winner=$5,updated_at=clock_timestamp()
 WHERE id=$1 RETURNING `+gameColumns,id,board,next,status,winner))
 if e!=nil{return empty,e}
 _,e=tx.ExecContext(ctx,`INSERT INTO bg_account_social.account_game_moves
 (game_id,move_number,actor,position) VALUES($1,$2,$3,$4)`,id,expected,viewer,position)
 if e!=nil{return empty,e}
 if e=tx.Commit();e!=nil{return empty,e}
 return game,nil
}

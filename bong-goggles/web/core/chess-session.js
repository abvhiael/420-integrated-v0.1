import {createAccountSocialClient,isSubjectID} from './account-social.js';
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UCI=/^[a-h][1-8][a-h][1-8][qrbn]?$/;
export const chessID=x=>typeof x==='string'&&ID.test(x);
export const chessMove=x=>typeof x==='string'&&UCI.test(x);
const clean=r=>r?.status===200&&r.data?.onChain===false&&r.data?.wager===false&&r.data?.rewards===false;
const fields='gameId ruleset seat color whiteSeat blackSeat board turn phase round scores winner terminal reason lastMove lastSAN castling enPassant halfmove check drawOffer timing'.split(' ');
export function normalizeChessSession(r,id){
 const s=r?.data?.session,v=s?.privateView;
 if(!clean(r)||!s||!v||!chessID(s.id)||s.id!==id||!chessID(s.roomId)||s.gameId!=='chess'||s.rulesVersion!=='v1.1'||s.seatCount!==2||
 !/^[a-f0-9]{64}$/.test(s.rulesHash)||!Number.isSafeInteger(s.sequence)||s.sequence<1||![0,1].includes(s.viewerSeat)||
 !['active','finished'].includes(s.status)||Object.keys(v).length!==fields.length||!fields.every(k=>Object.hasOwn(v,k))||
 v.gameId!=='chess'||v.ruleset!=='bc-chess-standard@1.1.0'||v.seat!==s.viewerSeat||v.color!==['white','black'][v.seat]||
 v.whiteSeat!==0||v.blackSeat!==1||typeof v.board!=='string'||!/^[.PNBRQKpnbrqk]{64}$/.test(v.board)||
 v.board.split('K').length!==2||v.board.split('k').length!==2||![0,1].includes(v.turn)&&!v.terminal||typeof v.check!=='boolean'||
 !Number.isInteger(v.round)||v.round<1||typeof v.lastSAN!=='string'||v.lastSAN.length>16||!(v.lastMove===''||chessMove(v.lastMove))||
 v.terminal!==(s.status==='finished')||(!v.terminal&&s.turnSeat!==v.turn)||(v.terminal&&(s.turnSeat!==null||s.winnerSeat!==v.winner))||
 ![null,0,1].includes(s.winnerSeat)||typeof v.reason!=='string'||v.reason.length>40||
 !(s.deadline===null||typeof s.deadline==='string'&&Number.isFinite(Date.parse(s.deadline))))return null;
 return {id:s.id,roomId:s.roomId,sequence:s.sequence,seat:s.viewerSeat,status:s.status,deadline:s.deadline,view:v};
}
export function normalizeChessActions(r,s){
 if(!clean(r)||r.data.sequence!==s.sequence||!Array.isArray(r.data.actions)||r.data.actions.length>1024)return null;
 const actions=[];
 for(const a of r.data.actions){
  if(!a||Object.keys(a).some(k=>!['type','uci'].includes(k))||!['move','move-offer','claim-draw','accept-draw','reject-draw','resign'].includes(a.type)||
  (['move','move-offer'].includes(a.type)?!chessMove(a.uci):a.uci!==undefined&&a.uci!==''&&!(a.type==='claim-draw'&&chessMove(a.uci))))return null;
  if(s.status!=='active'||s.view.turn!==s.seat&&['move','move-offer','claim-draw'].includes(a.type))return null;
  actions.push({type:a.type,...(a.uci?{uci:a.uci}:{})});
 }
 return actions;
}
export class ChessController{
 constructor({enabled=false,fetchImpl=fetch,onChange=()=>{}}={}){
  this.client=createAccountSocialClient({enabled,fetchImpl});this.onChange=onChange;this.gen=0;this.busy=false;this.reading=false;this.actor=null;
  this.state={status:enabled?'idle':'disabled',session:null,actions:[],matches:[],selected:null,promotion:[],flipped:null,offer:false,error:''};
 }
 emit(p){this.state={...this.state,...p};this.onChange();return this.state;}
 invalidate(){this.gen++;this.busy=false;this.reading=false;this.actor=null;this.emit({session:null,actions:[],matches:[],selected:null,promotion:[],offer:false,error:'',status:this.client.enabled?'idle':'disabled'});}
 async principal(){const r=await this.client.request('/v1/me');if(r.status===401)return null;if(r.status!==200||r.data?.walletRequired!==false||!isSubjectID(r.data.profile?.subject))throw Error('420ID verification unavailable ('+r.status+')');return r.data.profile.subject;}
 async refresh(id){
  if(!this.client.enabled||this.busy)return;
  const gen=++this.gen;this.busy=this.reading=true;
  try{
   const actor=await this.principal();if(gen!==this.gen)return;
   if(!actor){this.actor=null;this.emit({status:'guest',session:null,actions:[],matches:[],error:''});return;}
   if(this.actor!==actor){this.actor=actor;this.emit({session:null,actions:[],matches:[],selected:null,promotion:[],offer:false});}
   if(!id){
    const r=await this.client.request('/v1/classic-sessions');if(gen!==this.gen)return;
    if(!clean(r)||!Array.isArray(r.data.sessions))throw Error('Match list unavailable ('+r.status+')');
    const matches=r.data.sessions.filter(s=>s.gameId==='chess'&&s.rulesVersion==='v1.1'&&chessID(s.id)&&['active','finished'].includes(s.status)).map(s=>({id:s.id,status:s.status}));
    if(await this.principal()!==actor)throw Error('Account changed');
    if(gen===this.gen)this.emit({status:'ready',matches,error:''});return;
   }
   if(!chessID(id))throw Error('Invalid match link');
   const r=await this.client.request('/v1/classic-sessions/'+id);if(gen!==this.gen)return;
   const s=normalizeChessSession(r,id);if(!s)throw Error('Match not authorized or unavailable');
   const previous=this.state.session;
   if(previous?.id===id&&s.sequence<previous.sequence)throw Error('Stale match');
   const legal=await this.client.request('/v1/classic-sessions/'+id+'/chess-actions');
   if(gen!==this.gen)return;
   const actions=normalizeChessActions(legal,s);if(!actions)throw Error('Position changed; refreshing legal actions');
   if(await this.principal()!==actor)throw Error('Account changed');
   if(gen!==this.gen)return;
   if(previous?.id===id&&previous.sequence===s.sequence&&previous.seat===s.seat&&this.state.status==='ready')return;
   this.emit({status:'ready',session:s,actions,selected:null,promotion:[],offer:false,error:''});
  }catch(e){if(gen===this.gen)this.emit({status:'unavailable',session:null,actions:[],matches:[],selected:null,promotion:[],error:e.message});}
  finally{if(gen===this.gen)this.busy=this.reading=false;}
 }
 async act(action){
  const s=this.state.session,actor=this.actor;
  if((this.busy&&!this.reading)||this.state.status!=='ready'||!s||!this.state.actions.some(a=>a.type===action.type&&a.uci===action.uci))return;
  // An authorized click supersedes an in-flight read, never another mutation.
  const gen=++this.gen;this.reading=false;this.busy=true;this.emit({status:'submitting',error:''});
  try{
   if(await this.principal()!==actor||gen!==this.gen)throw Error('Account changed');
   const requestId=globalThis.crypto?.randomUUID?.();if(!chessID(requestId))throw Error('Secure request ID unavailable');
   const r=await this.client.request('/v1/classic-sessions/'+s.id+'/action',{method:'POST',body:{requestId,action:'move',expectedSequence:s.sequence+1,move:action}});
   if(gen!==this.gen)return;
   if(r.status!==409&&!normalizeChessSession(r,s.id))throw Error('Move not confirmed; refresh before retrying');
   this.emit({status:'idle',actions:[],selected:null,promotion:[],offer:false});
  }catch(e){if(gen===this.gen)this.emit({status:'unavailable',session:null,actions:[],error:e.message});}
  finally{if(gen===this.gen){this.busy=false;await this.refresh(s.id);}}
 }
}

import {classicRequestFailure} from './classic-rooms.js';
// BC-1.8: a genuine server-owned 420ID match against Easy/Medium/Hard.
// No local shuffle, hidden opponent state, scoring, or bot turn authority.
import {escapeHtml as esc} from './design-system.js';
import {isSubjectID} from './account-social.js';
import {normalizeCribbageSnapshot} from './cribbage-session.js';
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const levels=['easy','medium','hard'];
const validID=v=>typeof v==='string'&&ID.test(v);
function verify(r,status,name){
 if(r?.status!==status||r.data?.onChain!==false||r.data.wager!==false||
    r.data.rewards!==false)throw Error(classicRequestFailure(r,'Cribbage '+name));
 return r.data;
}
async function principal(client){
 const r=await client.request('/v1/me');
 if(r?.status!==200||r.data?.walletRequired!==false||
    !isSubjectID(r.data?.profile?.subject))throw Error('420ID sign-in required');
 return r.data.profile.subject;
}
function verifiedRoom(r,actor,status,roomId,difficulty){
 if(!r||!validID(r.id)||(roomId&&r.id!==roomId)||
    r.host!==actor||r.gameId!=='cribbage'||r.visibility!=='private'||
    r.seatCount!==2||r.status!==status||
    !Number.isSafeInteger(r.revision)||r.revision<0||
    !Array.isArray(r.seats)||r.seats.length!==2||
    r.seats[0]?.index!==0||r.seats[0]?.controller!=='human'||
    r.seats[0]?.subject!==actor||r.seats[1]?.index!==1||
    r.seats[1]?.controller!==(status==='open'?'empty':'bot')||
    (status==='ready'&&r.seats[1]?.difficulty!==difficulty))
  throw Error('Unverified Cribbage room or computer seat');
 return r;
}
export async function startCribbagePractice(client,difficulty){
 if(!client?.enabled||!levels.includes(difficulty))throw Error('Invalid computer difficulty');
 const actor=await principal(client);
 const created=verifiedRoom(verify(await client.request('/v1/classic-rooms',{
  method:'POST',body:{gameId:'cribbage',visibility:'private',seatCount:2}
 }),201,'room creation').room,actor,'open');
 if(await principal(client)!==actor)throw Error('420ID session changed');
 const chosen=verifiedRoom(verify(await client.request('/v1/classic-rooms/'+created.id+'/change',{
  method:'POST',body:{action:'bot',seat:1,difficulty,expectedRevision:created.revision}
 }),200,'computer seat').room,actor,'ready',created.id,difficulty);
 if(chosen.revision<=created.revision)throw Error('Uncommitted bot assignment');
 if(await principal(client)!==actor)throw Error('420ID session changed');
 const result=await client.request('/v1/classic-sessions',{
  method:'POST',body:{roomId:created.id}});
 verify(result,201,'match start');
 const game=normalizeCribbageSnapshot({...result,status:200},actor);
 if(!game||game.roomId!==created.id||game.gameId!=='cribbage'||
    game.viewerSeat!==0||game.seatCount!==2||game.sequence!==1||
    game.status!=='active')throw Error('Unverified Cribbage match');
 if(await principal(client)!==actor)throw Error('420ID session changed');
 return game.id;
}
export function renderCribbagePractice(s={}){
 const choice=levels.includes(s.practiceDifficulty)?s.practiceDifficulty:'medium';
 const off=s.status==='disabled',guest=s.status==='guest',busy=s.practiceBusy===true;
 const opts=levels.map(x=>'<option value="'+x+'"'+(choice===x?' selected':'')+'>'+
  x[0].toUpperCase()+x.slice(1)+'</option>').join('');
 return '<section class="cribbage-practice" aria-label="Play against the computer">'+
 '<h3>Play against the computer</h3>'+
 '<p>Choose Easy, Medium or Hard. Real 121-point scoring; no wagers.</p>'+
 '<form data-cribbage-practice><label>Computer difficulty <select name="difficulty" required>'+
 opts+'</select></label><button type="submit"'+(off||guest||busy?' disabled':'')+'>'+
 (busy?'Starting…':'Start against computer')+'</button></form>'+
 (off?'<p role="status">Classic rooms are not activated for this deployment.</p>':
 guest?'<p><a href="/social-api/auth/start">Sign in with 420ID</a> to play.</p>':
 '<p>420ID sign-in required. The computer never sees your hidden cards.</p>')+
 (s.practiceError?'<p role="alert">'+esc(s.practiceNotice||'Start unconfirmed. Check your rooms before retrying.')+'</p>':'')+
 '</section>';
}
export function bindCribbagePractice(root,controller,{
 navigate=path=>window.location.assign(path)}={}){
 const form=root.querySelector('[data-cribbage-practice]');
 if(!form||!controller?.client?.enabled)return;
 const picker=form.querySelector('select[name="difficulty"]');
 if(!picker)return;
 picker.addEventListener('change',()=>{
  if(levels.includes(picker.value))controller.emit({practiceDifficulty:picker.value});
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(controller.state?.practiceBusy||!levels.includes(picker.value))return;
  const difficulty=picker.value;
  controller.emit({practiceBusy:true,practiceError:false,practiceNotice:'',practiceDifficulty:difficulty});
  try{
   const id=await startCribbagePractice(controller.client,difficulty);
   navigate('/games/cribbage/play?session='+encodeURIComponent(id));
  }catch(error){
   controller.emit({practiceBusy:false,practiceError:true,practiceNotice:error.message.startsWith('Cribbage ')?error.message:'Start unconfirmed. Check your rooms before retrying.'});
  }
 });
}

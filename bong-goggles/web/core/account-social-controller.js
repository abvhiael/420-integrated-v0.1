import {createAccountSocialClient,normalizeAccountSocialFeed,socialInput,isSubjectID} from './account-social.js';

export class AccountSocialController {
 constructor({enabled=false,fetchImpl=fetch,onChange=()=>{}}={}){
  this.client=createAccountSocialClient({enabled,fetchImpl});
  this.onChange=onChange;
  this.state={status:enabled?'loading':'disabled'};
  this.generation=0;
 }
 emit(next){this.state={...next};this.onChange(this.state);return this.state;}
 invalidate(){this.generation++;this.emit({status:'loading'});}
 async refresh(){
  if(!this.client.enabled)return this.emit({status:'disabled'});
  const gen=++this.generation;
  this.emit({status:'loading'});
  try{
   const me=await this.client.request('/v1/me');
   if(gen!==this.generation)return this.state;
   if(me.status===401)return this.emit({status:'guest'});
   if(me.status!==200||me.data?.walletRequired!==false||!isSubjectID(me.data.profile?.subject))throw Error('Unverified account');
   const page=await this.client.request('/v1/feed');
   if(gen!==this.generation)return this.state;
   if(page.status===401)return this.emit({status:'guest'});
   if(page.status!==200)throw Error('Feed unavailable');
   const normalized=normalizeAccountSocialFeed(page.data);
   if(!normalized)throw Error('Unverified off-chain feed');
   return this.emit({status:'ready',profile:me.data.profile,...normalized,notice:'',comments:{}});
  }catch{
   if(gen===this.generation)return this.emit({status:'error'});
  }
  return this.state;
 }
 async act(action,details={}){
  if(this.state.status!=='ready'||!this.client.enabled)throw Error('Verified 420ID social session required');
  const id=details.postID,sub=details.subjectID;
  const mutation=(path,method,body)=>this.client.request(path,{method,body});
  let result;
  switch(action){
   case 'comments':{
    if(!isSubjectID(id))throw Error('Invalid post ID');
    const read=await this.client.request('/v1/posts/'+id+'/comments');
    if(read.status!==200||!Array.isArray(read.data?.comments)||read.data.comments.length>100)throw Error('Comments unavailable');
    return this.emit({...this.state,comments:{...this.state.comments,[id]:read.data.comments}});
   }
   case 'post':result=await mutation('/v1/posts','POST',{body:socialInput(details.body,'post')});break;
   case 'profile':result=await mutation('/v1/me','PUT',{displayName:socialInput(details.displayName,'displayName'),bio:socialInput(details.bio,'bio')});break;
   case 'comment':
    if(!isSubjectID(id))throw Error('Invalid post ID');
    result=await mutation('/v1/posts/'+id+'/comments','POST',{body:socialInput(details.body,'comment')});break;
   case 'react':
    if(!isSubjectID(id))throw Error('Invalid post ID');
    result=await mutation('/v1/posts/'+id+'/reaction','PUT',{});break;
   case 'delete':
    if(!isSubjectID(id))throw Error('Invalid post ID');
    result=await mutation('/v1/posts/'+id,'DELETE');break;
   case 'report':
    if(!isSubjectID(id))throw Error('Invalid post ID');
    result=await mutation('/v1/reports','POST',{postId:id,reason:'other'});break;
   case 'follow':case 'block':
    if(!isSubjectID(sub))throw Error('Invalid profile');
    result=await mutation('/v1/relationships/'+action+'/'+sub,'PUT',{});break;
   case 'logout':
    result=await mutation('/auth/logout','POST',{});break;
   case 'more':{
    if(typeof this.state.nextCursor!=='string')throw Error('No next page');
    result=await this.client.request('/v1/feed?cursor='+encodeURIComponent(this.state.nextCursor));
    if(result.status!==200)break;
    const extra=normalizeAccountSocialFeed(result.data);if(!extra)throw Error('Invalid next page');
    return this.emit({...this.state,posts:[...this.state.posts,...extra.posts],nextCursor:extra.nextCursor});
   }
   default:throw Error('Unknown activity');
  }
  if(!result||result.status<200||result.status>=300){
   this.emit({status:'error'});throw Error('Activity was not confirmed by the social service');
  }
  return this.refresh();
 }
}

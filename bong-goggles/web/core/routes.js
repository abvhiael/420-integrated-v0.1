export const ROUTES=Object.freeze([
  {id:'home',path:'/',label:'Home',icon:'⌂',requiresSession:false},
  {id:'profile',path:'/profile',label:'Profile',icon:'◎',requiresSession:false},
  {id:'friends',path:'/friends',label:'Friends',icon:'◌',requiresSession:true},
  {id:'messages',path:'/messages',label:'Messages',icon:'✉',requiresSession:true},
  {id:'notifications',path:'/notifications',label:'Notifications',icon:'◉',requiresSession:true},
  {id:'discover',path:'/discover',label:'Discover',icon:'⌕',requiresSession:false},
  {id:'groups',path:'/groups',label:'Groups',icon:'◍',requiresSession:false},
  {id:'pages',path:'/pages',label:'Pages',icon:'▤',requiresSession:false},
  {id:'events',path:'/events',label:'Events',icon:'◇',requiresSession:false},
  {id:'games',path:'/games',label:'Games',icon:'✦',requiresSession:true},
  {id:'rewards',path:'/rewards',label:'Rewards',icon:'◈',requiresSession:true},
  {id:'safety',path:'/safety',label:'Safety and appeals',icon:'⚑',requiresSession:true},
  {id:'settings',path:'/settings',label:'Settings',icon:'⚙',requiresSession:true}
]);
const BY_PATH=new Map(ROUTES.map(route=>[route.path,route]));
export function resolveRoute(pathname='/'){
  const normalized=typeof pathname==='string'&&pathname?pathname.replace(/\/+$/,'')||'/':'/';
  return BY_PATH.get(normalized)??Object.freeze({id:'not-found',path:normalized,label:'Not found',icon:'?',requiresSession:false});
}
export function routeAccess(route,{connected=false,supportedNetwork=true}={}){
  if(!route?.requiresSession)return Object.freeze({allowed:true,mode:'public',reason:null});
  if(!connected)return Object.freeze({allowed:false,mode:'read-only',reason:'WALLET_CONNECTION_REQUIRED'});
  if(!supportedNetwork)return Object.freeze({allowed:false,mode:'read-only',reason:'SUPPORTED_NETWORK_REQUIRED'});
  return Object.freeze({allowed:true,mode:'authenticated',reason:null});
}
export function navigationItems(context={}){return ROUTES.map(route=>Object.freeze({...route,access:routeAccess(route,context)}));}

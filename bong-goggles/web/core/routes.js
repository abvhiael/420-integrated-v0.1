import {classicGameById} from './classics.js';
import {GAME_SUBSCREENS} from './shared-game-ui.js';

export const ROUTES=Object.freeze([
  {id:'home',path:'/',label:'Home',icon:'⌂',requiresSession:false},
  {id:'profile',path:'/profile',label:'Profile',icon:'◎',requiresSession:false},
  {id:'social',path:'/social',label:'Account Social',icon:'♡',requiresSession:false},
  {id:'account-messages',path:'/account/messages',label:'Account Messages',icon:'✉',requiresSession:false},
  {id:'account-games',path:'/account/games',label:'Free Account Games',icon:'♟',requiresSession:false},
  {id:'account-xp',path:'/account/xp',label:'Community XP',icon:'✧',requiresSession:false},
  {id:'account-monetization',path:'/account/monetization',label:'Community Programmes',icon:'◇',requiresSession:false},
  {id:'friends',path:'/friends',label:'Friends',icon:'◌',requiresSession:true},
  {id:'messages',path:'/messages',label:'Messages',icon:'✉',requiresSession:true},
  {id:'notifications',path:'/notifications',label:'Notifications',icon:'◉',requiresSession:true},
  {id:'discover',path:'/discover',label:'Discover',icon:'⌕',requiresSession:false},
  {id:'groups',path:'/groups',label:'Groups',icon:'◍',requiresSession:false},
  {id:'pages',path:'/pages',label:'Pages',icon:'▤',requiresSession:false},
  {id:'events',path:'/events',label:'Events',icon:'◇',requiresSession:false},
  {id:'games',path:'/games',label:'Games',icon:'✦',requiresSession:false},
  {id:'classic-rooms',path:'/games/rooms',label:'Multiplayer Rooms',icon:'♟',requiresSession:false},
  {id:'classics',path:'/classics',label:'Classics',icon:'♠',requiresSession:false},
  {id:'chaos-game',path:'/classics/cross-country-chaos',label:'Cross-Country Chaos',icon:'🚙',requiresSession:false},
  {id:'rewards',path:'/rewards',label:'Rewards',icon:'◈',requiresSession:true},
  {id:'safety',path:'/safety',label:'Safety and appeals',icon:'⚑',requiresSession:true},
  {id:'settings',path:'/settings',label:'Settings',icon:'⚙',requiresSession:true}
]);
const BY_PATH=new Map(ROUTES.map(route=>[route.path,route]));
export function resolveRoute(pathname='/'){
  const normalized=typeof pathname==='string'&&pathname?pathname.replace(/\/+$/,'')||'/':'/';
  const fixed=BY_PATH.get(normalized);
  if(fixed)return fixed;
  if(/^\/games\/rooms\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized))
    return Object.freeze({id:'classic-room',roomId:normalized.slice('/games/rooms/'.length),path:normalized,label:'Multiplayer room',icon:'♟',requiresSession:false});
  if(normalized.startsWith('/games/')){
    const segments=normalized.slice('/games/'.length).split('/');
    if(segments.length<=2&&segments[0]&&
       (segments.length===1||GAME_SUBSCREENS.includes(segments[1]))){
      const game=classicGameById(segments[0]);
      if(game)return Object.freeze({id:'classic-game',path:normalized,label:game.title,
        gameId:game.id,screen:segments[1]??'intro',icon:'✦',requiresSession:false});
    }
  }
  return Object.freeze({id:'not-found',path:normalized,label:'Not found',icon:'?',requiresSession:false});
}
export function routeAccess(route,{connected=false,supportedNetwork=true}={}){
  if(!route?.requiresSession)return Object.freeze({allowed:true,mode:'public',reason:null});
  if(!connected)return Object.freeze({allowed:false,mode:'read-only',reason:'WALLET_CONNECTION_REQUIRED'});
  if(!supportedNetwork)return Object.freeze({allowed:false,mode:'read-only',reason:'SUPPORTED_NETWORK_REQUIRED'});
  return Object.freeze({allowed:true,mode:'authenticated',reason:null});
}
export function navigationItems(context={}){return ROUTES.map(route=>Object.freeze({...route,access:routeAccess(route,context)}));}

import test from 'node:test';
import assert from 'node:assert/strict';
import {bindChaosOnline} from '../core/chaos-online-bindings.js';
import {bindClassicRoomsDom} from '../core/classic-room-bindings.js';

function item(dataset={}){
 const handlers=new Map();
 return {dataset,handlers,addEventListener(name,handler){handlers.set(name,handler);},
  fire(name){handlers.get(name)?.({preventDefault(){}});}};
}
test('CCC online event binding stays scoped to the authenticated game route',()=>{
 const selected=item({chaosOnlineSelect:'2'});
 const drive=item({chaosOnlineAction:'move',move:'{"action":"drive","index":2}'});
 const chat=item({chaosOnlineAction:'chat-toggle'});
 const muted=item({chaosOnlineAction:'mute',seat:'1'});
 const report=item({chaosOnlineAction:'chat-report',messageId:'30000000-0000-4000-8000-000000000003'});
 const trace=[];
 const root={querySelector:()=>null,querySelectorAll:selector=>selector==='[data-chaos-online-select]'?[selected]:
  selector==='[data-chaos-online-action]'?[drive,chat,muted,report]:[]};
 const client={state:{room:{id:'10000000-0000-4000-8000-000000000001'}},
  selectCard:n=>trace.push(['select',n]),mutate:(action,payload)=>{trace.push([action,payload]);return Promise.resolve();},
  toggleChat:()=>trace.push(['chat']),toggleMute:n=>trace.push(['mute',n]),
  reportChat:id=>{trace.push(['report',id]);return Promise.resolve();}};
 bindChaosOnline(root,client,'/games');assert.equal(drive.handlers.size,0);
 bindChaosOnline(root,client,'/classics/cross-country-chaos');
 selected.fire('click');drive.fire('click');chat.fire('click');muted.fire('click');report.fire('click');
 assert.deepEqual(trace,[['select',2],['move',{move:{action:'drive',index:2}}],['chat'],
  ['mute',1],['report','30000000-0000-4000-8000-000000000003']]);
});
test('Classic room form bindings retain enabled and route guards after extraction',()=>{
 const refresh=item(),calls=[];
 const root={querySelector:s=>s==='[data-classic-room-refresh]'?refresh:null,querySelectorAll:()=>[]};
 const ctrl={client:{enabled:true}};
 const opts={isSurface:false,onRefresh:()=>calls.push('refresh'),
  onRouteChange:()=>calls.push('route'),history:{pushState(){}}};
 bindClassicRoomsDom(root,ctrl,opts);
 assert.equal(refresh.handlers.size,0);
 bindClassicRoomsDom(root,ctrl,{...opts,isSurface:true});
 refresh.fire('click');
 assert.deepEqual(calls,['refresh']);
});

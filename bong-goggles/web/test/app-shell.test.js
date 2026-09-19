import test from 'node:test';
import assert from 'node:assert/strict';
import {ROUTES,resolveRoute,routeAccess,navigationItems} from '../core/routes.js';
import {button,card,emptyState,errorState,skeleton,tabs,canonicalHandoffs,toast} from '../core/design-system.js';
import {renderApplicationShell} from '../core/app-shell.js';

test('BG-19.3 freezes the complete Genesis navigation route inventory',()=>{
  assert.deepEqual(ROUTES.map(r=>r.id),[
    'home','profile','friends','messages','notifications','discover',
    'groups','pages','events','games','rewards','settings'
  ]);
  assert.equal(resolveRoute('/messages').id,'messages');
  assert.equal(resolveRoute('/does-not-exist').id,'not-found');
});

test('BG-19.3 session guards fail closed for private routes',()=>{
  const route=resolveRoute('/messages');
  assert.equal(routeAccess(route,{connected:false}).allowed,false);
  assert.equal(routeAccess(route,{connected:true,supportedNetwork:false}).allowed,false);
  assert.equal(routeAccess(route,{connected:true,supportedNetwork:true}).allowed,true);
});

test('BG-19.3 public routes remain available in read-only mode',()=>{
  assert.equal(routeAccess(resolveRoute('/discover'),{connected:false}).allowed,true);
  assert.equal(routeAccess(resolveRoute('/'),{connected:false}).allowed,true);
});

test('BG-19.3 navigation emits access state without changing route authority',()=>{
  const items=navigationItems({connected:false});
  assert.equal(items.find(i=>i.id==='messages').access.allowed,false);
  assert.equal(items.find(i=>i.id==='home').access.allowed,true);
});

test('BG-19.3 reusable design-system primitives render escaped content',()=>{
  assert.match(button({label:'Post <now>',action:'post'}),/Post &lt;now&gt;/);
  assert.match(card({title:'Card',body:'<p>safe caller html</p>'}),/ui-card/);
  assert.match(emptyState({message:'none'}),/ui-empty/);
  assert.match(errorState({message:'bad'}),/role="alert"/);
  assert.match(skeleton({lines:2}),/ui-skeleton/);
  assert.match(tabs([{id:'a',label:'A'}],'a'),/aria-selected="true"/);
  assert.match(canonicalHandoffs({walletHref:'https://wallet.example',explorerHref:'https://explorer.example'}),/420Explorer/);
  assert.match(toast({message:'saved'}),/ui-toast/);
});

test('BG-19.3 shell includes desktop/mobile nav and route-aware main content',()=>{
  const html=renderApplicationShell({
    pathname:'/messages',
    bootstrapState:'ready',
    walletView:{
      connected:true,
      supportedNetwork:true,
      account:'0x1111111111111111111111111111111111111111',
      chainId:'0x66a44',
      sessionState:'active'
    },
    walletHref:'https://wallet.example',
    explorerHref:'https://explorer.example'
  });
  assert.match(html,/app-nav--desktop/);
  assert.match(html,/app-nav--mobile/);
  assert.match(html,/aria-current="page"/);
  assert.match(html,/>Messages</);
  assert.match(html,/Canonical state/);
});

test('BG-19.3 shell visibly blocks private routes when disconnected',()=>{
  const html=renderApplicationShell({pathname:'/rewards',bootstrapState:'ready',walletView:{connected:false,supportedNetwork:true}});
  assert.match(html,/Rewards requires 420Wallet/);
  assert.match(html,/Read-only mode/);
});

test('BG-19.3 degraded shell carries explicit non-authoritative warning',()=>{
  const html=renderApplicationShell({pathname:'/',bootstrapState:'degraded'});
  assert.match(html,/Canonical services are degraded/);
  assert.match(html,/Write actions remain unavailable/);
});

import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'vite';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {fileURLToPath} from 'node:url';
test('universal controls render accessible labels and prohibit inactive actions',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));const vite=await createServer({root,server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true}});
 try{
  const {UniversalGamePanel}=await vite.ssrLoadModule('/src/UniversalGamePanel.tsx');
  const view={state:'idle',settings:{volume:0.5,muted:true,reducedMotion:false,highContrast:false}};
  const html=renderToStaticMarkup(React.createElement(UniversalGamePanel,{view,onPause(){},onResume(){},onRestart(){},onSettings(){}}));
  for(const s of ['aria-label="Game controls"','Session:','Restart game','Pause','Resume','Reduce motion','High contrast','Mute audio','id="game-volume"'])assert.ok(html.includes(s),s);
  assert.equal((html.match(/disabled=""/g)||[]).length,3);
 }finally{await vite.close();}
});

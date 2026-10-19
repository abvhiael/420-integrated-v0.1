import test from 'node:test';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';import {createServer} from 'vite';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
test('accessibility route has sound-off opt-in controls and visible cue',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));const vite=await createServer({root,server:{middlewareMode:true},appType:'custom',optimizeDeps:{noDiscovery:true}});
 try{const {Launcher}=await vite.ssrLoadModule('/src/App.tsx');const html=renderToStaticMarkup(React.createElement(Launcher,{initialRoute:{kind:'accessibility'}}));
 for(const token of ['id="arcade-audio-title"','id="arcade-volume"','type="range"','Enable sound','Test cue','role="status"','starts muted'])assert.ok(html.includes(token),token);
 assert.match(html,/disabled=""/);assert.match(html,/min="0"/);assert.match(html,/max="100"/);
 }finally{await vite.close();}
});

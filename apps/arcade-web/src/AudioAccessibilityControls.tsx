import React,{useEffect,useRef,useState} from 'react';
import {ArcadeAudio} from '../../../packages/arcade-audio/src/index.mjs';
import identities from '../../../config/arcade-game-identities.json';
export function AudioAccessibilityControls(){
 const engine=useRef<ArcadeAudio|null>(null);
 const [volume,setVolume]=useState(50),[muted,setMuted]=useState(true);
 const [status,setStatus]=useState('Sound off. Audio requires your permission.');
 useEffect(()=>{
  const a=new ArcadeAudio({gameId:identities.games[0].gameId,createContext:()=>{
   if(typeof window.AudioContext!=='function')throw new Error('Audio unavailable');
   return new window.AudioContext();
  },onCue:event=>setStatus(event.text+' (visual cue)')});
  engine.current=a;return()=>{engine.current=null;void a.dispose();};
 },[]);
 const enable=async()=>{
  const a=engine.current;if(!a)return;
  try{if(!(await a.activate(true)))return;a.setVolume(volume/100);a.setMuted(false);setMuted(false);setStatus('Sound enabled. Visual alternatives remain available.');}
  catch{setStatus('Sound unavailable. Visual alternatives remain available.');}
 };
 const toggle=()=>{const a=engine.current;if(!a||!a.activated)return;const next=!muted;a.setMuted(next);setMuted(next);setStatus(next?'Sound muted':'Sound unmuted');};
 return <section className="audio-controls" aria-labelledby="arcade-audio-title">
  <h2 id="arcade-audio-title">Audio and accessibility controls</h2>
  <p>Sound is optional, starts muted, and is never the only way to receive a cue.</p>
  <label htmlFor="arcade-volume">Volume: {volume}%</label>
  <input type="range" id="arcade-volume" min="0" max="100" step="5" value={volume} onChange={e=>{const v=Number(e.currentTarget.value);setVolume(v);engine.current?.setVolume(v/100);}}/>
  <div className="audio-actions">
   <button type="button" onClick={()=>void enable()}>Enable sound</button>
   <button type="button" disabled={!engine.current?.activated} onClick={toggle}>{muted?'Unmute':'Mute'}</button>
   <button type="button" onClick={()=>{engine.current?.cue('confirm');}}>Test cue</button>
  </div>
  <p role="status" aria-live="polite">{status}</p>
 </section>;
}

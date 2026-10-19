import React from 'react';
export type ControlView={state:string;settings:{volume:number;muted:boolean;reducedMotion:boolean;highContrast:boolean}};
export function UniversalGamePanel({view,onPause,onResume,onRestart,onSettings}:{view:ControlView;onPause:()=>void;onResume:()=>void;onRestart:()=>void;onSettings:(patch:Partial<ControlView['settings']>)=>void}){
 const active=view.state==='running'||view.state==='paused';
 return <section aria-label="Game controls" className="universal-game-panel">
  <h2>Game controls</h2><p role="status" aria-live="polite">Session: {view.state}</p>
  <div className="game-action-controls">
   <button type="button" onClick={onPause} disabled={view.state!=='running'}>Pause</button>
   <button type="button" onClick={onResume} disabled={view.state!=='paused'}>Resume</button>
   <button type="button" onClick={onRestart} disabled={!active&&view.state!=='error'}>Restart game</button>
  </div>
  <fieldset><legend>Game settings</legend>
   <label htmlFor="game-volume">Volume: {Math.round(view.settings.volume*100)}%</label>
   <input id="game-volume" type="range" min={0} max={100} step={5} value={Math.round(view.settings.volume*100)} onChange={e=>onSettings({volume:Number(e.currentTarget.value)/100})}/>
   <label><input type="checkbox" checked={view.settings.muted} onChange={e=>onSettings({muted:e.currentTarget.checked})}/> Mute audio</label>
   <label><input type="checkbox" checked={view.settings.reducedMotion} onChange={e=>onSettings({reducedMotion:e.currentTarget.checked})}/> Reduce motion</label>
   <label><input type="checkbox" checked={view.settings.highContrast} onChange={e=>onSettings({highContrast:e.currentTarget.checked})}/> High contrast</label>
  </fieldset>
 </section>;
}

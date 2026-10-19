import React from 'react';
import {createRoot} from 'react-dom/client';
export type CasualViewProps={gameId:string;paused:boolean;progress:unknown};
type RenderOptions={container:Element;View:React.ComponentType<CasualViewProps>;gameId:string;signal:AbortSignal;paused:boolean};
export function createCasualReactRenderer({container,View,gameId,signal,paused}:RenderOptions){
 if(signal.aborted)throw new Error('Game load aborted');
 const root=createRoot(container);
 let disposed=false;
 const update=({paused,progress}:{paused:boolean;progress:unknown})=>{
  if(disposed||signal.aborted)throw new Error('React game session disposed');
  root.render(<View gameId={gameId} paused={paused} progress={progress}/>);
 };
 try{update({paused,progress:null});}
 catch(error){disposed=true;root.unmount();throw error;}
 return {render:update,unmount(){if(disposed)return;disposed=true;root.unmount();}};
}

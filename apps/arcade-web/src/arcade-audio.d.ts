declare module '../../../packages/arcade-audio/src/index.mjs' {
 export class ArcadeAudio {
  constructor(options:{gameId:string;createContext:()=>AudioContext;onCue?:(event:{gameId:string;name:string;text:string})=>void});
  readonly activated:boolean;readonly muted:boolean;readonly volume:number;
  activate(gesture:boolean):Promise<boolean>;
  setVolume(volume:number):void;setMuted(muted:boolean):void;cue(name:string):boolean;
  pause():void;resume():void;dispose():Promise<void>;
 }
}

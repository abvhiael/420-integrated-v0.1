export declare class AudioError extends Error {}
export declare class ArcadeAudio {
 constructor(options:{gameId:string;createContext:()=>AudioContext;onCue?:(event:{gameId:string;name:string;text:string})=>void});
 readonly muted:boolean;
 readonly activated:boolean;
 readonly volume:number;
 setMuted(value:boolean):void;
 setVolume(value:number):void;
 activate(gesture?:boolean):Promise<boolean>;
 cue(name:string,gameId?:string):boolean;
 pause():void;
 resume():void;
 dispose():Promise<void>;
}

import React from 'react';
type Props={children:React.ReactNode;fallback?:(retry:()=>void)=>React.ReactNode};
type State={failure:boolean;generation:number};
export class ArcadeGameErrorBoundary extends React.Component<Props,State>{
 state:State={failure:false,generation:0};
 static getDerivedStateFromError():Partial<State>{return {failure:true};}
 componentDidCatch(error:Error){if(import.meta.env.DEV)console.error('Arcade game failed',error.name);}
 retry=()=>{this.setState(s=>({failure:false,generation:s.generation+1}));};
 render(){if(this.state.failure)return this.props.fallback?.(this.retry)??<section role="alert" aria-live="assertive"><h2>Game unavailable</h2><p>This game encountered an error. Your other Arcade pages remain available.</p><button type="button" onClick={this.retry}>Retry game</button><a href="#/games">Back to games</a></section>;return <React.Fragment key={this.state.generation}>{this.props.children}</React.Fragment>;}
}

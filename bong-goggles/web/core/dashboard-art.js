// Static approved dashboard artwork. No runtime network lookup or identity data.
export const GREETINGS=Object.freeze({
 welcome:Object.freeze({file:'welcome.webp',label:'Welcome to Bong Goggles — The social network for cannabis culture. Community, creativity, knowledge, good company.'}),
 morning:Object.freeze({file:'good-morning.webp',label:'Good morning, good buds — Wake, bake, and connect.'}),
 grow:Object.freeze({file:'grow-together.webp',label:'Grow together — Share, learn, and thrive.'}),
 night:Object.freeze({file:'after-hours.webp',label:'420 After Hours — Kick back with the community.'})
});
export const APP_ART=Object.freeze({
 '420Integrated':'420integrated','420Exchange':'420exchange','420Pay':'420pay','420TownSquare':'420townsquare','DoobTube':'doobtube','PuffBuddies':'puffbuddies','420Arcade':'420arcade','More dApps':'more-dapps'
});
export const DASHBOARD_ASSETS=Object.freeze([
 ...Object.values(GREETINGS).map(x=>'assets/greetings/'+x.file),
 'assets/sidebars/botanical-dark.webp','assets/sidebars/botanical-light.webp',
 ...Object.values(APP_ART).map(x=>'assets/apps/'+x+'.webp')
]);
export function selectGreeting(date=new Date()){
 const hour=date instanceof Date?date.getHours():NaN;
 if(!Number.isInteger(hour))return GREETINGS.welcome;
 if(hour>=5&&hour<11)return GREETINGS.morning;
 if(hour>=11&&hour<17)return GREETINGS.grow;
 if(hour>=17&&hour<21)return GREETINGS.welcome;
 return GREETINGS.night;
}
export function greetingSrc(greeting){return '/assets/greetings/'+greeting.file;}

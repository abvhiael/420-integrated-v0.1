import {createHighCountryApp} from './app.js';
const res=await fetch('/runtime-config.json',{cache:'no-store'});
if(!res.ok)throw Error('runtime-config-unavailable');
const config=await res.json();
createHighCountryApp({document,location,config});

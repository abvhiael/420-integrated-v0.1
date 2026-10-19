import * as Crypto from 'expo-crypto';
import {createRiderApi} from './rider-api.mjs';
import {createRiderJourney} from './rider-journey.mjs';
// Called only by approved native deployment assembly after MBL-2 Identity setup.
// No origin or access token is taken from UI input, navigation, or deep links.
export function createNativeRider({session,approvedOrigin,accessToken}:{session:{withFreshRole:(role:string,fn:(s:any)=>Promise<any>)=>Promise<any>};approvedOrigin:string;accessToken:()=>Promise<string>}){
 if(!session||typeof session.withFreshRole!=='function'||typeof accessToken!=='function'||!approvedOrigin)throw Error('RIDER_NOT_CONFIGURED');
 const api=createRiderApi({origin:approvedOrigin,accessToken});
 const commandId=()=>Array.from(Crypto.getRandomBytes(24),b=>b.toString(16).padStart(2,'0')).join('');
 return createRiderJourney({session,api,commandId});
}

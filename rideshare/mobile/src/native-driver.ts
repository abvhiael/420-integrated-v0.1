import * as Crypto from 'expo-crypto';
import {createDriverApi} from './driver-api.mjs';
import {createDriverJourney} from './driver-journey.mjs';
// Activated only by trusted testnet deployment assembly with a verified driver-role session.
// Neither navigation deep links nor UI input may choose the authority origin.
export function createNativeDriver({session,approvedOrigin,accessToken}:{session:{withFreshRole:(role:string,fn:(s:any)=>Promise<any>)=>Promise<any>};approvedOrigin:string;accessToken:()=>Promise<string>}){
 if(!session||typeof session.withFreshRole!=='function'||typeof accessToken!=='function'||!approvedOrigin)throw Error('DRIVER_NOT_CONFIGURED');
 const api=createDriverApi({origin:approvedOrigin,accessToken});
 const commandId=()=>Array.from(Crypto.getRandomBytes(24),n=>n.toString(16).padStart(2,'0')).join('');
 return createDriverJourney({session,api,commandId});
}

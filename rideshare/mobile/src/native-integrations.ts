import * as Crypto from 'expo-crypto';
import {createMobileIntegratedConsumers,createLiftdTravelSdk} from './integrated-consumers.mjs';
import {createMobileServiceApi} from './service-api.mjs';
// Only trusted deployment assembly injects an approved endpoint, Wallet SDK and OS permission provider.
// No third-party message/push transport and no in-app key custody.
type Adapter={getStatus:()=>any;withFreshRole:(role:string,action:(session:any)=>Promise<any>)=>Promise<any>};
export function createNativeIntegrations({session,approvedOrigin,accessToken,permission}:{session:Adapter;approvedOrigin:string;accessToken:()=>Promise<string>;permission:{request:()=>Promise<boolean>}}){
 if(!session||!approvedOrigin||typeof accessToken!=='function'||typeof permission?.request!=='function')throw Error('INTEGRATIONS_NOT_CONFIGURED');
 const commandId=()=>Array.from(Crypto.getRandomBytes(24),n=>n.toString(16).padStart(2,'0')).join('');
 const api=createMobileServiceApi({approvedOrigin,tokenProvider:accessToken});
 const travelSdk=createLiftdTravelSdk({origin:approvedOrigin,fetchImpl:fetch,tokenProvider:accessToken});
 return createMobileIntegratedConsumers({session,api,travelSdk,permission,commandId});
}

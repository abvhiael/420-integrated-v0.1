import path from 'node:path';
import {loadExchangeReadConfig,startExchangeReadService} from './startup.mjs';
const file=path.resolve(process.argv[2]??process.env.EXCHANGE_READ_CONFIG??'config/local.json');
const config=loadExchangeReadConfig(file);
const runtime=await startExchangeReadService(config);
console.log(JSON.stringify({service:'420Exchange Read API',status:'listening',address:runtime.address,api:'v13.6'}));

import http from 'node:http';

const API_HEADERS=Object.freeze({'content-type':'application/json; charset=utf-8','x-420-api-major':'13','x-420-api-minor':'6','cache-control':'no-store'});
function write(res,status,body){const data=JSON.stringify(body);res.writeHead(status,{...API_HEADERS,'content-length':Buffer.byteLength(data)});res.end(data);}
function error(res,status,code,message){write(res,status,{error:{code,message,stableId:'exchange-read-'+code.toLowerCase()}});}
const limit=u=>{const raw=u.searchParams.get('limit')??'50';if(!/^\d+$/.test(raw))throw new Error('invalid limit');const n=Number(raw);if(!Number.isSafeInteger(n)||n<1||n>100)throw new Error('invalid limit');return n;};
export function createExchangeReadHandler(service){
  return async(req,res)=>{
    try{
      const u=new URL(req.url,'http://exchange.local'),path=u.pathname.replace(/\/+$/,'')||'/';
      if(req.method!=='GET')return error(res,405,'METHOD_NOT_ALLOWED','only GET is supported');
      if(path==='/health')return write(res,200,service.health());
      if(path==='/ready'){const r=await service.readiness();return write(res,r.ready?200:503,r);}
      const m=path.match(/^\/v13\/markets\/([^/]+)\/snapshot$/);
      if(m){let id;try{id=decodeURIComponent(m[1]);}catch{return error(res,400,'MALFORMED_QUERY','invalid market subject encoding');}const snapshot=await service.snapshot(id);return write(res,200,{schema:'420-exchange-snapshot-response-v13.6',snapshot});}
      if(path==='/v13/history'){
        const kind=u.searchParams.get('kind')??'';const subjectId=u.searchParams.get('subjectId');const activeOnly=(u.searchParams.get('activeOnly')??'true')!=='false';
        const page=await service.history({kind,subjectId,activeOnly,cursor:u.searchParams.get('cursor')??'',limit:limit(u)});
        return write(res,200,{schema:'420-exchange-history-response-v13.6',...page});
      }
      return error(res,404,'NOT_FOUND','route not found');
    }catch(e){
      if(e?.code==='NOT_FOUND')return error(res,404,'NOT_FOUND',e.message);
      if(/invalid|unsupported|cursor/i.test(String(e?.message??'')))return error(res,400,'MALFORMED_QUERY',String(e.message));
      return error(res,503,'PROJECTION_UNAVAILABLE','Exchange projection unavailable');
    }
  };
}
export function createExchangeReadHttpServer(service){return http.createServer(createExchangeReadHandler(service));}

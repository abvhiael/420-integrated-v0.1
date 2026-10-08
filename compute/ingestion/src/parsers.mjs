import {IngestionError} from './client.mjs';
function bad(){throw new IngestionError('SCHEMA_DRIFT')}
const safeUInt=s=>{if(typeof s!=='string'||!/^(0|[1-9][0-9]{0,17})$/.test(s))bad();let b=BigInt(s);if(b>BigInt(Number.MAX_SAFE_INTEGER))bad();return s};
export function parseFoldingDonorCsv(input){
 if(input.length>1048576||input.includes('\\0'))bad();
 const rows=input.trim().split(/\\r?\\n/);if(rows.length>501)bad();
 const records=rows.map(row=>{const parts=row.split('\\t');if(parts.length!==3)bad();const [donor,points,units]=parts;if(!donor||donor.length>100||/[\\x00-\\x1f]/.test(donor))bad();return {identityDigestOnly:true,creditUnits:'FOLDING_POINTS',points:safeUInt(points),workUnits:safeUInt(units)}});return {records};
}
export function parseBoincStatsXml(input){
 if(input.length>1048576||/<!DOCTYPE|<!ENTITY|<\\?xml-stylesheet|<script/i.test(input))bad();
 if(!/^\\s*(?:<\\?xml[^>]*>\\s*)?<users>/.test(input)||!/<\\/users>\\s*$/.test(input))bad();
 const inner=input.replace(/^\\s*(?:<\\?xml[^>]*>\\s*)?<users>/,'').replace(/<\\/users>\\s*$/,'');
 const chunks=inner.match(/<user>[\\s\\S]*?<\\/user>/g)||[];if(chunks.length>500||chunks.join('').replace(/\\s/g,'')!==inner.replace(/\\s/g,''))bad();
 const records=chunks.map(ch=>{const id=ch.match(/<id>([0-9]+)<\\/id>/),total=ch.match(/<total_credit>([0-9]+)<\\/total_credit>/);if(!id||!total||/\\&|<host|<name|<email|<passwd/i.test(ch))bad();return {identityDigestOnly:true,projectUserId:safeUInt(id[1]),creditUnits:'BOINC_CREDIT',credit:safeUInt(total[1])}});return {records};
}

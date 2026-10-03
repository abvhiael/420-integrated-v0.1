import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),dist=path.join(root,'dist');
fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist,{recursive:true});
for(const file of ['index.html','app.js','styles.css','runtime-config.json'])fs.copyFileSync(path.join(root,file),path.join(dist,file));
fs.cpSync(path.join(root,'core'),path.join(dist,'core'),{recursive:true});
fs.copyFileSync(path.join(dist,'index.html'),path.join(dist,'404.html'));
fs.writeFileSync(path.join(dist,'_headers'),"/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Content-Security-Policy: default-src 'self'; connect-src 'self' https:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'\n");
fs.writeFileSync(path.join(dist,'build-meta.json'),JSON.stringify({schema:'420-launchpad-web-build-v1',sourceSha:process.env.GITHUB_SHA||'local',execution:'FAIL_CLOSED_UNTIL_RUNTIME_RESOLVED'},null,2)+'\n');
console.log('420Launchpad web artifact built at '+dist);

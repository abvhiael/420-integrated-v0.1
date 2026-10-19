import {readFileSync,writeFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const write=(p,v)=>writeFileSync(new URL(p,import.meta.url),v);
let html=read('../index.html');
if(!html.includes('assets/liftd-official-logo.png')){
 html=html.replace('<link rel="stylesheet" href="./styles.css">','<link rel="icon" href="./assets/favicon.ico" sizes="any">\n  <link rel="icon" type="image/png" href="./assets/liftd-official-logo.png">\n  <link rel="stylesheet" href="./styles.css">');
 html=html.replace('<a href="/" data-route aria-label="LIFTd home">LIFTd</a>','<a href="/" data-route aria-label="LIFTd home"><img class="brand-logo" src="./assets/liftd-official-logo.png" alt="LIFTd — arrive higher" width="1536" height="1024"></a>');
 html=html.replace('<footer>Accessibility','<footer><img class="footer-logo" src="./assets/liftd-official-logo.png" alt="LIFTd — arrive higher" width="1536" height="1024">Accessibility');
 write('../index.html',html);
}
let css=read('../styles.css');
if(!css.includes('/* Official LIFTd artwork */')){
 css+='\n/* Official LIFTd artwork */\n.brand-logo{display:block;width:clamp(8rem,17vw,12rem);height:auto;object-fit:contain}.footer-logo{display:block;width:clamp(10rem,22vw,16rem);height:auto;object-fit:contain;margin:0 auto 1rem}.main-logo{display:block;width:min(100%,32rem);height:auto;object-fit:contain;margin:0 auto 1.2rem}.brand a{display:inline-block;text-decoration:none}\n';
 write('../styles.css',css);
}
let app=read('../app.mjs');
if(!app.includes('/* Official LIFTd public logo */')){
 const match='panel.append(node("p", AVAILABILITY.market + " pilot — " + AVAILABILITY.label + ".", "status"));';
 if(!app.includes(match))throw Error('Public panel insertion not found; inspect current app before changing it');
 app=app.replace(match,`/* Official LIFTd public logo */
    const officialLogo = document.createElement("img");
    officialLogo.className = "main-logo";
    officialLogo.src = "./assets/liftd-official-logo.png";
    officialLogo.alt = "LIFTd — arrive higher";
    officialLogo.width = 1536;
    officialLogo.height = 1024;
    panel.insertBefore(officialLogo, panel.firstChild);
    ${match}`);
 write('../app.mjs',app);
}
console.log('Official LIFTd logo wired into favicon, header, main home panel and footer.');

import {loadRuntimeConfig} from './core/runtime-config.js';
import {createBongGogglesServices} from './core/services.js';
import {deriveBootstrapState} from './core/bootstrap.js';
import {createTelemetrySink} from './core/telemetry.js';

const root=document.querySelector('#app');
const telemetry=createTelemetrySink({emit:(event)=>console.info('[bg-web]',event)});

function render(view){
  root.dataset.state=view.state;
  root.innerHTML=`
    <main class="bootstrap-shell" aria-live="polite">
      <section class="bootstrap-card">
        <p class="eyebrow">420 Integrated</p>
        <h1>Bong Goggles</h1>
        <p class="status">${view.state}</p>
        <p class="detail">${view.detail}</p>
      </section>
    </main>`;
}

async function start(){
  render({state:'loading',detail:'Loading canonical application configuration…'});
  try{
    const config=await loadRuntimeConfig();
    createBongGogglesServices(config);
    const view=deriveBootstrapState({config});
    telemetry.event('bootstrap',{state:view.state,environment:config.environment});
    render({
      state:view.state,
      detail:view.state==='maintenance'
        ?'Bong Goggles is temporarily in maintenance mode.'
        :'Application foundation loaded. Social surfaces arrive in BG-19.2+.',
    });
  }catch(error){
    telemetry.event('bootstrap_error',{message:error?.message});
    render({state:'degraded',detail:'Bong Goggles could not load a safe runtime configuration.'});
  }
}

window.addEventListener('error',(event)=>telemetry.event('window_error',{message:event.message}));
window.addEventListener('unhandledrejection',(event)=>telemetry.event('unhandled_rejection',{reason:String(event.reason)}));
start();

import {defineConfig} from 'vite';
export default defineConfig({
 server:{proxy:{'/api/420bet/player-history':{
  target:'http://127.0.0.1:'+(process.env.BET_HISTORY_PORT||'8787'),
  changeOrigin:false
 }}}
});

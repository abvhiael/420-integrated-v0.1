import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser', timeout:30000, retries:0, workers:2,
 use:{ baseURL:'http://127.0.0.1:8769', trace:'retain-on-failure' },
 projects:[
  {name:'desktop-keyboard',use:{...devices['Desktop Chrome']}},
  {name:'mobile-touch',use:{...devices['Pixel 7']}},
 ],
 webServer:{command:'python3 tests/browser/doobr_static_server.py',
  url:'http://127.0.0.1:8769/doobr/',reuseExistingServer:false,timeout:15000}
});

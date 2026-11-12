const assert=require('node:assert/strict');
const {mkdtemp,rm}=require('node:fs/promises');
const {resolve}=require('node:path');
const {chromium}=require('playwright');
const AxeBuilder=require('@axe-core/playwright').default;
(async()=>{
 const {serve}=await import('../scripts/dev-server.mjs'),{createArenaBackend}=await import('../server/app.js');
 const {pgStore}=await import('./pg-store.mjs'),{authFixture,testPassword}=await import('./auth-fixture.mjs');
 const dir=await mkdtemp('/tmp/blaind-a11y-'),auth=authFixture(),store=await pgStore(dir,{identity:auth.identity});
 const server=serve({root:resolve(__dirname,'../public'),backend:createArenaBackend({store,auth,env:{NODE_ENV:'test'}})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({...(process.env.PLAYWRIGHT_BUNDLED_CHROMIUM==='1'?{}:{executablePath:'/usr/bin/chromium'}),args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const errors=[];let checks=0;
 async function check(page,label){
  const {violations}=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']).analyze();
  assert.deepEqual(violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})),[],label);
  checks++;
 }
 try{
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
   for(const path of ['/','/arena/','/atmosphere/','/legal/','/legal/privacy.html','/legal/rules.html','/legal/terms.html','/legal/consents.html','/legal/sources.html','/admin/']){
    const page=await context.newPage();await page.goto(base+path);await page.evaluate(()=>document.fonts.ready);
    if(path==='/arena/')await page.locator('#ranking-body tr').first().waitFor();
    await check(page,path+' at '+width+'px');
    if(path==='/admin/'){
     await page.locator('[name=email]').fill('admin@example.test');await page.locator('[name=password]').fill(testPassword);await page.locator('#login-form button').click();await page.locator('#workspace').waitFor({state:'visible'});
     await check(page,'players editor at '+width+'px');
     await page.locator('[data-tab=tournaments]').click();await page.locator('#list').getByText('Golden Night',{exact:true}).click();await check(page,'tournament editor at '+width+'px');
    }
    await page.close();
   }
   await context.close();
  }
  assert.deepEqual(errors,[]);console.log(`PASS axe WCAG 2 A/AA, 2.1/2.2 AA and best practices: ${checks} desktop/mobile page and admin states; no automated violations. Keyboard and recovery scenarios are covered by polish-browser.cjs.`);
 }finally{await browser.close();await new Promise(r=>server.close(r));await store.db.close();await rm(dir,{recursive:true,force:true})}
})().catch(error=>{console.error(error);if(process.env.GITHUB_ACTIONS)console.error('::error::'+String(error.stack||error).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A'));process.exitCode=1});

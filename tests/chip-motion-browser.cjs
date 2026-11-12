const assert=require('node:assert/strict');const{chromium}=require('playwright');const{startSite,browserOptions}=require('./club-fixture.cjs');
(async()=>{const site=await startSite(),browser=await chromium.launch(browserOptions),errors=[];try{
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900}});await context.addInitScript(()=>{Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8});Object.defineProperty(navigator,'deviceMemory',{get:()=>8});window.frameRequests=0;const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>{window.frameRequests++;return raf(fn)}});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(site.base+'/');await page.locator('.model-loaded canvas').waitFor({timeout:60000});await page.waitForTimeout(300);
  const frameRequests=await page.evaluate(()=>window.frameRequests);
  const matrix=await page.locator('canvas').evaluate(n=>n.toDataURL()),initial=await page.locator('.chip-stage').evaluate(n=>({top:n.getBoundingClientRect().top+scrollY,left:n.getBoundingClientRect().left}));
  assert.equal(await page.locator('canvas').getAttribute('data-lod'),width<=900?'mobile':'desktop');
  await page.locator('.club-directions').scrollIntoViewIfNeeded();await page.waitForTimeout(350);assert.equal(await page.locator('canvas').evaluate(n=>n.toDataURL()),matrix,'no continuous rotation or scroll rendering');assert.equal(await page.evaluate(()=>window.frameRequests),frameRequests,'scroll does not schedule animation frames');
  const after=await page.locator('.chip-stage').evaluate(n=>({top:n.getBoundingClientRect().top+scrollY,left:n.getBoundingClientRect().left}));assert.deepEqual(after,initial);assert.equal(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length),0);
  await page.setViewportSize({width:width===1440?1024:width,height:780});await page.waitForTimeout(200);assert.equal(await page.locator('canvas').count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('canvas').evaluate(n=>n.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());await page.locator('.fallback-visible .chip-fallback').waitFor({state:'visible'});assert.equal(await page.locator('canvas').count(),0);await context.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS actual desktop/mobile GLB, still pose without scroll/pointer animation, no render loop, one resized canvas, non-overlapping layout and context-loss logo fallback.');
}finally{await browser.close();await site.close()}})().catch(e=>{console.error(e);if(process.env.GITHUB_ACTIONS)console.error('::error::'+String(e.stack||e).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A'));process.exitCode=1});

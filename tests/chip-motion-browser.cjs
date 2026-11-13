const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {startSite, browserOptions} = require('./club-fixture.cjs');
(async () => {
 const site = await startSite(), browser = await chromium.launch(browserOptions), errors = [];
 try {
  for (const [width, hasTouch] of [[320,true],[390,true],[768,true],[1024,true],[1366,true],[1100,false],[1440,false],[1920,false]]) {
   const context = await browser.newContext({viewport:{width,height:900},hasTouch});
   await context.addInitScript(() => {
    Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>8});
    Object.defineProperty(navigator,'deviceMemory',{get:()=>8});
    window.addEventListener('pointerup',()=>{const c=document.querySelector('canvas');if(c?.dataset.pose)window.releasePose=JSON.parse(c.dataset.pose)},true);
    window.frameRequests=0;window.arrivalHeights=[];const raf=requestAnimationFrame.bind(window);
    window.requestAnimationFrame=fn=>{window.frameRequests++;return raf(t=>{fn(t);const c=document.querySelector('canvas');if(c?.dataset.pose)window.arrivalHeights.push(JSON.parse(c.dataset.pose).y)})};
   });
   const page=await context.newPage(), requests=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
   await page.goto(site.base+'/');
   if(width<=1100||hasTouch){
    await page.waitForTimeout(400);
    assert.equal(await page.locator('canvas').count(),0);
    assert.equal(await page.locator('.chip-stage').boundingBox(),null);
    assert.deepEqual(requests.filter(url=>/\.glb|model(?:-|\.js)|three|meshopt/.test(url)),[],width+' has no 3D requests');
   }else{
    await page.locator('.object-arrival[data-state=arriving]').waitFor({timeout:60000});
    await page.waitForFunction(()=>Number(JSON.parse(document.querySelector('canvas').dataset.pose).y)>0);
    await page.locator('.object-arrival[data-state=ready]').waitFor();
    const canvas=page.locator('canvas'), stage=page.locator('.chip-stage');
    const pose=()=>canvas.evaluate(n=>JSON.parse(n.dataset.pose));
    const settled=await pose();assert.equal(settled.y,0);
    assert.ok(await page.evaluate(()=>window.arrivalHeights.some((y,i,a)=>i>0&&y>a[i-1]+.01)),'arrival includes a rebound');assert.equal(await canvas.getAttribute('data-lod'),'desktop');
    const frames=await page.evaluate(()=>window.frameRequests);await page.waitForTimeout(250);
    assert.equal(await page.evaluate(()=>window.frameRequests),frames,'idle does not render');
    const box=await stage.boundingBox(),copy=await page.locator('.club-hero-copy').boundingBox();
    assert.ok(copy.x+copy.width<=box.x,'model cannot overlap copy');
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.move(box.x+box.width/2+40,box.y+box.height/2);
    assert.deepEqual(await pose(),settled,'hover does not rotate');
    await page.mouse.down();await page.mouse.move(box.x+box.width/2+130,box.y+box.height/2+30,{steps:8});
    await page.mouse.up();const dragged=await page.evaluate(()=>window.releasePose);assert.notEqual(dragged.ry,settled.ry);
    await page.waitForTimeout(100);assert.notEqual((await pose()).ry,dragged.ry,'inertia continues after release');
    await page.waitForTimeout(1600);const resting=await pose();const stopped=await page.evaluate(()=>window.frameRequests);
    await page.waitForTimeout(200);assert.deepEqual(await pose(),resting);assert.equal(await page.evaluate(()=>window.frameRequests),stopped,'inertia stops');
    await stage.focus();await page.keyboard.press('ArrowRight');assert.notEqual((await pose()).ry,resting.ry);
    // Offscreen inertia is cancelled and the renderer returns to sleep.
    await page.mouse.move(box.x+180,box.y+180);await page.mouse.down();await page.mouse.move(box.x+250,box.y+200,{steps:4});await page.mouse.up();
    await page.setViewportSize({width,height:350});await page.locator('.site-footer').scrollIntoViewIfNeeded();await page.waitForTimeout(250);
    const asleep=await page.evaluate(()=>window.frameRequests);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>window.frameRequests),asleep,'no offscreen animation loop');
    await page.evaluate(()=>scrollTo(0,0));await page.setViewportSize({width,height:900});
    // Changing breakpoint disposes the GPU and removes the reserved area.
    await page.setViewportSize({width:768,height:900});await canvas.waitFor({state:'detached'});assert.equal(await stage.boundingBox(),null);
    await page.setViewportSize({width,height:900});await page.locator('.object-arrival[data-state=ready]').waitFor({timeout:60000});
    await page.locator('canvas').evaluate(n=>n.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await page.locator('.fallback-visible .chip-fallback').waitFor({state:'visible'});assert.equal(await page.locator('canvas').count(),0);
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await context.close();
  }
  const reduced=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),page=await reduced.newPage();
  await page.goto(site.base+'/');await page.locator('.object-arrival[data-state=ready]').waitFor({timeout:60000});
  assert.equal(await page.locator('canvas').evaluate(n=>JSON.parse(n.dataset.pose).y),0,'reduced motion skips arrival');await reduced.close();
  assert.deepEqual(errors,[]);
  console.log('PASS desktop drop, drag, damped inertia, idle stop, keyboard, breakpoint disposal, context-loss fallback, reduced motion; phones and tablets request no 3D resources.');
 }finally{await browser.close();await site.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

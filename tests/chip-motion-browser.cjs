const assert=require('node:assert/strict');const{resolve}=require('node:path');const{chromium}=require('playwright');
(async()=>{
 const{serve}=await import('../scripts/dev-server.mjs');const server=serve({root:resolve(__dirname,'../public')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
  for(const width of[393,1440]){
   const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/',{waitUntil:'commit'});
   await page.waitForFunction(()=>{const a=document.querySelector('.object-arrival')?.getAnimations()[0];if(!a)return false;window.chipFall=a;a.pause();a.currentTime=600;return true},{},{timeout:60000,polling:10});
   await page.locator('.model-loaded canvas').waitFor({state:'visible',timeout:60000});
   const fall=await page.evaluate(async()=>{
    const arrival=document.querySelector('.object-arrival'),position=document.querySelector('.object-position'),animation=window.chipFall;
    const samples=[];
    // Sample the actual compositor animation, including every rebound.
    for(const time of[0,150,300,450,600,750,960,1050,1210,1300,1530]){
     animation.pause();animation.currentTime=time;
     await new Promise(r=>requestAnimationFrame(r));
     const rect=position.getBoundingClientRect(),matrix=new DOMMatrixReadOnly(getComputedStyle(arrival).transform);
     samples.push({time,lift:matrix.m42,x:rect.x+rect.width/2});
    }
    animation.play();return samples;
   });
   assert.ok(fall[0].lift< -300);assert.ok(fall[2].lift>fall[1].lift);assert.ok(Math.abs(fall[4].lift)<1);assert.ok(fall[5].lift< -20);assert.ok(fall[7].lift<0);assert.ok(Math.abs(fall.at(-1).lift)<1);
   if(width<=600)assert.ok(fall.every(s=>Math.abs(s.x-width/2)<1),'entire mobile fall stays centered');
   await page.waitForFunction(()=>document.querySelector('.object-arrival').dataset.state==='ready');
   for(const id of['about','experience','events','contact','events','experience','about','top']){
    const before=await page.locator('.object-position').getAttribute('style');
    await page.evaluate(id=>scrollTo({top:id==='top'?0:document.getElementById(id).offsetTop,behavior:'instant'}),id);
    await page.waitForFunction(id=>document.querySelector('.object-position').dataset.chapter===id,id);
    await page.waitForFunction(({width,id})=>{
     const n=document.querySelector('.object-position'),r=n.getBoundingClientRect();
     if(width<=600&&['about','experience','events'].includes(id))return getComputedStyle(n).visibility==='hidden';
     if(id==='contact'){const s=document.querySelector('.final-object-space').getBoundingClientRect();return Math.abs(r.x+r.width/2-width/2)<2&&Math.abs(r.y+r.height/2-(s.y+s.height/2))<2}
     const pose=width<=600?[.5,null]:{top:[.79,.47],about:[.77,.42],experience:[.24,.37],events:[.81,.43]}[id];
     return Math.abs(r.x+r.width/2-width*pose[0])<2&&(pose[1]===null||Math.abs(r.y+r.height/2-900*pose[1])<2);
    },{width,id},{timeout:12000});
    if(id==='top')await page.waitForFunction(()=>document.querySelector('.object-arrival').dataset.state==='ready');
    await page.screenshot({path:`/tmp/blaind-repaired-${width}-${id}.png`});
    const box=await page.locator('.object-position').boundingBox(),visibility=await page.locator('.object-position').evaluate(n=>getComputedStyle(n).visibility);
    if(width<=600&&['about','experience','events'].includes(id))assert.equal(visibility,'hidden','mobile fully leaves screen '+id);
    else{
     assert.equal(visibility,'visible');assert.notEqual(await page.locator('.object-position').getAttribute('style'),before);
     if(width>600&&id!=='contact'){
      const pose={top:[.79,.47],about:[.77,.42],experience:[.24,.37],events:[.81,.43]}[id];
      assert.ok(Math.abs(box.x+box.width/2-width*pose[0])<2,'restored desktop x '+id);assert.ok(Math.abs(box.y+box.height/2-900*pose[1])<2,'restored desktop y '+id);
     }
     if(width<=600&&id==='contact'){
      const space=await page.locator('.final-object-space').boundingBox();assert.ok(box.y>=space.y&&box.y+box.height<=space.y+space.height);assert.ok(Math.abs(box.x+box.width/2-width/2)<2);
     }
    }
    assert.equal(await page.locator('.object-scene').evaluate(n=>n.style.clipPath),'','chip is never cropped');
   }
   await page.screenshot({path:'/tmp/blaind-repaired-'+width+'.png'});assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS actual WebGL, full centered fall and rebounds, original five desktop poses, mobile fly-out/return without clipping, reverse scroll and no page errors.');
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});

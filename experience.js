const position = document.querySelector('.object-position');
const arrival = document.querySelector('.object-arrival');
const ring = document.querySelector('.landing-ring');
const caption = document.querySelector('.object-caption');
const scene=document.querySelector('.object-scene');
const sectionIds=['top','about','experience','events','contact'];
const sections=sectionIds.map(id=>document.getElementById(id));
const finalSpace=document.querySelector('.final-object-space');
let mobile=false,viewportWidth=0,viewportHeight=0,modelWidth=0,finalTop=0,finalBottom=0,heroBoundary=0,mobileSlot='hero',resizeFrame=0,slowFrames=0;
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const keys = ['x', 'y', 's', 'rx', 'ry', 'rz'];
let chapters = [], activeChapter = -1, current = null, velocity = {};
let model = null, lastDrawnPose = null, dropStart = null, dropElapsed = 0, impactIndex = -1;
let frame = 0, lastTime = 0, lastStage=null, dropAnimation=null;

// Chapters select fixed viewport poses. Scroll never scrubs the model's transform.
function layout(snap = false) {
  const wasMobile=mobile;mobile=innerWidth<=600;
  if(wasMobile!==mobile)snap=true;
  const w=viewportWidth=mobile?document.documentElement.clientWidth:innerWidth,h=viewportHeight=innerHeight;
  modelWidth=position.offsetWidth;
  const headerHeight=document.querySelector('.site-header').offsetHeight;
  heroBoundary=document.querySelector('.hero-content').getBoundingClientRect().top+scrollY-16;
  const rect=finalSpace.getBoundingClientRect();finalTop=rect.top+scrollY;finalBottom=rect.bottom+scrollY;
  const footer=document.querySelector('.site-footer');
  const documentHeight=Math.max(h,footer.getBoundingClientRect().bottom+scrollY);
  const bottom=Math.max(0,documentHeight-h);
  const finalScroll=Math.min(sections[4].offsetTop,bottom);
  // Desktop preserves the original five chapter poses and entry thresholds.
  const desktopPoses=[
    {x:w*.79,y:h*.47,s:.88,rx:18,ry:-24,rz:-16},
    {x:w*.77,y:h*.42,s:.75,rx:30,ry:-154,rz:10},
    {x:w*.24,y:h*.37,s:.76,rx:22,ry:-214,rz:-14},
    {x:w*.81,y:h*.43,s:.62,rx:-12,ry:-330,rz:10},
    {x:w*.5,y:(finalTop+finalBottom)/2-finalScroll,s:.47,rx:0,ry:-360,rz:0}
  ];
  // Mobile slots live in document space: scrolling never drags the chip over copy.
  const away={x:w+modelWidth,y:headerHeight+112,s:.72,rx:30,ry:-154,rz:10};
  const mobilePoses=[
    {x:w*.5,y:headerHeight+112,s:.9,rx:18,ry:-24,rz:-16},
    away,away,away,
    {x:w*.5,y:(finalTop+finalBottom)/2,s:.72,rx:0,ry:-360,rz:0}
  ];
  chapters=sections.map((section,i)=>({
    enter:i===0?0:mobile&&i===1?24:Math.max(0,Math.min((mobile&&i===4?finalTop:section.offsetTop)-h*(mobile&&i===4?.7:.45),bottom-32)),
    pose:(mobile?mobilePoses:desktopPoses)[i]
  }));
  if(mobile&&current&&(lastStage==='hero'||lastStage==='contact')){current.y=mobilePoses[lastStage==='hero'?0:4].y;velocity.y=0}
  if(!mobile){scene.style.top='';scene.style.height=''}
  scene.style.clipPath='';
  if(snap){current=null;activeChapter=-1;lastStage=null}
  model?.resize();requestFrame();
}
function scheduleLayout(){if(!resizeFrame)resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;layout()})}

function selectChapter() {
  if (activeChapter === -1) {
    activeChapter = 0;
    while (activeChapter < chapters.length - 1 && scrollY >= chapters[activeChapter + 1].enter) activeChapter++;
  } else {
    // A small dead band prevents repeated transitions around a section boundary.
    while (activeChapter < chapters.length - 1 && scrollY >= chapters[activeChapter + 1].enter + (mobile&&activeChapter===0?0:20)) activeChapter++;
    while (activeChapter > 0 && scrollY < chapters[activeChapter].enter - Math.min(48,chapters[activeChapter].enter/2)) activeChapter--;
  }
  return chapters[activeChapter].pose;
}

function requestFrame() {
  if (!frame&&!document.hidden) frame = requestAnimationFrame(render);
}

// An analytic critically damped spring preserves velocity when a user reverses
// direction. It eases into each pose, then stops requesting animation frames.
function advance(target, dt) {
  let moving = false;
  const omega = 7.6;
  const decay = Math.exp(-omega * dt);
  for (const key of keys) {
    const tolerance = key === 's' ? .00004 : .015;
    const delta = current[key] - target[key];
    const impulse = (velocity[key] + omega * delta) * dt;
    current[key] = target[key] + (delta + impulse) * decay;
    velocity[key] = (velocity[key] - omega * impulse) * decay;
    if (Math.abs(current[key] - target[key]) < tolerance && Math.abs(velocity[key]) < tolerance * omega) {
      current[key] = target[key];
      velocity[key] = 0;
    } else moving = true;
  }
  return moving;
}

function render(time) {
  frame = 0;
  const elapsed=(time-(lastTime||time-16))/1000;
  const dt=Math.max(.001,Math.min(.25,elapsed));
  if(model&&position.style.visibility!=='hidden'&&elapsed>.05&&elapsed<1){if(++slowFrames===12){model.reduceQuality();slowFrames=0}}else slowFrames=0;
  lastTime = time;
  const target = {...selectChapter()};
  const stage=mobile?(activeChapter===0?'hero':activeChapter===4?'contact':'away'):'desktop';
  if(mobile&&current&&lastStage&&stage!==lastStage){
    if(stage==='away'){
      dropAnimation?.cancel();dropAnimation=null;dropStart=null;arrival.dataset.state='ready';
    }else{
      current={...target,x:stage==='hero'?target.x:viewportWidth+modelWidth};
      velocity=Object.fromEntries(keys.map(key=>[key,0]));lastDrawnPose=null;
      if(stage==='hero'&&model)startDrop();
    }
  }
  if(mobile&&stage==='away'&&current)target.y=current.y;
  lastStage=stage;
  if(mobile&&stage!=='away')mobileSlot=stage;
  const sceneTop=mobile&&mobileSlot==='contact'?finalTop:0;
  if(mobile){
    const top=sceneTop+'px',height=(mobileSlot==='contact'?finalBottom-finalTop:heroBoundary)+'px';
    if(scene.style.top!==top)scene.style.top=top;
    if(scene.style.height!==height)scene.style.height=height;
  }
  // Jumping several chapters uses the shortest turn, including on the way back.
  if (current && !motion.matches) {
    for (const key of ['rx', 'ry', 'rz']) {
      const turn = ((target[key] - current[key] + 180) % 360 + 360) % 360 - 180;
      target[key] = current[key] + turn;
    }
  }
  if (!current || motion.matches) {
    current = {...target};
    velocity = Object.fromEntries(keys.map(key => [key, 0]));
  }
  const moving = !motion.matches && advance(target, dt);
  position.style.transform = 'translate3d(' + current.x.toFixed(3) + 'px,' + (current.y-sceneTop).toFixed(3) + 'px,0) translate(-50%,-50%) scale(' + current.s.toFixed(5) + ')';
  const pose = motion.matches ? {rx:12, ry:-15, rz:-8} : {rx:current.rx, ry:current.ry, rz:current.rz};
  let lift = 0;
  if (dropStart !== null) {
    dropElapsed = Math.max(0,(time-dropStart)/1000);
    let impact = -1;
    if (dropElapsed < .60) {
      const q = dropElapsed / .60;
      const height = chapters[0].pose.y + modelWidth * .75 + 40;
      lift = -height * (1 - q*q);
      pose.rx += 360 * q + 28 * (1 - q);
      pose.ry += 36 * (1 - q);
      pose.rz -= 18 * (1 - q);
    } else {
      // Three shorter ballistic rebounds, each returning to the same table plane.
      const rebounds = [
        {duration:.36, height:56, rock:12},
        {duration:.25, height:25, rock:7},
        {duration:.17, height:9, rock:3}
      ];
      let remaining = dropElapsed - .60;
      let bouncing = false;
      impact = 0;
      for (let i = 0; i < rebounds.length; i++) {
        const bounce = rebounds[i];
        if (remaining < bounce.duration) {
          const q = remaining / bounce.duration;
          lift = -4 * bounce.height * q * (1-q);
          // Continue the first airborne turn with a full flip on the first rebound.
          pose.rx += (i === 0 ? 360 + 360*q : 720) + bounce.rock * Math.sin(Math.PI*q);
          pose.rz += bounce.rock * .4 * Math.sin(Math.PI*2*q);
          impact = i;
          bouncing = true;
          break;
        }
        remaining -= bounce.duration;
        impact = i+1;
      }
      if (!bouncing) {
        const settle = Math.min(1, remaining / .15);
        pose.rx += 720 + 2 * Math.sin(Math.PI*2*settle) * (1-settle);
        if (settle === 1) {
          dropStart = null;
          arrival.dataset.state = 'ready';
        }
      }
    }
    if (impact > impactIndex) {
      impactIndex = impact;
      ring.getAnimations().forEach(animation => animation.cancel());
      const strength = [.55, .36, .22, .12][impact];
      ring.animate([
        {opacity:strength, transform:'scale(.84)'},
        {opacity:0, transform:'scale(1.12)'}
      ],{duration:320-impact*40,easing:'ease-out'});
    }
  }
  if(!dropAnimation)arrival.style.transform='translate3d(0,'+lift.toFixed(3)+'px,0)';
  // Translation is handled by the compositor. An unchanged pose needs no WebGL redraw.
  const radius=modelWidth*current.s/2;
  const viewportY=current.y-(mobile?scrollY:0);
  const visible=current.x+radius>0&&current.x-radius<viewportWidth&&viewportY+radius>0&&viewportY-radius<viewportHeight;
  position.dataset.chapter=sectionIds[activeChapter];
  position.style.visibility=visible?'visible':'hidden';
  if(!visible)lastDrawnPose=null;
  if (model && visible && (!lastDrawnPose || ['rx','ry','rz'].some(key => Math.abs(pose[key] - lastDrawnPose[key]) > .001))) {
    model.draw(pose);
    lastDrawnPose = {...pose};
  }
  caption.style.opacity = model && dropStart === null && activeChapter === 0 ? String(Math.max(0,1-scrollY/300)) : '0';
  if (moving || dropStart !== null) requestFrame();else lastTime=0;
}

document.addEventListener('site:layout',scheduleLayout);
window.addEventListener('scroll', requestFrame, {passive:true});
window.addEventListener('resize',scheduleLayout,{passive:true});
window.addEventListener('pageshow',event=>{layout(event.persisted);if(event.persisted&&model&&scrollY<24)startDrop()});
window.addEventListener('pagehide',event=>{if(frame)cancelAnimationFrame(frame);frame=0;if(!event.persisted)model?.dispose()});
document.addEventListener('visibilitychange',()=>{lastTime=0;if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0}else requestFrame()});
motion.addEventListener('change', () => {
  if (motion.matches) {
    dropStart = null;
    dropAnimation?.cancel();dropAnimation=null;arrival.style.transform='';
    ring.getAnimations().forEach(animation => animation.cancel());
    if (model) arrival.dataset.state = 'ready';
  }
  requestFrame();
});
layout();
document.fonts.ready.then(() => layout());

function showFallback() {
  model = null;
  dropStart = null;
  dropAnimation?.cancel();dropAnimation=null;
  arrival.classList.remove('model-loaded');
  arrival.classList.add('fallback-visible');
  arrival.dataset.state = 'fallback';
  requestFrame();
}

function startDrop(){
  dropAnimation?.cancel();dropAnimation=null;
  if(!motion.matches&&scrollY<24){
    dropStart=performance.now();dropElapsed=0;impactIndex=-1;lastTime=dropStart;arrival.dataset.state='falling';
    const height=chapters[0].pose.y+modelWidth*.75+40;
    const duration=1530,keyframes=[];
    for(let ms=0;ms<=duration;ms+=15){
      const t=ms/1000;let lift=0;
      if(t<.6)lift=-height*(1-(t/.6)**2);
      else{let remaining=t-.6;for(const bounce of[{duration:.36,height:56},{duration:.25,height:25},{duration:.17,height:9}]){if(remaining<bounce.duration){const q=remaining/bounce.duration;lift=-4*bounce.height*q*(1-q);break}remaining-=bounce.duration}}
      keyframes.push({offset:ms/duration,transform:`translate3d(0,${lift}px,0)`});
    }
    // Compositor translation stays smooth independently of GPU rotation updates.
    const animation=arrival.animate(keyframes,{duration,easing:'linear',fill:'both'});dropAnimation=animation;
    animation.ready.then(()=>{if(dropAnimation===animation){dropStart=animation.startTime??performance.now();lastTime=dropStart;requestFrame()}}).catch(()=>{});
    animation.finished.then(()=>{if(dropAnimation===animation){arrival.style.transform='translate3d(0,0,0)';animation.cancel();dropAnimation=null}}).catch(()=>{});
  }else {dropStart=null;arrival.dataset.state='ready';arrival.style.transform='translate3d(0,0,0)'}
  requestFrame();
}
// Let text paint before creating a GPU context; fetch only the selected original-model LOD.
requestAnimationFrame(()=>requestAnimationFrame(()=>{
 import('./model.js').then(async({createChip})=>{
  model=await createChip(arrival,showFallback);lastDrawnPose=null;
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  if(!model)return;
  layout();startDrop();
  if(frame)cancelAnimationFrame(frame);
  render(performance.now());arrival.classList.add('model-loaded');
 }).catch(error=>{console.warn('3D unavailable; showing the club logo.',error);showFallback()});
}));

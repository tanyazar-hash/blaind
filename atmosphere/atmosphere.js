const $=selector=>document.querySelector(selector);
const motion=matchMedia('(prefers-reduced-motion: reduce)');
const finePointer=matchMedia('(min-width: 601px) and (pointer: fine)');
const menu=$('.atm-header .menu'),navigation=$('#atm-mobile-nav');
function closeMenu(){navigation.classList.remove('open');menu.setAttribute('aria-expanded','false')}
menu.addEventListener('click',()=>menu.setAttribute('aria-expanded',String(navigation.classList.toggle('open'))));
navigation.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
document.addEventListener('click',event=>{if(!$('.atm-header').contains(event.target))closeMenu()});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu()});
window.addEventListener('resize',()=>{if(innerWidth>600)closeMenu()},{passive:true});

// Content is fully visible without JavaScript. Enhancement never owns the image URLs.
if('IntersectionObserver' in window){
 document.body.classList.add('atm-enhanced');
 const reveals=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('is-visible');reveals.unobserve(entry.target)}
 },{threshold:.06});
 document.querySelectorAll('.atm-reveal').forEach(node=>reveals.observe(node));
}
const photos=[...document.querySelectorAll('.atm-frame')];
const nearViewport=new Set();let scrollFrame=0;
function paintParallax(){
 scrollFrame=0;
 for(const node of nearViewport){
  const rect=node.getBoundingClientRect();
  const progress=Math.max(-1,Math.min(1,(rect.top+rect.height/2-innerHeight/2)/(innerHeight/2+rect.height/2)));
  node.style.setProperty('--atm-parallax',!motion.matches&&finePointer.matches?(progress*8).toFixed(2)+'px':'0px');
 }
}
function scheduleParallax(){if(!scrollFrame&&!document.hidden)scrollFrame=requestAnimationFrame(paintParallax)}
if('IntersectionObserver'in window){
 const visibility=new IntersectionObserver(entries=>{
  for(const entry of entries){if(entry.isIntersecting)nearViewport.add(entry.target);else{nearViewport.delete(entry.target);entry.target.style.removeProperty('--atm-parallax')}}
  scheduleParallax();
 },{rootMargin:'100px'});
 photos.forEach(node=>visibility.observe(node));
 window.addEventListener('scroll',scheduleParallax,{passive:true});
 window.addEventListener('resize',scheduleParallax,{passive:true});
 motion.addEventListener('change',scheduleParallax);finePointer.addEventListener('change',scheduleParallax);
 document.addEventListener('visibilitychange',scheduleParallax);
}

const viewer=$('#atm-viewer'),image=$('#atm-viewer-image'),error=$('#atm-viewer-error');
const closeButton=$('.atm-viewer-close'),imageWrap=$('.atm-viewer-image-wrap');
let index=0,opener=null,loadId=0,closing=false,touchStart=null;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function showPhoto(next){
 if(closing)return;
 index=(next+photos.length)%photos.length;
 const photo=photos[index],id=++loadId;
 $('#atm-viewer-caption').textContent=photo.closest('figure').querySelector('figcaption>span').textContent;
 $('#atm-viewer-count').textContent=String(index+1).padStart(2,'0')+' / '+String(photos.length).padStart(2,'0');
 $('#atm-viewer-original').href=photo.href;
 image.alt=photo.querySelector('img').alt;image.classList.remove('is-loaded');error.hidden=true;
 imageWrap.setAttribute('aria-busy','true');
 try{
  const nextImage=new Image();nextImage.src=photo.dataset.full;
  await Promise.all([nextImage.decode(),wait(motion.matches?0:120)]);
  if(id!==loadId||!viewer.open||closing)return;
  image.src=nextImage.src;image.hidden=false;
  requestAnimationFrame(()=>{if(id===loadId&&viewer.open)image.classList.add('is-loaded')});
  // Decode only the next frame on demand; never preload the entire gallery.
  if(!navigator.connection?.saveData&&!/2g/.test(navigator.connection?.effectiveType||'')){
   const adjacent=new Image();adjacent.src=photos[(index+1)%photos.length].dataset.full;
  }
 }catch{
  if(id===loadId&&viewer.open&&!closing){image.hidden=true;error.hidden=false}
 }finally{if(id===loadId)imageWrap.setAttribute('aria-busy','false')}
}
function openPhoto(next,trigger){
 if(viewer.open||typeof viewer.showModal!=='function')return false;
 opener=trigger;closing=false;image.hidden=true;image.removeAttribute('src');
 viewer.showModal();document.body.classList.add('atm-viewer-open');
 requestAnimationFrame(()=>viewer.classList.add('is-open'));
 closeButton.focus({preventScroll:true});void showPhoto(next);return true;
}
async function closeViewer(){
 if(!viewer.open||closing)return;
 closing=true;loadId++;viewer.classList.remove('is-open');
 await wait(motion.matches?0:220);viewer.close();
}
photos.forEach((photo,i)=>photo.addEventListener('click',event=>{
 if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 if(openPhoto(i,photo))event.preventDefault();
}));
closeButton.addEventListener('click',closeViewer);
$('.atm-viewer-prev').addEventListener('click',()=>void showPhoto(index-1));
$('.atm-viewer-next').addEventListener('click',()=>void showPhoto(index+1));
viewer.addEventListener('cancel',event=>{event.preventDefault();void closeViewer()});
viewer.addEventListener('click',event=>{
 if([viewer,imageWrap,$('.atm-viewer-stage')].includes(event.target))void closeViewer();
});
viewer.addEventListener('keydown',event=>{
 if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();void showPhoto(index+(event.key==='ArrowRight'?1:-1))}
 if(event.key!=='Tab')return;
 const controls=[...viewer.querySelectorAll('button,a[href]')].filter(node=>node.getClientRects().length);
 const first=controls[0],last=controls.at(-1);
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
});
imageWrap.addEventListener('pointerdown',event=>{
 if(event.pointerType==='touch')touchStart={x:event.clientX,y:event.clientY};
});
imageWrap.addEventListener('pointerup',event=>{
 if(!touchStart)return;
 const dx=event.clientX-touchStart.x,dy=event.clientY-touchStart.y;touchStart=null;
 if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.4)void showPhoto(index+(dx<0?1:-1));
});
imageWrap.addEventListener('pointercancel',()=>touchStart=null);
viewer.addEventListener('close',()=>{
 loadId++;closing=false;viewer.classList.remove('is-open');document.body.classList.remove('atm-viewer-open');
 image.classList.remove('is-loaded');image.removeAttribute('src');imageWrap.setAttribute('aria-busy','false');
 if(opener?.isConnected)opener.focus({preventScroll:true});opener=null;
});

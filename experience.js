const arrival=document.querySelector('.object-arrival');
const motion=matchMedia('(prefers-reduced-motion: reduce)');
let model=null,destroyed=false,failed=false;
function fallback(){failed=true;model?.dispose();model=null;arrival.classList.remove('model-loaded');arrival.classList.add('fallback-visible');arrival.dataset.state='fallback'}
const resize=new ResizeObserver(()=>model?.resize());resize.observe(arrival);
// One still pose inside the hero: no scroll choreography, pointer tracking or render loop.
requestAnimationFrame(()=>requestAnimationFrame(async()=>{
 try{
  const {createChip}=await import('./model.js');if(destroyed)return;
  const chip=await createChip(arrival,fallback);
  if(destroyed||failed){chip.dispose();return}
  model=chip;model.draw({rx:12,ry:-18,rz:-12});arrival.classList.add('model-loaded');arrival.dataset.state='ready';
  if(!motion.matches)arrival.animate([{opacity:0},{opacity:1}],{duration:220,easing:'ease-out'});
 }catch(error){if(!destroyed){console.warn('3D unavailable; showing the club logo.',error);fallback()}}
}));
motion.addEventListener('change',()=>{if(motion.matches)arrival.getAnimations().forEach(animation=>animation.cancel())});
window.addEventListener('pagehide',event=>{if(!event.persisted){destroyed=true;resize.disconnect();model?.dispose()}});
window.addEventListener('pageshow',()=>model?.resize());

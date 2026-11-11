export const clubText=value=>String(value??'').replace(/BLΛIND/g,'БЛАИНД');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const header=document.querySelector('.site-header'),menu=header?.querySelector('.menu'),mobileNav=header?.querySelector('.mobile-nav');
export function closeSiteMenu(){mobileNav?.classList.remove('open');menu?.setAttribute('aria-expanded','false')}
menu?.addEventListener('click',()=>menu.setAttribute('aria-expanded',String(mobileNav.classList.toggle('open'))));
mobileNav?.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeSiteMenu));
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeSiteMenu()});
document.addEventListener('click',event=>{if(header&&!header.contains(event.target))closeSiteMenu()});
window.addEventListener('resize',()=>{if(innerWidth>600)closeSiteMenu()},{passive:true});
window.addEventListener('pageshow',closeSiteMenu);

const entrances=new WeakMap();
function showContent(node){
 observer?.unobserve(node);
 entrances.get(node)?.cancel();
 node.classList.add('site-visible');
 if(reduced.matches)return;
 const hero=node.classList.contains('site-hero-reveal');
 const animation=node.animate([
  {opacity:0,transform:`translate3d(0,${hero?26:18}px,0)`,filter:hero?'blur(6px)':'none'},
  {opacity:1,transform:'none',filter:'none'}
 ],{duration:hero?1100:760,delay:hero?Number(node.style.getPropertyValue('--hero-step'))*140:0,easing:'cubic-bezier(.22,.61,.36,1)',fill:'backwards'});
 entrances.set(node,animation);
 animation.finished.catch(()=>{}).finally(()=>{if(entrances.get(node)===animation)entrances.delete(node)});
}
const observer='IntersectionObserver'in window?new IntersectionObserver(entries=>{
 for(const entry of entries)if(entry.isIntersecting)showContent(entry.target);
},{threshold:.06}):null;
export function revealContent(root=document){
 const candidates=[...root.querySelectorAll('.reveal,.arena-reveal,.atm-reveal,h1,h2,.eyebrow,.section-num,.lead,.section-desc,.arena-lead,.atm-body-copy,.atm-hero-description,.atm-memory-copy,.hero-index,.hero-scroll,.scroll-cue,.atm-location,.contact-note,.atm-scroll,.section-meta,.ranking-explainer,.arena-stats,.actions,.arena-actions')];
 for(const node of candidates){
  if(node.closest('dialog')||node.classList.contains('site-reveal')||node.parentElement?.closest('.site-reveal'))continue;
  node.classList.add('site-reveal');
  if(node.closest('.hero,.arena-hero,.atm-hero')){
   node.classList.add('site-hero-reveal');
   const step=node.matches('.eyebrow')?0:node.matches('h1')?1:node.matches('.lead,.arena-lead,.atm-hero-description')?2:3;
   node.style.setProperty('--hero-step',String(step));
  }
  if(reduced.matches||!observer)showContent(node);else observer.observe(node);
 }
}
function replayContent(){
 for(const node of document.querySelectorAll('.site-reveal')){
  entrances.get(node)?.cancel();
  node.classList.remove('site-visible');
  if(reduced.matches||!observer)showContent(node);else{
   observer.unobserve(node);
   observer.observe(node);
  }
 }
}
document.body.classList.add('site-motion');revealContent();
// History restores the existing document, including its completed entrance state.
window.addEventListener('pageshow',event=>{if(event.persisted)replayContent()});
reduced.addEventListener('change',()=>{if(reduced.matches)document.querySelectorAll('.site-reveal').forEach(showContent);else replayContent()});

// Native details remain usable without JavaScript; animation also handles quick reversals.
for(const details of document.querySelectorAll('details.event')){
 const summary=details.querySelector('summary');let expanded=details.open,animation;
 summary.setAttribute('aria-expanded',String(expanded));
 summary.addEventListener('click',event=>{
  event.preventDefault();expanded=!expanded;
  const from=details.getBoundingClientRect().height;animation?.cancel();details.open=true;
  summary.setAttribute('aria-expanded',String(expanded));
  const border=details.offsetHeight-details.clientHeight;
  const target=(expanded?details.scrollHeight:summary.getBoundingClientRect().height)+border;
  if(reduced.matches){details.open=expanded;document.dispatchEvent(new Event('site:layout'));return}
  details.style.overflow='hidden';
  animation=details.animate([{height:from+'px'},{height:target+'px'}],{duration:360,easing:'cubic-bezier(.22,.61,.36,1)'});
  animation.finished.then(()=>{details.open=expanded;details.style.overflow='';animation=null;document.dispatchEvent(new Event('site:layout'))}).catch(()=>{});
 });
}

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

const observer='IntersectionObserver'in window?new IntersectionObserver(entries=>{
 for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('site-visible');observer.unobserve(entry.target)}
},{threshold:.06}):null;
export function revealContent(root=document){
 const candidates=[...root.querySelectorAll('.reveal,.arena-reveal,.atm-reveal,h1,h2,.eyebrow,.section-num,.lead,.section-desc,.arena-lead,.atm-body-copy,.atm-hero-description,.atm-memory-copy,.hero-index,.hero-scroll,.scroll-cue,.atm-location,.contact-note,.atm-scroll,.demo-note,.section-meta,.ranking-explainer')];
 for(const node of candidates){
  if(node.closest('dialog')||node.classList.contains('site-reveal')||node.parentElement?.closest('.site-reveal'))continue;
  node.classList.add('site-reveal');
  if(reduced.matches||!observer)node.classList.add('site-visible');else observer.observe(node);
 }
}
document.body.classList.add('site-motion');revealContent();
reduced.addEventListener('change',()=>{if(reduced.matches)document.querySelectorAll('.site-reveal').forEach(n=>{n.classList.add('site-visible');observer?.unobserve(n)})});

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

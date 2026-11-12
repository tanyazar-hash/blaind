export const clubText=value=>String(value??'').replace(/BLΛIND/g,'БЛАИНД');
const header=document.querySelector('.site-header'),menu=header?.querySelector('.menu'),mobileNav=header?.querySelector('.mobile-nav');
export function closeSiteMenu(){mobileNav?.classList.remove('open');menu?.setAttribute('aria-expanded','false')}
menu?.addEventListener('click',()=>menu.setAttribute('aria-expanded',String(mobileNav.classList.toggle('open'))));
mobileNav?.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeSiteMenu));
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape'||menu?.getAttribute('aria-expanded')!=='true')return;
 const returnFocus=mobileNav?.contains(document.activeElement);closeSiteMenu();if(returnFocus)menu.focus({preventScroll:true});
});
document.addEventListener('click',event=>{if(header&&!header.contains(event.target))closeSiteMenu()});
header?.addEventListener('focusout',event=>{if(event.relatedTarget&&!header.contains(event.relatedTarget))closeSiteMenu()});
window.addEventListener('resize',()=>{if(innerWidth>1100)closeSiteMenu()},{passive:true});
window.addEventListener('pageshow',closeSiteMenu);
// Content is immediately readable. No scroll reveals or replayed text entrances.
export function revealContent(root=document){for(const node of root.querySelectorAll('.reveal,.arena-reveal,.atm-reveal,.atm-photo'))node.classList.add('site-visible')}
revealContent();

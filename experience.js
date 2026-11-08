const menu = document.querySelector('.menu');
const mobileNav = document.querySelector('.mobile-nav');
menu.addEventListener('click', () => {
  const open = mobileNav.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(open));
});
function closeMenu() {
  mobileNav.classList.remove('open');
  menu.setAttribute('aria-expanded', 'false');
}
mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
const observer = new IntersectionObserver(entries => entries.forEach(entry => {
  if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
}), { threshold: .1 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
document.querySelector('#contact-button').addEventListener('click', e => {
  e.preventDefault();
  alert('Контакт клуба пока не указан. После получения официального адреса или Telegram заменим эту заглушку.');
});

const position = document.querySelector('.object-position');
const arrival = document.querySelector('.object-arrival');
const coin = document.querySelector('.coin');
const edge = document.querySelector('.coin-edge');
const ring = document.querySelector('.landing-ring');
const caption = document.querySelector('.object-caption');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(pointer: fine)');
let stops = [], pointerX = 0, pointerY = 0, tiltX = 0, tiltY = 0;
let frame = 0, lastTime = 0, entrance = null;
const mix = (a, b, t) => a + (b - a) * t;
function layout() {
  const mobile = innerWidth <= 600, w = innerWidth, h = innerHeight;
  const size = position.offsetWidth;
  edge.replaceChildren();
  for (let i = 0; i < 96; i++) {
    const segment = document.createElement('i');
    segment.className = 'edge-segment';
    segment.style.width = (size * Math.PI / 96 + 1) + 'px';
    segment.style.transform = 'translate(-50%,-50%) rotateZ(' + (i * 360 / 96) + 'deg) translateY(' + (-size / 2 + 1) + 'px) rotateX(90deg)';
    edge.append(segment);
  }
  const about = document.querySelector('#about');
  const experience = document.querySelector('#experience');
  const events = document.querySelector('#events');
  const contact = document.querySelector('#contact');
  const space = document.querySelector('.final-object-space');
  const finalY = space.getBoundingClientRect().top + scrollY - contact.offsetTop + space.offsetHeight / 2;
  stops = [
    {scroll:0,x:w*(mobile?.60:.73),y:mobile?230:h*.49,s:1,rx:20,ry:-28,rz:-21},
    {scroll:about.offsetTop,x:w*(mobile?.5:.73),y:mobile?660:h*.5,s:mobile?.9:.82,rx:38,ry:155,rz:16},
    {scroll:experience.offsetTop,x:w*(mobile?.5:.26),y:mobile?480:h*.43,s:mobile?.75:.85,rx:64,ry:260,rz:-14},
    {scroll:events.offsetTop,x:w*(mobile?.58:.78),y:mobile?175:h*.5,s:.66,rx:30,ry:435,rz:20},
    {scroll:contact.offsetTop,x:w*.5,y:finalY,s:mobile?.78:.60,rx:0,ry:720,rz:0}
  ];
  closeMenu();
  requestFrame();
}
function requestFrame() { if (!frame) frame = requestAnimationFrame(render); }
function render(time) {
  frame = 0;
  const dt = Math.min(64, time - (lastTime || time - 16)); lastTime = time;
  const smoothing = 1 - Math.exp(-dt / 150);
  tiltX += (pointerX - tiltX) * smoothing;
  tiltY += (pointerY - tiltY) * smoothing;
  let index = 0;
  while (index < stops.length - 2 && scrollY > stops[index + 1].scroll) index++;
  const a = stops[index], b = stops[index + 1];
  const raw = Math.max(0, Math.min(1, (scrollY - a.scroll) / (b.scroll - a.scroll)));
  const t = raw * raw * (3 - 2 * raw);
  const tail = Math.max(0, scrollY - stops.at(-1).scroll);
  const x = mix(a.x,b.x,t), y = mix(a.y,b.y,t) - tail;
  position.style.left = x + 'px'; position.style.top = y + 'px';
  position.style.transform = 'translate(-50%,-50%) scale(' + mix(a.s,b.s,t) + ')';
  const pointer = !motion.matches && finePointer.matches && innerWidth > 600 ? 1 : 0;
  if (motion.matches) {
    coin.style.transform = 'rotateX(12deg) rotateY(-15deg) rotateZ(-8deg)';
  } else coin.style.transform = 'rotateX(' + (mix(a.rx,b.rx,t) + tiltY*pointer) + 'deg) rotateY(' + (mix(a.ry,b.ry,t) + tiltX*pointer) + 'deg) rotateZ(' + mix(a.rz,b.rz,t) + 'deg)';
  caption.style.opacity = String(Math.max(0,1-scrollY/300));
  ring.style.opacity = String(Math.max(0,.6-scrollY/450));
  if (Math.abs(pointerX-tiltX) + Math.abs(pointerY-tiltY) > .01) requestFrame();
}
window.addEventListener('pointermove', e => {
  if (!finePointer.matches || motion.matches || innerWidth <= 600) return;
  pointerX = (e.clientX/innerWidth-.5)*9;
  pointerY = -(e.clientY/innerHeight-.5)*9;
  requestFrame();
}, {passive:true});
window.addEventListener('scroll',requestFrame,{passive:true});
window.addEventListener('resize',layout);
motion.addEventListener('change', () => { if (motion.matches) entrance?.cancel(); requestFrame(); });
layout();
document.fonts.ready.then(layout);
if (!motion.matches && scrollY < 20) {
  entrance = arrival.animate([
    { transform:'translateY(-110vh) rotate(-28deg)',offset:0 },
    { transform:'translateY(22px) rotate(4deg)',offset:.60 },
    { transform:'translateY(-26px) rotate(-2deg)',offset:.77 },
    { transform:'translateY(0) rotate(0)',offset:1 }
  ],{ duration:1900,easing:'cubic-bezier(.22,.65,.28,1)' });
  ring.animate([{opacity:0,scale:'.6'},{opacity:.7,scale:'1.04'},{opacity:.3,scale:'1.15'}],{delay:1000,duration:1200});
}

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
const ring = document.querySelector('.landing-ring');
const caption = document.querySelector('.object-caption');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(pointer: fine)');
const mix = (a, b, t) => a + (b - a) * t;
let stops = [], model = null, tossStart = null, touchdown = false;
let frame = 0, lastTime = 0, pointerX = 0, pointerY = 0, tiltX = 0, tiltY = 0;

function layout() {
  const mobile = innerWidth <= 600, w = innerWidth, h = innerHeight;
  const about = document.querySelector('#about');
  const experience = document.querySelector('#experience');
  const events = document.querySelector('#events');
  const contact = document.querySelector('#contact');
  const space = document.querySelector('.final-object-space');
  // The compact contact section can be shorter than the viewport.
  // Its final pose must be reachable at the actual bottom of the page.
  const finalScroll = Math.min(contact.offsetTop, document.documentElement.scrollHeight - h);
  const finalY = space.getBoundingClientRect().top + scrollY + space.offsetHeight / 2 - finalScroll;
  stops = [
    {scroll:0, x:w*(mobile ? .60 : .73), y:mobile ? 230 : h*.49, s:1, rx:20, ry:-28, rz:-21},
    {scroll:about.offsetTop, x:w*(mobile ? .5 : .73), y:mobile ? 660 : h*.5, s:mobile ? .9 : .82, rx:38, ry:155, rz:16},
    {scroll:experience.offsetTop, x:w*(mobile ? .5 : .26), y:mobile ? 480 : h*.43, s:mobile ? .75 : .85, rx:64, ry:260, rz:-14},
    {scroll:events.offsetTop, x:w*(mobile ? .58 : .78), y:mobile ? 175 : h*.5, s:.66, rx:30, ry:435, rz:20},
    {scroll:finalScroll, x:w*.5, y:finalY, s:mobile ? .70 : .50, rx:0, ry:720, rz:0}
  ];
  model?.resize();
  requestFrame();
}

function requestFrame() {
  if (!frame) frame = requestAnimationFrame(render);
}

function render(time) {
  frame = 0;
  const dt = Math.min(64, time - (lastTime || time - 16));
  lastTime = time;
  const damping = 1 - Math.exp(-dt / 150);
  tiltX += (pointerX - tiltX) * damping;
  tiltY += (pointerY - tiltY) * damping;
  let index = 0;
  while (index < stops.length - 2 && scrollY > stops[index + 1].scroll) index++;
  const a = stops[index], b = stops[index + 1];
  const raw = Math.max(0, Math.min(1, (scrollY - a.scroll) / (b.scroll - a.scroll)));
  // Hold each pose for most of its chapter. Travel only near the next chapter.
  const travel = Math.max(0, Math.min(1, (raw - .60) / .34));
  const t = travel * travel * (3 - 2 * travel);
  const tail = Math.max(0, scrollY - stops.at(-1).scroll);
  position.style.left = mix(a.x, b.x, t) + 'px';
  position.style.top = (mix(a.y, b.y, t) - tail) + 'px';
  position.style.transform = 'translate(-50%,-50%) scale(' + mix(a.s, b.s, t) + ')';
  const pointer = !motion.matches && finePointer.matches && innerWidth > 600 && tossStart === null ? 1 : 0;
  const pose = motion.matches
    ? {rx:12, ry:-15, rz:-8}
    : {rx:mix(a.rx,b.rx,t) + tiltY*pointer, ry:mix(a.ry,b.ry,t) + tiltX*pointer, rz:mix(a.rz,b.rz,t)};
  let lift = 0;
  if (tossStart !== null) {
    const p = Math.min(1, (time - tossStart) / 2600);
    if (p < .84) {
      const q = p / .84;
      // A ballistic arc: enter from below, rise, flip three times, then fall.
      lift = Math.min(innerHeight, 800) * (1.856*q*q - 2.556*q + .7);
      pose.rx += 1080 * (1 - q);
      pose.ry += 12 * Math.sin(Math.PI*q);
      pose.rz += 18 * (1 - q);
    } else {
      const settle = (p - .84) / .16;
      lift = -22 * Math.sin(Math.PI*settle) * (1-settle);
      pose.rx += 10 * Math.sin(Math.PI*2*settle) * (1-settle);
      if (!touchdown) {
        touchdown = true;
        ring.animate([{opacity:0,scale:'.65'},{opacity:.65,scale:'1.04'},{opacity:0,scale:'1.2'}],{duration:850});
      }
    }
    if (p === 1) {
      tossStart = null;
      arrival.dataset.state = 'ready';
    } else requestFrame();
  }
  arrival.style.transform = 'translateY(' + lift + 'px)';
  model?.draw(pose);
  caption.style.opacity = model && tossStart === null ? String(Math.max(0,1-scrollY/300)) : '0';
  if (Math.abs(pointerX-tiltX) + Math.abs(pointerY-tiltY) > .01) requestFrame();
}

window.addEventListener('pointermove', e => {
  if (!finePointer.matches || motion.matches || innerWidth <= 600) return;
  pointerX = (e.clientX/innerWidth-.5)*9;
  pointerY = -(e.clientY/innerHeight-.5)*9;
  requestFrame();
}, {passive:true});

function finishToss() {
  if (tossStart !== null) {
    tossStart = null;
    arrival.dataset.state = 'ready';
    ring.getAnimations().forEach(animation => animation.cancel());
  }
}

window.addEventListener('scroll', () => {
  if (scrollY > 40) finishToss();
  requestFrame();
}, {passive:true});
window.addEventListener('resize', () => { layout(); closeMenu(); });
window.addEventListener('pageshow', layout);
motion.addEventListener('change', () => { if (motion.matches) finishToss(); requestFrame(); });
layout();
document.fonts.ready.then(layout);

function showFallback() {
  model = null;
  tossStart = null;
  arrival.classList.remove('model-loaded');
  arrival.classList.add('fallback-visible');
  arrival.dataset.state = 'fallback';
  requestFrame();
}

// The first coin a visitor sees is the actual GLB, never an interim CSS drawing.
import('./model.js').then(async ({createChip}) => {
  model = await createChip(arrival, showFallback);
  if (!motion.matches && scrollY < 40) {
    tossStart = performance.now();
    arrival.dataset.state = 'tossing';
  } else arrival.dataset.state = 'ready';
  requestFrame();
}).catch(error => {
  console.warn('3D unavailable; showing the club logo.', error);
  showFallback();
});

document.querySelector('#contact-button').addEventListener('click', e => {
  e.preventDefault();
  alert('Контакт клуба пока не указан. После получения официального адреса или Telegram заменим эту заглушку.');
});

const position = document.querySelector('.object-position');
const arrival = document.querySelector('.object-arrival');
const ring = document.querySelector('.landing-ring');
const caption = document.querySelector('.object-caption');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const keys = ['x', 'y', 's', 'rx', 'ry', 'rz'];
let chapters = [], activeChapter = -1, current = null, velocity = {};
let model = null, lastDrawnPose = null, dropStart = null, dropElapsed = 0, impactIndex = -1;
let frame = 0, lastTime = 0;

// Chapters select fixed viewport poses. Scroll never scrubs the model's transform.
function layout(snap = false) {
  const mobile = innerWidth <= 600, w = innerWidth, h = innerHeight;
  const ids = ['top', 'about', 'experience', 'events', 'contact'];
  const sections = ids.map(id => document.getElementById(id));
  const space = document.querySelector('.final-object-space');
  const bottom = Math.max(0, document.documentElement.scrollHeight - h);
  const finalScroll = Math.min(sections[4].offsetTop, bottom);
  const finalY = space.getBoundingClientRect().top + scrollY + space.offsetHeight / 2 - finalScroll;
  const poses = [
    {x:w*(mobile ? .73 : .79), y:mobile ? 170 : h*.47, s:mobile ? .72 : .88, rx:18, ry:-24, rz:-16},
    {x:w*(mobile ? .78 : .77), y:mobile ? h*.84 : h*.42, s:mobile ? .55 : .75, rx:30, ry:-154, rz:10},
    {x:w*(mobile ? .78 : .24), y:mobile ? h*.78 : h*.37, s:mobile ? .52 : .76, rx:22, ry:-214, rz:-14},
    {x:w*(mobile ? .72 : .81), y:mobile ? 175 : h*.43, s:mobile ? .5 : .62, rx:-12, ry:-330, rz:10},
    {x:w*.5, y:finalY, s:mobile ? .60 : .47, rx:0, ry:-360, rz:0}
  ];
  chapters = sections.map((section, i) => ({
    enter:i === 0 ? 0 : Math.max(0, Math.min(section.offsetTop - h*.45, bottom - 32)),
    pose:poses[i]
  }));
  if (snap) { current = null; activeChapter = -1; }
  model?.resize();
  requestFrame();
}

function selectChapter() {
  if (activeChapter === -1) {
    activeChapter = 0;
    while (activeChapter < chapters.length - 1 && scrollY >= chapters[activeChapter + 1].enter) activeChapter++;
  } else {
    // A small dead band prevents repeated transitions around a section boundary.
    while (activeChapter < chapters.length - 1 && scrollY >= chapters[activeChapter + 1].enter + 20) activeChapter++;
    while (activeChapter > 0 && scrollY < chapters[activeChapter].enter - 48) activeChapter--;
  }
  return chapters[activeChapter].pose;
}

function requestFrame() {
  if (!frame) frame = requestAnimationFrame(render);
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
  const dt = Math.max(.001, Math.min(.064, (time - (lastTime || time - 16)) / 1000));
  lastTime = time;
  const target = {...selectChapter()};
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
  position.style.transform = 'translate3d(' + current.x.toFixed(3) + 'px,' + current.y.toFixed(3) + 'px,0) translate(-50%,-50%) scale(' + current.s.toFixed(5) + ')';
  const pose = motion.matches ? {rx:12, ry:-15, rz:-8} : {rx:current.rx, ry:current.ry, rz:current.rz};
  let lift = 0;
  if (dropStart !== null) {
    dropElapsed += dt;
    let impact = -1;
    if (dropElapsed < .60) {
      const q = dropElapsed / .60;
      const height = chapters[0].pose.y + position.offsetWidth * .75 + 40;
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
  arrival.style.transform = 'translate3d(0,' + lift.toFixed(3) + 'px,0)';
  // Translation is handled by the compositor. An unchanged pose needs no WebGL redraw.
  if (model && (!lastDrawnPose || ['rx','ry','rz'].some(key => Math.abs(pose[key] - lastDrawnPose[key]) > .001))) {
    model.draw(pose);
    lastDrawnPose = {...pose};
  }
  caption.style.opacity = model && dropStart === null && activeChapter === 0 ? String(Math.max(0,1-scrollY/300)) : '0';
  if (moving || dropStart !== null) requestFrame();
}

document.addEventListener('site:layout',()=>layout());
window.addEventListener('scroll', requestFrame, {passive:true});
window.addEventListener('resize', () => { layout(); });
window.addEventListener('pageshow', event => layout(event.persisted));
document.addEventListener('visibilitychange', () => { lastTime = 0; if (!document.hidden) requestFrame(); });
motion.addEventListener('change', () => {
  if (motion.matches) {
    dropStart = null;
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
  arrival.classList.remove('model-loaded');
  arrival.classList.add('fallback-visible');
  arrival.dataset.state = 'fallback';
  requestFrame();
}

// Only the original GLB appears during a successful load.
import('./model.js').then(async ({createChip}) => {
  model = await createChip(arrival, showFallback);
  lastDrawnPose = null;
  if (!motion.matches && scrollY < 40) {
    dropStart = performance.now();
    dropElapsed = 0;
    impactIndex = -1;
    lastTime = dropStart;
    arrival.dataset.state = 'falling';
  } else arrival.dataset.state = 'ready';
  // Position and shade the first frame before revealing the WebGL canvas.
  // Otherwise a cached load can flash the chip at rest before its fall starts.
  if (frame) cancelAnimationFrame(frame);
  render(performance.now());
  arrival.classList.add('model-loaded');
}).catch(error => {
  console.warn('3D unavailable; showing the club logo.', error);
  showFallback();
});

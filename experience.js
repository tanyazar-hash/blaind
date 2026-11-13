const arrival = document.querySelector('.object-arrival');
const stage = arrival.closest('.chip-stage');
const desktop = matchMedia('(min-width: 1101px) and (hover: hover) and (pointer: fine)');
const touch = matchMedia('(any-pointer: coarse)');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let model, pending = false, generation = 0, destroyed = false, failed = false;
let frame = 0, previous = 0, visible = true, elapsed = 0, arriving = false, drag;
let velocity = {x: 0, y: 0};
let pose = {rx: 12, ry: -18, rz: -12, y: 0};
const eligible = () => desktop.matches && !touch.matches && !destroyed;
const active = () => eligible() && visible && !document.hidden;
function stop() { cancelAnimationFrame(frame); frame = 0; previous = 0; }
function releaseDrag() {
  const pointer = drag?.id; drag = null;
  if (pointer !== undefined && stage.hasPointerCapture(pointer)) stage.releasePointerCapture(pointer);
  stage.classList.remove('is-dragging');
}
function draw() { model?.draw(pose); }
function schedule() {
  if (!frame && model && active() && (arriving || (drag ? drag.dirty : Math.hypot(velocity.x, velocity.y) > 1))) frame = requestAnimationFrame(tick);
}
// Ballistic fall followed by two progressively smaller rebounds, then rest.
function bounce(t) {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375;
  return n * (t -= 2.625 / d) * t + .984375;
}
function tick(now) {
  frame = 0;
  if (!active()) { previous = 0; return; }
  const dt = previous ? Math.min((now - previous) / 1000, .1) : 1 / 60;
  previous = now;
  if (arriving) {
    elapsed += dt;
    const t = Math.min(elapsed / 1.35, 1), rest = 1 - bounce(t);
    pose = {rx: 12 + 22 * rest, ry: -18 - 32 * (1 - t) ** 3, rz: -12 + 12 * rest, y: 6 * rest};
    if (t === 1) { arriving = false; arrival.dataset.state = 'ready'; }
  } else if (!drag) {
    pose.ry += velocity.x * dt; pose.rx = Math.max(-75, Math.min(75, pose.rx + velocity.y * dt));
    const damping = Math.exp(-5 * dt); velocity.x *= damping; velocity.y *= damping;
    if (Math.hypot(velocity.x, velocity.y) <= 1) velocity = {x: 0, y: 0};
  }
  if (drag) drag.dirty = false;
  if (dt > 1 / 25) model?.reduceQuality();
  draw();
  schedule();
}
function reset() {
  generation++; stop(); releaseDrag(); velocity = {x: 0, y: 0};
  model?.dispose(); model = null; pending = false; arriving = false;
  arrival.classList.remove('model-loaded', 'fallback-visible'); arrival.dataset.state = 'disabled';
}
function fallback() {
  failed = true; reset(); arrival.classList.add('fallback-visible'); arrival.dataset.state = 'fallback';
}
async function load() {
  if (!eligible() || model || pending || failed) return;
  pending = true; const request = ++generation;
  arrival.dataset.state = 'loading';
  try {
    const {createChip} = await import('./model.js');
    if (request !== generation || !eligible()) return;
    const chip = await createChip(arrival, fallback);
    if (request !== generation || !eligible() || failed) { chip.dispose(); return; }
    model = chip; elapsed = 0; arriving = !motion.matches;
    pose = {rx: 12, ry: -18, rz: -12, y: arriving ? 6 : 0};
    draw(); arrival.classList.add('model-loaded'); arrival.dataset.state = arriving ? 'arriving' : 'ready'; schedule();
  } catch (error) {
    if (request === generation && eligible()) { console.warn('3D unavailable; showing the club logo.', error); fallback(); }
  } finally { if (request === generation) pending = false; }
}
stage.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !model || arriving || !active() || failed) return;
  stop(); velocity = {x: 0, y: 0};
  drag = {id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now()};
  stage.setPointerCapture(event.pointerId); stage.classList.add('is-dragging');
  stage.focus({preventScroll: true}); event.preventDefault();
});
stage.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.id) return;
  const now = performance.now(), dt = Math.max((now - drag.time) / 1000, .016);
  const x = -(event.clientX - drag.x) * .35, y = -(event.clientY - drag.y) * .35;
  pose.ry += x; pose.rx = Math.max(-75, Math.min(75, pose.rx + y));
  velocity = {x: Math.max(-240, Math.min(240, x / dt)), y: Math.max(-180, Math.min(180, y / dt))};
  drag = {id: drag.id, x: event.clientX, y: event.clientY, time: now, dirty: true}; schedule();
});
function endDrag(event) {
  if (!drag || event.pointerId !== drag.id) return;
  if (event.type === 'pointercancel' || motion.matches) velocity = {x: 0, y: 0};
  else {
    const decay = Math.exp(-3 * Math.max(0, (performance.now() - drag.time) / 1000 - .05));
    velocity.x *= decay; velocity.y *= decay;
  }
  releaseDrag(); schedule();
}
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) stage.addEventListener(event, endDrag);
stage.addEventListener('keydown', event => {
  const delta = {ArrowLeft: [0, -12], ArrowRight: [0, 12], ArrowUp: [-12, 0], ArrowDown: [12, 0]}[event.key];
  if (!delta || !model || arriving) return;
  event.preventDefault(); stop(); velocity = {x: 0, y: 0};
  pose.rx = Math.max(-75, Math.min(75, pose.rx + delta[0])); pose.ry += delta[1]; draw();
});
const resize = new ResizeObserver(() => { if (active()) model?.resize(); }); resize.observe(stage);
const observer = new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  if (visible) { if (eligible()) { load(); model?.resize(); schedule(); } }
  else { stop(); releaseDrag(); velocity = {x: 0, y: 0}; }
}); observer.observe(stage);
function visibility() {
  if (document.hidden) { stop(); releaseDrag(); velocity = {x: 0, y: 0}; }
  else { model?.resize(); schedule(); }
}
document.addEventListener('visibilitychange', visibility);
function eligibility() { if (eligible()) load(); else reset(); }
desktop.addEventListener('change', eligibility); touch.addEventListener('change', eligibility);
motion.addEventListener('change', () => {
  if (motion.matches) {
    stop(); arriving = false; velocity = {x: 0, y: 0};
    pose.y = 0; if (model) { arrival.dataset.state = 'ready'; draw(); }
  }
});
window.addEventListener('pagehide', event => {
  stop(); releaseDrag();
  if (!event.persisted) { destroyed = true; reset(); resize.disconnect(); observer.disconnect(); }
});
window.addEventListener('pageshow', () => { model?.resize(); schedule(); });
// Mobile/tablet clients never import the renderer, Three.js, decoder or model.
eligibility();
